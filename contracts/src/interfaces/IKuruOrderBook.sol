// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Subset of Kuru's OrderBook used by Curb.
/// @dev Signatures from `@kuru-labs/kuru-sdk` 0.0.95 `abi/OrderBook.json` (see docs/CONTEXT.md);
///      behaviour confirmed by fork tests, not by the ABI alone.
interface IKuruOrderBook {
    function addBuyOrder(uint32 _price, uint96 size, bool _postOnly) external;
    function addSellOrder(uint32 _price, uint96 size, bool _postOnly) external;
    function batchCancelOrders(uint40[] calldata _orderIds) external;

    function bestBidAsk() external view returns (uint256 bestBid, uint256 bestAsk);

    /// @return pricePrecision, sizePrecision, baseAsset, baseDecimals, quoteAsset, quoteDecimals,
    ///         tickSize, minSize, maxSize, takerFeeBps, makerFeeBps (field order per the SDK)
    function getMarketParams()
        external
        view
        returns (uint32, uint96, address, uint256, address, uint256, uint32, uint96, uint96, uint256, uint256);

    function s_orderIdCounter() external view returns (uint40);

    /// @return ownerAddress, size, prev, next, flippedId, price, flippedPrice, isBuy (names inferred)
    function s_orders(uint40 orderId)
        external
        view
        returns (address, uint96, uint40, uint40, uint40, uint32, uint32, bool);
}
