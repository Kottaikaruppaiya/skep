# WORKBOOK ANALYSIS — EXPORT REALISATION TRACKER FY2026-27

**Source File**: `Export_Realisation_Tracker_FY2026-27_v3(2).xlsm`  
**Derived Package**: CSV Analysis Package & AI Studio Inspection Assets  
**Organisation**: S K Enterprises  
**Financial Year**: 2026-2027 (Capacity for multi-year tracking)

---

## 1. Workbook Structure & Worksheets Inventory

The workbook contains 13 visible worksheets, structured to handle operational export entries, fast invoice lookups, executive KPI overviews, buyer-specific ledgers, and master configurations:

| # | Worksheet Name | Type / Role | Source Row / Capacity | Primary Business Purpose |
|---|---|---|---|---|
| 1 | **New Entry** | Input Form | Form Layout (Header + Fields) | Data entry form for new export invoices, Shipping Bills, incentives, and FIRC allocations. Triggered macros to append records to Export Tracker. |
| 2 | **Invoice Lookup** | Operational Lookup | Key Lookup & Field Editors | Search by Invoice Number or Shipping Bill. Displays 31 tracker fields and provides "Change To" fields with `DEL` flag for clearing values. |
| 3 | **Quick View** | Executive Status | Rows 5–604 (Formula Range) | Fast-scan 15-column table displaying invoice status, outstanding USD, realized INR, pending incentives, and BRC due indicators. |
| 4 | **Export Tracker** | Core Master Register | Rows 5–274 populated (Capacity to row 605) | Primary tabular ledger containing all 31 columns (A–AE) for all historical and current export shipments. |
| 5 | **Summary** | Analytical Report | Summary Matrix & Monthly Tables | Comprehensive summary of export value, realisation percentages, government incentive claims (Drawback, RoDTEP, RoSCTL), and monthly realisations. |
| 6 | **Consignee Summary** | Buyer Aggregation | 16 Canonical Columns | Consolidated performance per overseas buyer: invoice count, packages, billed USD, customs FOB INR, received USD, pending balance, and incentive statuses. |
| 7 | **SK Global Ventures** | Specific Buyer Ledger | Rows 5+ | Isolated shipment ledger for S K Global Ventures Private Limited (Sri Lanka). |
| 8 | **Shasvanth Impex** | Specific Buyer Ledger | Rows 5+ | Isolated shipment ledger for Shasvanth Impex Private Limited (Sri Lanka). |
| 9 | **Precision Tex Lanka** | Specific Buyer Ledger | Rows 5+ | Isolated shipment ledger for Precision Tex Lanka Pvt Ltd (Sri Lanka). |
| 10 | **Tex Fab Lanka** | Specific Buyer Ledger | Rows 5+ | Isolated shipment ledger for Tex Fab Lanka Private Limited (Sri Lanka). |
| 11 | **Winfield Merchant** | Specific Buyer Ledger | Rows 5+ | Isolated shipment ledger for Winfield Merchant and General Pvt Ltd (Sri Lanka). |
| 12 | **Consignee Master** | Operational Master | Master List | Authoritative buyer records: legal company names, country, port of discharge, payment terms, currency, and contact emails. |
| 13 | **Bank Master** | Operational Master | Master List | Authorized receiving banks: DBS Bank India (AD Code: 6690005, IFSC: DBSS0IN0811), HDFC Bank, Kotak Mahindra Bank, and Yes Bank. |

---

## 2. Export Tracker (Core Register Analysis)

The Export Tracker comprises 31 columns (A through AE):
- **Populated Range**: Rows 5 through 274 (270 populated commercial invoice records).
- **Designed Formula Capacity**: Through row 605.
- **Identified Workbook Discrepancy**: While the Export Tracker worksheet formulas and formatted rows extend to row 605, several formulas in the Quick View and Consignee Summary sheets explicitly referenced ranges up to row 604 (`$A$5:$AE$604`), creating an apparent 1-row truncation risk in the spreadsheet. In the PostgreSQL-backed web application, dynamic relational queries eliminate this manual range discrepancy.

### The 31 Master Columns:
1. `Col A: S.No` — Sequential serial number.
2. `Col B: Invoice No` — Commercial invoice number (e.g., `SKE/26-27/020`).
3. `Col C: Invoice Date` — Invoice issuance date (YYYY-MM-DD format).
4. `Col D: Shipping Bill No` — 7-digit Indian Customs Shipping Bill number (e.g., `2173318`).
5. `Col E: Shipping Bill Date` — Customs clearance/filing date.
6. `Col F: Port Code` — Customs port code (e.g., `INMAA1` for Chennai Sea, `INNSA1` for Nhava Sheva).
7. `Col G: Consignee Name` — Registered overseas buyer name.
8. `Col H: No. of Pkgs` — Package / carton count.
9. `Col I: Invoice Value (USD)` — Total billed commercial invoice value in USD.
10. `Col J: FOB Value (INR)` — Customs FOB value in Indian Rupees.
11. `Col K: Exchange Rate` — Customs exchange rate: `=FOB_INR / Invoice_USD`.
12. `Col L: Drawback Amt (INR)` — Customs Duty Drawback claimed amount.
13. `Col M: Drawback Recd` — Receipt indicator / status.
14. `Col N: Drawback Received Date` — Date drawback credited to bank.
15. `Col O: RoDTEP Amt (INR)` — Remission of Duties and Taxes on Exported Products claimed amount.
16. `Col P: RoDTEP Recd` — RoDTEP receipt status.
17. `Col Q: RoSCTL Amt (INR)` — Rebate of State and Central Taxes and Levies claimed amount.
18. `Col R: RoSCTL Recd` — RoSCTL receipt status.
19. `Col S: Payment Received Date` — Date foreign inward remittance credited to account.
20. `Col T: Amount Received (USD)` — Foreign currency proceeds received in USD.
21. `Col U: Amount Received (INR)` — Net Rupee proceeds credited by the bank.
22. `Col V: Exchange Rate Received` — Bank foreign exchange conversion rate: `=INR_Received / USD_Received`.
23. `Col W: Bank` — Authorized receiving bank name (e.g., `HDFC Bank`, `DBS Bank India`).
24. `Col X: Bank Inward Remittance No. (IRM)` — Inward Remittance Message / FIRC reference number (e.g., `210426I049900457`).
25. `Col Y: BRC Number` — Bank Realisation Certificate reference number (e.g., `HDFC0000166A02685488`).
26. `Col Z: BRC Date` — DGFT statement / BRC document issuance date.
27. `Col AA: Difference (USD)` — Outstanding invoice balance: `=Invoice_USD - USD_Received`.
28. `Col AB: Forex Gain / Loss (INR)` — Net exchange variance: `=INR_Received - FOB_INR`.
29. `Col AC: Gain / Loss` — Classification tag: `GAIN` if `AB > 0`, `LOSS` if `AB < 0`, `NIL` if `AB = 0`.
30. `Col AD: Remarks` — Free-text notes, transport details, BL numbers, or vessel names.
31. `Col AE: Key` — Legacy tracking key based on consignee and occurrence index.

---

## 3. Critical CSV Limitations & Macro Reconstruction

CSV exports cannot execute:
1. **Embedded VBA Event Handlers & Macros**:
   - `New Entry` Append macro: In the workbook, clicking "Save Entry" fired VBA code that found the next empty row in Export Tracker, generated the formula cells, and cleared the input form. In the web app, this is reconstructed as a secure PostgreSQL ACID transaction (`POST /api/shipments`).
   - `Invoice Lookup` Edit macro: In the workbook, typing a query in the lookup sheet pulled data via `VLOOKUP` or VBA, and submitting edits updated specific cells. In the web app, this is reconstructed with atomic updates, audit logging, and `DEL` field-clearing support.
2. **Interactive Dropdowns**: Replaced with PostgreSQL master-backed select inputs.
3. **Dynamic Formula Recomputation**: Reconstructed in backend business logic with decimal precision (`Decimal(18, 2)`).
4. **Conditional Formatting**: Reconstructed using responsive Tailwind styling and semantic status badges.
