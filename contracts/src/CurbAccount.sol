// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IKuruOrderBook} from "./interfaces/IKuruOrderBook.sol";
import {IKuruMarginAccount} from "./interfaces/IKuruMarginAccount.sol";

/// @title CurbAccount
/// @notice A trading key that can't withdraw, and can't trade off Kuru's live order book.
/// @dev The account owns its Kuru margin and orders. Two keys from one passkey drive it:
///      - the owner withdraws, rotates the trader and chooses markets;
///      - the trader places and cancels limit orders, and only inside the lane: Kuru's live best bid/ask
///        ± LANE_BAND_BPS, read from the book in the same transaction. The rule mirrors
///        `web/src/lib/lane.ts` exactly (maxBuy floored to a tick, minSell ceiled to a tick; an empty or
///        crossed book has no lane).
contract CurbAccount {
    /// @notice Half-width of the lane around Kuru's best bid/ask, in basis points.
    uint256 public constant LANE_BAND_BPS = 50;
    /// @notice Kuru's MarginAccount uses the zero address for native MON.
    address public constant NATIVE = address(0);

    uint256 private constant BPS = 10_000;
    uint256 private constant WAD = 1e18;

    struct Market {
        bool allowed;
        uint32 pricePrecision;
        uint32 tickSize;
    }

    address public immutable owner;
    IKuruMarginAccount public immutable margin;
    address public trader;
    mapping(address market => Market) public markets;

    event TraderSet(address indexed previous, address indexed next);
    event MarketSet(address indexed market, bool allowed);
    event OrderSent(address indexed market, bool isBuy, uint32 price, uint96 size);
    event Withdrawn(address indexed token, uint256 amount, address indexed to);

    error NotOwner();
    error NotTrader();
    error NotOwnerOrTrader();
    error MarketNotAllowed(address market);
    /// @dev One side of the book is empty (Kuru returns 0 or 2^256-1), or the book is crossed.
    error NoMarket(address market);
    /// @dev The price is past a curb: above maxBuy for a buy, below minSell for a sell.
    error OffLane(bool isBuy, uint32 price, uint32 limit);
    error NotOnTick(uint32 price, uint32 tickSize);
    error ZeroPrice();
    error TransferFailed();
    error ZeroAddress();

    // `trader_` may be address(0): an account can start with no trading key.
    // forge-lint: disable-next-line(missing-zero-check)
    constructor(address owner_, address trader_, IKuruMarginAccount margin_, address market_) {
        if (owner_ == address(0) || address(margin_) == address(0)) revert ZeroAddress();
        owner = owner_;
        margin = margin_;
        trader = trader_;
        emit TraderSet(address(0), trader_);
        _setMarket(market_, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyTrader() {
        if (msg.sender != trader) revert NotTrader();
        _;
    }

    receive() external payable {}

    // ---------------------------------------------------------------- trading key

    /// @notice Rest or take a buy on `market`, at most at the lane's maxBuy.
    function placeBuy(address market, uint32 price, uint96 size, bool postOnly) external onlyTrader {
        _checkPrice(market, true, price);
        emit OrderSent(market, true, price, size);
        IKuruOrderBook(market).addBuyOrder(price, size, postOnly);
    }

    /// @notice Rest or take a sell on `market`, at least at the lane's minSell.
    function placeSell(address market, uint32 price, uint96 size, bool postOnly) external onlyTrader {
        _checkPrice(market, false, price);
        emit OrderSent(market, false, price, size);
        IKuruOrderBook(market).addSellOrder(price, size, postOnly);
    }

    /// @notice Cancel this account's orders. Either key may cancel: cancelling never moves money out.
    function cancel(address market, uint40[] calldata orderIds) external {
        if (msg.sender != trader && msg.sender != owner) revert NotOwnerOrTrader();
        IKuruOrderBook(market).batchCancelOrders(orderIds);
    }

    // ---------------------------------------------------------------- owner key

    /// @notice Withdraw from this account's Kuru margin straight to `to`. Owner only.
    function withdraw(address token, uint256 amount, address to) external onlyOwner {
        emit Withdrawn(token, amount, to);
        margin.withdraw(amount, token);
        _send(token, amount, to);
    }

    /// @notice Send tokens held by the account itself (outside Kuru margin) to `to`. Owner only.
    function sweep(address token, uint256 amount, address to) external onlyOwner {
        emit Withdrawn(token, amount, to);
        _send(token, amount, to);
    }

    /// @notice Replace or revoke (address(0)) the trading key. Owner only.
    // forge-lint: disable-next-line(missing-zero-check)
    function setTrader(address next) external onlyOwner {
        address previous = trader;
        trader = next; // address(0) revokes the trading key
        emit TraderSet(previous, next);
    }

    /// @notice Allow or disallow a Kuru market for the trading key. Owner only.
    function setMarket(address market, bool allowed) external onlyOwner {
        _setMarket(market, allowed);
    }

    // ---------------------------------------------------------------- the lane

    /// @notice The prices the trading key may use on `market` right now.
    /// @return maxBuy Kuru's best ask + LANE_BAND_BPS, floored to a tick (price units).
    /// @return minSell Kuru's best bid - LANE_BAND_BPS, ceiled to a tick (price units).
    function lane(address market) external view returns (uint32 maxBuy, uint32 minSell) {
        Market memory m = markets[market];
        if (!m.allowed) revert MarketNotAllowed(market);
        return _lane(market, m);
    }

    function _checkPrice(address market, bool isBuy, uint32 price) internal view {
        Market memory m = markets[market];
        if (!m.allowed) revert MarketNotAllowed(market);
        (uint32 maxBuy, uint32 minSell) = _lane(market, m);
        if (price == 0) revert ZeroPrice();
        if (price % m.tickSize != 0) revert NotOnTick(price, m.tickSize);
        if (isBuy) {
            if (price > maxBuy) revert OffLane(true, price, maxBuy);
        } else if (price < minSell) {
            revert OffLane(false, price, minSell);
        }
    }

    function _lane(address market, Market memory m) internal view returns (uint32 maxBuy, uint32 minSell) {
        (uint256 rawBid, uint256 rawAsk) = IKuruOrderBook(market).bestBidAsk();
        if (_empty(rawBid) || _empty(rawAsk)) revert NoMarket(market);
        uint256 bid = rawBid * m.pricePrecision / WAD;
        uint256 ask = rawAsk * m.pricePrecision / WAD;
        if (bid >= ask) revert NoMarket(market);

        // Floor (maxBuy) and ceil (minSell) to a tick: the division before the multiplication is the rounding,
        // exactly as web/src/lib/lane.ts does it.
        uint256 tick = m.tickSize;
        // forge-lint: disable-next-line(divide-before-multiply)
        uint256 up = ask * (BPS + LANE_BAND_BPS) / BPS / tick * tick;
        // forge-lint: disable-next-line(divide-before-multiply)
        uint256 down = (bid * (BPS - LANE_BAND_BPS) / BPS + tick - 1) / tick * tick;
        // Kuru prices are uint32. Cap instead of truncating: a truncated minSell could let an off-lane sell through.
        // forge-lint: disable-next-line(unsafe-typecast)
        maxBuy = up > type(uint32).max ? type(uint32).max : uint32(up);
        // forge-lint: disable-next-line(unsafe-typecast)
        minSell = down > type(uint32).max ? type(uint32).max : uint32(down);
    }

    function _empty(uint256 raw) internal pure returns (bool) {
        return raw == 0 || raw == type(uint256).max;
    }

    function _setMarket(address market, bool allowed) internal {
        if (allowed) {
            // forge-lint: disable-next-line(unused-return)
            (uint32 pricePrecision,,,,,, uint32 tickSize,,,,) = IKuruOrderBook(market).getMarketParams();
            markets[market] = Market(true, pricePrecision, tickSize);
        } else {
            delete markets[market];
        }
        emit MarketSet(market, allowed);
    }

    function _send(address token, uint256 amount, address to) internal {
        if (to == address(0)) revert ZeroAddress();
        if (token == NATIVE) {
            // Owner-only callers choose `to`: sending the owner's money where the owner says is the point.
            // forge-lint: disable-next-line(arbitrary-send-eth)
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else if (!IERC20(token).transfer(to, amount)) {
            revert TransferFailed();
        }
    }
}
