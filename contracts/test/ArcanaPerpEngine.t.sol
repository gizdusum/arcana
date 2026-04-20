// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ArcanaPerpEngine.sol";
import "../src/ArcanaOracle.sol";
import "../src/ArcanaPositionManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal USDC-like ERC-20 mock with 6 decimals
contract MockUSDC6 is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Thin wrapper so the test contract can act as the vault
contract VaultProxy {
    ArcanaPerpEngine public engine;

    constructor(address _engine) {
        engine = ArcanaPerpEngine(_engine);
    }

    function open(
        address vault,
        bytes32 market,
        bool isLong,
        uint256 collateral,
        uint8 leverage
    ) external returns (uint256) {
        return engine.openPosition(vault, market, isLong, collateral, leverage);
    }

    function close(uint256 posId) external returns (int256) {
        return engine.closePosition(posId);
    }
}

contract ArcanaPerpEngineTest is Test {
    // ─── Contracts ───────────────────────────────────────────────────────────
    MockUSDC6 usdc;
    ArcanaOracle oracle;
    ArcanaPositionManager posManager;
    ArcanaPerpEngine engine;

    // ─── Actors ──────────────────────────────────────────────────────────────
    address owner = address(this);
    address vault = makeAddr("vault");      // simulated vault
    address liquidator = makeAddr("liquidator");

    // ─── Constants ───────────────────────────────────────────────────────────
    bytes32 constant BTC_USD = keccak256("BTC/USD");
    bytes32 constant ETH_USD = keccak256("ETH/USD");

    // Prices in 8 decimals (Chainlink format)
    int256 constant BTC_PRICE = 9_500_000_000_000; // $95,000
    int256 constant ETH_PRICE = 320_000_000_000;   // $3,200

    uint256 constant USDC_UNIT = 1e6;

    // ─── Setup ───────────────────────────────────────────────────────────────

    function setUp() public {
        usdc = new MockUSDC6();
        oracle = new ArcanaOracle();
        posManager = new ArcanaPositionManager();

        oracle.setMockMode(true);
        oracle.updateMockPrice(BTC_USD, BTC_PRICE);
        oracle.updateMockPrice(ETH_USD, ETH_PRICE);

        engine = new ArcanaPerpEngine(
            address(oracle),
            address(posManager),
            address(usdc)
        );
        posManager.setEngine(address(engine));
        engine.setVault(vault);

        // Give vault USDC to use as collateral
        usdc.mint(vault, 100_000 * USDC_UNIT);

        // Vault pre-approves engine
        vm.prank(vault);
        usdc.approve(address(engine), type(uint256).max);

        // Seed engine with a liquidity buffer so it can pay out winning positions
        // (simulates the insurance fund / fee accumulation)
        usdc.mint(address(this), 100_000 * USDC_UNIT);
        usdc.approve(address(engine), 100_000 * USDC_UNIT);
        engine.addLiquidity(100_000 * USDC_UNIT);
    }

    // ─── Helper: open a position as vault ────────────────────────────────────
    function _openLong(uint256 collateral, uint8 leverage) internal returns (uint256) {
        vm.prank(vault);
        return engine.openPosition(vault, BTC_USD, true, collateral, leverage);
    }

    function _openShort(uint256 collateral, uint8 leverage) internal returns (uint256) {
        vm.prank(vault);
        return engine.openPosition(vault, BTC_USD, false, collateral, leverage);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Open Long Position
    // ─────────────────────────────────────────────────────────────────────────

    function test_OpenLongPosition_StoresCorrectData() public {
        uint256 collateral = 1_000 * USDC_UNIT;
        uint8 leverage = 2;

        uint256 posId = _openLong(collateral, leverage);

        (
            uint256 id,
            address posVault,
            bytes32 market,
            bool isLong,
            uint256 size,
            uint256 entryPrice,
            uint8 lev,
            uint256 col,
            ,
            bool isOpen,
        ) = engine.positions(posId);

        assertEq(id, posId);
        assertEq(posVault, vault);
        assertEq(market, BTC_USD);
        assertTrue(isLong);
        assertEq(size, collateral * leverage);
        assertEq(entryPrice, uint256(BTC_PRICE));
        assertEq(lev, leverage);
        assertEq(col, collateral);
        assertTrue(isOpen);
    }

    function test_OpenLongPosition_TransfersCollateral() public {
        uint256 collateral = 1_000 * USDC_UNIT;
        uint256 vaultBefore = usdc.balanceOf(vault);
        uint256 engineBefore = usdc.balanceOf(address(engine));

        _openLong(collateral, 3);

        assertEq(usdc.balanceOf(vault), vaultBefore - collateral);
        assertEq(usdc.balanceOf(address(engine)), engineBefore + collateral);
    }

    function test_OpenLongPosition_EmitsEvent() public {
        uint256 collateral = 500 * USDC_UNIT;
        uint8 leverage = 5;

        vm.expectEmit(true, false, false, true);
        emit ArcanaPerpEngine.PositionOpened(
            0, // nextPositionId starts at 0
            vault,
            BTC_USD,
            true,
            collateral * leverage,
            leverage,
            uint256(BTC_PRICE)
        );

        vm.prank(vault);
        engine.openPosition(vault, BTC_USD, true, collateral, leverage);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Open Short Position
    // ─────────────────────────────────────────────────────────────────────────

    function test_OpenShortPosition_StoresCorrectData() public {
        uint256 collateral = 2_000 * USDC_UNIT;
        uint8 leverage = 3;

        uint256 posId = _openShort(collateral, leverage);

        (, , , bool isLong, uint256 size, , , , , bool isOpen, ) = engine.positions(posId);

        assertFalse(isLong, "Should be short");
        assertEq(size, collateral * leverage);
        assertTrue(isOpen);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unrealized PnL
    // ─────────────────────────────────────────────────────────────────────────

    function test_UnrealizedPnL_ZeroAtEntry() public {
        uint256 posId = _openLong(1_000 * USDC_UNIT, 2);
        int256 pnl = engine.getUnrealizedPnL(posId);
        assertEq(pnl, 0, "PnL should be zero at entry price");
    }

    function test_UnrealizedPnL_PositiveLong_PriceUp() public {
        uint256 collateral = 1_000 * USDC_UNIT;
        uint8 leverage = 2;
        uint256 posId = _openLong(collateral, leverage);

        // Price increases 10%: $95,000 → $104,500
        int256 newPrice = (BTC_PRICE * 110) / 100;
        oracle.updateMockPrice(BTC_USD, newPrice);

        int256 pnl = engine.getUnrealizedPnL(posId);
        assertGt(pnl, 0, "Long PnL should be positive when price rises");

        // Expected: priceDelta * size / entryPrice
        // priceDelta = newPrice - BTC_PRICE = BTC_PRICE * 0.10
        // size = 2_000_000 (collateral * leverage, 6 dec)
        // pnl = (BTC_PRICE * 0.10 * 2_000_000) / BTC_PRICE = 0.10 * 2_000_000 = 200_000
        uint256 expectedPnl = (collateral * leverage * 10) / 100; // 10% of size
        assertEq(uint256(pnl), expectedPnl, "PnL mismatch for 10% price increase");
    }

    function test_UnrealizedPnL_NegativeLong_PriceDown() public {
        uint256 collateral = 1_000 * USDC_UNIT;
        uint8 leverage = 2;
        uint256 posId = _openLong(collateral, leverage);

        // Price drops 5%
        int256 newPrice = (BTC_PRICE * 95) / 100;
        oracle.updateMockPrice(BTC_USD, newPrice);

        int256 pnl = engine.getUnrealizedPnL(posId);
        assertLt(pnl, 0, "Long PnL should be negative when price falls");
    }

    function test_UnrealizedPnL_PositiveShort_PriceDown() public {
        uint256 collateral = 1_000 * USDC_UNIT;
        uint8 leverage = 2;
        uint256 posId = _openShort(collateral, leverage);

        // Price drops 10%
        int256 newPrice = (BTC_PRICE * 90) / 100;
        oracle.updateMockPrice(BTC_USD, newPrice);

        int256 pnl = engine.getUnrealizedPnL(posId);
        assertGt(pnl, 0, "Short PnL should be positive when price falls");

        uint256 expectedPnl = (collateral * leverage * 10) / 100;
        assertEq(uint256(pnl), expectedPnl);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Close Position — Positive PnL (returns collateral + profit)
    // ─────────────────────────────────────────────────────────────────────────

    function test_ClosePosition_PositivePnL() public {
        uint256 collateral = 1_000 * USDC_UNIT;
        uint8 leverage = 2;
        uint256 posId = _openLong(collateral, leverage);

        // Price rises 10%
        int256 newPrice = (BTC_PRICE * 110) / 100;
        oracle.updateMockPrice(BTC_USD, newPrice);

        uint256 vaultBefore = usdc.balanceOf(vault);

        vm.prank(vault);
        int256 pnl = engine.closePosition(posId);

        uint256 vaultAfter = usdc.balanceOf(vault);
        uint256 received = vaultAfter - vaultBefore;

        // Should receive collateral + profit
        assertGt(pnl, 0, "PnL should be positive");
        assertGt(received, collateral, "Should receive more than collateral");
        assertEq(uint256(int256(collateral) + pnl), received, "Settlement mismatch");

        // Position should be marked closed
        (, , , , , , , , , bool isOpen, ) = engine.positions(posId);
        assertFalse(isOpen, "Position should be closed");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Close Position — Negative PnL (returns collateral minus loss)
    // ─────────────────────────────────────────────────────────────────────────

    function test_ClosePosition_NegativePnL() public {
        uint256 collateral = 1_000 * USDC_UNIT;
        uint8 leverage = 2;
        uint256 posId = _openLong(collateral, leverage);

        // Price drops 5% (not enough to liquidate, 80% threshold)
        int256 newPrice = (BTC_PRICE * 95) / 100;
        oracle.updateMockPrice(BTC_USD, newPrice);

        uint256 vaultBefore = usdc.balanceOf(vault);

        vm.prank(vault);
        int256 pnl = engine.closePosition(posId);

        uint256 vaultAfter = usdc.balanceOf(vault);
        uint256 received = vaultAfter - vaultBefore;

        // 5% loss on 2x size = 10% of collateral
        uint256 expectedLoss = (collateral * leverage * 5) / 100;
        assertLt(pnl, 0, "PnL should be negative");
        assertEq(received, collateral - expectedLoss, "Should receive collateral minus loss");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Liquidation
    // ─────────────────────────────────────────────────────────────────────────

    function test_IsLiquidatable_ReturnsFalse_WhenHealthy() public {
        uint256 posId = _openLong(1_000 * USDC_UNIT, 2);
        assertFalse(engine.isLiquidatable(posId), "Should not be liquidatable at entry");
    }

    function test_IsLiquidatable_ReturnsTrue_WhenUnhealthy() public {
        uint256 collateral = 1_000 * USDC_UNIT;
        uint8 leverage = 2;
        uint256 posId = _openLong(collateral, leverage);

        // Loss > 80% of collateral: need price drop of > 40% of size → 40% price drop
        // size = 2_000_000, 80% of collateral = 800_000
        // pnl = priceDelta * size / entryPrice
        // 800_000 = priceDelta * 2_000_000 / BTC_PRICE → priceDelta = 800_000 * BTC_PRICE / 2_000_000
        // As % of entry: 800_000 / 2_000_000 = 40%
        // So a 41% price drop causes > 80% collateral loss
        int256 newPrice = (BTC_PRICE * 59) / 100; // 41% drop
        oracle.updateMockPrice(BTC_USD, newPrice);

        assertTrue(engine.isLiquidatable(posId), "Should be liquidatable");
    }

    function test_Liquidate_TransfersBonusToLiquidator() public {
        uint256 collateral = 1_000 * USDC_UNIT;
        uint256 posId = _openLong(collateral, 2);

        // 41% price drop → liquidatable
        oracle.updateMockPrice(BTC_USD, (BTC_PRICE * 59) / 100);

        uint256 liquidatorBefore = usdc.balanceOf(liquidator);

        vm.prank(liquidator);
        engine.liquidate(posId);

        uint256 liquidatorAfter = usdc.balanceOf(liquidator);
        assertGt(liquidatorAfter, liquidatorBefore, "Liquidator should receive bonus");
    }

    function test_Liquidate_MarksPositionClosed() public {
        uint256 posId = _openLong(1_000 * USDC_UNIT, 2);
        oracle.updateMockPrice(BTC_USD, (BTC_PRICE * 59) / 100);

        vm.prank(liquidator);
        engine.liquidate(posId);

        (, , , , , , , , , bool isOpen, ) = engine.positions(posId);
        assertFalse(isOpen, "Position should be marked closed after liquidation");
    }

    function test_Liquidate_Reverts_WhenNotLiquidatable() public {
        uint256 posId = _openLong(1_000 * USDC_UNIT, 2);
        // Price slightly down, not past threshold
        oracle.updateMockPrice(BTC_USD, (BTC_PRICE * 95) / 100);

        vm.prank(liquidator);
        vm.expectRevert("Not liquidatable");
        engine.liquidate(posId);
    }

    function test_Liquidate_EmitsEvent() public {
        uint256 posId = _openLong(1_000 * USDC_UNIT, 2);
        oracle.updateMockPrice(BTC_USD, (BTC_PRICE * 59) / 100);

        vm.expectEmit(true, false, false, false);
        emit ArcanaPerpEngine.PositionLiquidated(posId, liquidator, 0);

        vm.prank(liquidator);
        engine.liquidate(posId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Funding Rate
    // ─────────────────────────────────────────────────────────────────────────

    function test_FundingRate_Accrues_ForLongPosition() public {
        uint256 posId = _openLong(1_000 * USDC_UNIT, 2);

        (, , , , , , , , , , int256 fundingBefore) = engine.positions(posId);
        assertEq(fundingBefore, 0, "Funding should start at zero");

        // Advance 1 hour
        vm.warp(block.timestamp + 1 hours);

        engine.applyFunding(posId);

        (, , , , , , , , , , int256 fundingAfter) = engine.positions(posId);
        assertLt(fundingAfter, 0, "Long position should pay funding (negative accrual)");
    }

    function test_FundingRate_Accrues_ForShortPosition() public {
        uint256 posId = _openShort(1_000 * USDC_UNIT, 2);

        vm.warp(block.timestamp + 1 hours);
        engine.applyFunding(posId);

        (, , , , , , , , , , int256 fundingAfter) = engine.positions(posId);
        assertGt(fundingAfter, 0, "Short position should receive funding (positive accrual)");
    }

    function test_FundingRate_DoubleApply_ResetsClock() public {
        uint256 posId = _openLong(1_000 * USDC_UNIT, 2);

        vm.warp(block.timestamp + 1 hours);
        engine.applyFunding(posId);

        (, , , , , , , , , , int256 fundingAfterFirst) = engine.positions(posId);

        // Apply again immediately — should add zero additional funding
        engine.applyFunding(posId);

        (, , , , , , , , , , int256 fundingAfterSecond) = engine.positions(posId);
        assertEq(fundingAfterFirst, fundingAfterSecond, "Immediate re-apply should not change funding");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getVaultOpenPositions
    // ─────────────────────────────────────────────────────────────────────────

    function test_GetVaultOpenPositions_Empty() public view {
        uint256[] memory openPos = engine.getVaultOpenPositions(vault);
        assertEq(openPos.length, 0);
    }

    function test_GetVaultOpenPositions_AfterOpen() public {
        uint256 posId = _openLong(1_000 * USDC_UNIT, 2);
        uint256[] memory openPos = engine.getVaultOpenPositions(vault);
        assertEq(openPos.length, 1);
        assertEq(openPos[0], posId);
    }

    function test_GetVaultOpenPositions_AfterClose() public {
        uint256 posId = _openLong(1_000 * USDC_UNIT, 2);

        vm.prank(vault);
        engine.closePosition(posId);

        uint256[] memory openPos = engine.getVaultOpenPositions(vault);
        assertEq(openPos.length, 0, "No open positions after close");
    }

    function test_GetVaultOpenPositions_MultiplePositions() public {
        _openLong(500 * USDC_UNIT, 2);
        _openShort(500 * USDC_UNIT, 3);
        _openLong(500 * USDC_UNIT, 1);

        uint256[] memory openPos = engine.getVaultOpenPositions(vault);
        assertEq(openPos.length, 3);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Access Control
    // ─────────────────────────────────────────────────────────────────────────

    function test_OpenPosition_RevertsForNonVault() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert("Only vault");
        engine.openPosition(vault, BTC_USD, true, 100 * USDC_UNIT, 2);
    }

    function test_ClosePosition_RevertsForNonVault() public {
        uint256 posId = _openLong(1_000 * USDC_UNIT, 2);

        vm.prank(makeAddr("random"));
        vm.expectRevert("Only vault");
        engine.closePosition(posId);
    }

    function test_SetVault_OnlyOwner() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert();
        engine.setVault(makeAddr("newVault"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Edge cases
    // ─────────────────────────────────────────────────────────────────────────

    function test_OpenPosition_ZeroCollateral_Reverts() public {
        vm.prank(vault);
        vm.expectRevert("Zero collateral");
        engine.openPosition(vault, BTC_USD, true, 0, 2);
    }

    function test_OpenPosition_ZeroLeverage_Reverts() public {
        vm.prank(vault);
        vm.expectRevert("Bad leverage");
        engine.openPosition(vault, BTC_USD, true, 100 * USDC_UNIT, 0);
    }

    function test_OpenPosition_ExcessiveLeverage_Reverts() public {
        vm.prank(vault);
        vm.expectRevert("Bad leverage");
        engine.openPosition(vault, BTC_USD, true, 100 * USDC_UNIT, 11);
    }

    function test_ClosePosition_Twice_Reverts() public {
        uint256 posId = _openLong(1_000 * USDC_UNIT, 2);

        vm.prank(vault);
        engine.closePosition(posId);

        vm.prank(vault);
        vm.expectRevert("Position not open");
        engine.closePosition(posId);
    }

    function test_PositionId_Increments() public {
        uint256 id0 = _openLong(100 * USDC_UNIT, 1);
        uint256 id1 = _openLong(100 * USDC_UNIT, 1);
        uint256 id2 = _openShort(100 * USDC_UNIT, 1);

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
    }
}
