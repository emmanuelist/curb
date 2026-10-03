// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {CurbFactory} from "../src/CurbFactory.sol";
import {IKuruMarginAccount} from "../src/interfaces/IKuruMarginAccount.sol";
import {IPerplExchange} from "../src/interfaces/IPerplExchange.sol";

/// @notice #50: deploy CurbFactory v2 to Monad mainnet (chain 143): Kuru's MarginAccount and MON-USDC, and Perpl's
///         Exchange with the MON perpetual at a 5x leverage cap. (v1, Kuru only, was #31: E-016.)
/// @dev Dry run (no broadcast): forge script script/DeployFactory.s.sol --rpc-url $MONAD_RPC_URL --sender $DEPLOYER_ADDRESS
///      Broadcast only with the user's go-ahead (CLAUDE.md rule 6): add --broadcast --private-key $DEPLOYER_PRIVATE_KEY
contract DeployFactory is Script {
    IKuruMarginAccount constant MARGIN = IKuruMarginAccount(0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5);
    address constant MON_USDC = 0x065C9d28E428A0db40191a54d33d5b7c71a9C394;
    IPerplExchange constant PERPL = IPerplExchange(0x34B6552d57a35a1D042CcAe1951BD1C370112a6F);
    uint256 constant MON_PERP = 10;
    uint16 constant MAX_LEVERAGE_HDTHS = 500; // 5x

    function run() external returns (CurbFactory factory) {
        require(block.chainid == 143, "Monad mainnet only");
        vm.startBroadcast();
        factory = new CurbFactory(MARGIN, MON_USDC, PERPL, MON_PERP, MAX_LEVERAGE_HDTHS);
        vm.stopBroadcast();
        console2.log("CurbFactory", address(factory));
    }
}
