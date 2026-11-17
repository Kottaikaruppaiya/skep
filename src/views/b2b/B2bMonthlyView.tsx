/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  FileText,
  Building2,
  TrendingUp,
  Download,
  Plus,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Layers,
  Search,
  X,
} from 'lucide-react';
import { api } from '../../api/client.ts';
import type { B2bMonthlySummary, Role } from '../../types/index.ts';
import { B2bAddInvoiceModal } from './B2bAddInvoiceModal.tsx';
import {
  getCurrentIndianFinancialYearLabel,
  getDefaultGstrPeriodLabel,
  getFiscalYearOptions,
} from '../../shared/utils/normalizer.ts';

interface B2bMonthlyViewProps {
  userRole: Role;
  onOpenMonth: (periodKey: string) => void;
}

export const B2bMonthlyView: React.FC<B2bMonthlyViewProps> = ({ userRole, onOpenMonth }) => {
  const currentFy = getCurrentIndianFinancialYearLabel();
  const fyOptions = getFiscalYearOptions();
  const [summaries, setSummaries] = useState<B2bMonthlySummary[]>([]);
  const [selectedFy, setSelectedFy] = useState<string>(currentFy);
  const [monthSearch, setMonthSearch] = useState<string>('');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetAddPeriod, setTargetAddPeriod] = useState<string>(() => getDefaultGstrPeriodLabel());

  const isViewer = userRole === 'VIEWER';

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getB2bMonthlySummaries(selectedFy);
      setSummaries(data);
    } catch (err) {
      console.error('Error loading monthly summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFy]);

  const formatInr = (val?: number) => {
    return '₹' + (Number(val || 0)).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Compute FY aggregates
  const totalInvoices = summaries.reduce((s, m) => s + m.invoiceCount, 0);
  const totalTaxable = summaries.reduce((s, m) => s + m.totalTaxableValue, 0);
  const totalGst = summaries.reduce((s, m) => s + m.totalGst, 0);
  const totalInvoiceVal = summaries.reduce((s, m) => s + m.totalInvoiceValue, 0);
  const totalIgst = summaries.reduce((s, m) => s + m.totalIgst, 0);
  const totalCgst = summaries.reduce((s, m) => s + m.totalCgst, 0);
  const totalSgst = summaries.reduce((s, m) => s + m.totalSgst, 0);

  const handleAddForMonth = (displayPeriod: string) => {
    setTargetAddPeriod(displayPeriod);
    setIsAddModalOpen(true);
  };

  const filteredSummaries = summaries.filter((m) => {
    if (selectedMonthKey === 'ACTIVE_ONLY' && m.invoiceCount === 0) {
      return false;
    }
    if (selectedMonthKey !== 'ALL' && selectedMonthKey !== 'ACTIVE_ONLY' && m.periodKey !== selectedMonthKey) {
      return false;
    }
    if (monthSearch.trim()) {
      const q = monthSearch.trim().toLowerCase();
      return (
        m.displayPeriod.toLowerCase().includes(q) ||
        m.periodKey.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Calendar className="w-4 h-4" />
            <span>Month-by-Month GSTR Periods</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Monthly GST Entries (FY {selectedFy})</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Strictly grouped by GSTR Period (return filing month) across all 12 standard months of the Indian fiscal calendar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* FY Selector */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-300">
            <span className="text-xs font-medium text-slate-600 px-2">Financial Year:</span>
            <select
              value={selectedFy}
              onChange={(e) => setSelectedFy(e.target.value)}
              className="bg-white text-xs font-semibold text-slate-800 rounded-md px-2 py-1 border-0 shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
            >
              {fyOptions.map((fy) => (
                <option key={fy} value={fy}>
                  FY {fy}{fy === currentFy ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadData}
            title="Refresh"
            className="p-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {!isViewer && (
            <button
              onClick={() => {
                setTargetAddPeriod(getDefaultGstrPeriodLabel());
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
            onClick={() => void api.downloadB2bExport({ reportType: 'monthly_summary', financialYear: selectedFy })}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export FY Summary</span>
          </button>
        </div>
      </div>

      {/* Annual Summary Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 uppercase font-semibold">Total Invoices</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{totalInvoices}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 uppercase font-semibold">Total Taxable Value</div>
          <div className="text-xl font-bold text-indigo-950 font-mono mt-1">{formatInr(totalTaxable)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 uppercase font-semibold">Total Input GST</div>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">{formatInr(totalGst)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 uppercase font-semibold">Total Invoice Value</div>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">{formatInr(totalInvoiceVal)}</div>
        </div>
      </div>

      {/* Month Search & Selector Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={monthSearch}
              onChange={(e) => setMonthSearch(e.target.value)}
              placeholder="Search month (e.g. August, 2026-08)..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            {monthSearch && (
              <button
                onClick={() => setMonthSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Choose Month:</span>
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Months (12)</option>
              <option value="ACTIVE_ONLY">Months with Invoices Only</option>
              {summaries.map((m) => (
                <option key={m.periodKey} value={m.periodKey}>
                  {m.displayPeriod} ({m.invoiceCount} {m.invoiceCount === 1 ? 'Inv' : 'Invs'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedMonthKey !== 'ALL' && selectedMonthKey !== 'ACTIVE_ONLY' && (
            <button
              onClick={() => onOpenMonth(selectedMonthKey)}
              className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <span>Open Month Register</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {(monthSearch || selectedMonthKey !== 'ALL') && (
            <button
              onClick={() => {
                setMonthSearch('');
                setSelectedMonthKey('ALL');
              }}
              className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Reset
            </button>
          )}
          <span className="text-xs text-slate-500 font-medium pl-1">
            Showing {filteredSummaries.length} of {summaries.length}
          </span>
        </div>
      </div>

      {/* Months Grid (12 Months April to March) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSummaries.length === 0 ? (
          <div className="col-span-full bg-white p-10 rounded-xl border border-slate-200 text-center text-sm text-slate-500">
            No matching GSTR months found for "{monthSearch || selectedMonthKey}".
          </div>
        ) : (
          filteredSummaries.map((month) => {
          const hasInvoices = month.invoiceCount > 0;

          return (
            <div
              key={month.periodKey}
              className={`rounded-xl border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                hasInvoices
                  ? 'bg-white border-blue-200 shadow-xs hover:border-blue-400 hover:shadow-md'
                  : 'bg-slate-50/60 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              {/* Card Header */}
              <div
                onClick={() => onOpenMonth(month.periodKey)}
                className={`p-4 border-b transition-colors cursor-pointer flex items-center justify-between ${
                  hasInvoices ? 'bg-blue-50/70 border-blue-100 hover:bg-blue-100/60' : 'bg-slate-100/60 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{month.displayPeriod}</h3>
                    {hasInvoices && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[11px] font-semibold">
                        {month.invoiceCount} {month.invoiceCount === 1 ? 'Inv' : 'Invs'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    GSTR Period: {month.periodKey}
                  </div>
                </div>

                <div className="p-1.5 text-blue-600 hover:bg-blue-200/50 rounded-lg">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>

              {/* Card Body */}
              <div
                onClick={() => onOpenMonth(month.periodKey)}
                className="p-5 space-y-3 cursor-pointer flex-1"
              >
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Unique Suppliers</span>
                    <span className="font-semibold text-slate-800 text-sm">
                      {month.uniqueSuppliers} {month.uniqueSuppliers === 1 ? 'Supplier' : 'Suppliers'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ITC Available</span>
                    <span className="font-semibold text-emerald-700 text-sm flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {month.itcAvailableCount} Invoices
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Taxable Value:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {formatInr(month.totalTaxableValue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Total GST:</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {formatInr(month.totalGst)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                    <span>IGST: {formatInr(month.totalIgst)}</span>
                    <span>CGST+SGST: {formatInr(month.totalCgst + month.totalSgst)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                    <span className="text-xs">Invoice Value:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatInr(month.totalInvoiceValue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => onOpenMonth(month.periodKey)}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-100/50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Register</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1.5">
                  {!isViewer && (
                    <button
                      onClick={() => handleAddForMonth(month.displayPeriod)}
                      title={`Add invoice for ${month.displayPeriod}`}
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-300 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  {hasInvoices && (
                    <button
                      type="button"
                      onClick={() => void api.downloadB2bExport({ periodKey: month.periodKey })}
                      title={`Export Excel for ${month.displayPeriod}`}
                      className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-300 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }))}
      </div>

      {/* Add Invoice Modal prefilled with target month */}
      {isAddModalOpen && (
        <B2bAddInvoiceModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={loadData}
          defaultPeriodKey={targetAddPeriod}
        />
      )}
    </div>
  );
};
