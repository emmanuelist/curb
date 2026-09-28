// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice A stand-in for Kuru's OrderBook with a settable top of book: empty and crossed books can't be
///         produced on demand against the live market, and the lane fixtures must match web/src/lib/lane.test.ts.
contract MockOrderBook {
    uint256 public rawBid;
    uint256 public rawAsk;
    uint256 public buys;
    uint256 public sells;

    function setTop(uint256 bid, uint256 ask) external {
        rawBid = bid;
        rawAsk = ask;
    }

    function bestBidAsk() external view returns (uint256, uint256) {
        return (rawBid, rawAsk);
    }

    /// @dev Same field order as Kuru's getMarketParams(); pricePrecision 1e8, tickSize 100, like MON-USDC.
    function getMarketParams()
        external
        pure
        returns (uint32, uint96, address, uint256, address, uint256, uint32, uint96, uint96, uint256, uint256)
    {
        return (1e8, 1e10, address(0), 18, address(0), 6, 100, 2e12, 2e18, 0, 0);
    }

    function addBuyOrder(uint32, uint96, bool) external {
        buys++;
    }

    function addSellOrder(uint32, uint96, bool) external {
        sells++;
    }

    function batchCancelOrders(uint40[] calldata) external {}
}
