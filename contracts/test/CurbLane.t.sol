// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {CurbAccount} from "../src/CurbAccount.sol";
import {IKuruMarginAccount} from "../src/interfaces/IKuruMarginAccount.sol";
import {MockOrderBook} from "./mocks/MockOrderBook.sol";

/// @notice The onchain lane, against a mock book: the same fixtures as web/src/lib/lane.test.ts (so the
///         contract and the app provably draw one lane), plus the empty and crossed books the live market
///         can't produce on demand.
contract CurbLaneTest is Test {
    MockOrderBook book;
    CurbAccount account;
    address trader = makeAddr("trader");

    function setUp() public {
        book = new MockOrderBook();
        account =
            new CurbAccount(address(this), trader, IKuruMarginAccount(makeAddr("margin")), address(book));
    }

    /// @dev Price units → the 1e18-scaled value Kuru's bestBidAsk() returns (pricePrecision 1e8).
    function _raw(uint256 units) internal pure returns (uint256) {
        return units * 1e10;
    }

    function test_lane_matchesTheAppFixture() public {
        // web/src/lib/lane.test.ts: bid 0.026313 / ask 0.026341 → maxBuy 0.026472, minSell 0.026182
        book.setTop(_raw(2_631_300), _raw(2_634_100));
        (uint32 maxBuy, uint32 minSell) = account.lane(address(book));
        assertEq(maxBuy, 2_647_200);
        assertEq(minSell, 2_618_200);
    }

    function test_lane_matchesTheAppFixture_oneTickSpread() public {
        // web/src/lib/lane.test.ts: bid 0.026320 / ask 0.026321 → maxBuy 0.026452, minSell 0.026189
        book.setTop(_raw(2_632_000), _raw(2_632_100));
        (uint32 maxBuy, uint32 minSell) = account.lane(address(book));
        assertEq(maxBuy, 2_645_200);
        assertEq(minSell, 2_618_900);
    }

    function test_refuses_emptyOrCrossedBooks() public {
        uint256 max = type(uint256).max;
        uint256[2][5] memory tops = [
            [uint256(0), _raw(2_634_100)], // no bids
            [max, _raw(2_634_100)], // no bids, other sentinel
            [_raw(2_631_300), uint256(0)], // no asks
            [_raw(2_631_300), max], // no asks, other sentinel
            [_raw(2_634_100), _raw(2_631_300)] // crossed
        ];
        for (uint256 i; i < tops.length; i++) {
            book.setTop(tops[i][0], tops[i][1]);
            vm.expectRevert(abi.encodeWithSelector(CurbAccount.NoMarket.selector, address(book)));
            account.lane(address(book));
            vm.prank(trader);
            vm.expectRevert(abi.encodeWithSelector(CurbAccount.NoMarket.selector, address(book)));
            account.placeBuy(address(book), 2_600_000, 2e12, false);
        }
        assertEq(book.buys(), 0, "nothing reached the book");
    }

    function test_atTheCurb_isAllowed_oneTickPast_isRefused() public {
        book.setTop(_raw(2_631_300), _raw(2_634_100));
        vm.startPrank(trader);
        account.placeBuy(address(book), 2_647_200, 2e12, false);
        account.placeSell(address(book), 2_618_200, 2e12, false);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.OffLane.selector, true, 2_647_300, 2_647_200));
        account.placeBuy(address(book), 2_647_300, 2e12, false);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.OffLane.selector, false, 2_618_100, 2_618_200));
        account.placeSell(address(book), 2_618_100, 2e12, false);
        vm.stopPrank();
        assertEq(book.buys(), 1);
        assertEq(book.sells(), 1);
    }

    /// @dev Rounding properties for any sane book: maxBuy is the floor to a tick of ask × 1.005, minSell the ceil
    ///      of bid × 0.995.
    function testFuzz_lane_roundsLikeTheApp(uint32 bidTicks, uint32 spreadTicks) public {
        uint256 bid = uint256(bound(bidTicks, 1, 20_000_000)) * 100;
        uint256 ask = bid + uint256(bound(spreadTicks, 1, 1_000_000)) * 100;
        book.setTop(_raw(bid), _raw(ask));
        (uint32 maxBuy, uint32 minSell) = account.lane(address(book));

        uint256 up = ask * 10_050 / 10_000;
        uint256 down = bid * 9_950 / 10_000;
        assertEq(maxBuy % 100, 0);
        assertEq(minSell % 100, 0);
        assertLe(maxBuy, up);
        assertGt(uint256(maxBuy) + 100, up);
        assertGe(minSell, down);
        assertLt(uint256(minSell), down + 100);
    }
}
