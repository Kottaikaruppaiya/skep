/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  PlusCircle,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  Trash2,
  Edit,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  MinusCircle,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { GstEntry, GstSummary, GstResult, ConsigneeMaster, Role } from '../types/index.ts';

interface GstEntryViewProps {
  userRole: Role;
}

export const GstEntryView: React.FC<GstEntryViewProps> = ({ userRole }) => {
  const isViewer = userRole === 'VIEWER';

  // Data state
  const [entries, setEntries] = useState<GstEntry[]>([]);
  const [summary, setSummary] = useState<GstSummary | null>(null);
  const [consignees, setConsignees] = useState<ConsigneeMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedConsigneeId, setSelectedConsigneeId] = useState('ALL');
  const [selectedResult, setSelectedResult] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<'entryDate' | 'consigneeName' | 'totalGst' | 'refundEligible' | 'difference'>('entryDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GstEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<GstEntry | null>(null);
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<GstEntry | null>(null);

  // Form state (for create and edit)
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formConsigneeId, setFormConsigneeId] = useState('');
  const [formIgst, setFormIgst] = useState<string>('0');
  const [formCgst, setFormCgst] = useState<string>('0');
  const [formSgst, setFormSgst] = useState<string>('0');
  const [formRefundEligible, setFormRefundEligible] = useState<string>('0');
  const [formRemarks, setFormRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Computed values in form for real-time preview
  const numIgst = Math.max(0, parseFloat(formIgst) || 0);
  const numCgst = Math.max(0, parseFloat(formCgst) || 0);
  const numSgst = Math.max(0, parseFloat(formSgst) || 0);
  const numRefund = Math.max(0, parseFloat(formRefundEligible) || 0);
  const computedTotalGst = Math.round((numIgst + numCgst + numSgst) * 100) / 100;
  const computedDifference = Math.round((numRefund - computedTotalGst) * 100) / 100;
  const computedResult: GstResult = computedDifference > 0 ? 'GAIN' : computedDifference < 0 ? 'LOSS' : 'NIL';

  // Load consignees once
  useEffect(() => {
    api.getConsignees().then(setConsignees).catch(console.error);
  }, []);

  // Fetch entries
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const data = await api.getGstEntries({
        consigneeId: selectedConsigneeId !== 'ALL' ? selectedConsigneeId : undefined,
        result: selectedResult !== 'ALL' ? selectedResult : undefined,
        search: search.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: pageSize,
        sortBy,
        sortOrder,
      });
      setEntries(data.entries);
      setTotalCount(data.total);
      setSummary(data.summary);
    } catch (err: any) {
      console.error('Failed to load GST entries:', err);
      setNotification({ message: err.message || 'Failed to load GST entries.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [selectedConsigneeId, selectedResult, search, startDate, endDate, page, pageSize, sortBy, sortOrder]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormConsigneeId(consignees.length > 0 ? consignees[0].id : '');
    setFormIgst('0');
    setFormCgst('0');
    setFormSgst('0');
    setFormRefundEligible('0');
    setFormRemarks('');
    setFormError(null);
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (entry: GstEntry) => {
    setEditingEntry(entry);
    setFormDate(entry.entryDate);
    setFormConsigneeId(entry.consigneeId);
    setFormIgst(String(entry.igst));
    setFormCgst(String(entry.cgst));
    setFormSgst(String(entry.sgst));
    setFormRefundEligible(String(entry.refundEligible));
    setFormRemarks(entry.remarks || '');
    setFormError(null);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate) {
      setFormError('Please select a valid entry date.');
      return;
    }
    if (!formConsigneeId) {
      setFormError('Please select a consignee from master records.');
      return;
    }

    if (numIgst < 0 || numCgst < 0 || numSgst < 0 || numRefund < 0) {
      setFormError('Amounts cannot be negative.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      await api.createGstEntry({
        entryDate: formDate,
        consigneeId: formConsigneeId,
        igst: numIgst,
        cgst: numCgst,
        sgst: numSgst,
        refundEligible: numRefund,
        remarks: formRemarks.trim() || undefined,
      });
      setIsCreateOpen(false);
      showNotification('GST entry created successfully.');
      fetchEntries();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create GST entry.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    if (!formDate) {
      setFormError('Please select a valid entry date.');
      return;
    }
    if (!formConsigneeId) {
      setFormError('Please select a consignee.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      await api.updateGstEntry(editingEntry.id, {
        entryDate: formDate,
        consigneeId: formConsigneeId,
        igst: numIgst,
        cgst: numCgst,
        sgst: numSgst,
        refundEligible: numRefund,
        remarks: formRemarks.trim() || undefined,
      });
      setEditingEntry(null);
      showNotification(`GST entry ${editingEntry.id} updated successfully.`);
      fetchEntries();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update GST entry.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Entry
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmEntry) return;
    try {
      await api.deleteGstEntry(deleteConfirmEntry.id);
      showNotification(`GST entry ${deleteConfirmEntry.id} deleted successfully.`);
      setDeleteConfirmEntry(null);
      fetchEntries();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete GST entry.', 'error');
    }
  };

  // Sorting helper
  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="text-teal-600" size={24} />
            <span>GST Entry & Realisation Tracker</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record consignee-wise GST compliance, input tax credit claims, and calculate GAIN/LOSS differentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              void api.downloadGstExport({
                consigneeId: selectedConsigneeId,
                result: selectedResult,
                search,
                startDate,
                endDate,
              })
            }
            className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-2xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download size={14} className="text-teal-600" />
            <span>Export Excel (.xlsx)</span>
          </button>

          {!isViewer && (
            <button
              onClick={handleOpenCreate}
              className="h-9 px-4 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <PlusCircle size={15} />
              <span>Record GST Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div
          className={`p-3.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs font-bold hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Entries</span>
            <span className="text-lg font-bold text-slate-900 font-mono mt-1 block">{summary.totalEntries}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Recorded claims</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total IGST</span>
            <span className="text-base font-bold text-slate-800 font-mono mt-1 block">₹{summary.totalIgst.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Integrated tax</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total CGST</span>
            <span className="text-base font-bold text-slate-800 font-mono mt-1 block">₹{summary.totalCgst.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Central tax</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total SGST</span>
            <span className="text-base font-bold text-slate-800 font-mono mt-1 block">₹{summary.totalSgst.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">State tax</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Total GST</span>
            <span className="text-base font-bold text-indigo-700 font-mono mt-1 block">₹{summary.totalGst.toLocaleString()}</span>
            <span className="text-[10px] text-indigo-400 mt-0.5 block">IGST + CGST + SGST</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Refund Eligible</span>
            <span className="text-base font-bold text-emerald-700 font-mono mt-1 block">₹{summary.totalRefundEligible.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-500 mt-0.5 block">Sanction eligible</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Net Difference</span>
            <span
              className={`text-base font-bold font-mono mt-1 block ${
                summary.netDifference > 0
                  ? 'text-emerald-700'
                  : summary.netDifference < 0
                  ? 'text-rose-700'
                  : 'text-slate-700'
              }`}
            >
              ₹{summary.netDifference >= 0 ? '+' : ''}{summary.netDifference.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold mt-0.5 block">
              {summary.netDifference > 0 ? (
                <span className="text-emerald-600 font-bold">GAIN Overall</span>
              ) : summary.netDifference < 0 ? (
                <span className="text-rose-600 font-bold">LOSS Overall</span>
              ) : (
                <span className="text-slate-500 font-bold">NIL Variance</span>
              )}
            </span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outcomes</span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold font-mono">
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">{summary.gainCount}G</span>
              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded">{summary.lossCount}L</span>
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">{summary.nilCount}N</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Gain / Loss / Nil</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search Entry ID, buyer, remarks..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-teal-500 font-medium"
            />
          </div>

          {/* Consignee Filter */}
          <div>
            <select
              value={selectedConsigneeId}
              onChange={(e) => {
                setSelectedConsigneeId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-teal-500"
            >
              <option value="ALL">All Consignees (Buyers)</option>
              {consignees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Result Filter */}
          <div>
            <select
              value={selectedResult}
              onChange={(e) => {
                setSelectedResult(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-teal-500"
            >
              <option value="ALL">All Results (GAIN/LOSS/NIL)</option>
              <option value="GAIN">GAIN (Refund &gt; Total GST)</option>
              <option value="LOSS">LOSS (Refund &lt; Total GST)</option>
              <option value="NIL">NIL (Difference == 0)</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs w-full focus:outline-hidden"
            />
          </div>

          {/* Date Range End & Reset */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 flex-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs w-full focus:outline-hidden"
              />
            </div>
            {(search || selectedConsigneeId !== 'ALL' || selectedResult !== 'ALL' || startDate || endDate) && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedConsigneeId('ALL');
                  setSelectedResult('ALL');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                title="Reset all filters"
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <RotateCcw size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* GST Entries Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3 w-28 cursor-pointer hover:bg-slate-800" onClick={() => handleSort('entryDate')}>
                  <div className="flex items-center gap-1">
                    <span>Entry Date</span>
                    {sortBy === 'entryDate' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="p-3 w-32">Entry ID</th>
                <th className="p-3 cursor-pointer hover:bg-slate-800" onClick={() => handleSort('consigneeName')}>
                  <div className="flex items-center gap-1">
                    <span>Consignee (Buyer)</span>
                    {sortBy === 'consigneeName' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="p-3 text-right">IGST (₹)</th>
                <th className="p-3 text-right">CGST (₹)</th>
                <th className="p-3 text-right">SGST (₹)</th>
                <th className="p-3 text-right cursor-pointer hover:bg-slate-800" onClick={() => handleSort('totalGst')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Total GST (₹)</span>
                    {sortBy === 'totalGst' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="p-3 text-right cursor-pointer hover:bg-slate-800" onClick={() => handleSort('refundEligible')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Refund Eligible (₹)</span>
                    {sortBy === 'refundEligible' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="p-3 text-right cursor-pointer hover:bg-slate-800" onClick={() => handleSort('difference')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Difference (₹)</span>
                    {sortBy === 'difference' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="p-3 text-center w-20">Result</th>
                <th className="p-3 max-w-xs">Remarks</th>
                <th className="p-3 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-400 font-medium">
                    Loading GST records...
                  </td>
                </tr>
              )}

              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Receipt size={32} className="mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-600">No GST entries found</p>
                      <p className="text-[11px] text-slate-400">
                        Try adjusting your search query, consignee filters, or date range.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono text-slate-700 whitespace-nowrap">{e.entryDate}</td>
                    <td className="p-3 font-mono font-bold text-teal-700 whitespace-nowrap">{e.id}</td>
                    <td className="p-3 font-semibold text-slate-900">{e.consigneeName}</td>
                    <td className="p-3 text-right font-mono text-slate-700">₹{e.igst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono text-slate-700">₹{e.cgst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono text-slate-700">₹{e.sgst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ₹{e.totalGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">
                      ₹{e.refundEligible.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      <span className={e.difference > 0 ? 'text-emerald-700' : e.difference < 0 ? 'text-rose-700' : 'text-slate-600'}>
                        {e.difference >= 0 ? '+' : ''}
                        ₹{e.difference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          e.result === 'GAIN'
                            ? 'bg-emerald-100 text-emerald-800'
                            : e.result === 'LOSS'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {e.result === 'GAIN' && <TrendingUp size={11} />}
                        {e.result === 'LOSS' && <TrendingDown size={11} />}
                        {e.result === 'NIL' && <MinusCircle size={11} />}
                        <span>{e.result}</span>
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 max-w-xs truncate" title={e.remarks || ''}>
                      {e.remarks || '—'}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingEntry(e)}
                          title="View Details"
                          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye size={14} />
                        </button>

                        {!isViewer && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(e)}
                              title="Edit Entry"
                              className="w-7 h-7 flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmEntry(e)}
                              title="Delete Entry"
                              className="w-7 h-7 flex items-center justify-center text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              Showing {entries.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(page * pageSize, totalCount)} of {totalCount} records
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-slate-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-semibold"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Previous
            </button>
            <span className="px-2 font-mono font-bold text-slate-800">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {(isCreateOpen || editingEntry) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Receipt size={17} className="text-teal-400" />
                <span>{editingEntry ? `Edit GST Entry — ${editingEntry.id}` : 'Record New GST Entry'}</span>
              </h3>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingEntry(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={editingEntry ? handleEditSubmit : handleCreateSubmit}
              className="p-6 overflow-y-auto space-y-4 text-xs"
            >
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Entry Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Consignee (Buyer) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formConsigneeId}
                    onChange={(e) => setFormConsigneeId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-teal-500 font-medium"
                  >
                    <option value="" disabled>Select consignee...</option>
                    {consignees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tax components */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Tax Components (INR, 2 decimals)
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">IGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formIgst}
                      onChange={(e) => setFormIgst(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono bg-white text-right focus:outline-teal-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">CGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formCgst}
                      onChange={(e) => setFormCgst(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono bg-white text-right focus:outline-teal-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">SGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formSgst}
                      onChange={(e) => setFormSgst(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono bg-white text-right focus:outline-teal-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-700">Total GST (Auto Calculated):</span>
                  <span className="text-sm font-bold font-mono text-indigo-700">
                    ₹{computedTotalGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Refund and Differential */}
              <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-3">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Refund & Difference Assessment
                </span>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Refund Eligible (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formRefundEligible}
                    onChange={(e) => setFormRefundEligible(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono bg-white text-right focus:outline-teal-500 font-bold text-emerald-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100">
                  <div>
                    <span className="text-[11px] text-slate-600 block">Difference (Refund - GST):</span>
                    <span className="text-sm font-bold font-mono text-slate-900 block mt-0.5">
                      {computedDifference >= 0 ? '+' : ''}₹{computedDifference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-600 block">Assessed Result:</span>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold mt-0.5 ${
                        computedResult === 'GAIN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : computedResult === 'LOSS'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {computedResult}
                    </span>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Remarks (Optional)</label>
                <textarea
                  rows={2}
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="e.g. GSTN portal claim reference, sanction order details..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-teal-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingEntry(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : editingEntry ? 'Save Changes' : 'Create Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewingEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Receipt size={17} className="text-teal-400" />
                <span>GST Entry Details — {viewingEntry.id}</span>
              </h3>
              <button onClick={() => setViewingEntry(null)} className="text-slate-400 hover:text-white cursor-pointer font-bold">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Entry ID</span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{viewingEntry.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Entry Date</span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{viewingEntry.entryDate}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Consignee (Buyer)</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{viewingEntry.consigneeName}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">IGST Amount:</span>
                  <span className="font-mono font-bold">₹{viewingEntry.igst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">CGST Amount:</span>
                  <span className="font-mono font-bold">₹{viewingEntry.cgst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">SGST Amount:</span>
                  <span className="font-mono font-bold">₹{viewingEntry.sgst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-800">Total GST:</span>
                  <span className="font-mono font-bold text-indigo-700">₹{viewingEntry.totalGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Refund Eligible:</span>
                  <span className="font-mono font-bold text-emerald-700">₹{viewingEntry.refundEligible.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-emerald-100">
                  <span className="font-bold text-slate-800">Calculated Difference:</span>
                  <span className="font-mono font-bold">
                    {viewingEntry.difference >= 0 ? '+' : ''}₹{viewingEntry.difference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-slate-800">Assessed Outcome:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      viewingEntry.result === 'GAIN'
                        ? 'bg-emerald-100 text-emerald-800'
                        : viewingEntry.result === 'LOSS'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {viewingEntry.result}
                  </span>
                </div>
              </div>

              {viewingEntry.remarks && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Remarks</span>
                  <p className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-700 italic">
                    {viewingEntry.remarks}
                  </p>
                </div>
              )}

              <div className="text-[10px] text-slate-400 font-mono space-y-0.5 pt-2 border-t border-slate-100">
                <div>Created: {new Date(viewingEntry.createdAt).toLocaleString()}</div>
                <div>Updated: {new Date(viewingEntry.updatedAt).toLocaleString()}</div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setViewingEntry(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle size={24} />
              <h3 className="font-bold text-sm text-slate-900">Delete GST Entry</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete GST entry{' '}
              <strong className="font-mono text-slate-900">{deleteConfirmEntry.id}</strong> for{' '}
              <strong>{deleteConfirmEntry.consigneeName}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmEntry(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
