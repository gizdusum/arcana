// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ArcanaPerpEngine.sol";
import "./ArcanaStrategy.sol";

/// @title ArcanaVault
/// @notice ERC-4626 compliant vault for the ARCANA perpetual trading protocol.
///         HERMES (the AI agent) autonomously opens and closes leveraged positions
///         through the ArcanaPerpEngine. Users deposit USDC and receive aUSDC shares.
contract ArcanaVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    address public hermesAgent;
    ArcanaStrategy.StrategyType public activeStrategy;
    ArcanaPerpEngine public perpEngine;
    ArcanaStrategy public strategyRegistry;

    uint256 public constant WITHDRAWAL_DELAY = 0;
    mapping(address => uint256) public withdrawalRequestedAt;
    mapping(address => uint256) public pendingWithdrawShares;

    bool public isPrivate;
    uint256 public totalTradesExecuted;
    uint256 public lastHermesCycle;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event StrategyChanged(
        address indexed user,
        ArcanaStrategy.StrategyType from,
        ArcanaStrategy.StrategyType to
    );
    event HermesDecisionLogged(string reasoning, uint256 timestamp);
    event WithdrawalRequested(address indexed user, uint256 shares, uint256 availableAt);
    event WithdrawalCompleted(address indexed user, uint256 assets);
    event PositionExecuted(bytes32 market, bool isLong, uint256 positionId, uint8 leverage);
    event HermesAgentUpdated(address oldAgent, address newAgent);
    event PrivacyToggled(bool isPrivate);

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyHermes() {
        require(msg.sender == hermesAgent, "Only HERMES");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        IERC20 _usdc,
        address _perpEngine,
        address _strategyRegistry,
        address _hermesAgent,
        ArcanaStrategy.StrategyType _initialStrategy
    )
        ERC4626(_usdc)
        ERC20("ARCANA Vault Share", "aUSDC")
        Ownable(msg.sender)
    {
        require(_perpEngine != address(0), "Invalid perp engine");
        require(_strategyRegistry != address(0), "Invalid strategy registry");
        require(_hermesAgent != address(0), "Invalid hermes agent");

        perpEngine = ArcanaPerpEngine(_perpEngine);
        strategyRegistry = ArcanaStrategy(_strategyRegistry);
        hermesAgent = _hermesAgent;
        activeStrategy = _initialStrategy;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HERMES: Trade Execution
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice HERMES opens a leveraged position.
    ///         Vault approves the PerpEngine and passes collateral through.
    function executeOpen(
        bytes32 market,
        bool isLong,
        uint256 collateralAmount,
        uint8 leverage
    ) external onlyHermes returns (uint256 positionId) {
        require(collateralAmount > 0, "Zero collateral");
        require(leverage >= 1 && leverage <= 10, "Bad leverage");

        // Validate against active strategy config
        ArcanaStrategy.StrategyConfig memory config = strategyRegistry.getConfig(activeStrategy);
        require(!config.longOnly || isLong, "Strategy is long-only");
        require(leverage <= config.maxLeverage, "Exceeds max leverage");

        // Ensure sufficient USDC in vault
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        require(vaultBalance >= collateralAmount, "Insufficient vault balance");

        // Approve the exact amount to PerpEngine
        IERC20(asset()).forceApprove(address(perpEngine), collateralAmount);

        positionId = perpEngine.openPosition(
            address(this),
            market,
            isLong,
            collateralAmount,
            leverage
        );

        totalTradesExecuted++;
        lastHermesCycle = block.timestamp;

        emit PositionExecuted(market, isLong, positionId, leverage);
        return positionId;
    }

    /// @notice HERMES closes an open position and receives PnL settlement.
    function executeClose(uint256 positionId) external onlyHermes returns (int256 pnl) {
        pnl = perpEngine.closePosition(positionId);
        lastHermesCycle = block.timestamp;
        return pnl;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HERMES: Logging & Approve
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Log HERMES reasoning on-chain for transparency.
    function logDecision(string calldata reasoning) external onlyHermes {
        emit HermesDecisionLogged(reasoning, block.timestamp);
    }

    /// @notice Approve USDC spending to perp engine (for manual approval top-up if needed).
    function approveEngine(uint256 amount) external onlyHermes {
        IERC20(asset()).forceApprove(address(perpEngine), amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Strategy
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Change the active trading strategy.
    ///         May be called by the vault owner, the user (via their own vault), or HERMES.
    function setStrategy(ArcanaStrategy.StrategyType newStrategy) external {
        require(
            msg.sender == owner() || msg.sender == hermesAgent,
            "Not authorized"
        );
        ArcanaStrategy.StrategyType old = activeStrategy;
        activeStrategy = newStrategy;
        emit StrategyChanged(msg.sender, old, newStrategy);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Withdrawal (24-hour delayed)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Request a withdrawal. Shares are locked for 24 hours.
    function requestWithdraw(uint256 shares) external {
        require(shares > 0, "Zero shares");
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");

        // Transfer shares into escrow (this contract holds them during delay)
        _transfer(msg.sender, address(this), shares);

        pendingWithdrawShares[msg.sender] = shares;
        withdrawalRequestedAt[msg.sender] = block.timestamp;

        emit WithdrawalRequested(
            msg.sender,
            shares,
            block.timestamp + WITHDRAWAL_DELAY
        );
    }

    /// @notice Complete a withdrawal after the 24-hour delay has passed.
    function completeWithdraw() external nonReentrant {
        uint256 shares = pendingWithdrawShares[msg.sender];
        require(shares > 0, "No pending withdrawal");
        require(
            block.timestamp >= withdrawalRequestedAt[msg.sender] + WITHDRAWAL_DELAY,
            "Withdrawal delay not passed"
        );

        pendingWithdrawShares[msg.sender] = 0;
        withdrawalRequestedAt[msg.sender] = 0;

        // Burn the escrowed shares and return assets
        uint256 assets = previewRedeem(shares);

        // Burn the shares held by this contract
        _burn(address(this), shares);

        // Transfer USDC to user
        IERC20(asset()).safeTransfer(msg.sender, assets);

        emit WithdrawalCompleted(msg.sender, assets);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERC-4626: totalAssets
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice totalAssets = USDC held in vault + approximate unrealized PnL from open positions.
    function totalAssets() public view override returns (uint256) {
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));

        // Sum up unrealized PnL from all open positions
        uint256[] memory openPositions = perpEngine.getVaultOpenPositions(address(this));
        int256 unrealizedPnL = 0;
        for (uint256 i = 0; i < openPositions.length; i++) {
            unrealizedPnL += perpEngine.getUnrealizedPnL(openPositions[i]);
        }

        // Also account for collateral locked in the engine
        uint256 lockedCollateral = 0;
        for (uint256 i = 0; i < openPositions.length; i++) {
            (, , , , , , , uint256 collateral, , , ) = perpEngine.positions(openPositions[i]);
            lockedCollateral += collateral;
        }

        int256 total = int256(vaultBalance) + int256(lockedCollateral) + unrealizedPnL;
        return total > 0 ? uint256(total) : 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Toggle whether vault is private (only owner can deposit).
    function setPrivate(bool _isPrivate) external onlyOwner {
        isPrivate = _isPrivate;
        emit PrivacyToggled(_isPrivate);
    }

    /// @notice Update the HERMES agent address.
    function setHermesAgent(address agent) external onlyOwner {
        require(agent != address(0), "Invalid agent address");
        address old = hermesAgent;
        hermesAgent = agent;
        emit HermesAgentUpdated(old, agent);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERC-4626: Override deposit to enforce privacy
    // ─────────────────────────────────────────────────────────────────────────

    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        if (isPrivate) {
            require(msg.sender == owner(), "Vault is private");
        }
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        if (isPrivate) {
            require(msg.sender == owner(), "Vault is private");
        }
        return super.mint(shares, receiver);
    }
}
