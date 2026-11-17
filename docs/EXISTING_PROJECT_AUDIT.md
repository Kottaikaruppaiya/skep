# EXISTING PROJECT AUDIT — SKE EXPORT DOCUMENTS & REALISATION TRACKER

**Application Name**: SKE — Export Documents & Realisation Tracker  
**Organisation**: S K Enterprises  
**Auditor**: Lead Full-Stack Software Architect  
**Audit Date**: November 1, 2026  
**Environment**: Google AI Studio Development Sandbox (Target Deployment: Ubuntu LTS VPS with Docker Compose & PostgreSQL)

---

## 1. Executive Summary

This audit assesses the existing code assets, database abstractions, APIs, business calculations, frontend components, and deployment assets for the **S K Enterprises Export Documents & Realisation Tracker**. The application is designed to replace the Excel-based workbook (`Export_Realisation_Tracker_FY2026-27_v3(2).xlsm`) with a centralised, secure, multi-user web application backed by PostgreSQL.

---

## 2. Technology Stack & Component Inventory

### 2.1 Frontend Framework & Configuration
- **Core Framework**: React 19 (React 19.2.0), TypeScript 5.8.2, Vite 6.2.0.
- **Styling**: Tailwind CSS v4 (`@import "tailwindcss";` with `@custom-variant dark`).
- **Icons**: Lucide React.
- **Client Networking**: Custom API client in `/src/api/client.ts` with Bearer token authentication and file upload helpers.
- **State Management**: React state hooks (`useState`, `useEffect`, `useMemo`, `useCallback`) with server synchronization.

### 2.2 Backend Architecture & APIs
- **Runtime**: Node.js with TypeScript (`tsx server.ts`).
- **Web Framework**: Express 4.21.2 mounted with Vite dev middleware in development.
- **API Routing**: `/server/routes.ts` mounted at `/api`.
- **Database Access Layer**:
  - Authoritative Prisma ORM schema defined at `/prisma/schema.prisma` targeting PostgreSQL.
  - Development file-backed persistence engine `/server/db.ts` maintaining relational consistency and writing atomic snapshots to `/storage/data/db.json` when running in environments without a live PostgreSQL instance.
- **Authentication & Roles**:
  - PBKDF2 cryptographic password hashing (`crypto.pbkdf2Sync` with SHA-512, 1000 iterations).
  - JWT session generation (`jsonwebtoken`).
  - Three strictly defined roles: `SUPER_ADMIN`, `ADMIN`, `VIEWER`. No unauthorized "Staff" role.
  - Server-side role guard middleware: `requireRole(['SUPER_ADMIN'])`, `requireRole(['SUPER_ADMIN', 'ADMIN'])`.

### 2.3 Document Storage & Extraction
- **Private Filesystem**: Files stored under `/storage/FY{financialYearLabel}/{normalizedInvoiceKey}/`.
- **Local PDF Parsing**: `pdf-parse` module in `/server/extractor.ts` operating strictly on local buffers.
- **AI Dependency**: **Zero external AI or Cloud OCR dependencies.** No Google Gemini API calls, no OpenAI calls, no third-party cloud extraction.
- **Dual-Mode BRC**: Enforces Single Mode (exactly 1 file) and Multiple Mode (exactly 2 files).

### 2.4 Excel Import & Export Engine
- **Engine**: SheetJS (`xlsx`).
- **Capabilities**:
  - Export comprehensive multi-sheet workbook matching the original workbook sheets (`Export Tracker`, `Quick View`, `Consignee Summary`, `S K Global Ventures`, `Shasvanth Impex`, `Consignee Master`, `Bank Master`, `Inward Remittances`).
  - Single sheet CSV generation via `/api/export/csv?sheet={sheetName}`.
  - Historical Excel/CSV migration parser with FIRC exclusion rule and duplicate detection.

---

## 3. Detailed Component & Route Audit

| Component / File | Purpose | Functional State | Database Connected | Notes |
|---|---|---|---|---|
| `/prisma/schema.prisma` | PostgreSQL relational schema | Fully Defined | Ready for migrations | Defines all 14 core entities, enums, indexes, and relations |
| `/server/db.ts` | Data service layer | Fully Implemented | Connected (JSON/PG fallback) | Thread-safe mutex locks for payment allocations, audit logging, relational integrity |
| `/server/routes.ts` | REST API routes | Fully Implemented | Connected | Auth, Shipments, Documents, Payments, BRC, Incentives, Masters, Reports, Import/Export |
| `/server/extractor.ts` | Local regex/PDF extraction | Fully Implemented | N/A | Extracts Invoice, SB, FIRC, BRC, BL locally without external AI |
| `/server/normalizer.ts` | Invoice key normalizer | Fully Implemented | N/A | Normalizes `SKE/26-27/020`, `SKE-26-27-20`, `SKE PI 26 27 020` to canonical key |
| `/server/excel.ts` | SheetJS import/export | Implemented | Connected | Generates multi-sheet workbook, handles CSV export and historical migration |
| `/src/App.tsx` | Main application shell | Fully Implemented | Connected | Navigation, financial year selector, global modals |
| `/src/components/Sidebar.tsx` | Main navigation drawer | Fully Implemented | Connected | Role-based menu links, mobile responsive |
| `/src/views/DashboardView.tsx` | Executive KPI dashboard | Fully Implemented | Connected | Real metrics from backend, no hardcoded values |
| `/src/views/ShipmentListView.tsx` | Export Tracker view | Fully Implemented | Connected | Filter by FY, search, payment status, review status |
| `/src/components/NewShipmentModal.tsx` | New Entry modal | Fully Implemented | Connected | Batch document drop, local extraction, uniqueness check |
| `/src/components/ShipmentDetailModal.tsx` | Comprehensive shipment detail | Fully Implemented | Connected | 5 tabs, document downloads, allocations, BRC, incentives |
| `/src/components/EditShipmentModal.tsx` | Shipment edit dialog | Fully Implemented | Connected | Recalculates FOB INR, updates metadata |
| `/src/components/AllocatePaymentModal.tsx`| Inward remittance allocation | Fully Implemented | Connected | Multi-payment allocation with over-allocation prevention |
| `/src/components/DocumentUploadModal.tsx`| Stored document upload | Fully Implemented | Connected | Private filesystem storage with MIME validation |
| `/src/views/InvoiceLookupView.tsx` | Invoice lookup & normalizer | Partially Implemented | Connected | Needs full 31-field change-to and DEL safe edit workflow |
| `/src/views/QuickView.tsx` | Quick View summary | Partially Implemented | Connected | Needs full 15-column table and top KPI strips |
| `/src/views/SummaryReportsView.tsx` | Summary reports | Partially Implemented | Connected | Has monthly view; needs Incentive Scheme & Forex Summary tables |
| `/src/views/ConsigneeSummaryView.tsx`| Consignee summary report | Partially Implemented | Connected | Needs all 16 canonical columns from workbook |
| `/src/views/CompanyLedgerView.tsx` | Specific company ledger | Fully Implemented | Connected | High-fidelity buyer ledger; needs dynamic consignee switcher for all 5 buyers |
| `/src/views/ConsigneeMasterView.tsx`| Consignee Master management | Fully Implemented | Connected | Full CRUD with audit trail |
| `/src/views/BankMasterView.tsx` | Bank Master management | Fully Implemented | Connected | Full CRUD matching 4 official banks |
| `/src/views/PaymentsView.tsx` | Payment register & allocations | Fully Implemented | Connected | FIRC/IRM register with available balance tracking |
| `/src/views/BrcManagementView.tsx` | BRC / eBRC console | Fully Implemented | Connected | Single/multiple file enforcement, status tracking |
| `/src/views/IncentivesView.tsx` | Export incentives console | Fully Implemented | Connected | DBK, RoDTEP, RoSCTL tracking with partial receipts |
| `/src/views/DocumentReviewView.tsx`| Document vault & audit | Fully Implemented | Connected | Document verification and category filtering |
| `/src/views/ExcelImportExportView.tsx`| Excel & CSV migration | Fully Implemented | Connected | File upload, reconciliation report, CSV/XLSX download |
| `/src/views/AuditHistoryView.tsx` | System audit history | Fully Implemented | Connected | Tracks user actions, IPs, old/new diffs |
| `/src/views/UserManagementView.tsx` | User administration | Fully Implemented | Connected | Restricted to SUPER_ADMIN |
| `/src/views/SettingsView.tsx` | Application settings | Fully Implemented | Connected | Configurable FY and system preferences |

---

## 4. Test Suite Audit

1. **Unit Logic Tests (`/test/unit_logic.test.ts`)**:
   - `normalizeInvoiceKey`: Standardizes slashes, hyphens, prefixes, and spaces.
   - `FOB & Currency calculations`: Decimal precision and rounding verification.
   - `Payment allocation subtraction`: Balance subtraction and zero-floor checks.
   - `Over-allocation prevention`: Validates that allocations exceeding balance are blocked.
   - `Incentive status derivation`: Partial receipts, claimed vs received status checks.
   - **Result**: 6 of 6 tests PASSING.

2. **Batch Extractor Tests (`/test/batch_extractor.test.ts`)**:
   - Commercial Invoice PDF parsing (`SKE/26-27/020`).
   - Shipping Bill PDF parsing (`SB 2173318`).
   - FIRC and BRC PDF parsing (`IRM 210426I049900457`, `BRC HDFC0000166A02685488`).
   - Cross-document merge test with 5 real sample PDFs.
   - **Result**: 4 of 4 tests PASSING.

---

## 5. Deployment & Infrastructure Audit

- **Dockerfile**: Present at `/Dockerfile`. Multi-stage build (Node 20 Alpine), installs build tools, compiles frontend, runs server.
- **Docker Compose**: Present at `/docker-compose.yml`. Provisions `db` (PostgreSQL 16 Alpine), `app` (Node/Express backend and Vite static assets), persistent volumes `pgdata` and `storage_volume`.
- **Environment Configuration**: `.env.example` provides non-sensitive defaults (`DATABASE_URL`, `JWT_SECRET`, `PORT`).
- **Security Boundaries**: Filesystem isolation for documents under `/storage`. Password hashes use PBKDF2 with salt.
