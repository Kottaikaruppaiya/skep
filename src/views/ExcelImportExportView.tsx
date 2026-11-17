/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { ImportValidationReport, Role } from '../types/index.ts';

interface ExcelImportExportViewProps {
  selectedFyId: string;
  onRefresh: () => void;
  userRole: Role;
}

export const ExcelImportExportView: React.FC<ExcelImportExportViewProps> = ({
  selectedFyId,
  onRefresh,
  userRole,
}) => {
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setImporting(true);
    setError(null);
    setReport(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('financialYearId', selectedFyId);

    try {
      const rep = await api.importExcel(formData);
      setReport(rep);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Excel migration import failed.');
    } finally {
      setImporting(false);
    }
  };

  const isViewer = userRole === 'VIEWER';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-emerald-600" />
          <span>Excel Integration, Migration & Report Generator</span>
        </h2>
        <p className="text-xs text-slate-500">
          Bi-directional Excel interoperability matching the 9-sheet master workbook structure
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* EXPORT CARD */}
        <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Download size={22} />
            </div>
            <h3 className="font-bold text-base text-slate-900">Export System Database to Excel</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Generates a full-fidelity <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">.xlsx</code> workbook from current PostgreSQL database records matching the 9 sheets:
            </p>
            <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li>Export Tracker (44 columns)</li>
              <li>Quick View Executive Dashboard</li>
              <li>Consignee Summary & Ledgers</li>
              <li>Consignee & Bank Masters</li>
              <li>Inward Remittances Register</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => void api.downloadExportWorkbook(selectedFyId)}
            className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download size={15} />
            <span>Download Live Workbook (.xlsx)</span>
          </button>
        </div>

        {/* IMPORT / HISTORICAL MIGRATION CARD */}
        <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Upload size={22} />
            </div>
            <h3 className="font-bold text-base text-slate-900">Historical Data Migration</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload legacy tracker workbook (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">.xlsx / .xlsm</code>).
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs space-y-1">
              <span className="font-bold flex items-center gap-1">
                <ShieldAlert size={14} className="text-amber-700" />
                Mandatory Migration Policy (Section 14):
              </span>
              <p className="text-amber-800 text-[11px]">
                "Exclude legacy rows that have no FIRC under the confirmed import rule." Rows lacking FIRC remittance references are logged to the Rejection Report.
              </p>
            </div>
          </div>

          {!isViewer ? (
            <label className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors inline-flex items-center justify-center gap-2 cursor-pointer">
              <Upload size={15} />
              <span>{importing ? 'Processing Migration...' : 'Upload & Migrate Workbook'}</span>
              <input
                type="file"
                disabled={importing}
                accept=".xlsx,.xlsm,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          ) : (
            <div className="h-10 bg-slate-100 text-slate-500 inline-flex items-center justify-center text-xs rounded-xl font-medium">
              Read-Only Viewer: Migration Upload Disabled
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center space-x-2">
          <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Migration Report Result */}
      {report && (
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span>Historical Migration Audit Report</span>
          </h3>

          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-lg font-bold text-slate-900">{report.totalRowsRead}</span>
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total Rows Read</span>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-lg font-bold text-emerald-800">{report.acceptedRows}</span>
              <span className="text-[10px] text-emerald-700 block uppercase font-semibold">Accepted & Imported</span>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <span className="text-lg font-bold text-red-800">{report.rejectedRows}</span>
              <span className="text-[10px] text-red-700 block uppercase font-semibold">Excluded / Rejected</span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-lg font-bold text-amber-800">{report.warningsCount}</span>
              <span className="text-[10px] text-amber-700 block uppercase font-semibold">Notices & Warnings</span>
            </div>
          </div>

          {/* Rejection Log */}
          {report.rejectionLog && report.rejectionLog.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-red-800 block uppercase tracking-wider">
                Excluded Records Log (No Data Lost Without Trace)
              </span>
              <div className="border border-red-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-red-50 text-red-800 border-b border-red-200">
                    <tr>
                      <th className="p-2">Row #</th>
                      <th className="p-2">Invoice No</th>
                      <th className="p-2">Buyer</th>
                      <th className="p-2">Exclusion / Rejection Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {report.rejectionLog.map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-red-50/50">
                        <td className="p-2 font-mono">{r.rowNumber}</td>
                        <td className="p-2 font-semibold text-slate-900">{r.invoiceNo}</td>
                        <td className="p-2 text-slate-700">{r.consignee || '—'}</td>
                        <td className="p-2 text-red-700 font-medium">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
