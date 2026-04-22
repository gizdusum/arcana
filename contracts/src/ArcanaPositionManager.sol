// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ArcanaPositionManager
/// @notice Tracks which position IDs belong to which vault and whether they are open.
contract ArcanaPositionManager is Ownable {
    struct PositionInfo {
        uint256 positionId;
        address vault;
        uint256 openedAt;
        bool isOpen;
    }

    /// @notice vault address => array of position IDs (open and closed)
    mapping(address => uint256[]) public vaultPositions;

    /// @notice positionId => PositionInfo
    mapping(uint256 => PositionInfo) public positionInfo;

    /// @notice The PerpEngine contract that is authorized to register/close positions
    address public engine;

    event PositionRegistered(uint256 indexed positionId, address indexed vault);
    event PositionClosed(uint256 indexed positionId);
    event EngineSet(address engine);

    modifier onlyEngine() {
        require(msg.sender == engine, "Only engine");
        _;
    }

    constructor() Ownable(msg.sender) {}

    /// @notice Register a newly opened position
    function registerPosition(address vault, uint256 positionId) external onlyEngine {
        require(vault != address(0), "Invalid vault");
        require(!positionInfo[positionId].isOpen || positionInfo[positionId].openedAt == 0, "Position exists");

        positionInfo[positionId] = PositionInfo({
            positionId: positionId,
            vault: vault,
            openedAt: block.timestamp,
            isOpen: true
        });
        vaultPositions[vault].push(positionId);

        emit PositionRegistered(positionId, vault);
    }

    /// @notice Mark a position as closed
    function closePosition(uint256 positionId) external onlyEngine {
        require(positionInfo[positionId].isOpen, "Position not open");
        positionInfo[positionId].isOpen = false;
        emit PositionClosed(positionId);
    }

    /// @notice Returns all position IDs (open and closed) for a vault
    function getVaultPositions(address vault) external view returns (uint256[] memory) {
        return vaultPositions[vault];
    }

    /// @notice Returns the count of currently open positions for a vault
    function getOpenPositionCount(address vault) external view returns (uint256) {
        uint256[] storage positions = vaultPositions[vault];
        uint256 count = 0;
        for (uint256 i = 0; i < positions.length; i++) {
            if (positionInfo[positions[i]].isOpen) {
                count++;
            }
        }
        return count;
    }

    /// @notice Set the authorized engine address (onlyOwner)
    function setEngine(address _engine) external onlyOwner {
        require(_engine != address(0), "Invalid engine address");
        engine = _engine;
        emit EngineSet(_engine);
    }
}
