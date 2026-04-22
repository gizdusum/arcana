// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract ArcanaOracle is Ownable {
    uint256 public constant STALE_THRESHOLD = 60; // seconds

    mapping(bytes32 => address) public feeds;
    mapping(bytes32 => uint256[]) public priceHistory;
    mapping(bytes32 => int256) public mockPrices;

    bool public isMockMode;
    address public hermesAgent;

    event FeedAdded(bytes32 indexed market, address feed);
    event MockPriceUpdated(bytes32 indexed market, int256 price);
    event MockModeSet(bool enabled);
    event HermesAgentSet(address agent);

    modifier onlyAuthorized() {
        require(msg.sender == owner() || msg.sender == hermesAgent, "Not authorized");
        _;
    }

    constructor() Ownable(msg.sender) {
        isMockMode = true;
    }

    /// @notice Returns the current price for a market (8 decimals, Chainlink format)
    function getPrice(bytes32 market) public view returns (int256) {
        if (isMockMode) {
            int256 price = mockPrices[market];
            require(price > 0, "Mock price not set");
            return price;
        }

        address feed = feeds[market];
        require(feed != address(0), "No feed for market");

        (, int256 answer, , uint256 updatedAt, ) = AggregatorV3Interface(feed).latestRoundData();
        require(answer > 0, "Invalid price");
        require(block.timestamp - updatedAt <= STALE_THRESHOLD, "Stale price");

        return answer;
    }

    /// @notice Update mock price for a market, also records it into history for TWAP
    function updateMockPrice(bytes32 market, int256 price) external onlyAuthorized {
        require(price > 0, "Price must be positive");
        mockPrices[market] = price;
        priceHistory[market].push(uint256(price));
        emit MockPriceUpdated(market, price);
    }

    /// @notice Returns TWAP over last `periods` recorded prices
    function getTWAP(bytes32 market, uint8 periods) external view returns (uint256) {
        uint256[] storage history = priceHistory[market];
        require(history.length > 0, "No price history");
        require(periods > 0, "Periods must be > 0");

        uint256 count = periods > history.length ? history.length : periods;
        uint256 sum = 0;
        uint256 start = history.length - count;
        for (uint256 i = start; i < history.length; i++) {
            sum += history[i];
        }
        return sum / count;
    }

    /// @notice Add a Chainlink price feed for a market
    function addFeed(bytes32 market, address feed) external onlyOwner {
        require(feed != address(0), "Invalid feed address");
        feeds[market] = feed;
        emit FeedAdded(market, feed);
    }

    /// @notice Toggle mock mode
    function setMockMode(bool enabled) external onlyOwner {
        isMockMode = enabled;
        emit MockModeSet(enabled);
    }

    /// @notice Set the HERMES agent address (also authorized to update mock prices)
    function setHermesAgent(address agent) external onlyOwner {
        require(agent != address(0), "Invalid agent address");
        hermesAgent = agent;
        emit HermesAgentSet(agent);
    }

    /// @notice Returns the full price history array for a market
    function getPriceHistory(bytes32 market) external view returns (uint256[] memory) {
        return priceHistory[market];
    }
}
