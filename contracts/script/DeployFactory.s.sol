// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {CurbFactory} from "../src/CurbFactory.sol";
import {IKuruMarginAccount} from "../src/interfaces/IKuruMarginAccount.sol";

/// @notice #31: deploy CurbFactory to Monad mainnet (chain 143) against Kuru's MarginAccount and MON-USDC.
/// @dev Dry run (no broadcast): forge script script/DeployFactory.s.sol --rpc-url $MONAD_RPC_URL --sender $DEPLOYER_ADDRESS
///      Broadcast only with the user's go-ahead (CLAUDE.md rule 6): add --broadcast --private-key $DEPLOYER_PRIVATE_KEY
contract DeployFactory is Script {
    IKuruMarginAccount constant MARGIN = IKuruMarginAccount(0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5);
    address constant MON_USDC = 0x065C9d28E428A0db40191a54d33d5b7c71a9C394;

    function run() external returns (CurbFactory factory) {
        require(block.chainid == 143, "Monad mainnet only");
        vm.startBroadcast();
        factory = new CurbFactory(MARGIN, MON_USDC);
        vm.stopBroadcast();
        console2.log("CurbFactory", address(factory));
    }
}
