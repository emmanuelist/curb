// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {IPerplExchange} from "../src/interfaces/IPerplExchange.sol";
import {PerplBookReader, IPerplBookViews} from "../src/readers/PerplBookReader.sol";

/// @notice #51: the deployless book reader against Perpl's live MON book, on a mainnet fork.
/// @dev Run: MONAD_RPC_URL=https://rpc.monad.xyz forge test --match-contract PerplBookReaderForkTest -vv
contract PerplBookReaderForkTest is Test {
    IPerplExchange constant PERPL = IPerplExchange(0x34B6552d57a35a1D042CcAe1951BD1C370112a6F);
    uint256 constant MON_PERP = 10;

    PerplBookReader reader;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("monad"));
        reader = new PerplBookReader();
    }

    function test_readsTheTopAndDepth_inOrder() public view {
        (uint256 bid, uint256 ask, PerplBookReader.Level[] memory bids, PerplBookReader.Level[] memory asks) =
            reader.book(PERPL, MON_PERP, 8);
        console2.log("bid", bid, "ask", ask);
        IPerplExchange.PerpetualInfo memory p = PERPL.getPerpetualInfo(MON_PERP);
        assertEq(bid, p.maxBidPriceONS + p.basePricePNS);
        assertEq(ask, p.minAskPriceONS + p.basePricePNS);
        assertGt(bids.length, 0);
        assertGt(asks.length, 0);
        assertEq(bids[0].pricePNS, bid, "best bid first");
        assertEq(asks[0].pricePNS, ask, "best ask first");
        for (uint256 i = 1; i < bids.length; i++) {
            assertLt(bids[i].pricePNS, bids[i - 1].pricePNS, "bids descend");
        }
        for (uint256 i = 1; i < asks.length; i++) {
            assertGt(asks[i].pricePNS, asks[i - 1].pricePNS, "asks ascend");
        }
        for (uint256 i; i < bids.length; i++) {
            console2.log("bid level", bids[i].pricePNS, bids[i].lotLNS);
            assertGt(bids[i].lotLNS, 0);
        }
        for (uint256 i; i < asks.length; i++) {
            console2.log("ask level", asks[i].pricePNS, asks[i].lotLNS);
            assertGt(asks[i].lotLNS, 0);
        }
    }

    /// @dev What Perpl returns past the last level, which the reader's loop guards rely on.
    function test_pastTheEdges() public view {
        IPerplBookViews views = IPerplBookViews(address(PERPL));
        console2.log("below 1", views.getNextPriceBelowWithOrders(MON_PERP, 1));
        console2.log("above 2^24", views.getNextPriceAboveWithOrders(MON_PERP, 16_000_000));
    }
}
