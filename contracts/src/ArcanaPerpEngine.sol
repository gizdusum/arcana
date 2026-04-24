// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ArcanaOracle.sol";
import "./ArcanaPositionManager.sol";

/// @title ArcanaPerpEngine
/// @notice Perpetual futures engine for the ARCANA protocol.
///         USDC has 6 decimals; Chainlink prices have 8 decimals.
///         PnL formula: priceDelta(8dec) * size(6dec) / entryPrice(8dec) = result(6dec)
contract ArcanaPerpEngine is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    // Structs & State
    // ─────────────────────────────────────────────────────────────────────────

    struct Position {
        uint256 id;
        address vault;
        bytes32 market;
        bool isLong;
        uint256 size;          // USDC notional (6 decimals)
        uint256 entryPrice;    // 8 decimals (Chainlink format)
        uint8 leverage;
        uint256 collateral;    // USDC margin (6 decimals)
        uint256 openedAt;
        bool isOpen;
        int256 fundingAccrued; // USDC accrued funding (6 decimals, may be negative)
    }

    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public vaultPositions;

    uint256 public nextPositionId;
    uint256 public fundingRatePerHour = 1e14; // 0.01% per hour (scaled to 1e18)

    ArcanaOracle public oracle;
    ArcanaPositionManager public posManager;
    IERC20 public usdc;
    address public vaultContract;

    /// @dev Loss beyond 80% of collateral triggers liquidation
    uint256 public constant LIQUIDATION_THRESHOLD = 8000; // BPS (80%)
    uint256 public constant LIQUIDATION_BONUS = 500;      // 5% bonus to liquidator
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event PositionOpened(
        uint256 indexed id,
        address vault,
        bytes32 market,
        bool isLong,
        uint256 size,
        uint8 leverage,
        uint256 entryPrice
    );
    event PositionClosed(uint256 indexed id, int256 pnl, uint256 exitPrice);
    event PositionLiquidated(uint256 indexed id, address liquidator, int256 pnl);
    event FundingApplied(uint256 indexed id, int256 fundingAmount);
    event VaultSet(address vault);
    event FundingRateUpdated(uint256 newRate);

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyVault() {
        require(msg.sender == vaultContract, "Only vault");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        address _oracle,
        address _posManager,
        address _usdc
    ) Ownable(msg.sender) {
        require(_oracle != address(0), "Invalid oracle");
        require(_posManager != address(0), "Invalid pos manager");
        require(_usdc != address(0), "Invalid USDC");
        oracle = ArcanaOracle(_oracle);
        posManager = ArcanaPositionManager(_posManager);
        usdc = IERC20(_usdc);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Invalid vault");
        vaultContract = _vault;
        emit VaultSet(_vault);
    }

    /// @notice Add liquidity to the engine's insurance/counterparty fund.
    ///         In production this is funded by protocol fees and LP deposits.
    function addLiquidity(uint256 amount) external {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }

    function setFundingRate(uint256 _ratePerHour) external onlyOwner {
        fundingRatePerHour = _ratePerHour;
        emit FundingRateUpdated(_ratePerHour);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core: Open Position
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Open a leveraged position.
    /// @param vault        The vault address that owns this position.
    /// @param market       keccak256 market identifier (e.g. keccak256("BTC/USD")).
    /// @param isLong       Direction of the position.
    /// @param collateral   USDC margin amount transferred FROM vault (6 decimals).
    /// @param leverage     Leverage multiplier (1–10).
    /// @return positionId  The newly assigned position ID.
    function openPosition(
        address vault,
        bytes32 market,
        bool isLong,
        uint256 collateral,
        uint8 leverage
    ) external onlyVault nonReentrant returns (uint256) {
        require(collateral > 0, "Zero collateral");
        require(leverage >= 1 && leverage <= 10, "Bad leverage");

        // Collateral is pushed by the vault via safeTransfer before this call.
        // No transferFrom needed — avoids contract-to-contract approve issues on Arc Testnet.

        // Calculate notional size: collateral * leverage
        uint256 size = collateral * leverage;

        // Fetch current price
        int256 priceRaw = oracle.getPrice(market);
        require(priceRaw > 0, "Invalid price");
        uint256 entryPrice = uint256(priceRaw);

        uint256 posId = nextPositionId++;

        positions[posId] = Position({
            id: posId,
            vault: vault,
            market: market,
            isLong: isLong,
            size: size,
            entryPrice: entryPrice,
            leverage: leverage,
            collateral: collateral,
            openedAt: block.timestamp,
            isOpen: true,
            fundingAccrued: 0
        });

        vaultPositions[vault].push(posId);
        posManager.registerPosition(vault, posId);

        emit PositionOpened(posId, vault, market, isLong, size, leverage, entryPrice);

        return posId;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core: Close Position
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Close an open position and settle PnL back to the vault.
    /// @param positionId  The ID of the position to close.
    /// @return pnl        Realized PnL in USDC (6 decimals, can be negative).
    function closePosition(uint256 positionId)
        external
        onlyVault
        nonReentrant
        returns (int256 pnl)
    {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Position not open");
        require(pos.vault == msg.sender, "Not your position");

        // Apply any outstanding funding
        _applyFunding(positionId);

        pnl = _calculateUnrealizedPnL(positionId);
        uint256 exitPrice = uint256(oracle.getPrice(pos.market));

        pos.isOpen = false;
        posManager.closePosition(positionId);

        // Settle: collateral + pnl back to vault
        // pnl can be negative, but collateral is always owed (subject to losses)
        int256 collateral = int256(pos.collateral);
        int256 settlement = collateral + pnl + pos.fundingAccrued;

        if (settlement > 0) {
            usdc.safeTransfer(pos.vault, uint256(settlement));
        }
        // If settlement <= 0, vault receives nothing (all margin lost)

        emit PositionClosed(positionId, pnl, exitPrice);
        return pnl;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core: Liquidation
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Liquidate an unhealthy position. Anyone may call this.
    ///         The liquidator receives a 5% bonus from the remaining collateral.
    function liquidate(uint256 positionId)
        external
        nonReentrant
        returns (int256)
    {
        require(isLiquidatable(positionId), "Not liquidatable");

        Position storage pos = positions[positionId];
        require(pos.isOpen, "Position not open");

        _applyFunding(positionId);

        int256 pnl = _calculateUnrealizedPnL(positionId);
        uint256 exitPrice = uint256(oracle.getPrice(pos.market));

        pos.isOpen = false;
        posManager.closePosition(positionId);

        int256 collateral = int256(pos.collateral);
        int256 remaining = collateral + pnl + pos.fundingAccrued;

        uint256 bonus = 0;
        if (remaining > 0) {
            bonus = (uint256(remaining) * LIQUIDATION_BONUS) / BPS_DENOMINATOR;
            uint256 afterBonus = uint256(remaining) - bonus;
            // Return remaining collateral minus bonus to vault
            if (afterBonus > 0) {
                usdc.safeTransfer(pos.vault, afterBonus);
            }
            // Pay bonus to liquidator
            usdc.safeTransfer(msg.sender, bonus);
        }
        // If remaining <= 0, vault and liquidator receive nothing

        emit PositionLiquidated(positionId, msg.sender, pnl);
        return pnl;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View: PnL
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Calculate unrealized PnL for an open position.
    ///         Formula: priceDelta(8dec) * size(6dec) / entryPrice(8dec) = result(6dec)
    function getUnrealizedPnL(uint256 positionId) public view returns (int256) {
        return _calculateUnrealizedPnL(positionId);
    }

    function _calculateUnrealizedPnL(uint256 positionId) internal view returns (int256) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) return 0;

        int256 currentPrice = oracle.getPrice(pos.market);
        int256 entryPrice = int256(pos.entryPrice);
        int256 size = int256(pos.size);

        // priceDelta = currentPrice - entryPrice (both 8 decimals)
        int256 priceDelta = currentPrice - entryPrice;

        // pnl = priceDelta * size / entryPrice
        // All in 6-decimal USDC result because:
        //   (8dec delta) * (6dec size) / (8dec entryPrice) = 6dec
        int256 pnl;
        if (pos.isLong) {
            pnl = (priceDelta * size) / entryPrice;
        } else {
            // Short: profit when price falls
            pnl = (-priceDelta * size) / entryPrice;
        }

        return pnl;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View: Liquidation Check
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns true if position losses exceed 80% of collateral.
    function isLiquidatable(uint256 positionId) public view returns (bool) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) return false;

        int256 pnl = _calculateUnrealizedPnL(positionId);
        // If pnl is positive, position is healthy
        if (pnl >= 0) return false;

        uint256 loss = uint256(-pnl);
        uint256 threshold = (pos.collateral * LIQUIDATION_THRESHOLD) / BPS_DENOMINATOR;

        return loss >= threshold;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View: Vault Open Positions
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns all currently open position IDs for a vault.
    function getVaultOpenPositions(address vault)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] storage all = vaultPositions[vault];
        uint256 count = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (positions[all[i]].isOpen) count++;
        }
        uint256[] memory open = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (positions[all[i]].isOpen) {
                open[idx++] = all[i];
            }
        }
        return open;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Funding
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Apply funding rate accrual to a position. Public so it can be called periodically.
    function applyFunding(uint256 positionId) public {
        _applyFunding(positionId);
    }

    function _applyFunding(uint256 positionId) internal {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) return;

        uint256 elapsed = block.timestamp - pos.openedAt;
        if (elapsed == 0) return;

        // fundingRatePerHour is scaled to 1e18 (e.g. 1e14 = 0.01% per hour)
        // funding = size * fundingRatePerHour * hoursElapsed / 1e18
        // We use seconds: funding = size * fundingRatePerHour * elapsed / (3600 * 1e18)
        int256 funding = int256(
            (pos.size * fundingRatePerHour * elapsed) / (3600 * 1e18)
        );

        // Longs pay funding, shorts receive it (simplified model)
        if (pos.isLong) {
            pos.fundingAccrued -= funding;
        } else {
            pos.fundingAccrued += funding;
        }

        // Reset openedAt to prevent double-counting on subsequent calls
        pos.openedAt = block.timestamp;

        emit FundingApplied(positionId, funding);
    }
}
