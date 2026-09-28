// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {CurbAccount} from "./CurbAccount.sol";
import {IKuruMarginAccount} from "./interfaces/IKuruMarginAccount.sol";

/// @title CurbFactory
/// @notice Creates one CurbAccount per owner at a CREATE2 address that depends only on the owner's and
///         trader's keys, so the app can always find an account again from the passkey alone.
contract CurbFactory {
    IKuruMarginAccount public immutable margin;
    /// @notice The market every new account starts with (Kuru MON-USDC on mainnet).
    address public immutable defaultMarket;

    event AccountCreated(address indexed owner, address indexed account, address trader);

    error ZeroAddress();

    constructor(IKuruMarginAccount margin_, address defaultMarket_) {
        if (address(margin_) == address(0) || defaultMarket_ == address(0)) revert ZeroAddress();
        margin = margin_;
        defaultMarket = defaultMarket_;
    }

    /// @notice Create the caller's account, owned by the caller, traded by `trader`.
    function create(address trader) external returns (CurbAccount account) {
        account = new CurbAccount{salt: _salt(msg.sender)}(msg.sender, trader, margin, defaultMarket);
        // The only external call is this factory's own CREATE of CurbAccount, which calls nothing back here.
        // forge-lint: disable-next-line(reentrancy-events)
        emit AccountCreated(msg.sender, address(account), trader);
    }

    /// @notice Where `owner`'s account lives (or will), given the trader it was created with.
    function accountOf(address owner, address trader) external view returns (address) {
        bytes32 initCodeHash = keccak256(
            bytes.concat(type(CurbAccount).creationCode, abi.encode(owner, trader, margin, defaultMarket))
        );
        return address(
            uint160(
                uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), _salt(owner), initCodeHash)))
            )
        );
    }

    function _salt(address owner) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(owner)));
    }
}
