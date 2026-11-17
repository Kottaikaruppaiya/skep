/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Building2,
  TrendingUp,
  Download,
  Plus,
  Upload,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { api } from '../../api/client.ts';
import type { B2bDashboardMetrics, FinancialYear, Role } from '../../types/index.ts';
import { B2bAddInvoiceModal } from './B2bAddInvoiceModal.tsx';

interface B2bDashboardViewProps {
  userRole: Role;
  onNavigateTab: (tab: string, param?: string) => void;
}

export const B2bDashboardView: React.FC<B2bDashboardViewProps> = ({ userRole, onNavigateTab }) => {
  const [metrics, setMetrics] = useState<B2bDashboardMetrics | null>(null);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFy, setSelectedFy] = useState<string>('2026-27');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const isViewer = userRole === 'VIEWER';

  const loadData = async () => {
    setLoading(true);
    try {
      const [fys, dashboardData] = await Promise.all([
        api.getFinancialYears(),
        api.getB2bDashboard(selectedFy),
      ]);
      setFinancialYears(fys);
      setMetrics(dashboardData);
    } catch (err) {
      console.error('Error loading B2B dashboard:', err);
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

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Layers className="w-4 h-4" />
            <span>GSTR-2B Compliance & Input Tax Credit</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">B2B Inward Purchase Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time monthly monitoring of inward B2B invoices, ITC availability, and supplier distribution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* FY Selector */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-300">
            <span className="text-xs font-medium text-slate-600 px-2">FY:</span>
            <select
              value={selectedFy}
              onChange={(e) => setSelectedFy(e.target.value)}
              className="bg-white text-xs font-semibold text-slate-800 rounded-md px-2 py-1 border-0 shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
            >
              <option value="2026-27">FY 2026-27</option>
              <option value="2025-26">FY 2025-26</option>
              <option value="ALL">All Financial Years</option>
            </select>
          </div>

          <button
            onClick={loadData}
            title="Refresh Dashboard"
            className="p-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {!isViewer && (
            <>
              <button
                onClick={() => onNavigateTab('b2b-import')}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Import Workbook</span>
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add B2B Invoice</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => void api.downloadB2bExport({ reportType: 'monthly_summary', financialYear: selectedFy })}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Summary</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inward Invoices */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Inward B2B Invoices</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {metrics?.totalInvoices || 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {metrics?.itcAvailableCount || 0} ITC Eligible
            </span>
            <span>•</span>
            <span>{metrics?.reverseChargeCount || 0} RCM</span>
          </div>
        </div>

        {/* Total Taxable Value */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Taxable Value</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-950 font-mono">
            {formatInr(metrics?.totalTaxableValue)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Invoice Value: <span className="font-semibold text-slate-700">{formatInr(metrics?.totalInvoiceValue)}</span>
          </div>
        </div>

        {/* Total GST Incurred */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Input GST (ITC)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono">
            {formatInr(metrics?.totalGst)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px] font-mono">
              IGST: {formatInr(metrics?.totalIgst)}
            </span>
            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px] font-mono">
              CGST: {formatInr(metrics?.totalCgst)}
            </span>
          </div>
        </div>

        {/* Unique Suppliers */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Registered Suppliers</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {metrics?.uniqueSuppliers || 0}
          </div>
          <button
            onClick={() => onNavigateTab('b2b-suppliers')}
            className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View Supplier Master</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Tax Component Pills Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Total GST Breakup:</span>
          <span className="text-xs font-mono font-semibold text-emerald-400">
            {formatInr(metrics?.totalGst)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Integrated Tax (IGST):</span>
            <span className="font-semibold text-blue-300">{formatInr(metrics?.totalIgst)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Central Tax (CGST):</span>
            <span className="font-semibold text-teal-300">{formatInr(metrics?.totalCgst)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">State/UT Tax (SGST):</span>
            <span className="font-semibold text-amber-300">{formatInr(metrics?.totalSgst)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Cess:</span>
            <span className="font-semibold text-purple-300">{formatInr(metrics?.totalCess)}</span>
          </div>
        </div>
      </div>

      {/* Monthly Distribution Trend / Bar Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Monthly GSTR Filing Trend (FY {selectedFy})</h3>
            <p className="text-xs text-slate-500">
              Inward invoice volume and GST credit accrued month-by-month based on GSTR Period.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('b2b-monthly')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View All Months</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Month Bars Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
          {metrics?.monthlyTrends.map((trend) => {
            const hasData = trend.invoiceCount > 0;
            return (
              <div
                key={trend.periodKey}
                onClick={() => onNavigateTab('b2b-monthly-detail', trend.periodKey)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                  hasData
                    ? 'bg-blue-50/50 border-blue-200 hover:border-blue-400 hover:shadow-xs'
                    : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {trend.displayPeriod}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {trend.periodKey}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60">
                  <div className="text-xs font-semibold text-slate-700">
                    {trend.invoiceCount} {trend.invoiceCount === 1 ? 'Invoice' : 'Invoices'}
                  </div>
                  <div className="text-xs font-bold text-emerald-700 font-mono mt-0.5">
                    {formatInr(trend.totalGst)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Columns: Top Suppliers & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suppliers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Top Suppliers by Inward GST</h3>
            </div>
            <button
              onClick={() => onNavigateTab('b2b-suppliers')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Supplier / GSTIN</th>
                  <th className="px-3 py-2.5 text-center">Invoices</th>
                  <th className="px-3 py-2.5 text-right">Taxable Val</th>
                  <th className="px-4 py-2.5 text-right">Total GST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics?.topSuppliers.length ? (
                  metrics.topSuppliers.map((sup, idx) => (
                    <tr key={sup.gstin} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 truncate max-w-[220px]">
                          {sup.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">{sup.gstin}</div>
                      </td>
                      <td className="px-3 py-3 text-center font-medium">{sup.invoiceCount}</td>
                      <td className="px-3 py-3 text-right font-mono text-slate-700">
                        {formatInr(sup.taxableValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                        {formatInr(sup.totalGst)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      No supplier records available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent Inward Invoices</h3>
            </div>
            <button
              onClick={() => onNavigateTab('b2b-register')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Full Register
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Invoice No</th>
                  <th className="px-3 py-2.5">Period</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-4 py-2.5 text-right">Taxable</th>
                  <th className="px-4 py-2.5 text-right">Total GST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics?.recentInvoices && metrics.recentInvoices.length > 0 ? (
                  metrics.recentInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 font-mono">{inv.invoiceNumber}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          {inv.supplierName}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[11px] font-medium">
                          {inv.gstrPeriod}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{inv.invoiceDate}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {formatInr(inv.taxableValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                        {formatInr(inv.totalGst)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      No invoices recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Invoice Modal */}
      {isAddModalOpen && (
        <B2bAddInvoiceModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={loadData}
          defaultPeriodKey="August 2026"
        />
      )}
    </div>
  );
};
