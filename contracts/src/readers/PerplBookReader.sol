// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPerplExchange} from "../interfaces/IPerplExchange.sol";

interface IPerplBookViews {
    function getNextPriceBelowWithOrders(uint256 perpId, uint256 priceONS) external view returns (uint256);
    function getNextPriceAboveWithOrders(uint256 perpId, uint256 priceONS) external view returns (uint256);
    function getVolumeAtBookPrice(uint256 perpId, uint256 priceONS)
        external
        view
        returns (uint256 bids, uint256 expBids, uint256 asks, uint256 expAsks);
}

/// @title PerplBookReader
/// @notice Reads the top of one Perpl perpetual's onchain book in a single call: the best bid and ask the lane is
///         built from, plus `depth` price levels on each side. Never deployed: the app runs it as a deployless
///         eth_call (viem `call({ code })`), because Perpl exposes its book one level at a time.
contract PerplBookReader {
    struct Level {
        uint256 pricePNS;
        uint256 lotLNS;
    }

    /// @return bidPNS Best bid, 0 when there are no bids.
    /// @return askPNS Best ask, 0 when there are no asks.
    /// @return bids Up to `depth` bid levels, best first.
    /// @return asks Up to `depth` ask levels, best first.
    function book(IPerplExchange ex, uint256 perpId, uint256 depth)
        external
        view
        returns (uint256 bidPNS, uint256 askPNS, Level[] memory bids, Level[] memory asks)
    {
        IPerplExchange.PerpetualInfo memory p = ex.getPerpetualInfo(perpId);
        uint256 base = p.basePricePNS;
        IPerplBookViews views = IPerplBookViews(address(ex));

        // A price level can hold only expired orders (Perpl counts them apart): those carry no live size and are
        // skipped. The walk is bounded so a book full of expired levels can't run the call out of gas. Calls in the
        // loop are the point: Perpl exposes its book one level at a time, and this only ever runs inside an eth_call.
        uint256 budget = depth * 4;
        bids = new Level[](depth);
        uint256 n = 0;
        for (uint256 px = p.maxBidPriceONS; px != 0 && n < depth && budget != 0; budget--) {
            // Only the live bid volume is wanted; the expired and ask figures are Perpl's other three returns.
            // forge-lint: disable-next-line(calls-loop, unused-return)
            (uint256 lots,,,) = views.getVolumeAtBookPrice(perpId, px);
            if (lots != 0) bids[n++] = Level(px + base, lots);
            // forge-lint: disable-next-line(calls-loop)
            uint256 next = views.getNextPriceBelowWithOrders(perpId, px);
            px = next < px ? next : 0;
        }
        _trim(bids, n);

        budget = depth * 4;
        asks = new Level[](depth);
        n = 0;
        for (uint256 px = p.minAskPriceONS; px != 0 && n < depth && budget != 0; budget--) {
            // forge-lint: disable-next-line(calls-loop, unused-return)
            (,, uint256 lots,) = views.getVolumeAtBookPrice(perpId, px);
            if (lots != 0) asks[n++] = Level(px + base, lots);
            // forge-lint: disable-next-line(calls-loop)
            uint256 next = views.getNextPriceAboveWithOrders(perpId, px);
            px = next > px ? next : 0;
        }
        _trim(asks, n);

        bidPNS = p.maxBidPriceONS == 0 ? 0 : p.maxBidPriceONS + base;
        askPNS = p.minAskPriceONS == 0 ? 0 : p.minAskPriceONS + base;
    }

    /// @dev Shortens a memory array in place to its first `n` entries.
    function _trim(Level[] memory levels, uint256 n) private pure {
        assembly ("memory-safe") {
            mstore(levels, n)
        }
    }
}
