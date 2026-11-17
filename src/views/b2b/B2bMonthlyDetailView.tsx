/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Calendar,
  Building2,
  FileText,
  Download,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  ShieldCheck,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../api/client.ts';
import type { B2bInvoice, B2bMonthlySummary, Role } from '../../types/index.ts';
import { B2bAddInvoiceModal } from './B2bAddInvoiceModal.tsx';

interface B2bMonthlyDetailViewProps {
  periodKey: string;
  userRole: Role;
  onBack: () => void;
}

export const B2bMonthlyDetailView: React.FC<B2bMonthlyDetailViewProps> = ({
  periodKey,
  userRole,
  onBack,
}) => {
  const [summary, setSummary] = useState<B2bMonthlySummary | null>(null);
  const [invoices, setInvoices] = useState<B2bInvoice[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [itcFilter, setItcFilter] = useState('ALL');
  const [rcmFilter, setRcmFilter] = useState('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<B2bInvoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<B2bInvoice | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isViewer = userRole === 'VIEWER';

  const loadMonthData = async () => {
    setLoading(true);
    try {
      const res = await api.getB2bMonthDetail(periodKey);
      setSummary(res.summary);
      setInvoices(res.invoices);
      setTopSuppliers(res.topSuppliers);
    } catch (err) {
      console.error('Failed to load month details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthData();
  }, [periodKey]);

  const formatInr = (val?: number) => {
    return '₹' + (Number(val || 0)).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    let result = [...invoices];
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(s) ||
          i.supplierName.toLowerCase().includes(s) ||
          i.supplierGstin.toLowerCase().includes(s)
      );
    }
    if (supplierFilter !== 'ALL') {
      result = result.filter((i) => i.supplierGstin.toUpperCase() === supplierFilter.toUpperCase());
    }
    if (typeFilter !== 'ALL') {
      result = result.filter((i) => i.invoiceType.toLowerCase() === typeFilter.toLowerCase());
    }
    if (itcFilter !== 'ALL') {
      result = result.filter((i) => i.itcAvailability.toLowerCase() === itcFilter.toLowerCase());
    }
    if (rcmFilter !== 'ALL') {
      result = result.filter((i) => i.reverseCharge.toUpperCase() === rcmFilter.toUpperCase());
    }
    return result;
  }, [invoices, search, supplierFilter, typeFilter, itcFilter, rcmFilter]);

  // Unique suppliers list for filter dropdown
  const uniqueSuppliers = useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of invoices) {
      if (!map.has(inv.supplierGstin)) {
        map.set(inv.supplierGstin, inv.supplierName);
      }
    }
    return Array.from(map.entries()).map(([gstin, name]) => ({ gstin, name }));
  }, [invoices]);

  const handleDelete = async (invoice: B2bInvoice) => {
    if (isViewer) return;
    if (
      !confirm(
        `Are you sure you want to delete invoice ${invoice.invoiceNumber} from ${invoice.supplierName}?`
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await api.deleteB2bInvoice(invoice.id);
      loadMonthData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete invoice.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Back to Monthly Entries"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                GSTR Period Detail
              </span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono text-xs font-bold">
                {periodKey}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                FY {summary?.financialYear || '2026-27'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
              {summary?.displayPeriod || periodKey}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadMonthData}
            title="Refresh Month"
            className="p-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {!isViewer && (
            <button
              onClick={() => {
                setEditingInvoice(null);
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Invoice</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void api.downloadB2bExport({ periodKey })}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Month Excel</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="font-bold text-red-600">×</button>
        </div>
      )}

      {/* Month Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Invoices</span>
          <div className="text-lg font-bold text-slate-900 mt-0.5">{summary?.invoiceCount || 0}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Suppliers</span>
          <div className="text-lg font-bold text-slate-900 mt-0.5">{summary?.uniqueSuppliers || 0}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Taxable Value</span>
          <div className="text-lg font-bold text-indigo-950 font-mono mt-0.5">
            {formatInr(summary?.totalTaxableValue)}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Total GST</span>
          <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
            {formatInr(summary?.totalGst)}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">IGST Amount</span>
          <div className="text-lg font-bold text-blue-700 font-mono mt-0.5">
            {formatInr(summary?.totalIgst)}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Total Inv Value</span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
            {formatInr(summary?.totalInvoiceValue)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice no, supplier name, GSTIN..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Supplier Filter */}
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="ALL">All Suppliers ({uniqueSuppliers.length})</option>
            {uniqueSuppliers.map((s) => (
              <option key={s.gstin} value={s.gstin}>
                {s.name} ({s.gstin})
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="ALL">All Invoice Types</option>
            <option value="Regular">Regular</option>
            <option value="Deemed Exp">Deemed Export</option>
            <option value="SEZ supplies with payment">SEZ with Payment</option>
          </select>

          {/* ITC Filter */}
          <select
            value={itcFilter}
            onChange={(e) => setItcFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="ALL">All ITC Status</option>
            <option value="Yes">ITC Available (Yes)</option>
            <option value="No">ITC Ineligible (No)</option>
          </select>

          {/* RCM Filter */}
          <select
            value={rcmFilter}
            onChange={(e) => setRcmFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="ALL">All Reverse Charge</option>
            <option value="N">Regular (RCM: No)</option>
            <option value="Y">Reverse Charge (RCM: Yes)</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{filteredInvoices.length}</span> of{' '}
          {invoices.length} invoices
        </div>
      </div>

      {/* 16-Column Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold tracking-wider border-b border-slate-200 whitespace-nowrap">
              <tr>
                <th className="px-3 py-3 w-10 text-center">#</th>
                <th className="px-3 py-3">Supplier GSTIN</th>
                <th className="px-3 py-3">Supplier Name</th>
                <th className="px-3 py-3">Invoice No</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">POS</th>
                <th className="px-3 py-3 text-center">RCM</th>
                <th className="px-3 py-3 text-right">Taxable (₹)</th>
                <th className="px-3 py-3 text-right">IGST (₹)</th>
                <th className="px-3 py-3 text-right">CGST (₹)</th>
                <th className="px-3 py-3 text-right">SGST (₹)</th>
                <th className="px-3 py-3 text-right">Cess (₹)</th>
                <th className="px-3 py-3 text-right">Total GST (₹)</th>
                <th className="px-3 py-3 text-right">Inv Value (₹)</th>
                <th className="px-3 py-3 text-center">ITC</th>
                <th className="px-3 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-3 py-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-3 font-mono font-medium text-slate-700">
                      {inv.supplierGstin}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900 max-w-[200px] truncate" title={inv.supplierName}>
                      {inv.supplierName}
                    </td>
                    <td className="px-3 py-3 font-mono font-bold text-blue-700">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{inv.invoiceType}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">{inv.invoiceDate}</td>
                    <td className="px-3 py-3 text-slate-600">{inv.placeOfSupply || '—'}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                          inv.reverseCharge === 'Y'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {inv.reverseCharge}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-slate-900">
                      {formatInr(inv.taxableValue)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      {formatInr(inv.integratedTax)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      {formatInr(inv.centralTax)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      {formatInr(inv.stateUtTax)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      {formatInr(inv.cess)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">
                      {formatInr(inv.totalGst)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                      {formatInr(inv.invoiceValue)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {inv.itcAvailability === 'Yes' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-semibold text-[11px]">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-semibold text-[11px]" title={inv.reason}>
                          <XCircle className="w-3 h-3 text-rose-600" />
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewingInvoice(inv)}
                          title="View 21-field detail"
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!isViewer && (
                          <>
                            <button
                              onClick={() => {
                                setEditingInvoice(inv);
                                setIsAddModalOpen(true);
                              }}
                              title="Edit invoice"
                              className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(inv)}
                              title="Delete invoice"
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={17} className="px-4 py-8 text-center text-slate-400">
                    No invoices found matching current filters for GSTR Period {summary?.displayPeriod || periodKey}.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Table Footer with Totals */}
            {filteredInvoices.length > 0 && (
              <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={8} className="px-3 py-3 text-right">
                    TOTAL ({filteredInvoices.length} Invoices):
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-indigo-950">
                    {formatInr(filteredInvoices.reduce((s, i) => s + i.taxableValue, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-700">
                    {formatInr(filteredInvoices.reduce((s, i) => s + i.integratedTax, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-700">
                    {formatInr(filteredInvoices.reduce((s, i) => s + i.centralTax, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-700">
                    {formatInr(filteredInvoices.reduce((s, i) => s + i.stateUtTax, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-700">
                    {formatInr(filteredInvoices.reduce((s, i) => s + i.cess, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-emerald-800">
                    {formatInr(filteredInvoices.reduce((s, i) => s + i.totalGst, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-950">
                    {formatInr(filteredInvoices.reduce((s, i) => s + i.invoiceValue, 0))}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* View 21-Field Inspection Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div>
                <h3 className="font-bold text-base">Invoice Details — {viewingInvoice.invoiceNumber}</h3>
                <p className="text-xs text-slate-300">Complete 21-Field GSTR-2B Inward Record</p>
              </div>
              <button
                onClick={() => setViewingInvoice(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 text-xs max-h-[70vh] overflow-y-auto">
              <div>
                <span className="text-slate-500 font-semibold block">Supplier GSTIN:</span>
                <span className="font-mono font-bold text-slate-900">{viewingInvoice.supplierGstin}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Trade/Legal Name:</span>
                <span className="font-medium text-slate-900">{viewingInvoice.supplierName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Invoice Number:</span>
                <span className="font-mono font-bold text-blue-700">{viewingInvoice.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Invoice Type:</span>
                <span className="text-slate-900">{viewingInvoice.invoiceType}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Invoice Date:</span>
                <span className="text-slate-900">{viewingInvoice.invoiceDate}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">GSTR Period:</span>
                <span className="font-bold text-blue-700">{viewingInvoice.gstrPeriod}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Place of Supply:</span>
                <span className="text-slate-900">{viewingInvoice.placeOfSupply || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Reverse Charge (RCM):</span>
                <span className="font-bold">{viewingInvoice.reverseCharge}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Taxable Value:</span>
                <span className="font-mono font-bold text-slate-900">{formatInr(viewingInvoice.taxableValue)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Total GST:</span>
                <span className="font-mono font-bold text-emerald-700">{formatInr(viewingInvoice.totalGst)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">IGST:</span>
                <span className="font-mono">{formatInr(viewingInvoice.integratedTax)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">CGST:</span>
                <span className="font-mono">{formatInr(viewingInvoice.centralTax)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">SGST:</span>
                <span className="font-mono">{formatInr(viewingInvoice.stateUtTax)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Cess:</span>
                <span className="font-mono">{formatInr(viewingInvoice.cess)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Total Invoice Value:</span>
                <span className="font-mono font-bold text-slate-900">{formatInr(viewingInvoice.invoiceValue)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">ITC Availability:</span>
                <span className="font-bold">{viewingInvoice.itcAvailability}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Supplier Filing Date:</span>
                <span>{viewingInvoice.filingDate || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Return Source:</span>
                <span>{viewingInvoice.source || 'GSTR-1'}</span>
              </div>
              {viewingInvoice.irn && (
                <div className="col-span-2">
                  <span className="text-slate-500 font-semibold block">IRN (64-character hash):</span>
                  <span className="font-mono text-[11px] break-all text-slate-800">{viewingInvoice.irn}</span>
                </div>
              )}
              {viewingInvoice.reason && (
                <div className="col-span-2">
                  <span className="text-slate-500 font-semibold block">ITC Ineligibility Reason:</span>
                  <span className="text-rose-700">{viewingInvoice.reason}</span>
                </div>
              )}
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingInvoice(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Invoice Modal */}
      {isAddModalOpen && (
        <B2bAddInvoiceModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingInvoice(null);
          }}
          onSuccess={loadMonthData}
          initialData={editingInvoice}
          defaultPeriodKey={summary?.displayPeriod || periodKey}
        />
      )}
    </div>
  );
};
