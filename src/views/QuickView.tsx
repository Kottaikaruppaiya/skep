/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  TrendingUp,
  DollarSign,
  Award,
  FileCheck2,
  AlertCircle,
  Download,
  Filter,
  Search,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Layers,
  Edit,
  Check,
  X,
  Trash2,
  Archive,
  Loader2,
} from 'lucide-react';
import { DashboardMetrics, Shipment, ConsigneeMaster, Role } from '../types/index.ts';
import { api } from '../api/client.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';

interface QuickViewProps {
  selectedFyId: string;
  onSelectShipment?: (id: string) => void;
  onRefresh?: () => void;
  userRole?: Role;
  refreshKey?: number;
}

interface InlineRowEditState {
  consigneeId: string;
  shippingBillDate: string;
  invoiceValueUsd: number;
  dbkClaimed: number;
  dbkReceivedDate: string;
  brcDeadline: string;
  remarks: string;
}

export const QuickView: React.FC<QuickViewProps> = ({
  selectedFyId,
  onSelectShipment,
  onRefresh,
  userRole = 'ADMIN',
  refreshKey,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [consignees, setConsignees] = useState<ConsigneeMaster[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [brcStatusFilter, setBrcStatusFilter] = useState('ALL');
  const [incentiveStatusFilter, setIncentiveStatusFilter] = useState('ALL');

  // Inline Row Editing State
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<InlineRowEditState | null>(null);
  const [isRowSaving, setIsRowSaving] = useState(false);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [rowSuccess, setRowSuccess] = useState<string | null>(null);

  // Delete & Archive Modal State
  const [targetShipmentForDelete, setTargetShipmentForDelete] = useState<Shipment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isViewer = userRole === 'VIEWER';

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, s, c] = await Promise.all([
        api.getDashboardMetrics(selectedFyId !== 'ALL' ? selectedFyId : undefined),
        api.getShipments({ financialYearId: selectedFyId !== 'ALL' ? selectedFyId : undefined }),
        api.getConsignees(),
      ]);
      setMetrics(m);
      setShipments(s);
      setConsignees(c);
    } catch (err) {
      console.error('Error fetching Quick View data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFyId, refreshKey]);

  // Financial aggregates for KPI cards across the active dataset
  const kpis = useMemo(() => {
    let totalBills = shipments.length;
    let paidCount = 0;
    let partPaidCount = 0;
    let pendingCount = 0;
    let totalOutstandingUsd = 0;
    let totalNetForexInr = 0;
    let totalDrawbackPendingInr = 0;
    let totalAllIncentivesPendingInr = 0;

    for (const s of shipments) {
      const totalPaid = s.totalPaidUsd || 0;
      const bal = s.balanceDueUsd ?? Math.max(0, s.invoiceValueUsd - totalPaid);
      totalOutstandingUsd += bal;

      if (s.paymentStatus === 'FULLY_PAID' || s.paymentStatus === 'EXCESS_RECEIVED') paidCount++;
      else if (s.paymentStatus === 'PART_PAID') partPaidCount++;
      else pendingCount++;

      // Realised INR and Forex Gain/Loss (derived strictly from actual FIRC receipts, never customs SB rate)
      const realisedRate = s.averageRealisedRate || 0;
      const realisedInr = s.realisedInr ?? (totalPaid * realisedRate);
      const fobInr = s.fobValueInr || 0;
      if (bal === 0 && totalPaid > 0 && realisedInr > 0) {
        totalNetForexInr += (realisedInr - fobInr);
      }

      // Incentives
      const dbk = s.incentives?.find((i) => i.type === 'DRAWBACK');
      const rodtep = s.incentives?.find((i) => i.type === 'RODTEP');
      const rosctl = s.incentives?.find((i) => i.type === 'ROSCTL');

      const dbkPending = Math.max(0, (dbk?.claimedAmount || 0) - (dbk?.receivedAmount || 0));
      const rodtepPending = Math.max(0, (rodtep?.claimedAmount || 0) - (rodtep?.receivedAmount || 0));
      const rosctlPending = Math.max(0, (rosctl?.claimedAmount || 0) - (rosctl?.receivedAmount || 0));

      totalDrawbackPendingInr += dbkPending;
      totalAllIncentivesPendingInr += (dbkPending + rodtepPending + rosctlPending);
    }

    return {
      totalBills,
      paidCount,
      partPaidCount,
      pendingCount,
      totalOutstandingUsd,
      totalNetForexInr,
      totalDrawbackPendingInr,
      totalAllIncentivesPendingInr,
    };
  }, [shipments]);

  // Filtered operational rows
  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesInvoice = s.invoiceNumber.toLowerCase().includes(q);
        const matchesSb = s.shippingBillNumber.toLowerCase().includes(q);
        const matchesConsignee = (s.consigneeName || '').toLowerCase().includes(q);
        if (!matchesInvoice && !matchesSb && !matchesConsignee) return false;
      }

      // Buyer filter
      if (selectedBuyer !== 'ALL' && s.consigneeId !== selectedBuyer) {
        return false;
      }

      // Payment status
      if (paymentStatusFilter !== 'ALL') {
        if (
          paymentStatusFilter === 'PAID' &&
          s.paymentStatus !== 'FULLY_PAID' &&
          s.paymentStatus !== 'EXCESS_RECEIVED'
        ) {
          return false;
        }
        if (paymentStatusFilter === 'PART_PAID' && s.paymentStatus !== 'PART_PAID') return false;
        if (paymentStatusFilter === 'PENDING' && s.paymentStatus !== 'UNPAID') return false;
      }

      // BRC status
      if (brcStatusFilter !== 'ALL') {
        const brc = s.brcRecord;
        if (brcStatusFilter === 'REALISED' && brc?.status !== 'REALISED') return false;
        if (brcStatusFilter === 'PENDING' && brc?.status === 'REALISED') return false;
        if (brcStatusFilter === 'OVERDUE') {
          const isOverdue =
            brc?.status !== 'REALISED' &&
            brc?.statutoryDeadline &&
            new Date(brc.statutoryDeadline).getTime() < Date.now();
          if (!isOverdue) return false;
        }
      }

      // Incentive status
      if (incentiveStatusFilter !== 'ALL') {
        const dbk = s.incentives?.find((i) => i.type === 'DRAWBACK');
        if (incentiveStatusFilter === 'RECEIVED' && dbk?.status !== 'RECEIVED') return false;
        if (incentiveStatusFilter === 'PENDING' && dbk?.status === 'RECEIVED') return false;
      }

      return true;
    });
  }, [shipments, searchTerm, selectedBuyer, paymentStatusFilter, brcStatusFilter, incentiveStatusFilter]);

  // Inline Edit Handlers
  const startRowEdit = (s: Shipment, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isViewer) return;
    const dbk = s.incentives?.find((i) => i.type === 'DRAWBACK');
    setEditingRowId(s.id);
    setEditFormData({
      consigneeId: s.consigneeId,
      shippingBillDate: s.shippingBillDate || '',
      invoiceValueUsd: s.invoiceValueUsd,
      dbkClaimed: dbk?.claimedAmount || 0,
      dbkReceivedDate: dbk?.receivedDate || '',
      brcDeadline: s.brcRecord?.statutoryDeadline || '',
      remarks: s.remarks || '',
    });
    setRowError(null);
  };

  const cancelRowEdit = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRowId(null);
    setEditFormData(null);
    setRowError(null);
  };

  const handleSaveInlineRow = async (s: Shipment, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!editFormData) return;

    if (editFormData.invoiceValueUsd <= 0) {
      setRowError({ id: s.id, message: 'Invoice Value (USD) must be greater than zero.' });
      return;
    }

    setIsRowSaving(true);
    setRowError(null);
    try {
      const updated = await api.updateShipment(s.id, {
        consigneeId: editFormData.consigneeId,
        shippingBillDate: editFormData.shippingBillDate || undefined,
        invoiceValueUsd: Number(editFormData.invoiceValueUsd),
        remarks: editFormData.remarks.trim() || null,
        ...(editFormData.dbkClaimed !== undefined ? { dbkClaimed: Number(editFormData.dbkClaimed) } : {}),
        dbkReceivedDate: editFormData.dbkReceivedDate || null,
      } as any);

      // Persist to local list immediately
      setShipments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingRowId(null);
      setEditFormData(null);
      setRowSuccess(`Invoice ${updated.invoiceNumber} saved & formulas recalculated.`);
      setTimeout(() => setRowSuccess(null), 3500);

      // Trigger app-wide synchronization
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setRowError({ id: s.id, message: err.message || 'Failed to save changes.' });
    } finally {
      setIsRowSaving(false);
    }
  };

  // Keyboard navigation for inline edit
  const handleKeyDown = (e: React.KeyboardEvent, s: Shipment) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveInlineRow(s);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRowEdit();
    }
  };

  // Delete & Archive Handlers
  const handleDeleteShipment = async () => {
    if (!targetShipmentForDelete) return;
    try {
      await api.deleteShipment(targetShipmentForDelete.id);
      setShipments((prev) => prev.filter((s) => s.id !== targetShipmentForDelete.id));
      setRowSuccess(`Shipment ${targetShipmentForDelete.invoiceNumber} deleted.`);
      setTimeout(() => setRowSuccess(null), 3500);
      setTargetShipmentForDelete(null);
      if (onRefresh) onRefresh();
      loadData();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete shipment.');
      throw err;
    }
  };

  const handleArchiveShipment = async () => {
    if (!targetShipmentForDelete) return;
    try {
      await api.archiveShipment(
        targetShipmentForDelete.id,
        'Archived from Quick View to preserve statutory and payment history'
      );
      setShipments((prev) => prev.filter((s) => s.id !== targetShipmentForDelete.id));
      setRowSuccess(`Shipment ${targetShipmentForDelete.invoiceNumber} archived safely.`);
      setTimeout(() => setRowSuccess(null), 3500);
      setTargetShipmentForDelete(null);
      if (onRefresh) onRefresh();
      loadData();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to archive shipment.');
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Eye size={20} className="text-blue-600 flex-shrink-0" />
            <span>Operational Quick View &amp; Excel-like Grid Editor</span>
          </h2>
          <p className="text-xs text-slate-500">
            Worksheet 3: 15-column high-density tracking matrix, real-time formula recalculation, and inline editing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void api.downloadExportCsv(
                'Export Tracker',
                selectedFyId !== 'ALL' ? selectedFyId : undefined,
                'QuickView_Tracker.csv'
              )
            }
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download size={14} />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {rowSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{rowSuccess}</span>
        </div>
      )}

      {/* TOP 8 SUMMARY KPI CARDS (Part 8.2) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
        {/* 1. Total Bills */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            1. Total Bills
          </span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            {kpis.totalBills}
          </div>
          <span className="text-[10px] text-slate-500">Invoices Tracked</span>
        </div>

        {/* 2. Paid Bills */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
            2. Paid
          </span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
            {kpis.paidCount}
          </div>
          <span className="text-[10px] text-emerald-600">Fully Realised</span>
        </div>

        {/* 3. Part Paid Bills */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
            3. Part Paid
          </span>
          <div className="text-xl font-bold font-mono text-amber-700 mt-0.5">
            {kpis.partPaidCount}
          </div>
          <span className="text-[10px] text-amber-600">Partial Inward</span>
        </div>

        {/* 4. Pending Payment */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
            4. Pending
          </span>
          <div className="text-xl font-bold font-mono text-rose-700 mt-0.5">
            {kpis.pendingCount}
          </div>
          <span className="text-[10px] text-rose-600">Awaiting FIRC</span>
        </div>

        {/* 5. Outstanding USD */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            5. Outst (USD)
          </span>
          <div className="text-xl font-bold font-mono text-amber-700 mt-0.5">
            ${Math.round(kpis.totalOutstandingUsd).toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500">Balance Due</span>
        </div>

        {/* 6. Net Forex INR */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            6. Forex (INR)
          </span>
          <div
            className={`text-xl font-bold font-mono mt-0.5 ${
              kpis.totalNetForexInr >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {kpis.totalNetForexInr >= 0 ? '+' : ''}₹{Math.round(kpis.totalNetForexInr).toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500">Realised Gain/Loss</span>
        </div>

        {/* 7. DBK Pending */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
            7. DBK Pend
          </span>
          <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">
            ₹{Math.round(kpis.totalDrawbackPendingInr).toLocaleString()}
          </div>
          <span className="text-[10px] text-blue-600">Duty Drawback</span>
        </div>

        {/* 8. All Inc Pending */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">
            8. All Inc Pend
          </span>
          <div className="text-xl font-bold font-mono text-purple-700 mt-0.5">
            ₹{Math.round(kpis.totalAllIncentivesPendingInr).toLocaleString()}
          </div>
          <span className="text-[10px] text-purple-600">DBK+RoDTEP+RoSCTL</span>
        </div>
      </div>

      {/* FILTER TOOLBAR (Part 8.3) */}
      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-blue-600" />
            <span className="text-xs font-bold text-slate-800">Filter Operational Grid:</span>
          </div>

          <div className="text-xs text-slate-500">
            Tip: Click <strong>Edit</strong> or double-click any row to edit values inline. Formulas update live!
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoice, SB, buyer..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:bg-white focus:border-blue-500"
            />
          </div>

          {/* Buyer Selector */}
          <div>
            <select
              value={selectedBuyer}
              onChange={(e) => setSelectedBuyer(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 truncate"
            >
              <option value="ALL">All Buyers ({consignees.length})</option>
              {consignees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Fully Paid</option>
              <option value="PART_PAID">Part-Paid</option>
              <option value="PENDING">Pending (Unpaid)</option>
            </select>
          </div>

          {/* BRC Status */}
          <div>
            <select
              value={brcStatusFilter}
              onChange={(e) => setBrcStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="ALL">All BRC Statuses</option>
              <option value="REALISED">BRC Realised</option>
              <option value="PENDING">BRC Pending</option>
              <option value="OVERDUE">BRC Overdue (&gt;9m)</option>
            </select>
          </div>

          {/* Incentive Status */}
          <div>
            <select
              value={incentiveStatusFilter}
              onChange={(e) => setIncentiveStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="ALL">All Incentive Statuses</option>
              <option value="RECEIVED">DBK Received</option>
              <option value="PENDING">DBK Pending</option>
            </select>
          </div>
        </div>

        {/* Active Filter Indicators */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{filteredShipments.length}</strong> of{' '}
            <strong className="text-slate-800">{shipments.length}</strong> invoices
          </span>

          {(searchTerm ||
            selectedBuyer !== 'ALL' ||
            paymentStatusFilter !== 'ALL' ||
            brcStatusFilter !== 'ALL' ||
            incentiveStatusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedBuyer('ALL');
                setPaymentStatusFilter('ALL');
                setBrcStatusFilter('ALL');
                setIncentiveStatusFilter('ALL');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Row-Level Error Message */}
      {rowError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{rowError.message}</span>
          </div>
          <button
            onClick={() => setRowError(null)}
            className="text-rose-500 hover:text-rose-800 font-bold p-1"
          >
            ×
          </button>
        </div>
      )}

      {/* 15-COLUMN HIGH DENSITY OPERATIONAL TABLE WITH INLINE EDITING (Part 8.1 & Part 5) */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1600px] text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold sticky top-0 z-10">
              <tr>
                <th className="p-3 text-center w-12">1. S.No</th>
                <th className="p-3">2. Invoice No</th>
                <th className="p-3">3. Consignee</th>
                <th className="p-3">4. SB Date</th>
                <th className="p-3 text-right">5. Inv USD</th>
                <th className="p-3 text-right">6. Recd USD</th>
                <th className="p-3 text-right">7. Outst USD</th>
                <th className="p-3 text-center">8. Status</th>
                <th className="p-3">9. Recd On</th>
                <th className="p-3 text-right">10. Forex INR</th>
                <th className="p-3 text-right">11. DBK Claim</th>
                <th className="p-3 text-center">12. DBK Status</th>
                <th className="p-3">13. DBK Date</th>
                <th className="p-3 text-right">14. All Inc Pending</th>
                <th className="p-3 text-center">15. BRC Due</th>
                <th className="p-3 text-right min-w-[130px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={16} className="p-8 text-center text-xs text-slate-400">
                    No shipments match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredShipments.map((s, idx) => {
                  const isEditingThisRow = editingRowId === s.id;

                  // Existing or in-progress values
                  const currentInvUsd = isEditingThisRow && editFormData
                    ? Number(editFormData.invoiceValueUsd)
                    : s.invoiceValueUsd;
                  const totalPaid = s.totalPaidUsd || 0;
                  const balUsd = Math.max(0, currentInvUsd - totalPaid);

                  // Derived payment status preview
                  let derivedStatus = s.paymentStatus;
                  if (totalPaid >= currentInvUsd && currentInvUsd > 0) {
                    derivedStatus = totalPaid > currentInvUsd ? 'EXCESS_RECEIVED' : 'FULLY_PAID';
                  } else if (totalPaid > 0) {
                    derivedStatus = 'PART_PAID';
                  } else {
                    derivedStatus = 'UNPAID';
                  }

                  // Realised INR & Forex live recalculation (never substitute SB rate for payment rate)
                  const realisedRate = s.averageRealisedRate || 0;
                  const realisedInr = s.realisedInr ?? (totalPaid * realisedRate);
                  const currentFobInr = isEditingThisRow && editFormData
                    ? Math.round(currentInvUsd * (s.sbExchangeRate || 0) * 100) / 100
                    : s.fobValueInr;
                  const netForexInr = balUsd === 0 && totalPaid > 0 && realisedInr > 0 ? realisedInr - currentFobInr : 0;

                  // Incentives live recalculation
                  const dbk = s.incentives?.find((i) => i.type === 'DRAWBACK');
                  const rodtep = s.incentives?.find((i) => i.type === 'RODTEP');
                  const rosctl = s.incentives?.find((i) => i.type === 'ROSCTL');

                  const dbkClaimed = isEditingThisRow && editFormData
                    ? Number(editFormData.dbkClaimed)
                    : (dbk?.claimedAmount || 0);
                  const dbkRecd = dbk?.receivedAmount || 0;
                  const dbkPending = Math.max(0, dbkClaimed - dbkRecd);
                  const rodtepPending = Math.max(0, (rodtep?.claimedAmount || 0) - (rodtep?.receivedAmount || 0));
                  const rosctlPending = Math.max(0, (rosctl?.claimedAmount || 0) - (rosctl?.receivedAmount || 0));
                  const allIncPending = dbkPending + rodtepPending + rosctlPending;

                  // BRC
                  const brc = s.brcRecord;
                  const isBrcRealised = brc?.status === 'REALISED';
                  const brcDeadlineDisplay = isEditingThisRow && editFormData
                    ? editFormData.brcDeadline
                    : brc?.statutoryDeadline;
                  const isBrcOverdue =
                    brc?.status === 'OVERDUE' ||
                    (!isBrcRealised &&
                      brcDeadlineDisplay &&
                      new Date(brcDeadlineDisplay).getTime() < Date.now());

                  // Realisation date(s) across all linked allocations or days pending
                  let receivedOnText = 'Pending';
                  if (s.allocations && s.allocations.length > 0) {
                    const dates = Array.from(
                      new Set(
                        s.allocations
                          .map((a) => a.paymentCreditDate || (a.allocatedAt ? a.allocatedAt.split('T')[0] : ''))
                          .filter(Boolean)
                      )
                    );
                    receivedOnText = dates.length > 0 ? dates.join(', ') : 'Settled';
                  } else if (s.shippingBillDate) {
                    const daysAgo = Math.floor(
                      (Date.now() - new Date(s.shippingBillDate).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    receivedOnText = `${daysAgo}d pending`;
                  }

                  return (
                    <tr
                      key={s.id}
                      onDoubleClick={(e) => startRowEdit(s, e)}
                      onKeyDown={(e) => handleKeyDown(e, s)}
                      className={`transition-colors group ${
                        isEditingThisRow
                          ? 'bg-blue-50/70 border-y-2 border-blue-400'
                          : 'hover:bg-blue-50/40 cursor-pointer'
                      }`}
                      onClick={() => !isEditingThisRow && onSelectShipment?.(s.id)}
                    >
                      {/* 1. S.No */}
                      <td className="p-3 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* 2. Invoice No (Canonical Key) */}
                      <td className="p-3 font-mono font-bold text-slate-900 group-hover:text-blue-600">
                        {s.invoiceNumber}
                      </td>

                      {/* 3. Consignee (Editable) */}
                      <td className="p-3 text-slate-800 font-medium max-w-[220px]">
                        {isEditingThisRow && editFormData ? (
                          <select
                            value={editFormData.consigneeId}
                            onChange={(e) =>
                              setEditFormData({ ...editFormData, consigneeId: e.target.value })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="w-full p-1 bg-white border border-blue-400 rounded text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {consignees.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span title={s.consigneeName} className="truncate block">
                            {s.consigneeName || 'Unknown Buyer'}
                          </span>
                        )}
                      </td>

                      {/* 4. SB Date (Editable) */}
                      <td className="p-3 font-mono text-slate-600">
                        {isEditingThisRow && editFormData ? (
                          <input
                            type="date"
                            value={editFormData.shippingBillDate}
                            onChange={(e) =>
                              setEditFormData({ ...editFormData, shippingBillDate: e.target.value })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 bg-white border border-blue-400 rounded text-xs font-mono font-medium focus:outline-none"
                          >
                          </input>
                        ) : (
                          s.shippingBillDate || '—'
                        )}
                      </td>

                      {/* 5. Inv USD (Editable - Triggers Live Dependency Recalculation!) */}
                      <td className="p-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {isEditingThisRow && editFormData ? (
                          <div className="flex items-center justify-end">
                            <span className="text-slate-400 mr-0.5">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editFormData.invoiceValueUsd}
                              onChange={(e) =>
                                setEditFormData({
                                  ...editFormData,
                                  invoiceValueUsd: parseFloat(e.target.value) || 0,
                                })
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="w-28 p-1 text-right bg-white border border-blue-500 rounded font-bold font-mono text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                        ) : (
                          `$${s.invoiceValueUsd.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        )}
                      </td>

                      {/* 6. Recd USD (Read-only Formula) */}
                      <td className="p-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                        ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 7. Outst USD (Live Calculated Preview: Inv USD - Recd USD) */}
                      <td className="p-3 text-right font-mono tabular-nums font-bold text-amber-700">
                        ${balUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 8. Status (Live Derived Badge) */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            derivedStatus === 'FULLY_PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : derivedStatus === 'PART_PAID'
                              ? 'bg-amber-100 text-amber-800'
                              : derivedStatus === 'EXCESS_RECEIVED'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {derivedStatus === 'FULLY_PAID'
                            ? 'PAID'
                            : derivedStatus === 'PART_PAID'
                            ? 'PART PAID'
                            : derivedStatus === 'EXCESS_RECEIVED'
                            ? 'EXCESS'
                            : 'PENDING'}
                        </span>
                      </td>

                      {/* 9. Recd On */}
                      <td className="p-3 font-mono text-slate-600 text-[11px]">
                        {receivedOnText}
                      </td>

                      {/* 10. Forex INR (Live Calculated Preview: Realised INR - FOB INR) */}
                      <td
                        className={`p-3 text-right font-mono tabular-nums font-bold ${
                          netForexInr >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {netForexInr >= 0 ? '+' : ''}₹{netForexInr.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* 11. DBK Claim (Editable) */}
                      <td className="p-3 text-right font-mono tabular-nums text-slate-700">
                        {isEditingThisRow && editFormData ? (
                          <div className="flex items-center justify-end">
                            <span className="text-slate-400 mr-0.5">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={editFormData.dbkClaimed}
                              onChange={(e) =>
                                setEditFormData({
                                  ...editFormData,
                                  dbkClaimed: parseFloat(e.target.value) || 0,
                                })
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="w-24 p-1 text-right bg-white border border-blue-500 rounded font-semibold font-mono text-slate-900 focus:outline-none"
                            />
                          </div>
                        ) : (
                          `₹${dbkClaimed.toLocaleString()}`
                        )}
                      </td>

                      {/* 12. DBK Status (Live Calculated) */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            dbkRecd >= dbkClaimed && dbkClaimed > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : dbkRecd > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {dbkRecd >= dbkClaimed && dbkClaimed > 0
                            ? 'RECEIVED'
                            : dbkRecd > 0
                            ? 'PART_RECEIVED'
                            : 'PENDING'}
                        </span>
                      </td>

                      {/* 13. DBK Date (Editable) */}
                      <td className="p-3 font-mono text-slate-500 text-[11px]">
                        {isEditingThisRow && editFormData ? (
                          <input
                            type="date"
                            value={editFormData.dbkReceivedDate}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                dbkReceivedDate: e.target.value,
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 bg-white border border-blue-400 rounded text-xs font-mono"
                          />
                        ) : (
                          dbk?.receivedDate || '—'
                        )}
                      </td>

                      {/* 14. All Inc Pending (Live Recalculated) */}
                      <td className="p-3 text-right font-mono tabular-nums font-bold text-purple-700">
                        ₹{allIncPending.toLocaleString()}
                      </td>

                      {/* 15. BRC Due */}
                      <td className="p-3 text-center">
                        {isBrcRealised ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <CheckCircle2 size={12} />
                            <span>Realised</span>
                          </span>
                        ) : isBrcOverdue ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            <XCircle size={12} />
                            <span>Overdue</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                            <Clock size={12} className="text-slate-400" />
                            <span>{brcDeadlineDisplay || 'Due 9m'}</span>
                          </span>
                        )}
                      </td>

                      {/* 16. Action Column (Inline Save / Cancel / Edit / Delete) */}
                      <td
                        className="p-3 text-right min-w-[130px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEditingThisRow ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleSaveInlineRow(s, e)}
                              disabled={isRowSaving}
                              title="Save Changes to Database"
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            >
                              {isRowSaving ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Check size={13} />
                              )}
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => cancelRowEdit(e)}
                              disabled={isRowSaving}
                              title="Cancel & Revert Changes"
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {!isViewer && (
                              <button
                                type="button"
                                onClick={(e) => startRowEdit(s, e)}
                                title="Edit Values Inline (Excel-like)"
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-100 text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onSelectShipment?.(s.id)}
                              title="Open Shipment Dossier"
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            >
                              <Eye size={14} />
                            </button>
                            {!isViewer && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTargetShipmentForDelete(s);
                                  setDeleteError(null);
                                }}
                                title="Delete or Archive Shipment"
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Row count footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{filteredShipments.length}</strong> of{' '}
            <strong className="text-slate-800">{shipments.length}</strong> invoices
          </span>
          <span className="text-[11px] text-slate-400">
            Double-click row or click <Edit size={11} className="inline text-blue-600" /> to edit values inline. Press Enter to Save, Esc to Cancel.
          </span>
        </div>
      </div>

      {/* Confirmation Modal for Delete & Archival */}
      {targetShipmentForDelete && (
        <ConfirmationModal
          isOpen={Boolean(targetShipmentForDelete)}
          onClose={() => {
            setTargetShipmentForDelete(null);
            setDeleteError(null);
          }}
          onConfirm={handleDeleteShipment}
          showArchiveOption={true}
          onArchive={handleArchiveShipment}
          title="Delete Export Shipment Record"
          entityName={targetShipmentForDelete.invoiceNumber}
          entityType="Export Invoice"
          message={`Are you sure you want to delete shipment "${targetShipmentForDelete.invoiceNumber}"? If active payment allocations or realised statutory records exist, deletion will be blocked to safeguard customs and financial integrity; you may safely archive the record instead.`}
          confirmText="Delete Record"
          archiveText="Archive Safely"
          error={deleteError}
        />
      )}
    </div>
  );
};
