// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {CurbAccount} from "../src/CurbAccount.sol";
import {IKuruMarginAccount} from "../src/interfaces/IKuruMarginAccount.sol";
import {IPerplExchange} from "../src/interfaces/IPerplExchange.sol";
import {MockOrderBook} from "./mocks/MockOrderBook.sol";
import {MockPerplExchange} from "./mocks/MockPerplExchange.sol";

/// @notice The onchain lanes, against mock books (Kuru and Perpl): the same fixtures as web/src/lib/lane.test.ts
///         (so the contract and the app provably draw one lane), plus the empty and crossed books the live markets
///         can't produce on demand.
contract CurbLaneTest is Test {
    uint256 constant PERP = 10;
    uint16 constant CAP = 500; // 5x

    MockOrderBook book;
    MockPerplExchange perpl;
    CurbAccount account;
    address trader = makeAddr("trader");

    function setUp() public {
        book = new MockOrderBook();
        perpl = new MockPerplExchange(makeAddr("ausd"));
        account = new CurbAccount(
            address(this),
            trader,
            IKuruMarginAccount(makeAddr("margin")),
            address(book),
            CurbAccount.PerplConfig(IPerplExchange(address(perpl)), IERC20(makeAddr("ausd")), PERP, CAP)
        );
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

    // ---------------------------------------------------------------- Perpl

    function _perp(uint8 orderType, uint256 price, uint256 leverageHdths)
        internal
        pure
        returns (IPerplExchange.OrderDesc memory d)
    {
        d.perpId = PERP;
        d.orderType = orderType;
        d.pricePNS = price;
        d.lotLNS = 300;
        d.leverageHdths = leverageHdths;
        d.maxNegPnlCollatBPS = 1000;
    }

    function test_perpLane_matchesTheAppFixture() public {
        // web/src/lib/lane.test.ts: Perpl MON perp bid 0.033284 / ask 0.033376 (tick 0.000001)
        //   → maxBuy 0.033542 (floor of ask × 1.005), minSell 0.033118 (ceil of bid × 0.995)
        perpl.setTop(33_284, 33_376, 0);
        (uint256 maxBuy, uint256 minSell) = account.perpLane(PERP);
        assertEq(maxBuy, 33_542);
        assertEq(minSell, 33_118);
    }

    function test_perpLane_addsTheBasePrice() public {
        perpl.setTop(284, 376, 33_000); // the same book, expressed against a base price
        (uint256 maxBuy, uint256 minSell) = account.perpLane(PERP);
        assertEq(maxBuy, 33_542);
        assertEq(minSell, 33_118);
    }

    function test_perp_refuses_emptyOrCrossedBooks() public {
        uint256[2][3] memory tops = [[uint256(0), 33_376], [uint256(33_284), 0], [uint256(33_376), 33_284]];
        for (uint256 i; i < tops.length; i++) {
            perpl.setTop(tops[i][0], tops[i][1], 0);
            vm.expectRevert(abi.encodeWithSelector(CurbAccount.PerpNoMarket.selector, PERP));
            account.perpLane(PERP);
            vm.prank(trader);
            vm.expectRevert(abi.encodeWithSelector(CurbAccount.PerpNoMarket.selector, PERP));
            account.perplOrder(_perp(0, 33_000, CAP));
        }
        assertEq(perpl.orders(), 0, "nothing reached Perpl");
    }

    function test_perp_atTheCurb_isAllowed_onePast_isRefused() public {
        perpl.setTop(33_284, 33_376, 0);
        vm.startPrank(trader);
        account.perplOrder(_perp(0, 33_542, CAP)); // OpenLong at maxBuy
        account.perplOrder(_perp(3, 33_542, CAP)); // CloseShort is a bid too
        account.perplOrder(_perp(1, 33_118, CAP)); // OpenShort at minSell
        account.perplOrder(_perp(2, 33_118, CAP)); // CloseLong is an ask too
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.PerpOffLane.selector, PERP, true, 33_543, 33_542));
        account.perplOrder(_perp(0, 33_543, CAP));
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.PerpOffLane.selector, PERP, false, 33_117, 33_118));
        account.perplOrder(_perp(2, 33_117, CAP));
        vm.stopPrank();
        assertEq(perpl.orders(), 4);
    }

    function test_perp_refuses_leverageAboveTheCap() public {
        perpl.setTop(33_284, 33_376, 0);
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.LeverageAboveCap.selector, CAP + 1, CAP));
        account.perplOrder(_perp(0, 33_376, CAP + 1));

        // The owner can raise it, and only the owner.
        vm.prank(trader);
        vm.expectRevert(CurbAccount.NotOwner.selector);
        account.setPerp(PERP, true, 2000);
        account.setPerp(PERP, true, 2000);
        vm.prank(trader);
        account.perplOrder(_perp(0, 33_376, 2000));
    }

    function test_perp_refuses_ordersThatAreNotOpensOrCloses() public {
        perpl.setTop(33_284, 33_376, 0);
        uint8[3] memory types = [uint8(4), 5, 6]; // cancel goes through perplCancel; collateral and change never
        for (uint256 i; i < types.length; i++) {
            vm.prank(trader);
            vm.expectRevert(abi.encodeWithSelector(CurbAccount.PerpOrderNotAllowed.selector, types[i]));
            account.perplOrder(_perp(types[i], 33_376, CAP));
        }
        IPerplExchange.OrderDesc memory withCollateral = _perp(0, 33_376, CAP);
        withCollateral.amountCNS = 1;
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.PerpOrderNotAllowed.selector, 0));
        account.perplOrder(withCollateral);
        assertEq(perpl.orders(), 0);
    }

    function test_perp_refuses_otherPerpsAndOtherCallers() public {
        perpl.setTop(33_284, 33_376, 0);
        IPerplExchange.OrderDesc memory btc = _perp(0, 33_376, CAP);
        btc.perpId = 1;
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.PerpNotAllowed.selector, 1));
        account.perplOrder(btc);

        vm.prank(makeAddr("outside"));
        vm.expectRevert(CurbAccount.NotTrader.selector);
        account.perplOrder(_perp(0, 33_376, CAP));
        vm.prank(makeAddr("outside"));
        vm.expectRevert(CurbAccount.NotOwnerOrTrader.selector);
        account.perplCancel(PERP, 1);
    }

    /// @dev Rounding properties for any sane Perpl book: maxBuy is the floor of ask × 1.005, minSell the ceil of
    ///      bid × 0.995, with a tick of one price unit.
    function testFuzz_perpLane_rounds(uint64 bidPx, uint64 spread) public {
        uint256 bid = bound(bidPx, 1, 1e15);
        uint256 ask = bid + bound(spread, 1, 1e12);
        perpl.setTop(bid, ask, 0);
        (uint256 maxBuy, uint256 minSell) = account.perpLane(PERP);
        assertLe(maxBuy * 10_000, ask * 10_050);
        assertGt((maxBuy + 1) * 10_000, ask * 10_050);
        assertGe(minSell * 10_000, bid * 9_950);
        assertLt((minSell - 1) * 10_000, bid * 9_950);
    }
}
