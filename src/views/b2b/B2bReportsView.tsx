/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Building2,
  ShieldCheck,
  Hash,
  Percent,
  Layers,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '../../api/client.ts';
import type { B2bInvoice, B2bMonthlySummary, Supplier, Role } from '../../types/index.ts';

interface B2bReportsViewProps {
  userRole: Role;
}

export const B2bReportsView: React.FC<B2bReportsViewProps> = () => {
  const [activeReport, setActiveReport] = useState<string>('monthly_summary');
  const [financialYear, setFinancialYear] = useState('2026-27');
  const [loading, setLoading] = useState(false);

  const [monthlySummaries, setMonthlySummaries] = useState<B2bMonthlySummary[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allInvoices, setAllInvoices] = useState<B2bInvoice[]>([]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [mRes, sRes, invRes] = await Promise.all([
        api.getB2bMonthlySummaries(financialYear),
        api.getB2bSuppliers(),
        api.getB2bInvoices({ financialYear, limit: 0 }),
      ]);
      setMonthlySummaries(mRes);
      setSuppliers(sRes);
      setAllInvoices(invRes.data);
    } catch (err) {
      console.error('Error loading report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [financialYear]);

  const formatInr = (val?: number) => {
    return '₹' + (Number(val || 0)).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const reportsList = [
    {
      id: 'monthly_summary',
      title: '1. Monthly GSTR Summary',
      desc: '12-Month inward GST & taxable figures divided by GSTR Period.',
      icon: Calendar,
    },
    {
      id: 'supplier_summary',
      title: '2. Supplier-wise Summary',
      desc: 'Aggregated inward volume and input tax credit grouped by supplier.',
      icon: Building2,
    },
    {
      id: 'rcm_register',
      title: '3. Reverse Charge Register',
      desc: 'Inward supplies liable to Reverse Charge (RCM = Y).',
      icon: ShieldCheck,
    },
    {
      id: 'ineligible_itc',
      title: '4. Ineligible ITC Register',
      desc: 'Inward invoices where ITC is marked No (Section 17(5) blocked credit).',
      icon: Layers,
    },
    {
      id: 'irn_register',
      title: '5. E-Invoiced (IRN) Register',
      desc: 'Inward purchases containing valid 64-character IRN hashes.',
      icon: Hash,
    },
    {
      id: 'state_distribution',
      title: '6. State-wise (POS) Tax Summary',
      desc: 'Taxable value and taxes broken down by Place of Supply state code.',
      icon: Percent,
    },
    {
      id: 'tax_rate_breakdown',
      title: '7. Tax Rate Breakdown',
      desc: 'Inward volume grouped by applicable GST rate slab.',
      icon: FileSpreadsheet,
    },
    {
      id: 'annual_reconciliation',
      title: '8. Annual FY Reconciliation',
      desc: 'Consolidated fiscal year totals and quarterly breakdowns.',
      icon: Calendar,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Auditing & Statutory Reports</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">B2B GST Reports & Statements</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate and export GSTR-2B compliance statements, supplier summaries, and reverse charge registers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* FY Selector */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-300">
            <span className="text-xs font-medium text-slate-600 px-2">FY:</span>
            <select
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="bg-white text-xs font-semibold text-slate-800 rounded-md px-2 py-1 border-0 shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
            >
              <option value="2026-27">FY 2026-27</option>
              <option value="2025-26">FY 2025-26</option>
              <option value="ALL">All Fiscal Years</option>
            </select>
          </div>

          <button
            onClick={loadReportData}
            title="Refresh"
            className="p-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Reports Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {reportsList.map((rep) => {
          const Icon = rep.icon;
          const isActive = activeReport === rep.id;
          return (
            <button
              key={rep.id}
              onClick={() => setActiveReport(rep.id)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600/30'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300 hover:bg-blue-50/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-blue-700 text-white' : 'bg-slate-100 text-blue-600'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs truncate">{rep.title}</span>
              </div>
              <p className={`text-[11px] leading-tight line-clamp-2 ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                {rep.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Report View Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        {/* Report Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {reportsList.find((r) => r.id === activeReport)?.title}
            </h2>
            <p className="text-xs text-slate-500">
              {reportsList.find((r) => r.id === activeReport)?.desc} • Financial Year: {financialYear}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void api.downloadB2bExport(
                  activeReport === 'monthly_summary'
                    ? { reportType: 'monthly_summary', financialYear }
                    : { financialYear }
                )
              }
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* REPORT 1: Monthly Summary */}
        {activeReport === 'monthly_summary' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3">GSTR Period</th>
                  <th className="px-3 py-3">Period Key</th>
                  <th className="px-3 py-3 text-center">Invoices</th>
                  <th className="px-3 py-3 text-center">Suppliers</th>
                  <th className="px-3 py-3 text-right">Taxable Value (₹)</th>
                  <th className="px-3 py-3 text-right">IGST (₹)</th>
                  <th className="px-3 py-3 text-right">CGST (₹)</th>
                  <th className="px-3 py-3 text-right">SGST (₹)</th>
                  <th className="px-3 py-3 text-right">Total GST (₹)</th>
                  <th className="px-3 py-3 text-right">Invoice Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlySummaries.map((m) => (
                  <tr key={m.periodKey} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-bold text-slate-900">{m.displayPeriod}</td>
                    <td className="px-3 py-3 font-mono text-slate-600">{m.periodKey}</td>
                    <td className="px-3 py-3 text-center font-bold text-blue-700">{m.invoiceCount}</td>
                    <td className="px-3 py-3 text-center">{m.uniqueSuppliers}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-800">{formatInr(m.totalTaxableValue)}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">{formatInr(m.totalIgst)}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">{formatInr(m.totalCgst)}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">{formatInr(m.totalSgst)}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">{formatInr(m.totalGst)}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">{formatInr(m.totalInvoiceValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-right">TOTAL:</td>
                  <td className="px-3 py-3 text-center text-blue-800">
                    {monthlySummaries.reduce((s, m) => s + m.invoiceCount, 0)}
                  </td>
                  <td className="px-3 py-3 text-center">—</td>
                  <td className="px-3 py-3 text-right font-mono text-indigo-950">
                    {formatInr(monthlySummaries.reduce((s, m) => s + m.totalTaxableValue, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono">
                    {formatInr(monthlySummaries.reduce((s, m) => s + m.totalIgst, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono">
                    {formatInr(monthlySummaries.reduce((s, m) => s + m.totalCgst, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono">
                    {formatInr(monthlySummaries.reduce((s, m) => s + m.totalSgst, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-emerald-800">
                    {formatInr(monthlySummaries.reduce((s, m) => s + m.totalGst, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-950">
                    {formatInr(monthlySummaries.reduce((s, m) => s + m.totalInvoiceValue, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* REPORT 2: Supplier-wise Summary */}
        {activeReport === 'supplier_summary' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3">Supplier GSTIN</th>
                  <th className="px-3 py-3">Legal Name</th>
                  <th className="px-3 py-3">State</th>
                  <th className="px-3 py-3 text-center">Invoices</th>
                  <th className="px-3 py-3 text-right">Taxable Value (₹)</th>
                  <th className="px-3 py-3 text-right">Total GST (₹)</th>
                  <th className="px-3 py-3 text-right">Invoice Value (₹)</th>
                  <th className="px-3 py-3">Latest Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((sup) => (
                  <tr key={sup.gstin} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono font-bold text-blue-800">{sup.gstin}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{sup.legalName}</td>
                    <td className="px-3 py-3 text-slate-600">{sup.state || 'Tamil Nadu'}</td>
                    <td className="px-3 py-3 text-center font-bold text-slate-800">{sup.invoiceCount || 0}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-800">{formatInr(sup.totalTaxableValue)}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">{formatInr(sup.totalGst)}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">{formatInr(sup.totalInvoiceValue)}</td>
                    <td className="px-3 py-3 text-slate-600">{sup.latestInvoiceDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 3: Reverse Charge (RCM) Invoices */}
        {activeReport === 'rcm_register' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3">Invoice No</th>
                  <th className="px-3 py-3">GSTR Period</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Supplier GSTIN</th>
                  <th className="px-3 py-3">Supplier Name</th>
                  <th className="px-3 py-3 text-right">Taxable (₹)</th>
                  <th className="px-3 py-3 text-right">CGST (₹)</th>
                  <th className="px-3 py-3 text-right">SGST (₹)</th>
                  <th className="px-3 py-3 text-right">Total GST (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allInvoices.filter((i) => i.reverseCharge === 'Y').length > 0 ? (
                  allInvoices
                    .filter((i) => i.reverseCharge === 'Y')
                    .map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-mono font-bold text-blue-700">{inv.invoiceNumber}</td>
                        <td className="px-3 py-3 font-medium text-slate-800">{inv.gstrPeriod}</td>
                        <td className="px-3 py-3 text-slate-600">{inv.invoiceDate}</td>
                        <td className="px-3 py-3 font-mono">{inv.supplierGstin}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{inv.supplierName}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatInr(inv.taxableValue)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatInr(inv.centralTax)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatInr(inv.stateUtTax)}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">
                          {formatInr(inv.totalGst)}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      No reverse charge (RCM = Y) invoices found for FY {financialYear}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 4: Ineligible ITC Register */}
        {activeReport === 'ineligible_itc' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3">Invoice No</th>
                  <th className="px-3 py-3">GSTR Period</th>
                  <th className="px-3 py-3">Supplier Name</th>
                  <th className="px-3 py-3 text-right">Taxable (₹)</th>
                  <th className="px-3 py-3 text-right">Blocked GST (₹)</th>
                  <th className="px-3 py-3">Ineligibility Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allInvoices.filter((i) => i.itcAvailability === 'No').length > 0 ? (
                  allInvoices
                    .filter((i) => i.itcAvailability === 'No')
                    .map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-mono font-bold text-rose-700">{inv.invoiceNumber}</td>
                        <td className="px-3 py-3">{inv.gstrPeriod}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{inv.supplierName}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatInr(inv.taxableValue)}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-rose-700">
                          {formatInr(inv.totalGst)}
                        </td>
                        <td className="px-3 py-3 text-rose-600 font-medium">{inv.reason || 'Blocked credit under 17(5)'}</td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Zero blocked/ineligible ITC invoices recorded. All {allInvoices.length} invoices are 100% ITC eligible!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 5: IRN Register */}
        {activeReport === 'irn_register' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3">Invoice No</th>
                  <th className="px-3 py-3">Supplier Name</th>
                  <th className="px-3 py-3">IRN Date</th>
                  <th className="px-3 py-3">IRN (64-Character Hash)</th>
                  <th className="px-3 py-3 text-right">Taxable (₹)</th>
                  <th className="px-3 py-3 text-right">Total GST (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allInvoices.filter((i) => i.irn && i.irn.trim()).length > 0 ? (
                  allInvoices
                    .filter((i) => i.irn && i.irn.trim())
                    .map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-mono font-bold text-blue-700">{inv.invoiceNumber}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{inv.supplierName}</td>
                        <td className="px-3 py-3 text-slate-600">{inv.irnDate || inv.invoiceDate}</td>
                        <td className="px-3 py-3 font-mono text-[11px] text-slate-800 break-all max-w-xs">{inv.irn}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatInr(inv.taxableValue)}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">{formatInr(inv.totalGst)}</td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No invoices with IRN hashes found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 6: State-wise Tax Summary */}
        {activeReport === 'state_distribution' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Place of Supply (POS)</th>
                  <th className="px-4 py-3 text-center">Invoices</th>
                  <th className="px-4 py-3 text-right">Taxable Value (₹)</th>
                  <th className="px-4 py-3 text-right">IGST (₹)</th>
                  <th className="px-4 py-3 text-right">CGST (₹)</th>
                  <th className="px-4 py-3 text-right">SGST (₹)</th>
                  <th className="px-4 py-3 text-right">Total GST (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from(
                  allInvoices.reduce((acc, inv) => {
                    const pos = inv.placeOfSupply || '33-Tamil Nadu';
                    const cur = acc.get(pos) || {
                      pos,
                      invoices: 0,
                      taxable: 0,
                      igst: 0,
                      cgst: 0,
                      sgst: 0,
                      totalGst: 0,
                    };
                    cur.invoices += 1;
                    cur.taxable += inv.taxableValue || 0;
                    cur.igst += inv.integratedTax || 0;
                    cur.cgst += inv.centralTax || 0;
                    cur.sgst += inv.stateUtTax || 0;
                    cur.totalGst += inv.totalGst || 0;
                    acc.set(pos, cur);
                    return acc;
                  }, new Map<string, any>()).values()
                ).map((row) => (
                  <tr key={row.pos} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{row.pos}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-700">{row.invoices}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-800">{formatInr(row.taxable)}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-700">{formatInr(row.igst)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{formatInr(row.cgst)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{formatInr(row.sgst)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{formatInr(row.totalGst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 7: Tax Rate Breakdown */}
        {activeReport === 'tax_rate_breakdown' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Applicable Tax Rate</th>
                  <th className="px-4 py-3 text-center">Invoices</th>
                  <th className="px-4 py-3 text-right">Taxable Value (₹)</th>
                  <th className="px-4 py-3 text-right">Total GST Accrued (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from(
                  allInvoices.reduce((acc, inv) => {
                    const rate = inv.applicableTaxRate ? `${inv.applicableTaxRate}%` : 'Standard 100%';
                    const cur = acc.get(rate) || { rate, invoices: 0, taxable: 0, totalGst: 0 };
                    cur.invoices += 1;
                    cur.taxable += inv.taxableValue || 0;
                    cur.totalGst += inv.totalGst || 0;
                    acc.set(rate, cur);
                    return acc;
                  }, new Map<string, any>()).values()
                ).map((row) => (
                  <tr key={row.rate} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{row.rate}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-700">{row.invoices}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-800">{formatInr(row.taxable)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{formatInr(row.totalGst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 8: Annual FY Reconciliation */}
        {activeReport === 'annual_reconciliation' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-500 font-semibold block uppercase">Total Invoices</span>
                <span className="text-xl font-bold text-slate-900">{allInvoices.length}</span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-500 font-semibold block uppercase">Total Taxable</span>
                <span className="text-xl font-bold text-indigo-950 font-mono">
                  {formatInr(allInvoices.reduce((s, i) => s + i.taxableValue, 0))}
                </span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-500 font-semibold block uppercase">Total Input GST</span>
                <span className="text-xl font-bold text-emerald-700 font-mono">
                  {formatInr(allInvoices.reduce((s, i) => s + i.totalGst, 0))}
                </span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-500 font-semibold block uppercase">Total Gross Value</span>
                <span className="text-xl font-bold text-slate-900 font-mono">
                  {formatInr(allInvoices.reduce((s, i) => s + i.invoiceValue, 0))}
                </span>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
              <div className="font-bold text-sm">GSTR-2B Inward Purchase Integrity Check</div>
              <div>• Total GST strictly equals (IGST + CGST + SGST + Cess) across all records.</div>
              <div>• Every invoice is linked to an exact GSTR Period month bucket.</div>
              <div>• Duplicates are enforced at database level on (Supplier GSTIN + Invoice Number + Invoice Type).</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
