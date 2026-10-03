// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPerplExchange} from "../../src/interfaces/IPerplExchange.sol";

/// @notice A stand-in for Perpl's Exchange with a settable top of book: empty and crossed books can't be produced
///         on demand against the live market, and the perp lane fixtures must match web/src/lib/lane.test.ts.
contract MockPerplExchange {
    uint256 public bestBid;
    uint256 public bestAsk;
    uint256 public base;
    uint256 public orders;
    address public collateral;

    constructor(address collateral_) {
        collateral = collateral_;
    }

    function setTop(uint256 bid, uint256 ask, uint256 base_) external {
        bestBid = bid;
        bestAsk = ask;
        base = base_;
    }

    function getExchangeInfo() external view returns (uint256, uint256, uint256, uint256, address, address) {
        return (0, 0, 0, 6, collateral, address(0));
    }

    function getPerpetualInfo(uint256) external view returns (IPerplExchange.PerpetualInfo memory info) {
        info.name = "MON Perp";
        info.symbol = "MON";
        info.priceDecimals = 6;
        info.basePricePNS = base;
        info.maxBidPriceONS = bestBid;
        info.minAskPriceONS = bestAsk;
    }

    function execOrder(IPerplExchange.OrderDesc calldata) external {
        orders++;
    }
}
