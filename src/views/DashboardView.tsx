/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  FileCheck2,
  Award,
  Clock,
  ArrowUpRight,
  PlusCircle,
  FileSpreadsheet,
  Download,
  Search,
  Receipt,
} from 'lucide-react';
import { DashboardMetrics, Role } from '../types/index.ts';
import { api } from '../api/client.ts';

interface DashboardViewProps {
  selectedFyId: string;
  onNavigate: (tab: any) => void;
  onSelectShipment: (id: string) => void;
  userRole: Role;
  refreshKey?: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  selectedFyId,
  onNavigate,
  onSelectShipment,
  userRole,
  refreshKey,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getDashboardMetrics(selectedFyId)
      .then((data) => setMetrics(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedFyId, refreshKey]);

  if (loading || !metrics) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
        Calculating financial realization metrics and ledger totals...
      </div>
    );
  }

  const realisationPercent =
    metrics.totalInvoiceValueUsd > 0
      ? ((metrics.totalRealisedUsd / metrics.totalInvoiceValueUsd) * 100).toFixed(1)
      : '0.0';

  const isViewer = userRole === 'VIEWER';

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-4 sm:p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              FY {selectedFyId.replace('fy-', '')}
            </span>
            <span className="text-xs text-slate-400 font-medium">Export Realisation Console</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">S K Enterprises — Export Document Vault</h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Real-time tracking of export invoices, customs Shipping Bills, bank FIRC foreign inward remittances, and DGFT eBRC certificates.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {!isViewer && (
            <button
              onClick={() => onNavigate('new-shipment')}
              className="px-3.5 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <PlusCircle size={15} />
              <span>New Shipment</span>
            </button>
          )}
          <button
            onClick={() => onNavigate('excel')}
            className="px-3.5 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Download size={14} />
            <span>Excel Reports</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Invoiced */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Invoiced (USD)
            </span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign size={16} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            ${metrics.totalInvoiceValueUsd.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>{metrics.totalShipments} Shipments</span>
            <span className="font-semibold text-slate-700">100% Invoiced</span>
          </div>
        </div>

        {/* Total Realised */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Total Realised (FIRC)
            </span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle size={16} />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">
            ${metrics.totalRealisedUsd.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-700 mt-1 flex items-center justify-between font-medium">
            <span>{realisationPercent}% Realised</span>
            <span>{metrics.fullyPaidCount} Fully Settled</span>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Outstanding USD Due
            </span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">
            ${metrics.totalOutstandingUsd.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>{metrics.partPaidCount} Part Paid</span>
            <span>{metrics.unpaidCount} Unpaid</span>
          </div>
        </div>

        {/* Incentives */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
              Pending Incentives (INR)
            </span>
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Award size={16} />
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-800 mt-2">
            ₹{metrics.incentivesPendingInr.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>Claimed: ₹{metrics.incentivesClaimedInr.toLocaleString()}</span>
            <span className="text-emerald-700 font-semibold">
              Recv: ₹{metrics.incentivesReceivedInr.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Realisation Status Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800">Export Realisation Progress (FY)</span>
          <span className="font-semibold text-emerald-700">{realisationPercent}% Completed</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${realisationPercent}%` }}
            className="bg-emerald-500 h-full transition-all duration-500"
          ></div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>Realised: ${metrics.totalRealisedUsd.toLocaleString()}</span>
          <span>Target: ${metrics.totalInvoiceValueUsd.toLocaleString()}</span>
        </div>
      </div>

      {/* Two Column Layout: BRC Watchlist & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* BRC / eBRC Compliance */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <FileCheck2 size={18} className="text-blue-600" />
              <span>BRC / eBRC Compliance Overview</span>
            </h3>
            <button
              onClick={() => onNavigate('brc')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>View BRC Manager</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
              <span className="text-xl font-bold text-emerald-800 block">{metrics.brcRealisedCount}</span>
              <span className="text-[10px] text-emerald-700 font-medium uppercase tracking-wider">
                BRC Realised
              </span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <span className="text-xl font-bold text-amber-800 block">{metrics.brcPendingCount}</span>
              <span className="text-[10px] text-amber-700 font-medium uppercase tracking-wider">
                Pending Issuance
              </span>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
              <span className="text-xl font-bold text-red-800 block">{metrics.brcOverdueCount}</span>
              <span className="text-[10px] text-red-700 font-medium uppercase tracking-wider">
                Overdue Deadline
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200">
            FEMA statutory deadline reminder: Bank realization must be completed within statutory timeframe from export date.
          </div>
        </div>

        {/* GST Entry & Realisation Overview */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Receipt size={18} className="text-emerald-600" />
              <span>Consignee GST Refund & Compliance</span>
            </h3>
            <button
              onClick={() => onNavigate('gst-entry')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              <span>Open GST Entry</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[11px] text-slate-500 block">Total GST Claimed</span>
              <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                ₹{metrics.gstSummary?.totalGst?.toLocaleString() || '0'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[11px] text-slate-500 block">Refund Eligible</span>
              <span className="text-sm font-bold text-emerald-700 font-mono mt-0.5 block">
                ₹{metrics.gstSummary?.totalRefundEligible?.toLocaleString() || '0'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-[11px] text-slate-600">Net Refund Differential:</span>
              <span className="font-bold font-mono ml-1.5 text-slate-900">
                ₹{(metrics.gstSummary?.netDifference || 0) >= 0 ? '+' : ''}
                {metrics.gstSummary?.netDifference?.toLocaleString() || '0'}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                (metrics.gstSummary?.netDifference || 0) > 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : (metrics.gstSummary?.netDifference || 0) < 0
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {(metrics.gstSummary?.netDifference || 0) > 0 ? 'GAIN' : (metrics.gstSummary?.netDifference || 0) < 0 ? 'LOSS' : 'NIL'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
