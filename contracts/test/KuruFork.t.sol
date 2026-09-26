// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IKuruOrderBook} from "../src/interfaces/IKuruOrderBook.sol";
import {IKuruMarginAccount} from "../src/interfaces/IKuruMarginAccount.sol";
import {KuruCallerSpike} from "../src/spike/KuruCallerSpike.sol";

/// @notice Issue #1: a contract deposits, places, cancels and withdraws on Kuru MON-USDC,
///         against a fork of Monad mainnet. Addresses from docs/CONTEXT.md.
/// @dev Run: MONAD_RPC_URL=https://rpc.monad.xyz forge test --match-contract KuruForkTest -vv
contract KuruForkTest is Test {
    IKuruMarginAccount constant MARGIN = IKuruMarginAccount(0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5);
    IKuruOrderBook constant MON_USDC = IKuruOrderBook(0x065C9d28E428A0db40191a54d33d5b7c71a9C394);
    address constant USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;

    uint256 constant FUND = 50e6; // 50 USDC (6 decimals)

    KuruCallerSpike spike;
    uint32 pricePrecision;
    uint32 tick;
    uint96 minSize;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("monad"));
        spike = new KuruCallerSpike(MARGIN);
        deal(USDC, address(spike), FUND);
    }

    function _readParams() internal {
        uint96 sizePrecision;
        uint256 baseDecimals;
        address quote;
        uint256 quoteDecimals;
        (pricePrecision, sizePrecision,, baseDecimals, quote, quoteDecimals, tick, minSize,,,) =
            MON_USDC.getMarketParams();
        assertEq(quote, USDC, "quote asset is USDC");
        console2.log("block", block.number);
        console2.log("pricePrecision", pricePrecision);
        console2.log("sizePrecision", sizePrecision);
        console2.log("baseDecimals", baseDecimals);
        console2.log("quoteDecimals", quoteDecimals);
        console2.log("tickSize", tick);
        console2.log("minSize", minSize);
    }

    function test_contractOwnsKuruOrders_roundTrip() public {
        _readParams();

        // 1. Deposit: the contract credits itself in MarginAccount.
        spike.deposit(USDC, FUND);
        uint256 marginBal = MARGIN.getBalance(address(spike), USDC);
        console2.log("margin balance after deposit", marginBal);
        assertGt(marginBal, 0, "deposit credited the contract");
        assertEq(IERC20(USDC).balanceOf(address(spike)), 0, "tokens moved into MarginAccount");

        // 2. Book scaling: bestBidAsk() is assumed 1e18-scaled; convert to order-price units.
        (uint256 bid, uint256 ask) = MON_USDC.bestBidAsk();
        console2.log("bestBid (raw)", bid);
        console2.log("bestAsk (raw)", ask);
        uint256 bidPx = bid * pricePrecision / 1e18;
        assertEq(bidPx * 1e18 / pricePrecision, bid, "bestBid maps exactly onto pricePrecision units");
        assertEq(bidPx % tick, 0, "bestBid sits on a tick");

        // Improve the bid by one tick (still below the ask, so a post-only order rests).
        uint32 myPx = uint32(bidPx + tick);
        assertLt(uint256(myPx) * 1e18 / pricePrecision, ask, "one tick above bid is still below ask");

        // 3. Place: the contract becomes the order owner.
        uint40 idBefore = MON_USDC.s_orderIdCounter();
        spike.placeBuy(MON_USDC, myPx, minSize);
        uint40 id = MON_USDC.s_orderIdCounter();
        console2.log("orderId before/after", idBefore, id);
        (address owner, uint96 size,,,, uint32 price,, bool isBuy) = MON_USDC.s_orders(id);
        assertEq(owner, address(spike), "a contract can own a Kuru order");
        assertEq(size, minSize, "size recorded");
        assertEq(price, myPx, "price recorded");
        assertTrue(isBuy, "buy side");

        (uint256 newBid,) = MON_USDC.bestBidAsk();
        assertEq(
            newBid, uint256(myPx) * 1e18 / pricePrecision, "our order is the new best bid: scaling confirmed"
        );
        console2.log("margin balance with order resting", MARGIN.getBalance(address(spike), USDC));

        // 4. Cancel.
        uint40[] memory ids = new uint40[](1);
        ids[0] = id;
        spike.cancel(MON_USDC, ids);
        (uint256 bidAfterCancel,) = MON_USDC.bestBidAsk();
        assertEq(bidAfterCancel, bid, "best bid restored after cancel");

        // 5. Withdraw everything back to the contract.
        uint256 back = MARGIN.getBalance(address(spike), USDC);
        spike.withdraw(USDC, back);
        assertEq(IERC20(USDC).balanceOf(address(spike)), FUND, "full round trip, nothing lost");
        assertEq(MARGIN.getBalance(address(spike), USDC), 0, "margin emptied");
    }
}
