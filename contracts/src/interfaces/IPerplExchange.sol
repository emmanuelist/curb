// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Subset of Perpl's Exchange (perpetual futures on an onchain order book) used by Curb.
/// @dev Struct layouts and signatures from `perpl-sdk` 0.2.9 `abi/dex/Exchange.json`, for the implementation
///      behind the mainnet proxy (version 1.7.5, docs/CONTEXT.md → Perpl). Behaviour confirmed by fork tests
///      (E-020), not by the ABI alone.
interface IPerplExchange {
    /// @dev orderType: 0 OpenLong, 1 OpenShort, 2 CloseLong, 3 CloseShort, 4 Cancel, 5 IncreasePositionCollateral,
    ///      6 Change. Prices are PNS (USD × 10^priceDecimals), sizes LNS (lots × 10^lotDecimals), collateral CNS.
    struct OrderDesc {
        uint256 orderDescId;
        uint256 perpId;
        uint8 orderType;
        uint256 orderId;
        uint256 pricePNS;
        uint256 lotLNS;
        uint256 expiryBlock;
        bool postOnly;
        bool fillOrKill;
        bool immediateOrCancel;
        uint256 maxMatches;
        uint256 leverageHdths;
        uint256 lastExecutionBlock;
        uint256 amountCNS;
        uint256 maxNegPnlCollatBPS;
    }

    struct PerpetualInfo {
        string name;
        string symbol;
        uint256 priceDecimals;
        uint256 lotDecimals;
        bytes32 linkFeedId;
        uint256 priceTolPer100K;
        uint256 marginTol;
        uint256 marginTolDecimals;
        uint256 refPriceMaxAgeSec;
        uint256 positionBalanceCNS;
        uint256 insuranceBalanceCNS;
        uint256 markPNS;
        uint256 markTimestamp;
        uint256 lastPNS;
        uint256 lastTimestamp;
        uint256 oraclePNS;
        uint256 oracleTimestampSec;
        uint256 longOpenInterestLNS;
        uint256 shortOpenInterestLNS;
        uint256 fundingStartBlock;
        int16 fundingRatePct100k;
        uint256 absFundingClampPctPer100K;
        uint8 status;
        uint256 basePricePNS;
        /// @dev The best bid, in order price units (PNS = ONS + basePricePNS); 0 when there are no bids.
        uint256 maxBidPriceONS;
        uint256 minBidPriceONS;
        uint256 maxAskPriceONS;
        /// @dev The best ask, in order price units; 0 when there are no asks.
        uint256 minAskPriceONS;
        uint256 numOrders;
        bool ignOracle;
    }

    struct PositionBitMap {
        uint256 bank1;
        uint256 bank2;
        uint256 bank3;
        uint256 bank4;
    }

    struct AccountInfo {
        uint256 accountId;
        uint256 balanceCNS;
        uint256 lockedBalanceCNS;
        uint8 frozen;
        address accountAddr;
        PositionBitMap positions;
    }

    struct PositionInfoV2 {
        uint256 accountId;
        uint256 nextNodeId;
        uint256 prevNodeId;
        uint8 positionType;
        uint256 depositCNS;
        uint256 pricePNS;
        uint256 lotLNS;
        uint256 entryBlock;
        int256 pnlCNS;
        int256 deltaPnlCNS;
        int256 premiumPnlCNS;
        uint256 priceResiduePNSQ16;
    }

    /// @dev Opens an exchange account owned by msg.sender, funded with `amountCNS` of the collateral token
    ///      (approved first); at least getMinAccountOpenCNS().
    function createAccount(uint256 amountCNS) external returns (uint256);
    function depositCollateral(uint256 amountCNS) external;
    function withdrawCollateral(uint256 amountCNS) external;
    function execOrder(OrderDesc calldata orderDesc) external;

    function getExchangeInfo()
        external
        view
        returns (
            uint256 balanceCNS,
            uint256 protocolBalanceCNS,
            uint256 recycleBalanceCNS,
            uint256 collateralDecimals,
            address collateralToken,
            address verifierProxy
        );
    function getPerpetualInfo(uint256 perpId) external view returns (PerpetualInfo memory);
    function getAccountByAddr(address accountAddress) external view returns (AccountInfo memory);
    function getPositionV2(uint256 perpId, uint256 accountId)
        external
        view
        returns (PositionInfoV2 memory positionInfo, uint256 markPricePNS, bool markPriceValid);
}
