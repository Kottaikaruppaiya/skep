/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Award, PlusCircle, CheckCircle, Clock, AlertTriangle, Edit } from 'lucide-react';
import { Shipment, IncentiveRecord, Role } from '../types/index.ts';
import { api } from '../api/client.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';

interface IncentivesViewProps {
  selectedFyId: string;
  userRole: Role;
  onSelectShipment: (id: string) => void;
  onRefresh?: () => void;
  refreshKey?: number;
}

export const IncentivesView: React.FC<IncentivesViewProps> = ({
  selectedFyId,
  userRole,
  onSelectShipment,
  onRefresh,
  refreshKey,
}) => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<'ALL' | 'DRAWBACK' | 'RODTEP' | 'ROSCTL'>('ALL');
  const [editingInc, setEditingInc] = useState<{ inc: IncentiveRecord; invoiceNo: string } | null>(null);

  // Edit form state
  const [claimedAmount, setClaimedAmount] = useState<number>(0);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [receivedDate, setReceivedDate] = useState('');
  const [scrollNumber, setScrollNumber] = useState('');
  const [status, setStatus] = useState<any>('RECEIVED');
  const [remarks, setRemarks] = useState('');

  // Add Incentive Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addShipmentId, setAddShipmentId] = useState('');
  const [addType, setAddType] = useState<IncentiveRecord['type']>('DRAWBACK');
  const [addClaimedAmount, setAddClaimedAmount] = useState<number>(10000);
  const [addReceivedAmount, setAddReceivedAmount] = useState<number>(0);
  const [addScrollNumber, setAddScrollNumber] = useState('');
  const [addReceivedDate, setAddReceivedDate] = useState('');
  const [addRemarks, setAddRemarks] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await api.getShipments({ financialYearId: selectedFyId });
      setShipments(list);
      if (list.length > 0 && !addShipmentId) {
        setAddShipmentId(list[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFyId, refreshKey]);

  const allIncentives: Array<{ inc: IncentiveRecord; shipment: Shipment }> = [];
  for (const s of shipments) {
    if (s.incentives) {
      for (const inc of s.incentives) {
        if (activeType === 'ALL' || inc.type === activeType) {
          allIncentives.push({ inc, shipment: s });
        }
      }
    }
  }

  const totalClaimed = allIncentives.reduce((sum, item) => sum + item.inc.claimedAmount, 0);
  const totalReceived = allIncentives.reduce((sum, item) => sum + item.inc.receivedAmount, 0);
  const totalPending = Math.max(0, totalClaimed - totalReceived);

  const [editError, setEditError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // Delete modal state
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    incId: string;
    invoiceNo: string;
    scheme: string;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    incId: '',
    invoiceNo: '',
    scheme: '',
    loading: false,
    error: null,
  });

  const openEdit = (inc: IncentiveRecord, invoiceNo: string) => {
    setEditingInc({ inc, invoiceNo });
    setClaimedAmount(inc.claimedAmount || 0);
    setReceivedAmount(inc.receivedAmount || 0);
    setReceivedDate(inc.receivedDate || '');
    setScrollNumber(inc.scrollNumber || '');
    setStatus(inc.status || 'PENDING');
    setRemarks(inc.remarks || '');
    setEditError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInc) return;
    setEditError(null);

    try {
      await api.updateIncentive(editingInc.inc.id, {
        claimedAmount: Number(claimedAmount),
        receivedAmount: Number(receivedAmount),
        receivedDate: receivedDate || null,
        scrollNumber: scrollNumber.trim() || null,
        status,
        remarks: remarks.trim() || null,
      });
      setEditingInc(null);
      loadData();
      onRefresh?.();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update incentive');
    }
  };

  const handleCreateIncentive = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    try {
      if (!addShipmentId) throw new Error('Please select an export shipment.');
      await api.createIncentive({
        shipmentId: addShipmentId,
        type: addType,
        claimedAmount: Number(addClaimedAmount),
        receivedAmount: Number(addReceivedAmount),
        receivedDate: addReceivedDate || undefined,
        scrollNumber: addScrollNumber || undefined,
        remarks: addRemarks || undefined,
      });
      setShowAddModal(false);
      loadData();
      onRefresh?.();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create incentive record.');
    }
  };

  const isViewer = userRole === 'VIEWER';

  const [searchTerm, setSearchTerm] = useState('');

  const filteredIncentives = allIncentives.filter(({ inc, shipment }) => {
    const q = searchTerm.toLowerCase();
    return (
      (shipment.invoiceNumber && shipment.invoiceNumber.toLowerCase().includes(q)) ||
      (shipment.consigneeName && shipment.consigneeName.toLowerCase().includes(q)) ||
      (inc.type && inc.type.toLowerCase().includes(q)) ||
      (inc.scrollNumber && inc.scrollNumber.toLowerCase().includes(q))
    );
  });

  const handleConfirmDelete = async () => {
    if (!deleteModalState.incId) return;
    setDeleteModalState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.deleteIncentive(deleteModalState.incId);
      setDeleteModalState({ isOpen: false, incId: '', invoiceNo: '', scheme: '', loading: false, error: null });
      loadData();
      onRefresh?.();
    } catch (err: any) {
      setDeleteModalState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to delete incentive',
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Award size={20} className="text-purple-600" />
            <span>Government Export Incentives Tracker (DBK, RoDTEP, RoSCTL)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Customs duty drawbacks and remission scheme claims, receipts, and scroll settlements
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {!isViewer && (
            <button
              onClick={() => setShowAddModal(true)}
              className="h-9 px-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              <PlusCircle size={15} />
              <span>Add Incentive Record</span>
            </button>
          )}
          <input
            type="text"
            placeholder="Search by invoice, buyer, scroll..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Claimed (INR)
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1">₹{totalClaimed.toLocaleString()}</div>
          <span className="text-xs text-slate-400">Total Customs Assessed Claims</span>
        </div>

        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Total Received (INR)
          </span>
          <div className="text-2xl font-bold text-emerald-800 mt-1">₹{totalReceived.toLocaleString()}</div>
          <span className="text-xs text-emerald-600">
            {totalClaimed > 0 ? ((totalReceived / totalClaimed) * 100).toFixed(1) : '0'}% Settled via Scrolls
          </span>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Pending Balance (INR)
          </span>
          <div className="text-2xl font-bold text-amber-800 mt-1">₹{totalPending.toLocaleString()}</div>
          <span className="text-xs text-amber-600">Awaiting Customs Scroll Credit</span>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-2xs text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveType('ALL')}
          className={`py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
            activeType === 'ALL' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-600'
          }`}
        >
          All Schemes ({shipments.reduce((sum, s) => sum + (s.incentives?.length || 0), 0)})
        </button>
        <button
          onClick={() => setActiveType('DRAWBACK')}
          className={`py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
            activeType === 'DRAWBACK' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-600'
          }`}
        >
          Duty Drawback (DBK)
        </button>
        <button
          onClick={() => setActiveType('RODTEP')}
          className={`py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
            activeType === 'RODTEP' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-600'
          }`}
        >
          RoDTEP
        </button>
        <button
          onClick={() => setActiveType('ROSCTL')}
          className={`py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
            activeType === 'ROSCTL' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-600'
          }`}
        >
          RoSCTL
        </button>
      </div>

      {/* Incentives List Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full min-w-[1100px] text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold sticky top-0 z-10">
              <tr>
                <th className="p-3">Invoice No.</th>
                <th className="p-3">Buyer (Consignee)</th>
                <th className="p-3">Scheme Type</th>
                <th className="p-3 text-right">Claimed (INR)</th>
                <th className="p-3 text-right">Received (INR)</th>
                <th className="p-3 text-right">Pending Balance</th>
                <th className="p-3">Scroll Number</th>
                <th className="p-3">Received Date</th>
                <th className="p-3 text-center">Receipt Status</th>
                {!isViewer && <th className="p-3 text-right min-w-[150px]">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400 animate-pulse">
                    Loading incentive records...
                  </td>
                </tr>
              )}

              {!loading && filteredIncentives.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-400">
                    No incentive records found.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredIncentives.map(({ inc, shipment }) => (
                  <tr key={inc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">
                      <button
                        onClick={() => onSelectShipment(shipment.id)}
                        className="text-blue-600 hover:underline font-bold text-left"
                      >
                        {shipment.invoiceNumber}
                      </button>
                    </td>
                    <td className="p-3 text-slate-700">{shipment.consigneeName}</td>
                    <td className="p-3 font-semibold text-purple-800">
                      <span className="px-2 py-0.5 bg-purple-50 rounded">
                        {inc.type === 'DRAWBACK' ? 'Duty Drawback' : inc.type}
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium text-slate-800">
                      ₹{inc.claimedAmount.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-700">
                      ₹{inc.receivedAmount.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-bold text-amber-700">
                      ₹{(inc.outstandingBalance || 0).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono text-slate-600">{inc.scrollNumber || '—'}</td>
                    <td className="p-3 text-slate-600">{inc.receivedDate || '—'}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inc.status === 'RECEIVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inc.status === 'PART_RECEIVED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    {!isViewer && (
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(inc, shipment.invoiceNumber)}
                            className="h-7 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-[11px] inline-flex items-center gap-1 transition-colors"
                          >
                            <Edit size={12} />
                            <span>Log Receipt</span>
                          </button>
                          <button
                            onClick={() => setDeleteModalState({
                              isOpen: true,
                              incId: inc.id,
                              invoiceNo: shipment.invoiceNumber,
                              scheme: inc.type === 'DRAWBACK' ? 'Duty Drawback' : inc.type,
                              loading: false,
                              error: null,
                            })}
                            className="h-7 px-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-md font-medium text-[11px] transition-colors cursor-pointer inline-flex items-center justify-center"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Incentive Modal */}
      {editingInc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                Edit Incentive Record — {editingInc.invoiceNo}
              </h3>
              <button onClick={() => setEditingInc(null)} className="p-1 text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {editError}
                </div>
              )}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-900">
                <span className="font-bold block">
                  {editingInc.inc.type === 'DRAWBACK' ? 'Duty Drawback' : editingInc.inc.type}
                </span>
                <span>Invoice: <strong>{editingInc.invoiceNo}</strong></span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Claimed Amount (INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={claimedAmount}
                  onChange={(e) => setClaimedAmount(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Received Amount (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Receipt Date</label>
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Customs Scroll Number</label>
                <input
                  type="text"
                  placeholder="e.g. SCR-DBK-26-8819"
                  value={scrollNumber}
                  onChange={(e) => setScrollNumber(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value="RECEIVED">RECEIVED (Fully Settled)</option>
                  <option value="PART_RECEIVED">PART_RECEIVED (Partial Credit)</option>
                  <option value="PENDING">PENDING (Awaiting Credit)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Remarks / Reference</label>
                <input
                  type="text"
                  placeholder="Notes, customs query reference..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingInc(null)}
                  className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Incentive Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Add Government Export Incentive</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIncentive} className="p-6 space-y-4 text-xs">
              {addError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {addError}
                </div>
              )}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Export Shipment / Invoice *</label>
                <select
                  value={addShipmentId}
                  onChange={(e) => setAddShipmentId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  required
                >
                  {shipments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.invoiceNumber} — {s.consigneeName} (${s.invoiceValueUsd.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Incentive Scheme Type *</label>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value="DRAWBACK">Duty Drawback (DBK)</option>
                  <option value="RODTEP">RoDTEP (Remission of Duties and Taxes)</option>
                  <option value="ROSCTL">RoSCTL (Rebate of State and Central Taxes)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Claimed Amount (INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={addClaimedAmount}
                  onChange={(e) => setAddClaimedAmount(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Received Amount (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  value={addReceivedAmount}
                  onChange={(e) => setAddReceivedAmount(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-semibold text-emerald-700"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Receipt Date</label>
                <input
                  type="date"
                  value={addReceivedDate}
                  onChange={(e) => setAddReceivedDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Scroll Number</label>
                <input
                  type="text"
                  placeholder="e.g. SCR-DBK-2026-001"
                  value={addScrollNumber}
                  onChange={(e) => setAddScrollNumber(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="Optional remarks..."
                  value={addRemarks}
                  onChange={(e) => setAddRemarks(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Create Incentive Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Incentive Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        title={`Delete ${deleteModalState.scheme} Record`}
        itemName={`${deleteModalState.scheme} for ${deleteModalState.invoiceNo}`}
        itemType="Export Incentive Claim"
        isLoading={deleteModalState.loading}
        errorMessage={deleteModalState.error}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalState({ isOpen: false, incId: '', invoiceNo: '', scheme: '', loading: false, error: null })}
      />
    </div>
  );
};
