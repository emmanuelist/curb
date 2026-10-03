// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IKuruOrderBook} from "./interfaces/IKuruOrderBook.sol";
import {IKuruMarginAccount} from "./interfaces/IKuruMarginAccount.sol";
import {IPerplExchange} from "./interfaces/IPerplExchange.sol";

/// @title CurbAccount
/// @notice A trading key that can't withdraw, and can't trade off the live order book.
/// @dev The account owns its money and orders on two onchain books: Kuru (spot) and Perpl (perpetuals, AUSD
///      collateral). Two keys from one passkey drive it:
///      - the owner moves money in and out, rotates the trader, and chooses markets and the leverage cap;
///      - the trader places and cancels orders, and only inside the lane: the venue's live best bid/ask
///        ± LANE_BAND_BPS, read from its book in the same transaction. On Perpl it is also held to the owner's
///        leverage cap. The rules mirror `web/src/lib/lane.ts` exactly (maxBuy floored to a tick, minSell
///        ceiled to a tick; an empty or crossed book has no lane).
contract CurbAccount {
    /// @notice Half-width of the lane around the venue's best bid/ask, in basis points.
    uint256 public constant LANE_BAND_BPS = 50;
    /// @notice Kuru's MarginAccount uses the zero address for native MON.
    address public constant NATIVE = address(0);

    uint256 private constant BPS = 10_000;
    uint256 private constant WAD = 1e18;

    // Perpl order types the trading key may send (docs/CONTEXT.md → Perpl). Cancel goes through perplCancel.
    uint8 private constant OPEN_LONG = 0;
    uint8 private constant CLOSE_SHORT = 3;
    uint8 private constant CANCEL = 4;

    struct Market {
        bool allowed;
        uint32 pricePrecision;
        uint32 tickSize;
    }

    struct Perp {
        bool allowed;
        /// @dev The most leverage the trading key may use on this perpetual, in hundredths (500 = 5x).
        uint16 maxLeverageHdths;
    }

    /// @notice How a new account reaches Perpl, and the one perpetual it starts with.
    struct PerplConfig {
        IPerplExchange exchange;
        IERC20 collateral;
        uint256 perpId;
        uint16 maxLeverageHdths;
    }

    address public immutable owner;
    IKuruMarginAccount public immutable margin;
    IPerplExchange public immutable perpl;
    /// @notice Perpl's collateral token (AUSD on mainnet).
    IERC20 public immutable perplCollateral;
    address public trader;
    /// @notice Whether this account has opened its Perpl account (Perpl's createAccount runs once).
    bool public perplOpened;
    mapping(address market => Market) public markets;
    mapping(uint256 perpId => Perp) public perps;

    event TraderSet(address indexed previous, address indexed next);
    event MarketSet(address indexed market, bool allowed);
    event PerpSet(uint256 indexed perpId, bool allowed, uint256 maxLeverageHdths);
    event OrderSent(address indexed market, bool isBuy, uint32 price, uint96 size);
    event PerpOrderSent(
        uint256 indexed perpId, uint8 orderType, uint256 pricePNS, uint256 lotLNS, uint256 leverageHdths
    );
    event PerplDeposited(uint256 amountCNS);
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
    error PerpNotAllowed(uint256 perpId);
    /// @dev One side of Perpl's book for this perpetual is empty, or the book is crossed.
    error PerpNoMarket(uint256 perpId);
    /// @dev The price is past a curb on Perpl's book: above maxBuy for a bid, below minSell for an ask.
    error PerpOffLane(uint256 perpId, bool isBuy, uint256 price, uint256 limit);
    error LeverageAboveCap(uint256 leverageHdths, uint256 cap);
    /// @dev The trading key may only open or close positions (order types 0-3), with no collateral attached.
    error PerpOrderNotAllowed(uint8 orderType);

    constructor(
        address owner_,
        // `trader_` may be address(0): an account can start with no trading key.
        // forge-lint: disable-next-line(missing-zero-check)
        address trader_,
        IKuruMarginAccount margin_,
        address market_,
        PerplConfig memory perpl_
    ) {
        if (owner_ == address(0) || address(margin_) == address(0)) revert ZeroAddress();
        owner = owner_;
        margin = margin_;
        perpl = perpl_.exchange;
        perplCollateral = perpl_.collateral;
        trader = trader_;
        emit TraderSet(address(0), trader_);
        _setMarket(market_, true);
        if (address(perpl_.exchange) != address(0)) _setPerp(perpl_.perpId, true, perpl_.maxLeverageHdths);
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

    /// @notice Open or close a long or short on Perpl: only inside the lane on Perpl's live book, and at no more
    ///         than the owner's leverage cap for that perpetual.
    function perplOrder(IPerplExchange.OrderDesc calldata d) external onlyTrader {
        _checkPerpOrder(d);
        emit PerpOrderSent(d.perpId, d.orderType, d.pricePNS, d.lotLNS, d.leverageHdths);
        perpl.execOrder(d);
    }

    /// @notice Cancel one of this account's Perpl orders. Either key may cancel: cancelling never moves money out.
    function perplCancel(uint256 perpId, uint256 orderId) external {
        if (msg.sender != trader && msg.sender != owner) revert NotOwnerOrTrader();
        perpl.execOrder(
            IPerplExchange.OrderDesc({
                orderDescId: block.number,
                perpId: perpId,
                orderType: CANCEL,
                orderId: orderId,
                pricePNS: 0,
                lotLNS: 0,
                expiryBlock: 0,
                postOnly: false,
                fillOrKill: false,
                immediateOrCancel: false,
                maxMatches: 0,
                leverageHdths: 0,
                lastExecutionBlock: 0,
                amountCNS: 0,
                maxNegPnlCollatBPS: 0
            })
        );
    }

    // ---------------------------------------------------------------- owner key

    /// @notice Withdraw from this account's Kuru margin straight to `to`. Owner only.
    function withdraw(address token, uint256 amount, address to) external onlyOwner {
        emit Withdrawn(token, amount, to);
        margin.withdraw(amount, token);
        _send(token, amount, to);
    }

    /// @notice Send tokens held by the account itself (outside Kuru and Perpl) to `to`. Owner only.
    function sweep(address token, uint256 amount, address to) external onlyOwner {
        emit Withdrawn(token, amount, to);
        _send(token, amount, to);
    }

    /// @notice Move `amountCNS` of the account's own collateral (AUSD) into its Perpl account, opening that account
    ///         on first use (Perpl's minimum applies). Owner only.
    function perplDeposit(uint256 amountCNS) external onlyOwner {
        emit PerplDeposited(amountCNS);
        if (!perplCollateral.approve(address(perpl), amountCNS)) revert TransferFailed();
        if (perplOpened) {
            perpl.depositCollateral(amountCNS);
        } else {
            perplOpened = true;
            // The return value is Perpl's account id, readable later with getAccountByAddr.
            // forge-lint: disable-next-line(unused-return)
            perpl.createAccount(amountCNS);
        }
    }

    /// @notice Withdraw `amountCNS` of collateral from the account's Perpl account straight to `to`. Owner only.
    function perplWithdraw(uint256 amountCNS, address to) external onlyOwner {
        emit Withdrawn(address(perplCollateral), amountCNS, to);
        perpl.withdrawCollateral(amountCNS);
        _send(address(perplCollateral), amountCNS, to);
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

    /// @notice Allow or disallow a Perpl perpetual for the trading key, with its leverage cap. Owner only.
    function setPerp(uint256 perpId, bool allowed, uint16 maxLeverageHdths) external onlyOwner {
        _setPerp(perpId, allowed, maxLeverageHdths);
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

    /// @notice The prices the trading key may use on Perpl perpetual `perpId` right now.
    /// @return maxBuy Perpl's best ask + LANE_BAND_BPS, floored (PNS): the most a bid may carry.
    /// @return minSell Perpl's best bid - LANE_BAND_BPS, ceiled (PNS): the least an ask may carry.
    function perpLane(uint256 perpId) external view returns (uint256 maxBuy, uint256 minSell) {
        if (!perps[perpId].allowed) revert PerpNotAllowed(perpId);
        return _perpLane(perpId);
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

    function _checkPerpOrder(IPerplExchange.OrderDesc calldata d) internal view {
        Perp memory p = perps[d.perpId];
        if (!p.allowed) revert PerpNotAllowed(d.perpId);
        // Opens and closes only, with no collateral attached: anything else could move money or skip the lane.
        if (d.orderType > CLOSE_SHORT || d.amountCNS != 0) revert PerpOrderNotAllowed(d.orderType);
        if (d.leverageHdths > p.maxLeverageHdths) {
            revert LeverageAboveCap(d.leverageHdths, p.maxLeverageHdths);
        }
        (uint256 maxBuy, uint256 minSell) = _perpLane(d.perpId);
        if (d.pricePNS == 0) revert ZeroPrice();
        // Bids are OpenLong and CloseShort; asks are OpenShort and CloseLong.
        bool isBuy = d.orderType == OPEN_LONG || d.orderType == CLOSE_SHORT;
        if (isBuy) {
            if (d.pricePNS > maxBuy) revert PerpOffLane(d.perpId, true, d.pricePNS, maxBuy);
        } else if (d.pricePNS < minSell) {
            revert PerpOffLane(d.perpId, false, d.pricePNS, minSell);
        }
    }

    function _lane(address market, Market memory m) internal view returns (uint32 maxBuy, uint32 minSell) {
        (uint256 rawBid, uint256 rawAsk) = IKuruOrderBook(market).bestBidAsk();
        if (_empty(rawBid) || _empty(rawAsk)) revert NoMarket(market);
        uint256 bid = rawBid * m.pricePrecision / WAD;
        uint256 ask = rawAsk * m.pricePrecision / WAD;
        if (bid >= ask) revert NoMarket(market);

        // maxBuy: ask × (1 + band) rounded down to a tick. minSell: bid × (1 − band) rounded up, then up to a tick,
        // so a sell can never sit below best bid − band. The division before the multiplication is the rounding,
        // exactly as web/src/lib/lane.ts does it (shared fixtures in CurbLane.t.sol and lane.test.ts).
        uint256 tick = m.tickSize;
        // forge-lint: disable-next-line(divide-before-multiply)
        uint256 up = ask * (BPS + LANE_BAND_BPS) / BPS / tick * tick;
        // forge-lint: disable-next-line(divide-before-multiply)
        uint256 down = ((bid * (BPS - LANE_BAND_BPS) + BPS - 1) / BPS + tick - 1) / tick * tick;
        // Kuru prices are uint32. Cap instead of truncating: a truncated minSell could let an off-lane sell through.
        // forge-lint: disable-next-line(unsafe-typecast)
        maxBuy = up > type(uint32).max ? type(uint32).max : uint32(up);
        // forge-lint: disable-next-line(unsafe-typecast)
        minSell = down > type(uint32).max ? type(uint32).max : uint32(down);
    }

    /// @dev Perpl prices have a tick of one price unit, so flooring and ceiling are integer division.
    function _perpLane(uint256 perpId) internal view returns (uint256 maxBuy, uint256 minSell) {
        IPerplExchange.PerpetualInfo memory info = perpl.getPerpetualInfo(perpId);
        if (info.maxBidPriceONS == 0 || info.minAskPriceONS == 0) revert PerpNoMarket(perpId);
        uint256 bid = info.maxBidPriceONS + info.basePricePNS;
        uint256 ask = info.minAskPriceONS + info.basePricePNS;
        if (bid >= ask) revert PerpNoMarket(perpId);
        maxBuy = ask * (BPS + LANE_BAND_BPS) / BPS;
        minSell = (bid * (BPS - LANE_BAND_BPS) + BPS - 1) / BPS;
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

    function _setPerp(uint256 perpId, bool allowed, uint16 maxLeverageHdths) internal {
        if (allowed) {
            perps[perpId] = Perp(true, maxLeverageHdths);
        } else {
            delete perps[perpId];
        }
        emit PerpSet(perpId, allowed, allowed ? maxLeverageHdths : 0);
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
