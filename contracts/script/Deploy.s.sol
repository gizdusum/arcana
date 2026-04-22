// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ArcanaOracle.sol";
import "../src/ArcanaStrategy.sol";
import "../src/ArcanaPerpEngine.sol";
import "../src/ArcanaPositionManager.sol";
import "../src/ArcanaVault.sol";

contract Deploy is Script {
    /// @dev USDC on Arc Testnet — 6 decimals, native gas token
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address hermesAgent = vm.envOr("HERMES_AGENT", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // ── 1. Oracle ────────────────────────────────────────────────────────
        ArcanaOracle oracle = new ArcanaOracle();
        oracle.setMockMode(true);

        // Set initial mock prices (8 decimals — Chainlink format)
        // BTC ~$95,000 → 95000 * 1e8 = 9_500_000_000_000
        oracle.updateMockPrice(keccak256("BTC/USD"), 9_500_000_000_000);
        // ETH ~$3,200 → 3200 * 1e8 = 320_000_000_000
        oracle.updateMockPrice(keccak256("ETH/USD"), 320_000_000_000);

        // ── 2. Strategy Registry ─────────────────────────────────────────────
        ArcanaStrategy strategy = new ArcanaStrategy();

        // ── 3. Position Manager ──────────────────────────────────────────────
        ArcanaPositionManager posManager = new ArcanaPositionManager();

        // ── 4. Perp Engine ───────────────────────────────────────────────────
        ArcanaPerpEngine perpEngine = new ArcanaPerpEngine(
            address(oracle),
            address(posManager),
            USDC
        );
        posManager.setEngine(address(perpEngine));

        // ── 5. Vault (ATLAS = default strategy = index 1) ────────────────────
        ArcanaVault vault = new ArcanaVault(
            IERC20(USDC),
            address(perpEngine),
            address(strategy),
            hermesAgent,
            ArcanaStrategy.StrategyType.ATLAS
        );

        // Wire up
        perpEngine.setVault(address(vault));
        oracle.setHermesAgent(hermesAgent);

        vm.stopBroadcast();

        // ── Write deployment output ──────────────────────────────────────────
        string memory json = string.concat(
            '{"chainId":5042002,',
            '"deployedAt":', vm.toString(block.timestamp), ',',
            '"ArcanaVault":"', vm.toString(address(vault)), '",',
            '"ArcanaPerpEngine":"', vm.toString(address(perpEngine)), '",',
            '"ArcanaOracle":"', vm.toString(address(oracle)), '",',
            '"ArcanaStrategy":"', vm.toString(address(strategy)), '",',
            '"ArcanaPositionManager":"', vm.toString(address(posManager)), '",',
            '"USDC":"', vm.toString(USDC), '",',
            '"hermesAgent":"', vm.toString(hermesAgent), '"}'
        );

        // Write two levels up so it lands in arcana/deployments/
        vm.writeFile("../deployments/arc-testnet.json", json);

        console.log("=== ARCANA DEPLOYED ===");
        console.log("ArcanaVault         :", address(vault));
        console.log("ArcanaPerpEngine    :", address(perpEngine));
        console.log("ArcanaOracle        :", address(oracle));
        console.log("ArcanaStrategy      :", address(strategy));
        console.log("ArcanaPositionManager:", address(posManager));
        console.log("HERMES Agent        :", hermesAgent);
    }
}
