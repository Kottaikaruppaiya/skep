/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../api/client.ts';
import type { B2bInvoice, Role, Supplier } from '../../types/index.ts';
import { B2bAddInvoiceModal } from './B2bAddInvoiceModal.tsx';

interface B2bInvoiceRegisterViewProps {
  userRole: Role;
}

export const B2bInvoiceRegisterView: React.FC<B2bInvoiceRegisterViewProps> = ({ userRole }) => {
  const [invoices, setInvoices] = useState<B2bInvoice[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalTaxable, setTotalTaxable] = useState(0);
  const [totalGst, setTotalGst] = useState(0);
  const [totalInvoiceVal, setTotalInvoiceVal] = useState(0);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState('');
  const [periodKey, setPeriodKey] = useState('ALL');
  const [financialYear, setFinancialYear] = useState('2026-27');
  const [supplierGstin, setSupplierGstin] = useState('ALL');
  const [invoiceType, setInvoiceType] = useState('ALL');
  const [reverseCharge, setReverseCharge] = useState('ALL');
  const [itcAvailability, setItcAvailability] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<B2bInvoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<B2bInvoice | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isViewer = userRole === 'VIEWER';

  const loadData = async () => {
    setLoading(true);
    try {
      const [invRes, supRes] = await Promise.all([
        api.getB2bInvoices({
          periodKey,
          financialYear,
          supplierGstin,
          invoiceType,
          reverseCharge,
          itcAvailability,
          search,
          page,
          limit,
        }),
        api.getB2bSuppliers(),
      ]);

      setInvoices(invRes.data);
      setTotalCount(invRes.total);
      setTotalTaxable(invRes.totalTaxableValue);
      setTotalGst(invRes.totalGst);
      setTotalInvoiceVal(invRes.totalInvoiceValue);
      setSuppliers(supRes);
    } catch (err) {
      console.error('Failed to load invoice register:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [periodKey, financialYear, supplierGstin, invoiceType, reverseCharge, itcAvailability, page, limit]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const formatInr = (val?: number) => {
    return '₹' + (Number(val || 0)).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleDelete = async (invoice: B2bInvoice) => {
    if (isViewer) return;
    if (
      !confirm(
        `Are you sure you want to delete invoice "${invoice.invoiceNumber}" for supplier ${invoice.supplierName}?`
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await api.deleteB2bInvoice(invoice.id);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete invoice.');
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <FileText className="w-4 h-4" />
            <span>GSTR-2B Inward Purchase Master</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">B2B Invoice Register</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Complete inward purchase register with multi-column filtering, period sorting, and full 21 GSTR fields.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            title="Refresh Register"
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
              <span>Add B2B Invoice</span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              void api.downloadB2bExport({
                periodKey,
                financialYear,
                supplierGstin,
              })
            }
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Register (.xlsx)</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="font-bold text-red-600">×</button>
        </div>
      )}

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 uppercase font-semibold">Matched Invoices</span>
          <div className="text-xl font-bold text-slate-900 mt-1">{totalCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 uppercase font-semibold">Total Taxable Value</span>
          <div className="text-xl font-bold text-indigo-950 font-mono mt-1">{formatInr(totalTaxable)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 uppercase font-semibold">Total Input GST</span>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">{formatInr(totalGst)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 uppercase font-semibold">Total Invoice Value</span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">{formatInr(totalInvoiceVal)}</div>
        </div>
      </div>

      {/* Multi-Filters Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice number, supplier, GSTIN, IRN..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* FY Filter */}
          <select
            value={financialYear}
            onChange={(e) => {
              setFinancialYear(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="2026-27">FY 2026-27</option>
            <option value="2025-26">FY 2025-26</option>
            <option value="ALL">All Financial Years</option>
          </select>

          {/* GSTR Period Filter */}
          <select
            value={periodKey}
            onChange={(e) => {
              setPeriodKey(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="ALL">All GSTR Periods</option>
            <option value="2026-04">April 2026</option>
            <option value="2026-05">May 2026</option>
            <option value="2026-06">June 2026</option>
            <option value="2026-07">July 2026</option>
            <option value="2026-08">August 2026</option>
            <option value="2026-09">September 2026</option>
            <option value="2026-10">October 2026</option>
            <option value="2026-11">November 2026</option>
            <option value="2026-12">December 2026</option>
            <option value="2027-01">January 2027</option>
            <option value="2027-02">February 2027</option>
            <option value="2027-03">March 2027</option>
          </select>

          {/* Supplier Filter */}
          <select
            value={supplierGstin}
            onChange={(e) => {
              setSupplierGstin(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden max-w-[200px]"
          >
            <option value="ALL">All Suppliers ({suppliers.length})</option>
            {suppliers.map((s) => (
              <option key={s.gstin} value={s.gstin}>
                {s.legalName}
              </option>
            ))}
          </select>

          {/* Invoice Type */}
          <select
            value={invoiceType}
            onChange={(e) => {
              setInvoiceType(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="ALL">All Types</option>
            <option value="Regular">Regular</option>
            <option value="Deemed Exp">Deemed Export</option>
            <option value="SEZ supplies with payment">SEZ with Payment</option>
          </select>

          {/* ITC Filter */}
          <select
            value={itcAvailability}
            onChange={(e) => {
              setItcAvailability(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="ALL">All ITC</option>
            <option value="Yes">ITC Available (Yes)</option>
            <option value="No">ITC Ineligible (No)</option>
          </select>

          {/* RCM Filter */}
          <select
            value={reverseCharge}
            onChange={(e) => {
              setReverseCharge(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="ALL">All RCM</option>
            <option value="N">Regular (N)</option>
            <option value="Y">Reverse Charge (Y)</option>
          </select>

          {/* Page Limit */}
          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="15">15 / page</option>
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold tracking-wider border-b border-slate-200 whitespace-nowrap">
              <tr>
                <th className="px-3 py-3 w-10 text-center">#</th>
                <th className="px-3 py-3">Supplier GSTIN</th>
                <th className="px-3 py-3">Supplier Name</th>
                <th className="px-3 py-3">Invoice No</th>
                <th className="px-3 py-3">GSTR Period</th>
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
              {invoices.length > 0 ? (
                invoices.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-3 py-3 text-center font-mono text-slate-400">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td className="px-3 py-3 font-mono font-medium text-slate-700">
                      {inv.supplierGstin}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900 max-w-[180px] truncate" title={inv.supplierName}>
                      {inv.supplierName}
                    </td>
                    <td className="px-3 py-3 font-mono font-bold text-blue-700">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[11px] font-medium whitespace-nowrap">
                        {inv.gstrPeriod}
                      </span>
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
                  <td colSpan={18} className="px-4 py-8 text-center text-slate-400">
                    No inward invoices found matching current filter parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200 text-xs">
          <div className="text-slate-500">
            Showing <span className="font-semibold text-slate-800">{invoices.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalCount}</span> total invoices
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-700 font-semibold px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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
          onSuccess={loadData}
          initialData={editingInvoice}
          defaultPeriodKey={periodKey !== 'ALL' ? periodKey : 'August 2026'}
        />
      )}
    </div>
  );
};
