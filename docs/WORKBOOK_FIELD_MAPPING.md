# WORKBOOK FIELD MAPPING — SKE EXPORT DOCUMENTS & REALISATION TRACKER

This document provides a strict 1-to-1 mapping between the 31 columns of the Excel workbook (`Export Tracker`), the PostgreSQL database schema (`prisma/schema.prisma`), backend REST API endpoints, and React frontend components.

---

## 1. Master 31-Column Field Mapping Table

| Col | Workbook Header | Data Type | Prisma Model & Field | API JSON Property | Frontend UI Component | Notes & Validation Rules |
|---|---|---|---|---|---|---|
| **A** | `S.No` | Integer | Calculated Index / Row | `index + 1` | `ShipmentListView`, `CompanyLedgerView` | Sequential counter in view |
| **B** | `Invoice No` | String (e.g. `SKE/26-27/020`) | `Shipment.invoiceNumber` | `invoiceNumber` | `NewShipmentModal`, `InvoiceLookupView` | Unique per FY; formatted automatically |
| **C** | `Invoice Date` | Date (YYYY-MM-DD) | `Shipment.invoiceDate` | `invoiceDate` | `ShipmentDetailModal`, `NewShipmentModal` | Must precede or equal SB Date |
| **D** | `Shipping Bill No` | String (7 digits) | `Shipment.shippingBillNumber` | `shippingBillNumber` | `ShipmentDetailModal`, `QuickView` | Indian Customs clearance number |
| **E** | `Shipping Bill Date`| Date (YYYY-MM-DD) | `Shipment.shippingBillDate` | `shippingBillDate` | `ShipmentDetailModal`, `QuickView` | Date of customs filing |
| **F** | `Port Code` | String (e.g. `INMAA1`) | `Shipment.portCode` | `portCode` | `ShipmentDetailModal`, `EditShipmentModal` | e.g. Chennai Sea Port (INMAA1) |
| **G** | `Consignee Name` | String | `Shipment.consignee.name` | `consigneeName` | `CompanyLedgerView`, `ConsigneeSummary` | Foreign buyer matching ConsigneeMaster |
| **H** | `No. of Pkgs` | Integer | `Shipment.packageCount` | `packageCount` | `ShipmentDetailModal`, `QuickView` | Total cartons or packages shipped |
| **I** | `Invoice Value (USD)`| Decimal (18, 2) | `Shipment.invoiceValueUsd` | `invoiceValueUsd` | `ShipmentDetailModal`, `QuickView` | Authoritative commercial invoice value |
| **J** | `FOB Value (INR)` | Decimal (18, 2) | `Shipment.fobValueInr` | `fobValueInr` | `ShipmentDetailModal`, `InvoiceLookupView` | Customs assessed Free on Board value |
| **K** | `Exchange Rate` | Decimal (12, 4) | `Shipment.sbExchangeRate` | `sbExchangeRate` | `ShipmentDetailModal`, `InvoiceLookupView` | Customs rate: `=FOB_INR / Invoice_USD` |
| **L** | `Drawback Amt (INR)` | Decimal (18, 2) | `IncentiveRecord.claimedAmount` (type DRAWBACK) | `incentives[type=DRAWBACK].claimedAmount` | `IncentivesView`, `ShipmentDetailModal` | Duty Drawback claimed from customs |
| **M** | `Drawback Recd` | String / Enum | `IncentiveRecord.status` | `status` | `IncentivesView`, `QuickView` | `CLAIMED`, `PART_RECEIVED`, `RECEIVED` |
| **N** | `Drawback Received Date`| Date | `IncentiveRecord.receivedDate` | `receivedDate` | `IncentivesView`, `QuickView` | Customs scroll credit date |
| **O** | `RoDTEP Amt (INR)`| Decimal (18, 2) | `IncentiveRecord.claimedAmount` (type RODTEP) | `incentives[type=RODTEP].claimedAmount` | `IncentivesView`, `SummaryReportsView` | Remission of duties claim |
| **P** | `RoDTEP Recd` | String / Enum | `IncentiveRecord.status` | `status` | `IncentivesView`, `SummaryReportsView` | RoDTEP scroll credit status |
| **Q** | `RoSCTL Amt (INR)`| Decimal (18, 2) | `IncentiveRecord.claimedAmount` (type ROSCTL) | `incentives[type=ROSCTL].claimedAmount` | `IncentivesView`, `SummaryReportsView` | Apparel rebate claim |
| **R** | `RoSCTL Recd` | String / Enum | `IncentiveRecord.status` | `status` | `IncentivesView`, `SummaryReportsView` | RoSCTL credit status |
| **S** | `Payment Received Date`| Date | `Payment.creditDate` | `paymentCreditDate` | `PaymentsView`, `ShipmentDetailModal` | Bank credit date from FIRC |
| **T** | `Amount Received (USD)`| Decimal (18, 2) | `PaymentAllocation.allocatedAmountUsd` | `totalPaidUsd` | `PaymentsView`, `ShipmentDetailModal` | Foregin currency realized proceeds |
| **U** | `Amount Received (INR)`| Decimal (18, 2) | `Shipment.realisedInr` | `realisedInr` | `PaymentsView`, `CompanyLedgerView` | Rupee value credited to bank account |
| **V** | `Exchange Rate Received`| Decimal (12, 4) | `Shipment.averageRealisedRate` | `averageRealisedRate` | `PaymentsView`, `QuickView` | Bank conversion rate: `=INR_Recd / USD_Recd` |
| **W** | `Bank` | String | `BankMaster.name` | `bankName` | `BankMasterView`, `PaymentsView` | Remittance receiving bank |
| **X** | `Bank Inward No. (IRM)`| String | `Payment.irmNumber` | `irmNumber` | `PaymentsView`, `ShipmentDetailModal` | Unique inward reference number |
| **Y** | `BRC Number` | String | `BrcRecord.brcNumber` | `brcNumber` | `BrcManagementView`, `QuickView` | Bank Realisation Certificate ID |
| **Z** | `BRC Date` | Date | `BrcRecord.issueDate` | `issueDate` | `BrcManagementView`, `QuickView` | Date certificate issued by bank |
| **AA**| `Difference (USD)` | Decimal (18, 2) | `Shipment.balanceDueUsd` | `balanceDueUsd` | `ShipmentDetailModal`, `QuickView` | Balance due: `=Invoice_USD - USD_Recd` |
| **AB**| `Forex Gain / Loss (INR)`| Decimal (18, 2) | Computed Variance | `forexGainLossInr` | `InvoiceLookupView`, `QuickView` | Variance: `=INR_Received - FOB_INR` |
| **AC**| `Gain / Loss` | Enum (`GAIN`/`LOSS`/`NIL`)| Computed Classification | `gainLossTag` | `InvoiceLookupView`, `QuickView` | `GAIN` if AB > 0, `LOSS` if AB < 0 |
| **AD**| `Remarks` | Text | `Shipment.remarks` | `remarks` | `ShipmentDetailModal`, `CompanyLedgerView`| Transport, BL, vessel, or trade notes |
| **AE**| `Key` | String | `Shipment.normalizedInvoiceKey` | `normalizedInvoiceKey` | `InvoiceLookupView`, `ShipmentDetailModal`| Canonical key used for deduplication |

---

## 2. Legacy Mathematical Formulas and Equivalents

### 2.1 Exchange Rate (Column K)
$$\text{Exchange Rate} = \frac{\text{FOB Value (INR)}}{\text{Invoice Value (USD)}}$$
- **Excel Formula**: `=J5/I5`
- **Application Logic**: Evaluated during shipment entry; compared against customs published rate with 100-Rupee tolerance warning.

### 2.2 Exchange Rate Received (Column V)
$$\text{Exchange Rate Received} = \frac{\text{Amount Received (INR)}}{\text{Amount Received (USD)}}$$
- **Excel Formula**: `=IF(T5>0, U5/T5, 0)`
- **Application Logic**: Computed dynamically from allocated inward remittances and weighted when multiple partial payments exist.

### 2.3 Difference USD / Balance Due (Column AA)
$$\text{Difference (USD)} = \text{Invoice Value (USD)} - \text{Amount Received (USD)}$$
- **Excel Formula**: `=I5 - T5`
- **Application Logic**: Enforced to never drop below zero; excess allocations flagged as `EXCESS_RECEIVED`.

### 2.4 Forex Gain / Loss INR (Column AB & AC)
$$\text{Forex Gain / Loss (INR)} = \text{Amount Received (INR)} - \text{FOB Value (INR)}$$
$$\text{Classification} = \begin{cases} \text{"GAIN"} & \text{if } \text{Forex Variance} > 0 \\ \text{"LOSS"} & \text{if } \text{Forex Variance} < 0 \\ \text{"NIL"} & \text{if } \text{Forex Variance} = 0 \end{cases}$$
- **Excel Formula**: `=U5 - J5` and `=IF(AB5>0,"GAIN",IF(AB5<0,"LOSS","NIL"))`
- **Application Logic**: Fully preserved for cross-reconciliation.
