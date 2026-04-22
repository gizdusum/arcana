// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ArcanaStrategy
/// @notice Defines and stores configuration for the three ARCANA trading strategies.
contract ArcanaStrategy {
    enum StrategyType {
        APOLLO, // index 0 — conservative long-only
        ATLAS,  // index 1 — balanced long/short
        ARES    // index 2 — aggressive long/short
    }

    struct StrategyConfig {
        string name;
        uint8 maxLeverage;       // maximum leverage multiplier
        bool longOnly;           // if true, only long positions allowed
        uint256 stopLossBPS;     // stop-loss in basis points (e.g. 500 = 5%)
        uint256 takeProfitBPS;   // take-profit in basis points (e.g. 1000 = 10%)
        uint256 cooldownSeconds; // minimum seconds between trades
        uint256 maxPositionCount; // maximum number of concurrent open positions
    }

    mapping(StrategyType => StrategyConfig) private _configs;

    constructor() {
        _configs[StrategyType.APOLLO] = StrategyConfig({
            name: "APOLLO",
            maxLeverage: 3,
            longOnly: true,
            stopLossBPS: 500,
            takeProfitBPS: 1000,
            cooldownSeconds: 900,
            maxPositionCount: 2
        });

        _configs[StrategyType.ATLAS] = StrategyConfig({
            name: "ATLAS",
            maxLeverage: 5,
            longOnly: false,
            stopLossBPS: 1000,
            takeProfitBPS: 2000,
            cooldownSeconds: 600,
            maxPositionCount: 3
        });

        _configs[StrategyType.ARES] = StrategyConfig({
            name: "ARES",
            maxLeverage: 10,
            longOnly: false,
            stopLossBPS: 2000,
            takeProfitBPS: 5000,
            cooldownSeconds: 300,
            maxPositionCount: 5
        });
    }

    /// @notice Returns the full configuration for a given strategy
    function getConfig(StrategyType strategyType)
        external
        view
        returns (StrategyConfig memory)
    {
        return _configs[strategyType];
    }

    /// @notice Returns true if the requested leverage is within the strategy's limit
    function validateLeverage(StrategyType strategyType, uint8 leverage)
        external
        view
        returns (bool)
    {
        return leverage > 0 && leverage <= _configs[strategyType].maxLeverage;
    }

    /// @notice Returns the max position count for a strategy (convenience helper)
    function getMaxPositionCount(StrategyType strategyType) external view returns (uint256) {
        return _configs[strategyType].maxPositionCount;
    }

    /// @notice Returns whether the strategy allows short positions
    function allowsShort(StrategyType strategyType) external view returns (bool) {
        return !_configs[strategyType].longOnly;
    }
}
