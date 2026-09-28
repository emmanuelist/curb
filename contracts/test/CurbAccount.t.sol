// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {CurbAccount} from "../src/CurbAccount.sol";
import {CurbFactory} from "../src/CurbFactory.sol";
import {IKuruOrderBook} from "../src/interfaces/IKuruOrderBook.sol";
import {IKuruMarginAccount} from "../src/interfaces/IKuruMarginAccount.sol";

/// @notice #30: CurbAccount on a fork of Monad mainnet against Kuru's live MON-USDC book, under Monad's
///         execution rules (foundry.toml `network = "monad"`). Refusal paths first (CLAUDE.md rule 4).
/// @dev Run: MONAD_RPC_URL=https://rpc.monad.xyz forge test --match-contract CurbAccountForkTest -vv
contract CurbAccountForkTest is Test {
    IKuruMarginAccount constant MARGIN = IKuruMarginAccount(0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5);
    address constant MON_USDC = 0x065C9d28E428A0db40191a54d33d5b7c71a9C394;
    address constant MON_AUSD = 0x131A2e70A5b31a517A74b8c567149bc294470Da9;
    address constant USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
    address constant NATIVE = address(0);

    uint32 constant TICK = 100;
    uint96 constant MIN_SIZE = 2e12; // 200 MON, Kuru's smallest order on MON-USDC

    CurbFactory factory;
    CurbAccount account;
    address owner = makeAddr("owner");
    address trader = makeAddr("trader");
    address outside = makeAddr("outside"); // e.g. the user's exchange wallet

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("monad"));
        factory = new CurbFactory(MARGIN, MON_USDC);
        vm.prank(owner);
        account = factory.create(trader);

        // The owner credits the account's Kuru margin directly: 500 MON and 50 USDC.
        vm.deal(owner, 1_000 ether);
        vm.prank(owner);
        MARGIN.deposit{value: 500 ether}(address(account), NATIVE, 500 ether);
        deal(USDC, owner, 50e6);
        vm.startPrank(owner);
        IERC20(USDC).approve(address(MARGIN), 50e6);
        MARGIN.deposit(address(account), USDC, 50e6);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ refusals

    function test_refuses_traderWithdrawal() public {
        vm.prank(trader);
        vm.expectRevert(CurbAccount.NotOwner.selector);
        account.withdraw(NATIVE, 1 ether, trader);

        vm.prank(trader);
        vm.expectRevert(CurbAccount.NotOwner.selector);
        account.sweep(NATIVE, 1 ether, trader);

        // Nor can the trading key reach the account's margin on Kuru directly: margin belongs to the account.
        vm.prank(trader);
        vm.expectRevert();
        MARGIN.withdraw(1 ether, NATIVE);
        assertEq(MARGIN.getBalance(address(account), NATIVE), 500 ether, "margin untouched");
    }

    function test_refuses_offLaneBuy() public {
        (uint32 maxBuy,) = account.lane(MON_USDC);
        uint32 past = maxBuy + TICK;
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.OffLane.selector, true, past, maxBuy));
        account.placeBuy(MON_USDC, past, MIN_SIZE, false);
    }

    function test_refuses_offLaneSell() public {
        (, uint32 minSell) = account.lane(MON_USDC);
        uint32 past = minSell - TICK;
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.OffLane.selector, false, past, minSell));
        account.placeSell(MON_USDC, past, MIN_SIZE, false);
    }

    function test_refuses_marketNotAllowed() public {
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.MarketNotAllowed.selector, MON_AUSD));
        account.placeBuy(MON_AUSD, 100_000, MIN_SIZE, false);
    }

    function test_refuses_anyoneButTheTrader() public {
        (uint32 maxBuy,) = account.lane(MON_USDC);
        vm.prank(owner);
        vm.expectRevert(CurbAccount.NotTrader.selector);
        account.placeBuy(MON_USDC, maxBuy, MIN_SIZE, false);

        vm.prank(outside);
        vm.expectRevert(CurbAccount.NotTrader.selector);
        account.placeSell(MON_USDC, maxBuy, MIN_SIZE, false);

        uint40[] memory none = new uint40[](0);
        vm.prank(outside);
        vm.expectRevert(CurbAccount.NotOwnerOrTrader.selector);
        account.cancel(MON_USDC, none);
    }

    function test_refuses_revokedTrader() public {
        vm.prank(owner);
        account.setTrader(address(0));
        (uint32 maxBuy,) = account.lane(MON_USDC);
        vm.prank(trader);
        vm.expectRevert(CurbAccount.NotTrader.selector);
        account.placeBuy(MON_USDC, maxBuy, MIN_SIZE, false);
    }

    function test_refuses_offTickAndZeroPrices() public {
        (uint32 maxBuy,) = account.lane(MON_USDC);
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.NotOnTick.selector, maxBuy - 1, TICK));
        account.placeBuy(MON_USDC, maxBuy - 1, MIN_SIZE, false);

        vm.prank(trader);
        vm.expectRevert(CurbAccount.ZeroPrice.selector);
        account.placeBuy(MON_USDC, 0, MIN_SIZE, false);
    }

    // ------------------------------------------------------------------ what the keys may do

    function test_trader_restsAnInLaneSell_onKurusBook_andCancelsIt() public {
        (uint32 bidPx, uint32 askPx) = _top();
        (, uint32 minSell) = account.lane(MON_USDC);
        assertLe(minSell, askPx, "joining the best ask is inside the lane");

        uint256 before = MARGIN.getBalance(address(account), NATIVE);
        vm.prank(trader);
        uint256 g = gasleft();
        account.placeSell(MON_USDC, askPx, MIN_SIZE, true);
        console2.log("placeSell gas (Monad rules)", g - gasleft());

        uint40 id = IKuruOrderBook(MON_USDC).s_orderIdCounter();
        (address orderOwner, uint96 size,,,, uint32 price,, bool isBuy) =
            IKuruOrderBook(MON_USDC).s_orders(id);
        assertEq(orderOwner, address(account), "the account owns the resting order");
        assertEq(size, MIN_SIZE);
        assertEq(price, askPx);
        assertFalse(isBuy);
        assertEq(
            before - MARGIN.getBalance(address(account), NATIVE), 200 ether, "200 MON locked for the sell"
        );
        assertGt(askPx, bidPx);

        uint40[] memory ids = new uint40[](1);
        ids[0] = id;
        vm.prank(trader);
        g = gasleft();
        account.cancel(MON_USDC, ids);
        console2.log("cancel gas (Monad rules)", g - gasleft());
        assertEq(MARGIN.getBalance(address(account), NATIVE), before, "cancel returns the MON");
    }

    function test_trader_restsAnInLaneBuy_andOwnerCancels() public {
        (uint32 bidPx,) = _top();
        uint256 before = MARGIN.getBalance(address(account), USDC);
        vm.prank(trader);
        account.placeBuy(MON_USDC, bidPx, MIN_SIZE, true);
        uint40 id = IKuruOrderBook(MON_USDC).s_orderIdCounter();
        (address orderOwner,,,,,,, bool isBuy) = IKuruOrderBook(MON_USDC).s_orders(id);
        assertEq(orderOwner, address(account));
        assertTrue(isBuy);
        assertLt(MARGIN.getBalance(address(account), USDC), before, "USDC locked for the buy");

        uint40[] memory ids = new uint40[](1);
        ids[0] = id;
        vm.prank(owner); // the owner key may cancel too
        account.cancel(MON_USDC, ids);
        assertEq(MARGIN.getBalance(address(account), USDC), before, "cancel returns the USDC");
    }

    function test_owner_withdrawsMonAndUsdc_toAnOutsideAddress() public {
        vm.prank(owner);
        account.withdraw(NATIVE, 120 ether, outside);
        assertEq(outside.balance, 120 ether, "MON reached the outside address");
        assertEq(MARGIN.getBalance(address(account), NATIVE), 380 ether);

        vm.prank(owner);
        account.withdraw(USDC, 50e6, outside);
        assertEq(IERC20(USDC).balanceOf(outside), 50e6, "USDC reached the outside address");

        // MON sent straight to the account (outside Kuru) can be swept out by the owner as well.
        vm.deal(address(account), 3 ether);
        vm.prank(owner);
        account.sweep(NATIVE, 3 ether, outside);
        assertEq(outside.balance, 123 ether);
    }

    function test_owner_rotatesTheTradingKey() public {
        address next = makeAddr("next trader");
        vm.prank(owner);
        account.setTrader(next);
        (uint32 bidPx,) = _top();

        vm.prank(trader);
        vm.expectRevert(CurbAccount.NotTrader.selector);
        account.placeBuy(MON_USDC, bidPx, MIN_SIZE, true);

        vm.prank(next);
        account.placeBuy(MON_USDC, bidPx, MIN_SIZE, true);
    }

    function test_factory_predictsTheAddress_andAllowsOneAccountPerOwner() public {
        assertEq(factory.accountOf(owner, trader), address(account), "address recomputable from the keys");
        assertEq(account.owner(), owner);
        assertEq(account.trader(), trader);
        vm.prank(owner);
        vm.expectRevert();
        factory.create(trader);
    }

    function test_gas_createAnAccount() public {
        address someone = makeAddr("someone");
        vm.prank(someone);
        uint256 g = gasleft();
        factory.create(makeAddr("their trader"));
        console2.log("factory.create gas (Monad rules)", g - gasleft());
    }

    function _top() internal view returns (uint32 bidPx, uint32 askPx) {
        (uint256 rawBid, uint256 rawAsk) = IKuruOrderBook(MON_USDC).bestBidAsk();
        bidPx = uint32(rawBid * 1e8 / 1e18);
        askPx = uint32(rawAsk * 1e8 / 1e18);
    }
}
