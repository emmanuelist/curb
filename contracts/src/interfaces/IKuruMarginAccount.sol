// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Subset of Kuru's MarginAccount used by Curb.
/// @dev Signatures from `@kuru-labs/kuru-sdk` 0.0.95 `abi/MarginAccount.json` (see docs/CONTEXT.md).
interface IKuruMarginAccount {
    /// @dev Credits `_user`; anyone may deposit on behalf of any user.
    function deposit(address _user, address _token, uint256 _amount) external payable;
    function withdraw(uint256 _amount, address _token) external;
    function getBalance(address _user, address _token) external view returns (uint256);
}
