/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Layers,
  Calendar,
  Building2,
  RefreshCw,
  Clock,
  Check,
} from 'lucide-react';
import { api } from '../../api/client.ts';
import type { B2bImportPreview, ImportBatch, Role } from '../../types/index.ts';

interface B2bImportViewProps {
  userRole: Role;
  onNavigateTab: (tab: string, param?: string) => void;
}

export const B2bImportView: React.FC<B2bImportViewProps> = ({ userRole, onNavigateTab }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<B2bImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Import mode
  const [importMode, setImportMode] = useState<'SKIP_EXISTING' | 'OVERWRITE_EXISTING' | 'INSERT_ALL'>('SKIP_EXISTING');
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    batchId: string;
    totalProcessed: number;
    inserted: number;
    updated: number;
    skipped: number;
    failed?: number;
  } | null>(null);

  // Batches history
  const [batches, setBatches] = useState<ImportBatch[]>([]);

  const isViewer = userRole === 'VIEWER';

  const loadBatches = async () => {
    try {
      const list = await api.getB2bImportBatches();
      setBatches(list);
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setPreview(null);
    setCommitResult(null);
    setError(null);
    setAnalyzing(true);

    try {
      const res = await api.previewB2bImport(file);
      setPreview(res);
    } catch (err: any) {
      setError(err.message || 'Failed to inspect workbook.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    if (!preview || !selectedFile) return;
    const rowsCount = preview.allParsedRecords?.length ?? preview.sampleRows?.length ?? 0;
    if (rowsCount === 0) {
      setError('No valid parsed rows found to import. Please resolve the validation errors in the file and re-upload.');
      return;
    }
    setCommitting(true);
    setError(null);

    try {
      const res = await api.commitB2bImport(
        preview,
        importMode,
        selectedFile.name,
        selectedFile.size
      );
      setCommitResult(res);
      setPreview(null);
      loadBatches();
    } catch (err: any) {
      setError(err.message || 'Failed to commit import.');
    } finally {
      setCommitting(false);
    }
  };

  const formatInr = (val?: number) => {
    return '₹' + (Number(val || 0)).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Upload className="w-4 h-4" />
            <span>Excel / CSV Import Wizard</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">B2B Inward Purchase Import</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Bulk upload GSTR-2B purchase workbooks with automatic "B2B" sheet detection, monthly period distribution preview, and duplicate resolution.
          </p>
        </div>

        <button
          onClick={loadBatches}
          className="p-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          title="Refresh History"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isViewer && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
          <strong>Notice:</strong> Your role is Viewer. You can view previous import batch records below, but workbook upload and commit actions are restricted to Admin and Super Admin.
        </div>
      )}

      {/* Step 1: File Dropzone (if not viewer) */}
      {!isViewer && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>Step 1: Select or Drop GSTR-2B Workbook</span>
          </h3>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center bg-slate-50 hover:bg-blue-50/20 transition-all cursor-pointer flex flex-col items-center justify-center"
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              id="b2b-file-upload"
              className="hidden"
            />
            <label htmlFor="b2b-file-upload" className="cursor-pointer flex flex-col items-center">
              <div className="p-3 bg-blue-100 text-blue-700 rounded-full mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-slate-800">
                {selectedFile ? selectedFile.name : 'Click to browse or drag & drop Excel / CSV file'}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Supports official GSTR-2B inward files (.xlsx, .xls, .csv) with "B2B" worksheet
              </span>
            </label>
          </div>

          {analyzing && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3 text-blue-700 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analyzing workbook structure, detecting "B2B" sheet, and mapping 21 GSTR fields...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-700 text-xs">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2 & 3: Preview & Distribution Analysis */}
      {preview && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">Sheet Detected</span>
              <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">{preview.worksheetDetected}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">Total Rows</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{preview.totalRows}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">Valid Invoices</span>
              <div className="text-lg font-bold text-emerald-700 mt-0.5">{preview.validRows}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">Duplicates Found</span>
              <div className="text-lg font-bold text-amber-700 mt-0.5">{preview.duplicateRows}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">New Suppliers</span>
              <div className="text-lg font-bold text-blue-700 mt-0.5">{preview.newSuppliersCount}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">Invalid Rows</span>
              <div className="text-lg font-bold text-rose-700 mt-0.5">{preview.invalidRows}</div>
            </div>
          </div>

          {/* Missing Optional Columns Info (if any) */}
          {preview.missingColumns && preview.missingColumns.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Optional columns not found in workbook (left blank if omitted):{' '}
                <strong className="text-slate-800">{preview.missingColumns.join(', ')}</strong>
              </span>
            </div>
          )}

          {/* Monthly Period Distribution Preview Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Step 2: Monthly Period Distribution Preview
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Invoices bucketed strictly by return period (GSTR Period)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">GSTR Period</th>
                    <th className="px-4 py-2.5">Period Key</th>
                    <th className="px-4 py-2.5">Financial Year</th>
                    <th className="px-4 py-2.5 text-center text-emerald-800">New Invoices</th>
                    <th className="px-4 py-2.5 text-center text-amber-800">Existing (Duplicates)</th>
                    <th className="px-4 py-2.5 text-center text-rose-800">Invalid Rows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.periodDistribution.map((dist) => (
                    <tr key={dist.periodKey} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{dist.displayPeriod}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{dist.periodKey}</td>
                      <td className="px-4 py-3 text-slate-700">{dist.financialYear}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-700">
                        {dist.newInvoices}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-amber-700">
                        {dist.existingInvoices}
                      </td>
                      <td className="px-4 py-3 text-center text-rose-600 font-medium">
                        {dist.invalidRows}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Duplicates Details Warning (if duplicates found) */}
          {preview.duplicates && preview.duplicates.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Duplicate Records Identified ({preview.duplicates.length})</span>
              </div>
              <p className="text-xs text-amber-800">
                The following invoices match existing records on compound key (GSTIN + Invoice Number + Invoice Type):
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1 text-[11px] font-mono text-slate-800 bg-white p-2.5 rounded-lg border border-amber-200">
                {preview.duplicates.map((dup, idx) => (
                  <div key={idx} className="flex items-center justify-between py-0.5 border-b border-slate-100 last:border-0">
                    <span>
                      Row #{dup.rowNumber}: Inv <strong>{dup.invoiceNumber}</strong> ({dup.supplierGstin})
                    </span>
                    <span className="text-slate-500">
                      {dup.differingFields.length > 0 ? `Differs in: ${dup.differingFields.join(', ')}` : 'Exact match'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row-level Validation Errors (if any) */}
          {preview.errors && preview.errors.length > 0 && (
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Validation Errors Found ({preview.errors.length}) — These rows will be skipped</span>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 text-[11px] font-mono text-rose-900 bg-white p-2.5 rounded-lg border border-rose-200">
                {preview.errors.slice(0, 50).map((errItem, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-1 border-b border-rose-100 last:border-0 gap-1">
                    <span>
                      Row #{errItem.rowNumber}
                      {errItem.invoiceNumber ? ` · Inv ${errItem.invoiceNumber}` : ''}
                      {errItem.supplierGstin ? ` (${errItem.supplierGstin})` : ''}
                    </span>
                    <span className="text-rose-700 font-sans font-medium">{errItem.issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Mode Selection & Commit */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Step 3: Duplicate Resolution & Commit Mode</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                onClick={() => setImportMode('SKIP_EXISTING')}
                className={`p-4 rounded-xl border cursor-pointer flex flex-col justify-between ${
                  importMode === 'SKIP_EXISTING'
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">Skip Duplicates</span>
                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Keep existing database records intact; only insert newly found invoices.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setImportMode('OVERWRITE_EXISTING')}
                className={`p-4 rounded-xl border cursor-pointer flex flex-col justify-between ${
                  importMode === 'OVERWRITE_EXISTING'
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <span className="font-bold text-xs text-slate-900">Overwrite Existing</span>
                  <p className="text-xs text-slate-500 mt-1">
                    Update existing invoices with the figures and details from this uploaded file.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setImportMode('INSERT_ALL')}
                className={`p-4 rounded-xl border cursor-pointer flex flex-col justify-between ${
                  importMode === 'INSERT_ALL'
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <span className="font-bold text-xs text-slate-900">Insert All</span>
                  <p className="text-xs text-slate-500 mt-1">
                    Generate new internal IDs and insert all records without overwriting.
                  </p>
                </div>
              </label>
            </div>

            {(preview.allParsedRecords?.length ?? preview.sampleRows?.length ?? 0) === 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                No valid rows are available to commit from this file. Please fix the validation errors listed above and upload again.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                disabled={committing || (preview.allParsedRecords?.length ?? preview.sampleRows?.length ?? 0) === 0}
                className="px-6 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {committing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing Invoices...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Commit Import to Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Success Commit Banner */}
      {commitResult && (
        <div
          className={`rounded-xl p-6 space-y-3 border ${
            commitResult.inserted + commitResult.updated > 0
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 text-white rounded-lg ${
                commitResult.inserted + commitResult.updated > 0 ? 'bg-emerald-600' : 'bg-amber-600'
              }`}
            >
              {commitResult.inserted + commitResult.updated > 0 ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3
                className={`text-base font-bold ${
                  commitResult.inserted + commitResult.updated > 0 ? 'text-emerald-950' : 'text-amber-950'
                }`}
              >
                {commitResult.inserted + commitResult.updated > 0
                  ? (commitResult.failed || 0) > 0
                    ? 'Import Completed With Some Failed Rows'
                    : 'Import Completed Successfully!'
                  : (commitResult.failed || 0) > 0
                    ? 'Import Failed — Invalid Rows Rejected'
                    : 'Import Processed — All Matching Invoices Were Skipped'}
              </h3>
              <p
                className={`text-xs font-mono ${
                  commitResult.inserted + commitResult.updated > 0 ? 'text-emerald-700' : 'text-amber-800'
                }`}
              >
                Batch ID: {commitResult.batchId}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2">
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500 block">Total Invoices</span>
              <span className="text-base font-bold text-slate-900">{commitResult.totalProcessed}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500 block">Newly Inserted</span>
              <span className="text-base font-bold text-emerald-700">{commitResult.inserted}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500 block">Updated</span>
              <span className="text-base font-bold text-blue-700">{commitResult.updated}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500 block">Skipped</span>
              <span className="text-base font-bold text-slate-600">{commitResult.skipped}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500 block">Failed / Invalid</span>
              <span className="text-base font-bold text-rose-700">{commitResult.failed ?? 0}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => onNavigateTab('b2b-monthly')}
              className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg cursor-pointer"
            >
              View Monthly Entries
            </button>
            <button
              onClick={() => onNavigateTab('b2b-register')}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
            >
              Open Invoice Register
            </button>
          </div>
        </div>
      )}

      {/* Batches History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-sm text-slate-900">Import Batches History</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {batches.length} past upload {batches.length === 1 ? 'batch' : 'batches'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Batch ID</th>
                <th className="px-4 py-2.5">File Name</th>
                <th className="px-4 py-2.5">Uploaded Date</th>
                <th className="px-4 py-2.5 text-center">Total Rows</th>
                <th className="px-4 py-2.5 text-center text-emerald-700">Successful</th>
                <th className="px-4 py-2.5 text-center text-rose-700">Failed</th>
                <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.length > 0 ? (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-blue-700 font-semibold">{b.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{b.fileName}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(b.uploadedAt).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">{b.totalRows}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-700">{b.successfulRows}</td>
                    <td className="px-4 py-3 text-center font-bold text-rose-600">{b.failedRows}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                        {b.importStatus}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No import batches recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
