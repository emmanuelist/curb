// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, Vm, console2} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IPerplExchange} from "../src/interfaces/IPerplExchange.sol";

/// @dev Stands in for CurbAccount: a contract that owns a Perpl account, holds its AUSD and sends its orders.
contract PerplProbe {
    IPerplExchange public immutable ex;
    IERC20 public immutable ausd;

    constructor(IPerplExchange ex_, IERC20 ausd_) {
        ex = ex_;
        ausd = ausd_;
    }

    function open(uint256 amount) external {
        ausd.approve(address(ex), amount);
        ex.createAccount(amount);
    }

    function order(IPerplExchange.OrderDesc calldata d) external {
        ex.execOrder(d);
    }

    function withdraw(uint256 amount, address to) external {
        ex.withdrawCollateral(amount);
        require(ausd.transfer(to, amount), "transfer");
    }
}

/// @notice M3 spike for the Agora bounty: can a contract own a Perpl account and trade on Perpl's onchain book?
/// @dev Run: MONAD_RPC_URL=https://rpc.monad.xyz forge test --match-contract PerplProbeForkTest -vv
contract PerplProbeForkTest is Test {
    IPerplExchange constant EX = IPerplExchange(0x34B6552d57a35a1D042CcAe1951BD1C370112a6F);
    IERC20 constant AUSD = IERC20(0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a);
    uint256 constant MON_PERP = 10;
    bytes32 constant ORDER_PLACED = keccak256("OrderPlaced(uint256,uint256,uint256,int256,uint256)");

    PerplProbe probe;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("monad"));
        probe = new PerplProbe(EX, AUSD);
        // AUSD for the probe, from the exchange's own holdings (fork only).
        vm.prank(address(EX));
        require(AUSD.transfer(address(probe), 100e6), "fund");
    }

    function _desc(uint8 orderType, uint256 orderId, uint256 price, uint256 lots, bool postOnly, bool ioc)
        internal
        view
        returns (IPerplExchange.OrderDesc memory)
    {
        return IPerplExchange.OrderDesc({
            orderDescId: block.number,
            perpId: MON_PERP,
            orderType: orderType,
            orderId: orderId,
            pricePNS: price,
            lotLNS: lots,
            expiryBlock: 0,
            postOnly: postOnly,
            fillOrKill: false,
            immediateOrCancel: ioc,
            maxMatches: 0,
            leverageHdths: 1000, // 10x
            lastExecutionBlock: 0,
            amountCNS: 0,
            maxNegPnlCollatBPS: 1000
        });
    }

    function test_contractOwnsAPerplAccountAndTrades() public {
        // 1. Open a Perpl account owned by the contract, with 20 AUSD.
        probe.open(20e6);
        IPerplExchange.AccountInfo memory acct = EX.getAccountByAddr(address(probe));
        console2.log("perpl account id", acct.accountId, "balance CNS", acct.balanceCNS);
        assertGt(acct.accountId, 0, "account created for a contract");
        assertEq(acct.accountAddr, address(probe));

        IPerplExchange.PerpetualInfo memory p = EX.getPerpetualInfo(MON_PERP);
        uint256 bid = p.maxBidPriceONS + p.basePricePNS;
        uint256 ask = p.minAskPriceONS + p.basePricePNS;
        console2.log("MON perp best bid", bid, "best ask", ask);
        assertGt(ask, bid, "book not crossed");

        // 2. A post-only long below the best bid rests on the book.
        vm.recordLogs();
        probe.order(_desc(0, 0, bid - 50, 1000, true, false));
        uint256 orderId;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter == address(EX) && logs[i].topics[0] == ORDER_PLACED) {
                (orderId,,,,) = abi.decode(logs[i].data, (uint256, uint256, uint256, int256, uint256));
            }
        }
        console2.log("resting order id", orderId);
        assertGt(orderId, 0, "order rested");

        // 3. Cancel it.
        probe.order(_desc(4, orderId, 0, 0, false, false));
        acct = EX.getAccountByAddr(address(probe));
        assertEq(acct.lockedBalanceCNS, 0, "nothing locked after cancel");

        // 4. Take the asks: open a 300 MON long at 10x. Priced 0.5% through the best ask so the order can walk levels: the
        //    live book's top level doesn't always hold 300 MON.
        probe.order(_desc(0, 0, ask * 1005 / 1000, 300, false, true));
        (IPerplExchange.PositionInfoV2 memory pos,,) = EX.getPositionV2(MON_PERP, acct.accountId);
        console2.log("position lots", pos.lotLNS, "type", pos.positionType);
        assertEq(pos.lotLNS, 300, "long opened");

        // 5. Close it into the bids, 0.5% through the best one for the same reason (on 2026-10-04 it held 79 MON).
        p = EX.getPerpetualInfo(MON_PERP);
        probe.order(_desc(2, 0, (p.maxBidPriceONS + p.basePricePNS) * 995 / 1000, 300, false, true));
        (pos,,) = EX.getPositionV2(MON_PERP, acct.accountId);
        assertEq(pos.lotLNS, 0, "long closed");

        // 6. Withdraw everything back out of Perpl.
        acct = EX.getAccountByAddr(address(probe));
        console2.log("balance after round trip CNS", acct.balanceCNS);
        address out = makeAddr("out");
        probe.withdraw(acct.balanceCNS, out);
        assertEq(AUSD.balanceOf(out), acct.balanceCNS, "withdrawn to an outside address");
    }
}
