// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {CurbAccount} from "./CurbAccount.sol";
import {IKuruMarginAccount} from "./interfaces/IKuruMarginAccount.sol";
import {IPerplExchange} from "./interfaces/IPerplExchange.sol";

/// @title CurbFactory
/// @notice Creates one CurbAccount per owner at a CREATE2 address that depends only on the owner's and
///         trader's keys, so the app can always find an account again from the passkey alone.
contract CurbFactory {
    IKuruMarginAccount public immutable margin;
    /// @notice The Kuru market every new account starts with (MON-USDC on mainnet).
    address public immutable defaultMarket;
    IPerplExchange public immutable perpl;
    /// @notice Perpl's collateral token, read from the exchange (AUSD on mainnet).
    IERC20 public immutable perplCollateral;
    /// @notice The Perpl perpetual every new account starts with (MON on mainnet), and its leverage cap.
    uint256 public immutable defaultPerp;
    uint16 public immutable defaultMaxLeverageHdths;

    event AccountCreated(address indexed owner, address indexed account, address trader);

    error ZeroAddress();

    constructor(
        IKuruMarginAccount margin_,
        address defaultMarket_,
        IPerplExchange perpl_,
        uint256 defaultPerp_,
        uint16 defaultMaxLeverageHdths_
    ) {
        if (address(margin_) == address(0) || defaultMarket_ == address(0) || address(perpl_) == address(0)) {
            revert ZeroAddress();
        }
        margin = margin_;
        defaultMarket = defaultMarket_;
        perpl = perpl_;
        // forge-lint: disable-next-line(unused-return)
        (,,,, address collateral,) = perpl_.getExchangeInfo();
        if (collateral == address(0)) revert ZeroAddress();
        perplCollateral = IERC20(collateral);
        defaultPerp = defaultPerp_;
        defaultMaxLeverageHdths = defaultMaxLeverageHdths_;
    }

    /// @notice Create the caller's account, owned by the caller, traded by `trader`.
    function create(address trader) external returns (CurbAccount account) {
        account = new CurbAccount{salt: _salt(msg.sender)}(
            msg.sender, trader, margin, defaultMarket, _perplConfig()
        );
        // The only external call is this factory's own CREATE of CurbAccount, which calls nothing back here.
        // forge-lint: disable-next-line(reentrancy-events)
        emit AccountCreated(msg.sender, address(account), trader);
    }

    /// @notice Where `owner`'s account lives (or will), given the trader it was created with.
    function accountOf(address owner, address trader) external view returns (address) {
        bytes32 initCodeHash = keccak256(
            bytes.concat(
                type(CurbAccount).creationCode,
                abi.encode(owner, trader, margin, defaultMarket, _perplConfig())
            )
        );
        return address(
            uint160(
                uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), _salt(owner), initCodeHash)))
            )
        );
    }

    function _perplConfig() internal view returns (CurbAccount.PerplConfig memory) {
        return CurbAccount.PerplConfig(perpl, perplCollateral, defaultPerp, defaultMaxLeverageHdths);
    }

    function _salt(address owner) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(owner)));
    }
}
