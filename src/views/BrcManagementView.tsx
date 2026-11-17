/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FileCheck2, Calendar, AlertTriangle, CheckCircle2, Clock, Upload, ArrowRight, Eye, Download } from 'lucide-react';
import { Shipment, Role } from '../types/index.ts';
import { api } from '../api/client.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';

interface BrcManagementViewProps {
  selectedFyId: string;
  onSelectShipment: (id: string) => void;
  onOpenUpload: (shipment: Shipment) => void;
  onRefresh?: () => void;
  userRole: Role;
  refreshKey?: number;
}

export const BrcManagementView: React.FC<BrcManagementViewProps> = ({
  selectedFyId,
  onSelectShipment,
  onOpenUpload,
  onRefresh,
  userRole,
  refreshKey,
}) => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBrcShipment, setEditingBrcShipment] = useState<Shipment | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Edit BRC Form State
  const [brcNumber, setBrcNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [realisationDate, setRealisationDate] = useState('');
  const [uploadMode, setUploadMode] = useState<'SINGLE' | 'MULTIPLE'>('SINGLE');
  const [statutoryDeadline, setStatutoryDeadline] = useState('');
  const [status, setStatus] = useState<any>('PENDING');
  const [remarks, setRemarks] = useState('');

  // Reset BRC modal state
  const [resetModalState, setResetModalState] = useState<{
    isOpen: boolean;
    shipment: Shipment | null;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    shipment: null,
    loading: false,
    error: null,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await api.getShipments({ financialYearId: selectedFyId });
      setShipments(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFyId, refreshKey]);

  const openEditBrc = (s: Shipment) => {
    setEditingBrcShipment(s);
    setBrcNumber(s.brcRecord?.brcNumber || '');
    setIssueDate(s.brcRecord?.issueDate || '');
    setRealisationDate(s.brcRecord?.realisationDate || '');
    setUploadMode(s.brcRecord?.uploadMode || 'SINGLE');
    setStatutoryDeadline(s.brcRecord?.statutoryDeadline || '');
    setStatus(s.brcRecord?.status || 'PENDING');
    setRemarks(s.brcRecord?.remarks || '');
    setEditError(null);
  };

  const handleSaveBrc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrcShipment) return;
    setEditError(null);

    try {
      const targetId = editingBrcShipment.brcRecord?.id || editingBrcShipment.id;
      await api.updateBrc(targetId, {
        brcNumber: brcNumber.trim() || null,
        issueDate: issueDate || null,
        realisationDate: realisationDate || null,
        uploadMode,
        statutoryDeadline: statutoryDeadline || null,
        status,
        remarks: remarks.trim() || null,
      });
      setEditingBrcShipment(null);
      loadData();
      onRefresh?.();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update BRC');
    }
  };

  const handleConfirmResetBrc = async () => {
    if (!resetModalState.shipment) return;
    setResetModalState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const targetId = resetModalState.shipment.brcRecord?.id || resetModalState.shipment.id;
      await api.resetBrc(targetId);
      setResetModalState({ isOpen: false, shipment: null, loading: false, error: null });
      loadData();
      onRefresh?.();
    } catch (err: any) {
      setResetModalState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to reset BRC',
      }));
    }
  };

  const isViewer = userRole === 'VIEWER';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck2 size={20} className="text-blue-600" />
            <span>Bank Realisation Certificates (BRC / eBRC) Console</span>
          </h2>
          <p className="text-xs text-slate-500">
            DGFT statement tracking, statutory deadline compliance, and dual-mode document management
          </p>
        </div>
      </div>

      {/* BRC Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full min-w-[1050px] text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold sticky top-0 z-10">
              <tr>
                <th className="p-3">Invoice No.</th>
                <th className="p-3">Buyer (Consignee)</th>
                <th className="p-3">Shipping Bill Date</th>
                <th className="p-3">BRC Reference No.</th>
                <th className="p-3">BRC Issue Date</th>
                <th className="p-3">Realisation Date</th>
                <th className="p-3">Upload Mode</th>
                <th className="p-3">Statutory Deadline</th>
                <th className="p-3 text-center">BRC Status</th>
                <th className="p-3 text-right min-w-[210px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400 animate-pulse">
                    Loading BRC compliance records...
                  </td>
                </tr>
              )}

              {!loading &&
                shipments.map((s) => {
                  const brc = s.brcRecord;
                  const isOverdue =
                    brc?.status === 'OVERDUE' ||
                    ((brc?.status === 'PENDING' || brc?.status === 'ISSUED') &&
                      Boolean(brc?.statutoryDeadline) &&
                      new Date(brc.statutoryDeadline!).getTime() < Date.now());

                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{s.invoiceNumber}</td>
                      <td className="p-3 font-medium text-slate-700">{s.consigneeName}</td>
                      <td className="p-3 text-slate-600">{s.shippingBillDate}</td>
                      <td className="p-3 font-mono font-semibold text-blue-700">
                        {brc?.brcNumber || <span className="text-slate-400 font-normal">Pending Issuance</span>}
                      </td>
                      <td className="p-3 text-slate-600">{brc?.issueDate || '—'}</td>
                      <td className="p-3 text-slate-600">{brc?.realisationDate || '—'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-700">
                          {brc?.uploadMode === 'SINGLE' ? 'Single (1 File)' : 'Multiple (2 Files)'}
                        </span>
                      </td>
                      <td className="p-3 font-medium">
                        <span className={isOverdue ? 'text-red-600 font-bold' : 'text-slate-700'}>
                          {brc?.statutoryDeadline || '—'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            brc?.status === 'REALISED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : isOverdue
                              ? 'bg-red-100 text-red-800'
                              : brc?.status === 'ISSUED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isOverdue ? 'OVERDUE' : brc?.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="p-3 text-right min-w-[210px]">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isViewer && (
                            <>
                              <button
                                onClick={() => openEditBrc(s)}
                                className="h-7 px-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer shrink-0"
                              >
                                Edit BRC
                              </button>
                              <button
                                onClick={() => onOpenUpload(s)}
                                title="Upload BRC File"
                                className="h-7 px-2.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                              >
                                <Upload size={12} />
                                <span>Attach</span>
                              </button>
                              {(brc?.brcNumber || brc?.status !== 'PENDING') && (
                                <button
                                  onClick={() => setResetModalState({
                                    isOpen: true,
                                    shipment: s,
                                    loading: false,
                                    error: null,
                                  })}
                                  title="Reset / Clear BRC Data"
                                  className="h-7 px-2 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer shrink-0"
                                >
                                  Reset
                                </button>
                              )}
                            </>
                          )}
                          {(s.documents || [])
                            .filter((d) => d.category.startsWith('BRC'))
                            .map((brcDoc, docIdx) => (
                              <button
                                key={brcDoc.id}
                                type="button"
                                onClick={() => void api.downloadDocument(brcDoc.id, brcDoc.originalFilename)}
                                title={`Download ${brcDoc.category.replace(/_/g, ' ')} (${brcDoc.originalFilename})`}
                                className="h-7 px-1.5 flex items-center justify-center gap-0.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer shrink-0 text-[10px] font-bold"
                              >
                                <Download size={13} />
                                {brcDoc.category === 'BRC_COPY_2' ? '2' : docIdx > 0 ? String(docIdx + 1) : ''}
                              </button>
                            ))}
                          <button
                            onClick={() => onSelectShipment(s.id)}
                            title="View Shipment Details"
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit BRC Modal */}
      {editingBrcShipment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                Update BRC Record — {editingBrcShipment.invoiceNumber}
              </h3>
              <button
                onClick={() => setEditingBrcShipment(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBrc} className="p-6 space-y-4 text-xs">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {editError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">BRC Reference Number</label>
                  <input
                    type="text"
                    placeholder="e.g. BRC-DGFT-2026-8841"
                    value={brcNumber}
                    onChange={(e) => setBrcNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">BRC Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Bank Realisation Date</label>
                  <input
                    type="date"
                    value={realisationDate}
                    onChange={(e) => setRealisationDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Upload Mode (Section 7)</label>
                  <select
                    value={uploadMode}
                    onChange={(e) => setUploadMode(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
                  >
                    <option value="SINGLE">Single Mode (Exactly 1 File)</option>
                    <option value="MULTIPLE">Multiple Mode (Exactly 2 Separate Files)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Statutory Deadline</label>
                  <input
                    type="date"
                    value={statutoryDeadline}
                    onChange={(e) => setStatutoryDeadline(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-semibold text-amber-700"
                  />
                </div>

                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">BRC Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-bold"
                  >
                    <option value="PENDING">PENDING (Awaiting Issuance)</option>
                    <option value="ISSUED">ISSUED (Statement Generated)</option>
                    <option value="REALISED">REALISED (Realisation Settled)</option>
                    <option value="OVERDUE">OVERDUE (Statutory Limit Exceeded)</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">Remarks</label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingBrcShipment(null)}
                  className="h-9 px-4 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Save BRC Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset BRC Confirmation Modal */}
      <ConfirmationModal
        isOpen={resetModalState.isOpen}
        title="Reset Bank Realisation Certificate"
        itemName={resetModalState.shipment?.invoiceNumber || ''}
        itemType="BRC / eBRC Record"
        isLoading={resetModalState.loading}
        errorMessage={resetModalState.error}
        onConfirm={handleConfirmResetBrc}
        onCancel={() => setResetModalState({ isOpen: false, shipment: null, loading: false, error: null })}
      />
    </div>
  );
};
