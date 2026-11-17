# WORKBOOK FUNCTIONALITY MAPPING — SKE EXPORT DOCUMENTS & REALISATION TRACKER

This document specifies how each macro-driven workflow, validation, and reporting action from the Excel workbook (`Export_Realisation_Tracker_FY2026-27_v3(2).xlsm`) is reconstructed into the web application.

---

## 1. New Entry Workflow

### 1.1 Workbook Behavior
- The user fills in an input form containing Shipping Bill details, commercial values, export incentive claims, and foreign remittance information.
- Clicking "Save" executed a VBA macro that validated required cells, formatted the invoice number, checked for duplicates, appended a new row to `Export Tracker`, inserted formula cells, and cleared the input form.
- Clicking "Clear" reset the form.

### 1.2 Web Application Implementation
- **Component**: `/src/components/NewShipmentModal.tsx` and `POST /api/shipments`.
- **Automatic Invoice Number Formatting**: Converts numeric inputs like `269` into `SKE/26-27/269` with 3-digit zero-padding.
- **Next Invoice Suggestion**: Analyzes existing invoices in the selected Financial Year and suggests the next sequential invoice number.
- **Real-Time Duplicate Prevention**: Debounced uniqueness check against `normalizedInvoiceKey` within the target FY.
- **Mandatory Field Validation**:
  - Shipping Bill Number and Date.
  - Consignee Master linkage.
  - Port Code and Package Count.
  - Invoice Value USD and Customs FOB INR.
  - **Mandatory FIRC Rule**: Blocks saving a verified shipment unless valid inward remittance evidence (FIRC / IRM) is uploaded or linked.
- **Automatic Exchange Rate & FOB Computation**: Real-time calculation with warning if custom FOB INR differs from USD × Rate by more than ₹100.
- **Clear Action**: Resets all form fields and staged documents cleanly.

---

## 2. Invoice Lookup Workflow

### 2.1 Workbook Behavior
- The user enters an Invoice Number or Shipping Bill in cell `C3`.
- `VLOOKUP` and VBA populated the current records across all 31 tracker columns.
- The user could type replacement values in dedicated "Change To" fields.
- Typing `DEL` in a "Change To" field indicated clearing that specific field.
- Leaving a "Change To" field blank meant preserving the existing value.
- Clicking "Save Changes" updated the master row in `Export Tracker`.

### 2.2 Web Application Implementation
- **Component**: `/src/views/InvoiceLookupView.tsx` and `PUT /api/shipments/:id`.
- **Search & Normalization**: Immediate matching across `invoiceNumber`, `normalizedInvoiceKey`, `shippingBillNumber`, and `blNumber`.
- **Safe Field Editing**:
  - Displays original read-only current values alongside editable "Change To" inputs.
  - **Blank Safety Rule**: Blank fields never erase existing data.
  - **DEL Flag Rule**: Typing `DEL` or clicking "Clear Field" explicitly clears optional fields (e.g. BL Number, Vessel, Remarks).
  - Every update records an audit log entry in PostgreSQL (`AuditLog`) capturing `userId`, `oldValues`, and `newValues`.

---

## 3. Quick View Workflow

### 3.1 Workbook Behavior
- A 15-column high-density table scanning invoice status, outstanding balance, realization dates, and pending incentives.
- Top-level KPI summary cards:
  - Total Bills.
  - Fully Paid Bills.
  - Part Paid Bills.
  - Pending Bills.
  - Outstanding USD.
  - Net Forex INR.
  - Drawback Pending INR.
  - All Incentives Pending INR.
- Legacy Statuses: `PENDING`, `RECD – INR PENDING`, `PART PAID`, `PAID – BANK CHG`, `EXCESS RECEIVED`, `PAID`.

### 3.2 Web Application Implementation
- **Component**: `/src/views/QuickView.tsx`.
- Renders the full 15-column table with pagination and real-time filters (by Consignee, FY, Status, and Bank).
- Evaluates PostgreSQL relational allocations to derive `PART_PAID`, `FULLY_PAID`, `UNPAID`, and `EXCESS_RECEIVED`.
- Preserves top-level KPI summary cards with `tabular-nums` formatting.
- Direct drill-down: Clicking any invoice number opens `/src/components/ShipmentDetailModal.tsx`.

---

## 4. Summary Reports Workflow

### 4.1 Workbook Behavior
- Matrix aggregating government incentive schemes:
  - Scheme Name (Duty Drawback, RoDTEP, RoSCTL, Total Incentives).
  - Total Claimed (INR).
  - Total Received (INR).
  - Pending Balance (INR).
  - Percentage Received.
- Foreign exchange and realization reconciliation:
  - Total Invoiced USD vs Realised USD.
  - Customs Assessed FOB INR vs Bank Credited INR.
  - Net Forex Gain/Loss INR.

### 4.2 Web Application Implementation
- **Component**: `/src/views/SummaryReportsView.tsx`.
- Displays dedicated Incentive Scheme Summary and Forex Realisation cards.
- Provides monthly breakdown table and exports to CSV/XLSX.

---

## 5. Consignee Summary Workflow

### 5.1 Workbook Behavior
Consolidated report covering all 16 canonical columns:
1. Consignee Name.
2. Number of Invoices.
3. Total Packages.
4. Invoice Value (USD).
5. FOB Value (INR).
6. Average Exchange Rate.
7. Received Amount (USD).
8. Outstanding Balance (USD).
9. Drawback Claimed (INR).
10. Drawback Pending (INR).
11. RoDTEP Claimed (INR).
12. RoDTEP Pending (INR).
13. RoSCTL Claimed (INR).
14. RoSCTL Pending (INR).
15. Total Incentives Pending (INR).
16. Net Forex Gain / Loss (INR).

### 5.2 Web Application Implementation
- **Component**: `/src/views/ConsigneeSummaryView.tsx`.
- Renders all 16 canonical columns with sorting, search, and CSV/XLSX download.

---

## 6. Dynamic Consignee Ledgers Workflow

### 6.1 Workbook Behavior
- 5 separate static worksheets for the 5 key overseas buyers:
  1. `SK Global Ventures`
  2. `Shasvanth Impex`
  3. `Precision Tex Lanka`
  4. `Tex Fab Lanka`
  5. `Winfield Merchant`

### 6.2 Web Application Implementation
- **Component**: `/src/views/CompanyLedgerView.tsx`.
- Reconstructed as a single **Dynamic Consignee Ledger** component.
- The user can select any buyer from a clean dropdown, instantly filtering the view.
- Generates buyer-specific CSV statements (`/api/export/csv?sheet={BuyerName}`) and full multi-sheet workbooks.

---

## 7. Operational Masters (Consignee & Bank)

### 7.1 Consignee Master
- Authoritative master maintaining legal entity names, addresses, countries, discharge ports, credit terms, currencies, and emails.
- Standard legal names:
  - `S K GLOBAL VENTURES PRIVATE LIMITED`
  - `SHASVANTH IMPEX PRIVATE LIMITED`
  - `PRECISION TEX LANKA PVT LTD`
  - `TEX FAB LANKA PRIVATE LIMITED`
  - `WINFIELD MERCHANT AND GENERAL PVT LTD`
- Prevents duplicates caused by casing or extra spaces.

### 7.2 Bank Master
- Authoritative receiving banks:
  - `DBS Bank India` (AD Code: `6690005`, IFSC: `DBSS0IN0811`, Chennai Branch)
  - `HDFC Bank` (Parrys Branch, Chennai)
  - `Kotak Mahindra Bank` (Mount Road Branch, Chennai)
  - `Yes Bank` (Parrys Corner, Chennai)
- Provides full CRUD with audit logging.

---

## 8. Multi-Payment & FIRC Allocations

### 8.1 Reconstructed Architecture
- In the original Excel sheet, only one payment could be logged per invoice row.
- In the web application:
  - Payments are stored once in `Payment` (with unique `irmNumber`, currency, verified USD, exchange rate, INR amount, credit date, value date, bank, and supporting FIRC document).
  - Remittances are allocated to shipments via `PaymentAllocation`.
  - Multiple payments can be allocated to a single invoice (partial payments).
  - A single large remittance can be distributed across multiple invoices.
  - Concurrency-safe mutex locking prevents over-allocation.
  - Available balance rule: $\text{Available Balance} = \text{Verified Amount} - \sum \text{Active Allocations}$.

---

## 9. BRC & Incentive Management

### 9.1 BRC Management
- Enforces Single Mode (exactly 1 document file) and Multiple Mode (exactly 2 document files).
- Tracks BRC Number, Issue Date, Realisation Date, Realised Amount, Currency, Status (`PENDING`, `ISSUED`, `REALISED`, `OVERDUE`), and Statutory Deadline.

### 9.2 Incentive Management
- Tracks Duty Drawback (DBK), RoDTEP, and RoSCTL independently.
- Supports partial receipts, customs scroll numbers, and receipt dates.

---

## 10. Local Document Processing & Historical Migration

### 10.1 Local Extraction (No External APIs)
- Uses `pdf-parse` module in Node.js to read text from uploaded PDF documents.
- Extracts invoice numbers, dates, amounts, SB numbers, ports, packages, IRMs, and BRC references locally.
- Requires user/admin review before committing extracted values.

### 10.2 Historical Excel/CSV Migration
- Implements the mandatory historical rule: **Legacy records lacking FIRC/payment evidence are excluded from valid imported shipments and logged in an exception/rejection report**.
- Full reconciliation report comparing workbook totals against database totals.
