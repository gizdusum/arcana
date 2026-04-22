// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ArcanaVault.sol";
import "../src/ArcanaPerpEngine.sol";
import "../src/ArcanaOracle.sol";
import "../src/ArcanaStrategy.sol";
import "../src/ArcanaPositionManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal ERC-20 mock with 6 decimals (USDC-like)
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ArcanaVaultTest is Test {
    // ─── Contracts ───────────────────────────────────────────────────────────
    MockUSDC usdc;
    ArcanaOracle oracle;
    ArcanaStrategy strategy;
    ArcanaPositionManager posManager;
    ArcanaPerpEngine perpEngine;
    ArcanaVault vault;

    // ─── Actors ──────────────────────────────────────────────────────────────
    address owner = address(this);
    address hermes = makeAddr("hermes");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    // ─── Constants ───────────────────────────────────────────────────────────
    bytes32 constant BTC_USD = keccak256("BTC/USD");
    int256 constant BTC_PRICE = 9_500_000_000_000; // $95,000 in 8 dec
    uint256 constant USDC_DECIMALS = 1e6;

    // ─── Setup ───────────────────────────────────────────────────────────────

    function setUp() public {
        usdc = new MockUSDC();
        oracle = new ArcanaOracle();
        strategy = new ArcanaStrategy();
        posManager = new ArcanaPositionManager();

        oracle.setMockMode(true);
        oracle.updateMockPrice(BTC_USD, BTC_PRICE);

        perpEngine = new ArcanaPerpEngine(
            address(oracle),
            address(posManager),
            address(usdc)
        );
        posManager.setEngine(address(perpEngine));

        vault = new ArcanaVault(
            IERC20(address(usdc)),
            address(perpEngine),
            address(strategy),
            hermes,
            ArcanaStrategy.StrategyType.ATLAS
        );

        perpEngine.setVault(address(vault));
        oracle.setHermesAgent(hermes);

        // Fund actors
        usdc.mint(alice, 10_000 * USDC_DECIMALS);
        usdc.mint(bob, 10_000 * USDC_DECIMALS);
        usdc.mint(hermes, 1_000 * USDC_DECIMALS);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Deposit / Shares (ERC-4626)
    // ─────────────────────────────────────────────────────────────────────────

    function test_DepositReceivesShares() public {
        uint256 depositAmount = 1_000 * USDC_DECIMALS;

        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmount);
        uint256 shares = vault.deposit(depositAmount, alice);
        vm.stopPrank();

        assertGt(shares, 0, "Should receive shares");
        assertEq(vault.balanceOf(alice), shares, "Share balance mismatch");
        assertEq(usdc.balanceOf(address(vault)), depositAmount, "Vault USDC balance mismatch");
    }

    function test_DepositAndTotalAssets() public {
        uint256 depositAmount = 5_000 * USDC_DECIMALS;

        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmount);
        vault.deposit(depositAmount, alice);
        vm.stopPrank();

        assertEq(vault.totalAssets(), depositAmount, "totalAssets should equal deposited USDC");
    }

    function test_MultipleDepositors() public {
        uint256 aliceDeposit = 1_000 * USDC_DECIMALS;
        uint256 bobDeposit = 2_000 * USDC_DECIMALS;

        vm.prank(alice);
        usdc.approve(address(vault), aliceDeposit);
        vm.prank(alice);
        vault.deposit(aliceDeposit, alice);

        vm.prank(bob);
        usdc.approve(address(vault), bobDeposit);
        vm.prank(bob);
        vault.deposit(bobDeposit, bob);

        assertEq(
            vault.totalAssets(),
            aliceDeposit + bobDeposit,
            "totalAssets should be sum of all deposits"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Withdrawal with 24-hour delay
    // ─────────────────────────────────────────────────────────────────────────

    function test_RequestWithdrawLocksShares() public {
        uint256 depositAmount = 1_000 * USDC_DECIMALS;

        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmount);
        uint256 shares = vault.deposit(depositAmount, alice);

        vault.requestWithdraw(shares);
        vm.stopPrank();

        // Shares should be transferred to vault (escrow)
        assertEq(vault.balanceOf(alice), 0, "Alice shares should be escrowed");
        assertEq(vault.pendingWithdrawShares(alice), shares, "Pending shares not set");
        assertEq(
            vault.withdrawalRequestedAt(alice),
            block.timestamp,
            "Withdrawal timestamp not set"
        );
    }

    function test_CompleteWithdrawFails_BeforeDelay() public {
        uint256 depositAmount = 1_000 * USDC_DECIMALS;

        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmount);
        uint256 shares = vault.deposit(depositAmount, alice);
        vault.requestWithdraw(shares);

        vm.expectRevert("Withdrawal delay not passed");
        vault.completeWithdraw();
        vm.stopPrank();
    }

    function test_CompleteWithdrawSucceeds_AfterDelay() public {
        uint256 depositAmount = 1_000 * USDC_DECIMALS;

        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmount);
        uint256 shares = vault.deposit(depositAmount, alice);
        vault.requestWithdraw(shares);
        vm.stopPrank();

        // Fast-forward 24 hours
        vm.warp(block.timestamp + 24 hours + 1);

        uint256 aliceBalanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        vault.completeWithdraw();

        uint256 aliceBalanceAfter = usdc.balanceOf(alice);
        assertEq(
            aliceBalanceAfter - aliceBalanceBefore,
            depositAmount,
            "Alice should receive full deposit back"
        );
        assertEq(vault.pendingWithdrawShares(alice), 0, "Pending shares not cleared");
    }

    function test_CannotWithdrawTwice() public {
        uint256 depositAmount = 1_000 * USDC_DECIMALS;

        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmount);
        uint256 shares = vault.deposit(depositAmount, alice);
        vault.requestWithdraw(shares);
        vm.stopPrank();

        vm.warp(block.timestamp + 25 hours);

        vm.prank(alice);
        vault.completeWithdraw();

        // Second withdrawal attempt
        vm.prank(alice);
        vm.expectRevert("No pending withdrawal");
        vault.completeWithdraw();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HERMES access control
    // ─────────────────────────────────────────────────────────────────────────

    function test_OnlyHermesCanExecuteOpen() public {
        // Deposit first
        vm.prank(alice);
        usdc.approve(address(vault), 5_000 * USDC_DECIMALS);
        vm.prank(alice);
        vault.deposit(5_000 * USDC_DECIMALS, alice);

        // Alice tries to call executeOpen — should fail
        vm.prank(alice);
        vm.expectRevert("Only HERMES");
        vault.executeOpen(BTC_USD, true, 100 * USDC_DECIMALS, 2);
    }

    function test_OnlyHermesCanExecuteClose() public {
        // Deposit first
        vm.prank(alice);
        usdc.approve(address(vault), 5_000 * USDC_DECIMALS);
        vm.prank(alice);
        vault.deposit(5_000 * USDC_DECIMALS, alice);

        // HERMES opens a position
        vm.prank(hermes);
        uint256 posId = vault.executeOpen(BTC_USD, true, 500 * USDC_DECIMALS, 2);

        // Alice tries to close — should fail
        vm.prank(alice);
        vm.expectRevert("Only HERMES");
        vault.executeClose(posId);
    }

    function test_HermesExecuteOpen_Success() public {
        uint256 depositAmount = 5_000 * USDC_DECIMALS;
        uint256 collateral = 500 * USDC_DECIMALS;

        vm.prank(alice);
        usdc.approve(address(vault), depositAmount);
        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        vm.prank(hermes);
        uint256 posId = vault.executeOpen(BTC_USD, true, collateral, 2);

        assertEq(vault.totalTradesExecuted(), 1, "Trade count should be 1");

        // Verify position stored in engine
        (uint256 id, , , bool isLong, uint256 size, , , , , bool isOpen, ) = perpEngine.positions(posId);
        assertEq(id, posId);
        assertTrue(isLong);
        assertEq(size, collateral * 2, "Size should be collateral * leverage");
        assertTrue(isOpen);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Strategy change
    // ─────────────────────────────────────────────────────────────────────────

    function test_StrategyChangeEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit ArcanaVault.StrategyChanged(
            hermes,
            ArcanaStrategy.StrategyType.ATLAS,
            ArcanaStrategy.StrategyType.ARES
        );

        vm.prank(hermes);
        vault.setStrategy(ArcanaStrategy.StrategyType.ARES);

        assertEq(
            uint8(vault.activeStrategy()),
            uint8(ArcanaStrategy.StrategyType.ARES),
            "Strategy not updated"
        );
    }

    function test_OnlyOwnerOrHermesCanChangeStrategy() public {
        vm.prank(alice);
        vm.expectRevert("Not authorized");
        vault.setStrategy(ArcanaStrategy.StrategyType.APOLLO);
    }

    function test_OwnerCanChangeStrategy() public {
        // owner = address(this) in this test
        vault.setStrategy(ArcanaStrategy.StrategyType.APOLLO);
        assertEq(
            uint8(vault.activeStrategy()),
            uint8(ArcanaStrategy.StrategyType.APOLLO)
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // totalAssets includes vault USDC balance
    // ─────────────────────────────────────────────────────────────────────────

    function test_TotalAssetsIncludesVaultBalance() public {
        uint256 deposit1 = 2_000 * USDC_DECIMALS;
        uint256 deposit2 = 3_000 * USDC_DECIMALS;

        vm.prank(alice);
        usdc.approve(address(vault), deposit1);
        vm.prank(alice);
        vault.deposit(deposit1, alice);

        vm.prank(bob);
        usdc.approve(address(vault), deposit2);
        vm.prank(bob);
        vault.deposit(deposit2, bob);

        assertEq(vault.totalAssets(), deposit1 + deposit2);
    }

    function test_TotalAssetsIncludesLockedCollateral() public {
        uint256 depositAmount = 5_000 * USDC_DECIMALS;
        uint256 collateral = 1_000 * USDC_DECIMALS;

        vm.prank(alice);
        usdc.approve(address(vault), depositAmount);
        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        vm.prank(hermes);
        vault.executeOpen(BTC_USD, true, collateral, 2);

        // totalAssets = remaining vault USDC + locked collateral + unrealized PnL
        // At exact entry price, PnL = 0, so total = depositAmount
        uint256 assets = vault.totalAssets();
        assertEq(assets, depositAmount, "totalAssets should equal deposit when PnL=0");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private vault
    // ─────────────────────────────────────────────────────────────────────────

    function test_PrivateVaultBlocksNonOwner() public {
        vault.setPrivate(true);

        vm.prank(alice);
        usdc.approve(address(vault), 1_000 * USDC_DECIMALS);

        vm.prank(alice);
        vm.expectRevert("Vault is private");
        vault.deposit(1_000 * USDC_DECIMALS, alice);
    }

    function test_PrivateVaultAllowsOwner() public {
        vault.setPrivate(true);

        usdc.mint(owner, 1_000 * USDC_DECIMALS);
        usdc.approve(address(vault), 1_000 * USDC_DECIMALS);
        uint256 shares = vault.deposit(1_000 * USDC_DECIMALS, owner);
        assertGt(shares, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HERMES logDecision
    // ─────────────────────────────────────────────────────────────────────────

    function test_LogDecision_EmitsEvent() public {
        string memory reasoning = "BTC momentum positive, opening long 2x";

        vm.expectEmit(false, false, false, true);
        emit ArcanaVault.HermesDecisionLogged(reasoning, block.timestamp);

        vm.prank(hermes);
        vault.logDecision(reasoning);
    }

    function test_LogDecision_OnlyHermes() public {
        vm.prank(alice);
        vm.expectRevert("Only HERMES");
        vault.logDecision("unauthorized");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // setHermesAgent
    // ─────────────────────────────────────────────────────────────────────────

    function test_SetHermesAgent() public {
        address newHermes = makeAddr("newHermes");
        vault.setHermesAgent(newHermes);
        assertEq(vault.hermesAgent(), newHermes);
    }

    function test_SetHermesAgent_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setHermesAgent(alice);
    }
}
