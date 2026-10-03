// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, Vm, console2} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {CurbAccount} from "../src/CurbAccount.sol";
import {CurbFactory} from "../src/CurbFactory.sol";
import {IKuruMarginAccount} from "../src/interfaces/IKuruMarginAccount.sol";
import {IPerplExchange} from "../src/interfaces/IPerplExchange.sol";

/// @notice #49: CurbAccount on Perpl, on a fork of Monad mainnet against Perpl's live MON perpetual book, under
///         Monad's execution rules. Refusal paths first (CLAUDE.md rule 4).
/// @dev Run: MONAD_RPC_URL=https://rpc.monad.xyz forge test --match-contract CurbPerplForkTest -vv
contract CurbPerplForkTest is Test {
    IKuruMarginAccount constant MARGIN = IKuruMarginAccount(0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5);
    address constant MON_USDC = 0x065C9d28E428A0db40191a54d33d5b7c71a9C394;
    IPerplExchange constant PERPL = IPerplExchange(0x34B6552d57a35a1D042CcAe1951BD1C370112a6F);
    IERC20 constant AUSD = IERC20(0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a);
    uint256 constant MON_PERP = 10;
    uint16 constant CAP = 500; // 5x
    bytes32 constant ORDER_PLACED = keccak256("OrderPlaced(uint256,uint256,uint256,int256,uint256)");

    CurbFactory factory;
    CurbAccount account;
    address owner = makeAddr("owner");
    address trader = makeAddr("trader");
    address outside = makeAddr("outside");

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("monad"));
        factory = new CurbFactory(MARGIN, MON_USDC, PERPL, MON_PERP, CAP);
        vm.prank(owner);
        account = factory.create(trader);

        // AUSD for the owner, from the exchange's own holdings (fork only). The owner sends 50 to the account and
        // moves it into Perpl, which opens the account's Perpl account.
        vm.prank(address(PERPL));
        require(AUSD.transfer(owner, 100e6), "fund");
        vm.startPrank(owner);
        require(AUSD.transfer(address(account), 50e6), "to account");
        uint256 g = gasleft();
        account.perplDeposit(50e6);
        console2.log("perplDeposit (opens the Perpl account) gas", g - gasleft());
        vm.stopPrank();
    }

    function _order(uint8 orderType, uint256 price, uint256 lots, uint256 leverage, bool postOnly, bool ioc)
        internal
        view
        returns (IPerplExchange.OrderDesc memory)
    {
        return IPerplExchange.OrderDesc({
            orderDescId: block.number,
            perpId: MON_PERP,
            orderType: orderType,
            orderId: 0,
            pricePNS: price,
            lotLNS: lots,
            expiryBlock: 0,
            postOnly: postOnly,
            fillOrKill: false,
            immediateOrCancel: ioc,
            maxMatches: 0,
            leverageHdths: leverage,
            lastExecutionBlock: 0,
            amountCNS: 0,
            maxNegPnlCollatBPS: 1000
        });
    }

    function _top() internal view returns (uint256 bid, uint256 ask) {
        IPerplExchange.PerpetualInfo memory p = PERPL.getPerpetualInfo(MON_PERP);
        bid = p.maxBidPriceONS + p.basePricePNS;
        ask = p.minAskPriceONS + p.basePricePNS;
    }

    function _perplBalance() internal view returns (uint256) {
        return PERPL.getAccountByAddr(address(account)).balanceCNS;
    }

    // ------------------------------------------------------------------ refusals

    function test_refuses_traderWithdrawalFromPerpl() public {
        uint256 before = _perplBalance();
        assertEq(before, 50e6, "the account's Perpl collateral");

        vm.prank(trader);
        vm.expectRevert(CurbAccount.NotOwner.selector);
        account.perplWithdraw(1e6, trader);

        vm.prank(trader);
        vm.expectRevert(CurbAccount.NotOwner.selector);
        account.sweep(address(AUSD), 1, trader);

        // Nor can the trading key reach the Perpl account directly: it belongs to the account contract.
        vm.prank(trader);
        vm.expectRevert();
        PERPL.withdrawCollateral(1e6);
        assertEq(_perplBalance(), before, "collateral untouched");
    }

    function test_refuses_offLanePerpOrders_bothWays() public {
        (uint256 maxBuy, uint256 minSell) = account.perpLane(MON_PERP);
        vm.prank(trader);
        vm.expectRevert(
            abi.encodeWithSelector(CurbAccount.PerpOffLane.selector, MON_PERP, true, maxBuy + 1, maxBuy)
        );
        account.perplOrder(_order(0, maxBuy + 1, 300, CAP, false, true));

        vm.prank(trader);
        vm.expectRevert(
            abi.encodeWithSelector(CurbAccount.PerpOffLane.selector, MON_PERP, false, minSell - 1, minSell)
        );
        account.perplOrder(_order(1, minSell - 1, 300, CAP, false, true));
    }

    function test_refuses_leverageAboveTheCap() public {
        (, uint256 ask) = _top();
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.LeverageAboveCap.selector, 1000, CAP));
        account.perplOrder(_order(0, ask, 300, 1000, false, true));
    }

    function test_refuses_otherPerpsAndOrderTypes() public {
        IPerplExchange.OrderDesc memory btc = _order(0, 1, 1, CAP, false, true);
        btc.perpId = 1;
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.PerpNotAllowed.selector, 1));
        account.perplOrder(btc);

        (, uint256 ask) = _top();
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(CurbAccount.PerpOrderNotAllowed.selector, 5));
        account.perplOrder(_order(5, ask, 300, CAP, false, true));
    }

    // ------------------------------------------------------------------ what the keys may do

    function test_trader_restsAPostOnlyLong_andOwnerCancels() public {
        (uint256 bid,) = _top();
        vm.recordLogs();
        vm.prank(trader);
        uint256 g = gasleft();
        account.perplOrder(_order(0, bid - 50, 1000, CAP, true, false));
        console2.log("perplOrder resting gas", g - gasleft());

        uint256 orderId;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter == address(PERPL) && logs[i].topics[0] == ORDER_PLACED) {
                (orderId,,,,) = abi.decode(logs[i].data, (uint256, uint256, uint256, int256, uint256));
            }
        }
        assertGt(orderId, 0, "rested on Perpl's book");
        assertGt(PERPL.getAccountByAddr(address(account)).lockedBalanceCNS, 0, "margin locked for the order");

        vm.prank(owner); // the owner key may cancel too
        g = gasleft();
        account.perplCancel(MON_PERP, orderId);
        console2.log("perplCancel gas", g - gasleft());
        assertEq(PERPL.getAccountByAddr(address(account)).lockedBalanceCNS, 0, "nothing locked after cancel");
    }

    function test_trader_opensAndClosesALong_insideTheLane() public {
        (, uint256 ask) = _top();
        vm.prank(trader);
        uint256 g = gasleft();
        account.perplOrder(_order(0, ask, 300, CAP, false, true));
        console2.log("perplOrder taking gas", g - gasleft());

        uint256 id = PERPL.getAccountByAddr(address(account)).accountId;
        (IPerplExchange.PositionInfoV2 memory pos,,) = PERPL.getPositionV2(MON_PERP, id);
        assertEq(pos.lotLNS, 300, "long opened at 5x");
        assertEq(pos.positionType, 0);

        (uint256 bid,) = _top();
        vm.prank(trader);
        account.perplOrder(_order(2, bid, 300, CAP, false, true));
        (pos,,) = PERPL.getPositionV2(MON_PERP, id);
        assertEq(pos.lotLNS, 0, "long closed");
    }

    function test_owner_topsUp_andWithdrawsAusd_toAnOutsideAddress() public {
        vm.startPrank(owner);
        require(AUSD.transfer(address(account), 10e6), "to account");
        account.perplDeposit(10e6); // a second deposit tops up the existing Perpl account
        assertEq(_perplBalance(), 60e6);

        uint256 g = gasleft();
        account.perplWithdraw(25e6, outside);
        console2.log("perplWithdraw gas", g - gasleft());
        vm.stopPrank();
        assertEq(AUSD.balanceOf(outside), 25e6, "AUSD reached the outside address");
        assertEq(_perplBalance(), 35e6);
    }

    function test_factory_predictsTheV2Address() public view {
        assertEq(factory.accountOf(owner, trader), address(account));
        assertEq(address(account.perpl()), address(PERPL));
        assertEq(address(account.perplCollateral()), address(AUSD), "collateral read from Perpl");
        (bool allowed, uint16 cap) = account.perps(MON_PERP);
        assertTrue(allowed);
        assertEq(cap, CAP);
    }
}
