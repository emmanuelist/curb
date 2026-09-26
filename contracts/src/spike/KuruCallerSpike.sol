// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IKuruOrderBook} from "../interfaces/IKuruOrderBook.sol";
import {IKuruMarginAccount} from "../interfaces/IKuruMarginAccount.sol";

/// @notice Spike for issue #1: can a *contract* own Kuru margin and resting orders?
/// @dev Throwaway. Not the product contract (CurbAccount, M2) and never deployed to mainnet.
contract KuruCallerSpike {
    address public immutable owner;
    IKuruMarginAccount public immutable margin;

    error NotOwner();

    constructor(IKuruMarginAccount margin_) {
        owner = msg.sender;
        margin = margin_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function deposit(address token, uint256 amount) external onlyOwner {
        IERC20(token).approve(address(margin), amount);
        margin.deposit(address(this), token, amount);
    }

    function placeBuy(IKuruOrderBook book, uint32 price, uint96 size) external onlyOwner {
        book.addBuyOrder(price, size, true);
    }

    function cancel(IKuruOrderBook book, uint40[] calldata orderIds) external onlyOwner {
        book.batchCancelOrders(orderIds);
    }

    function withdraw(address token, uint256 amount) external onlyOwner {
        margin.withdraw(amount, token);
    }
}
