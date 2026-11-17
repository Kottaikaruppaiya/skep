# Rule-Based Export Document Extraction & Local OCR Implementation Plan

A comprehensive architectural blueprint for implementing zero-external-AI document extraction, local OCR, field mapping, conflict detection, review governance, and shipment registration in the SKE Export Documents & Realisation Tracker application.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Strict Zero-AI Compliance**: This plan guarantees **100% local execution** on the VPS. It strictly prohibits external APIs (no Gemini, OpenAI, Claude, cloud OCR, Firebase, or external hosted services). All text parsing, regular expressions, and optical character recognition execute inside the self-contained Node.js / TypeScript environment using `pdf-parse` and local `tesseract.js`.

| Requirement | Proposed Architecture | Decision Rationale |
| :--- | :--- | :--- |
| **OCR Technology** | `tesseract.js` (WebAssembly/JS offline engine) | Runs entirely on self-managed VPS with zero external network calls; processes scanned PDFs & images locally. |
| **Digital PDF Parsing** | `pdf-parse` (Native Node.js buffer extraction) | High-speed, deterministic extraction for vector/digital PDFs without OCR overhead. |
| **Storage Strategy** | Private VPS filesystem (`storage/FY<year>/<invKey>/...`) | Secure, private, immutable document archival with database references; no cloud bucket dependencies. |
| **System of Record** | PostgreSQL / Structured Relational Store (`server/db.ts` & Prisma) | Maintains relational integrity across shipments, payments, allocations, incentives, and documents. |
| **BRC Enforcement** | `SINGLE` (1 file) or `MULTIPLE` (2 files) | Strictly enforces statutory mode selected by the user without allowing missing or excess files. |
| **FIRC Requirement** | Mandatory FIRC evidence before save | Prevents registering unbacked shipments in accordance with SKE compliance policy. |

---

## 1. Feature-to-Workbook Mapping

The 13 worksheets from `Export_Realisation_Tracker_FY2026-27_v3(1).xlsm` map directly to the application's domain model and extraction workflows:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        LEGACY EXCEL WORKBOOK (13 SHEETS)                               │
├────────────────────────┬───────────────────────────────────────────────────────────────┤
│ New Entry (Form)       │ ► NewShipmentModal + Document Auto-Extraction Pipeline        │
│ Export Tracker (A:AE)  │ ► shipments table + Document Records + Payment Allocations    │
│ Quick View (Dashboard) │ ► QuickView.tsx + DashboardView.tsx (Realisation Status)      │
│ Summary (Executive)    │ ► SummaryReportsView.tsx (Incentive & Forex Realisation KPIs) │
│ Consignee Summary      │ ► ConsigneeSummaryView.tsx (Consignee exposure & volume)      │
│ 5 Consignee Ledgers    │ ► CompanyLedgerView.tsx (Isolated dedicated account ledgers)  │
│ Consignee Master       │ ► ConsigneeMasterView.tsx (Master Buyer Directory)            │
│ Bank Master            │ ► BankMasterView.tsx (Authorized AD Code Banks)               │
│ Invoice Lookup         │ ► InvoiceLookupView.tsx (Single Invoice Inspection & Edit)    │
└────────────────────────┴───────────────────────────────────────────────────────────────┘
```

### Detailed Workbook Column to Database Field Mapping
| Excel Tracker Col | Excel Header | DB Field / Target Entity | Extraction Rule / Source Doc |
| :---: | :--- | :--- | :--- |
| **A** | S.No | `shipment.srNo` (Calculated) | Auto-incremented serial number per financial year |
| **B** | Invoice No | `shipment.invoiceNumber` | Extracted from Commercial Invoice `Invoice No & Date: SKE/26-27/xxx` |
| **C** | Invoice Date | `shipment.invoiceDate` | Extracted from Commercial Invoice `Dt: DD-MM-YYYY` |
| **D** | Shipping Bill No | `shipment.shippingBillNumber` | Extracted from Shipping Bill `SB No: 2173318` |
| **E** | Shipping Bill Date | `shipment.shippingBillDate` | Extracted from Shipping Bill `SB Date: DD-MMM-YY` |
| **F** | Port Code | `shipment.portCode` | Extracted from Shipping Bill `Port Code: INMAA1` / `INMAA4` |
| **G** | Consignee Name | `consignee.name` (FK link) | Matched from Commercial Invoice & Shipping Bill `Consignee:` |
| **H** | No. of Pkgs | `shipment.packageCount` | Extracted from Invoice `Total Packages: xx CTN/BALE` |
| **I** | Invoice Value (USD) | `shipment.invoiceValueUsd` | Extracted from Invoice `Total FOB US $ xx,xxx.xx` |
| **J** | FOB Value (INR) | `shipment.fobValueInr` | Extracted from Shipping Bill `1.FOB VALUE xx,xxx.xx` |
| **K** | Exchange Rate | `shipment.sbExchangeRate` | Extracted from Shipping Bill `1 USD INR 92.1` |
| **L** | Drawback Amt (INR) | `incentive.claimedAmount` (DBK) | Extracted from Shipping Bill `1.DBK CLAIM 65291` |
| **M** | Drawback Recd ✔/✘ | `incentive.status` | Set to `RECEIVED` upon bank scroll credit verification |
| **N** | Drawback Recd Date | `incentive.receivedDate` | Recorded when customs scroll is credited |
| **O** | RoDTEP Amt (INR) | `incentive.claimedAmount` (RoDTEP) | Extracted from Shipping Bill `5.RODTEP AMT 26254` |
| **Q** | RoSCTL Amt (INR) | `incentive.claimedAmount` (RoSCTL) | Extracted from Shipping Bill `6.ROSCTL AMT 49195` |
| **S** | Payment Recd Date | `payment.creditDate` | Extracted from FIRC `Credit Date: DD-MMM-YYYY` |
| **T** | Amount Recd (USD) | `payment.verifiedAmount` | Extracted from FIRC `FCY Amount: USD xx,xxx.xx` |
| **U** | Amount Recd (INR) | `payment.inrAmount` | Extracted from FIRC `INR Amount: xx,xxx.xx` |
| **V** | Exchange Rate Recd | `payment.exchangeRate` | Extracted from FIRC `Rate: 93.28` |
| **W** | Bank | `bank.name` (FK link) | Extracted from FIRC `HDFC Bank Ltd` / `DBS Bank` |
| **X** | Bank IRM No | `payment.irmNumber` | Extracted from FIRC `Inward No: 210426I049900457` |
| **Y** | BRC Number | `brcRecord.brcNumber` | Extracted from BRC `Certificate No: HDFC0000166A...` |
| **Z** | BRC Date | `brcRecord.realisationDate` | Extracted from BRC `Date of Realisation: DD-MM-YYYY` |
| **AA** | Difference (USD) | `shipment.balanceDueUsd` | Formula: `invoiceValueUsd - totalPaidUsd` |
| **AB** | Realised Forex (INR)| `allocation.realisedFxInr` | Accurate Forex: `Allocated USD * (FIRC Rate - Booking Rate)` |
| **AD** | Remarks | `shipment.remarks` | Structured operational notes, LEO dates, bank details |

---

## 2. Discrepancy List & Excel Formula Corrections

The inspection identified four critical mathematical and logic flaws in the legacy Excel workbook that the web application explicitly corrects:

1. **Unsafe Legacy Forex Formula (`AB = U - J`)**:
   - *Excel Flaw*: Excel subtracts total FOB INR (`J`) from received INR (`U`). For partial receipts (e.g., USD 50 received on a USD 100 invoice), this falsely calculates a massive forex loss because unpaid principal is mixed with currency movement.
   - *Application Solution*: Forex gain/loss is calculated **per payment allocation**:
     $$\text{Realised Forex Gain/Loss} = \text{Allocated USD} \times (\text{FIRC Exchange Rate} - \text{Booking/SB Rate})$$
2. **Payment-Pending Metric Mismatch (`Summary B16`)**:
   - *Excel Flaw*: Excel counts rows where column `U` (received INR) is blank. Since historical rows often have `U` filled with a partial payment, Excel falsely reports zero unpaid invoices even when 38 invoices have shortfalls.
   - *Application Solution*: Active balance due is evaluated using `invoiceValueUsd - totalAllocatedUsd > 1.00`.
3. **Inferred Bank Charges (`PAID - BANK CHG`)**:
   - *Excel Flaw*: Excel assumes any shortfall between $1 and $50 is a bank charge.
   - *Application Solution*: Actual bank charges are extracted from FIRC advice statements (`Value of Service`, `Bank GST`) and recorded as auditable line items, never guessed.
4. **Fragile BRC Deadline Text Parsing**:
   - *Excel Flaw*: Excel searches for the string `"BRC due "` inside free-text remarks.
   - *Application Solution*: `statutoryDeadline` is stored as an authoritative ISO date field calculated from the Shipping Bill date + statutory days (default 270 days per FEMA).

---

## 3. Database Schema Migration Proposal

To support full field-level provenance, local OCR results, manual overrides, and multi-document conflict detection, we augment the schema:

```prisma
// Augmented Document model in schema.prisma & server/db.ts
model Document {
  id               String           @id @default(uuid())
  shipmentId       String?
  shipment         Shipment?        @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  paymentId        String?
  payment          Payment?         @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  category         DocumentCategory // COMMERCIAL_INVOICE, SHIPPING_BILL, BILL_OF_LADING, FIRC_PAYMENT, BRC_COPY_1, BRC_COPY_2, ADDITIONAL_DOC
  originalFilename String
  storedPath       String           // e.g. storage/FY2026-27/SKE-26-27-020/invoice_xxx.pdf
  mimeType         String
  fileSizeBytes    BigInt
  version          Int              @default(1)
  isCurrent        Boolean          @default(true)
  reviewStatus     ReviewStatus     @default(EXTRACTED) // EXTRACTED, NEEDS_REVIEW, CONFIRMED, MANUALLY_ENTERED
  
  // Field-level extraction metadata & provenance
  extractedData    Json?            // Raw structured extraction output
  ocrApplied       Boolean          @default(false)
  ocrTextPreview   String?          // Extracted local OCR / text snippet preview
  extractionMethod String           @default("PDF_TEXT") // "PDF_TEXT" | "LOCAL_OCR" | "HYBRID" | "MANUAL"
  
  uploadedByUserId String
  uploadedByUser   User             @relation(fields: [uploadedByUserId], references: [id])
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  @@index([shipmentId])
  @@index([paymentId])
  @@index([category])
}

// Field Provenance Record (stored inside shipment.extractionProvenance or audit log)
type FieldProvenance {
  fieldKey        String   // e.g. "invoiceValueUsd"
  sourceDoc       String   // e.g. "SKE-26-27-020-Invoice.pdf"
  category        String   // "COMMERCIAL_INVOICE"
  pageNumber      Int      // e.g. 1
  method          String   // "PDF_TEXT" or "LOCAL_OCR"
  extractedValue  Any      // e.g. 24025.65
  acceptedValue   Any      // e.g. 24025.65
  confidence      String   // "HIGH", "MEDIUM", "LOW", "CONFLICT"
  isManuallyEdited Boolean @default(false)
  conflictNote    String?  // e.g. "Differs from Shipping Bill value of 24025.65"
}
```

---

## 4. Technical Architecture: Zero-AI Local Extraction Engine

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               LOCAL ZERO-AI EXTRACTION & OCR PIPELINE (VPS-HOSTED)                     │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
               ┌────────────────────────────┴───────────────────────────┐
               ▼                                                        ▼
    ┌─────────────────────┐                                  ┌─────────────────────┐
    │  Vector Digital PDF │                                  │ Scanned PDF / Image │
    │   (Searchable Text) │                                  │  (Embedded Raster)  │
    └──────────┬──────────┘                                  └──────────┬──────────┘
               │                                                        │
               ▼                                                        ▼
    ┌─────────────────────┐                                  ┌─────────────────────┐
    │  pdf-parse Engine   │                                  │ Local tesseract.js  │
    │  Fast text stream   │                                  │ WebAssembly Engine  │
    └──────────┬──────────┘                                  └──────────┬──────────┘
               │                                                        │
               └────────────────────────────┬───────────────────────────┘
                                            ▼
                          ┌───────────────────────────────────┐
                          │   Document Classifier & Router    │
                          │   (Header / Keyword Matching)     │
                          └─────────────────┬─────────────────┘
                                            ▼
       ┌────────────────────────────────────┼───────────────────────────────────┐
       ▼                                    ▼                                   ▼
┌──────────────┐                    ┌──────────────┐                    ┌──────────────┐
│  Commercial  │                    │Shipping Bill │                    │ FIRC Advice  │
│   Invoice    │                    │ (ICEGATE EDI)│                    │(HDFC/DBS/etc)│
│  Extractor   │                    │  Extractor   │                    │  Extractor   │
└──────┬───────┘                    └──────┬───────┘                    └──────┬───────┘
       │                                    │                                   │
       └────────────────────────────────────┼───────────────────────────────────┘
                                            ▼
                          ┌───────────────────────────────────┐
                          │     Field Normalizer & Conflict   │
                          │     Detector (Invoice / SB / BRC) │
                          └─────────────────┬─────────────────┘
                                            ▼
                          ┌───────────────────────────────────┐
                          │   Interactive Review & Override   │
                          │   Interface (Modal & Detail View) │
                          └─────────────────┬─────────────────┘
                                            ▼
                          ┌───────────────────────────────────┐
                          │ Atomic Relational Persistence     │
                          │ (PostgreSQL, Filesystem Storage)  │
                          └───────────────────────────────────┘
```

### Extraction Technology Specifications
1. **Digital PDF Stream Processing**: Employs `pdf-parse` to read raw stream objects, extract coordinate text chunks, and detect embedded text.
2. **Local Fallback OCR Engine (`tesseract.js`)**:
   - Executes inside the Node.js runtime via WebAssembly.
   - Triggered when text density of a PDF is $< 50$ characters, or when raster images (`.png`, `.jpg`, `.jpeg`) are uploaded.
   - Pre-processes image buffers (grayscale conversion & contrast enhancement) for optimal character recognition on stamps, thermal receipts, and scanned bills of lading.
3. **Deterministic Document Parsing Modules**:
   - **Commercial Invoice Parser**: Detects exporter ("S K ENTERPRISES"), consignee ("M/s S K Global Ventures", etc.), invoice number patterns (`SKE/\d{2}-\d{2}/\d{3}`), date formats (`06-04-2026`, `06/04/2026`), package count, and line items.
   - **Customs Shipping Bill Parser**: Extracts 7-digit SB Number (`2173318`), SB Date (`07-APR-26`), Port Code (`INMAA1`), CBIC exchange rate (`92.1`), Customs FOB INR (`2212762.37`), and incentive claim sums (`DBK: 65291`, `RODTEP: 26254`, `ROSCTL: 49195`).
   - **Bill of Lading Parser**: Extracts MTD/BL number (`736116000605`), BL Date, Vessel/Voyage (`VARADA / 0085W`), Container numbers, and carrier details.
   - **FIRC Remittance Parser**: Extracts Inward Remittance Number (IRM `210426I049900457`), Sender Reference, Value Date, Credit Date, remitted USD (`$24,025.65`), realized exchange rate (`93.28`), and net credited INR (`₹2,241,112.63`).
   - **eBRC Statement Parser**: Extracts BRC certificate number (`HDFC0000166A02685488`), issue date, realization date, and net realized currency/amount.

---

## 5. User Interface & Review Workflow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ NEW EXPORT SHIPMENT — EXTRACTION & AUDIT REVIEW                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [ DROPZONE: Drop up to 7 documents (Invoice, SB, BL, FIRC, BRC 1, BRC 2, Additional) ] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ STAGED DOCUMENTS (5/7 Uploaded):                                                        │
│  ✓ Commercial Invoice (12ae91b5.pdf)  [Local Text Extracted - 6 fields]                 │
│  ✓ Shipping Bill (f9ef4226.pdf)       [Local Text Extracted - 8 fields]                 │
│  ✓ Bill of Lading (697529d4.pdf)      [Local OCR Applied - 4 fields]                    │
│  ✓ FIRC Advice (8af61d5b.pdf)         [Local Text Extracted - 6 fields]                 │
│  ✓ BRC Copy (4229e495.pdf)            [Local Text Extracted - 4 fields]                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ FIELD-LEVEL VERIFICATION & PROVENANCE INSPECTOR:                                        │
│  • Invoice No: [ SKE/26-27/020       ]  Source: Invoice (p.1) [EXTRACTED - MATCH]       │
│  • SB Number:  [ 2173318             ]  Source: Shipping Bill [EXTRACTED - HIGH]        │
│  • Consignee:  [ S K Global Ventures ]  Source: Match Consignee Master [VERIFIED]       │
│  • FOB USD:    [ $24,025.65          ]  Source: Invoice & FIRC [CONFIRMED EQUAL]        │
│  • FIRC IRM:   [ 210426I049900457    ]  Source: FIRC Advice [LINKED & ALLOCATED]        │
│  • BRC Mode:   (*) Single (1 File)  ( ) Multiple (2 Files)                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ CONFLICT & CONSISTENCY CHECK:                                                           │
│  ✓ Invoice numbers match across Invoice, Shipping Bill and BRC Statement.               │
│  ✓ Customs FOB INR matches Invoice USD × SB Exchange Rate ($24,025.65 × 92.1 = ₹2.21M). │
│  ✓ Mandatory FIRC linkage verified with inward remittance credited via HDFC Bank.       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Clear Staged Form ]                                        [ Save Shipment & Ledger ] │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Validation & Business Rules Matrix

| Rule | Enforcement Level | Failure Action |
| :--- | :--- | :--- |
| **Unique Invoice Key** | Strict Server-Side & UI Debounce | Blocks save with clear error indicating existing shipment ID |
| **Mandatory FIRC Rule** | Strict Server-Side Validation | Rejects shipment save if no valid FIRC payment is linked |
| **BRC Mode Enforcement** | Modal & Server-Side | `SINGLE` requires exactly 1 BRC; `MULTIPLE` requires exactly 2 BRCs |
| **Date Sequence** | Soft Warning / Audit Flag | Warns if Invoice Date is after Shipping Bill Date; records in audit log |
| **FOB Currency Math** | Automatic Recomputation | Verifies `FOB INR ≈ USD * Rate` within customs rounding threshold |
| **Immutable Original Files** | Filesystem Archive | Saves uploaded binary untouched; never overwritten or mutated |

---

## 7. Test Scenarios & Real Document Test Plan

We test the complete extraction and reconciliation pipeline against the five real sample documents provided in the application:

| Document Tested | File Path | Expected Extracted Entities | Verification Criteria |
| :--- | :--- | :--- | :--- |
| **Commercial Invoice** | `public/assets/aistudio/SKE-26-27-020-Invoice_12ae91b5.pdf` | Invoice No: `SKE/26-27/020`<br>Date: `2026-04-06`<br>USD: `24,025.65`<br>Pkgs: `88` | Exact match against database seed |
| **Customs Shipping Bill** | `public/assets/aistudio/SKE-26-27-20-SHIPPING_BILL_f9ef4226.pdf` | SB No: `2173318`<br>Date: `2026-04-07`<br>Port: `INMAA1`<br>FOB INR: `2,212,762.37`<br>Rate: `92.1`<br>DBK: `65,291`<br>RoDTEP: `26,254`<br>RoSCTL: `49,195` | All customs fields extracted without AI |
| **Bill of Lading** | `public/assets/aistudio/BL_SKE-26-27-20_697529d4.pdf` | MTD No: `736116000605`<br>Date: `07/05/2026`<br>Vessel: `VARADA / 0085W`<br>Pkgs: `88` | Local OCR processes scanned raster stream |
| **FIRC Advice** | `public/assets/aistudio/SKE-26-27-20-FIRC_8af61d5b.pdf` | IRM: `210426I049900457`<br>USD: `24,025.65`<br>Rate: `93.28`<br>INR: `2,241,112.63`<br>Bank: `HDFC Bank Ltd` | Creates auditable inward payment allocation |
| **DGFT eBRC Certificate** | `public/assets/aistudio/BRC_Copy_4229e495.pdf` | BRC No: `HDFC0000166A02685488`<br>Realisation Date: `2026-04-20`<br>Realised USD: `24,025.65` | Updates BRC status to `REALISED` |
| **Excel Tracker Sync** | `public/assets/aistudio/Export_Realisation_Tracker_FY26-27_3d40b01e.csv` | Reconciles against Row 20 (`SKE/26-27/020`) | Zero discrepancy with legacy tracking record |

---

## 8. Implementation Steps & Phasing

1. **Phase 1: Backend Extraction Engine Enhancements**:
   - Upgrade `server/extractor.ts` to support image OCR fallback (`tesseract.js`) and raster extraction.
   - Add field provenance metadata (`sourceDoc`, `pageNumber`, `confidence`, `method`, `conflictDetected`).
2. **Phase 2: Extraction Review & Provenance UI**:
   - Enhance `NewShipmentModal.tsx` and `DocumentReviewView.tsx` with field-level provenance cards.
   - Add conflict comparison between Invoice USD vs Shipping Bill FOB vs FIRC credited amount.
3. **Phase 3: Relational Persistence & Audit Trail**:
   - Ensure original files are written to `storage/FY<year>/<invKey>/`.
   - Record immutable field override history in `auditLogs`.
4. **Phase 4: Automated Test Execution**:
   - Run unit and end-to-end extraction tests on all 5 sample export PDFs.
   - Validate TypeScript compilation (`tsc --noEmit`) and dev server stability.
