/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  AlertCircle,
  Edit,
  Plus,
  Trash2,
  Archive,
} from 'lucide-react';
import { Shipment, Role } from '../types/index.ts';
import { api } from '../api/client.ts';
import { ConfirmationModal } from './ConfirmationModal.tsx';
import { ShipmentOverviewTab } from '../features/shipments/components/detail/ShipmentOverviewTab.tsx';
import { ShipmentDocumentsTab } from '../features/shipments/components/detail/ShipmentDocumentsTab.tsx';
import { ShipmentPaymentsTab } from '../features/shipments/components/detail/ShipmentPaymentsTab.tsx';
import { ShipmentBrcTab } from '../features/shipments/components/detail/ShipmentBrcTab.tsx';
import { ShipmentIncentivesTab } from '../features/shipments/components/detail/ShipmentIncentivesTab.tsx';

interface ShipmentDetailModalProps {
  shipmentId: string | null;
  onClose: () => void;
  onOpenEdit: (shipment: Shipment) => void;
  onOpenAllocate: (shipment: Shipment) => void;
  onOpenUpload: (shipment: Shipment) => void;
  onDeleted?: () => void;
  userRole: Role;
}

export const ShipmentDetailModal: React.FC<ShipmentDetailModalProps> = ({
  shipmentId,
  onClose,
  onOpenEdit,
  onOpenAllocate,
  onOpenUpload,
  onDeleted,
  userRole,
}) => {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'payments' | 'brc' | 'incentives'>('overview');

  // BRC Edit state
  const [isEditingBrc, setIsEditingBrc] = useState(false);
  const [brcNumber, setBrcNumber] = useState('');
  const [brcStatus, setBrcStatus] = useState<'PENDING' | 'ISSUED' | 'REALISED'>('PENDING');
  const [brcIssueDate, setBrcIssueDate] = useState('');
  const [brcRealisationDate, setBrcRealisationDate] = useState('');
  const [brcUploadMode, setBrcUploadMode] = useState<'SINGLE' | 'MULTIPLE'>('SINGLE');
  const [brcRemarks, setBrcRemarks] = useState('');

  // Incentive Edit / Add state
  const [editingIncentive, setEditingIncentive] = useState<any | null>(null);
  const [isAddingIncentive, setIsAddingIncentive] = useState(false);
  const [incType, setIncType] = useState<'DRAWBACK' | 'RODTEP' | 'ROSCTL'>('DRAWBACK');
  const [incClaimed, setIncClaimed] = useState<number>(0);
  const [incStatus, setIncStatus] = useState<string>('CLAIMED');
  const [incReceived, setIncReceived] = useState<number>(0);
  const [incReceivedDate, setIncReceivedDate] = useState<string>('');
  const [incScrollNo, setIncScrollNo] = useState<string>('');
  const [incRemarks, setIncRemarks] = useState<string>('');

  // Unified confirmation modal state (declared unconditionally before any early returns)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    itemName: string;
    itemType: string;
    isArchiveOnly?: boolean;
    isLoading: boolean;
    errorMessage: string | null;
    action: () => Promise<void>;
    archiveAction?: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    itemName: '',
    itemType: '',
    isArchiveOnly: false,
    isLoading: false,
    errorMessage: null,
    action: async () => {},
  });

  const loadData = async () => {
    if (!shipmentId) return;
    setLoading(true);
    setActionError(null);
    try {
      const data = await api.getShipmentById(shipmentId);
      setShipment(data);
    } catch (e: any) {
      setActionError(e?.message || 'Failed to load shipment details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shipmentId) {
      void loadData();
    } else {
      setShipment(null);
      setActionError(null);
      setIsEditingBrc(false);
      setEditingIncentive(null);
      setIsAddingIncentive(false);
    }
  }, [shipmentId]);

  if (!shipmentId) return null;

  const isViewer = userRole === 'VIEWER';

  const validationWarnings: string[] = [];
  if (shipment) {
    if (!shipment.hasFircEvidence) {
      validationWarnings.push('MANDATORY FIRC WARNING: No Foreign Inward Remittance Certificate (FIRC) is linked to this shipment.');
    }
    const expectedFob = shipment.invoiceValueUsd * shipment.sbExchangeRate;
    if (Math.abs(expectedFob - shipment.fobValueInr) > 100) {
      validationWarnings.push(
        `FOB Discrepancy: Custom SB FOB INR (₹${shipment.fobValueInr.toLocaleString()}) differs from USD × SB Rate (₹${expectedFob.toLocaleString()}).`
      );
    }
    if (shipment.invoiceDate > shipment.shippingBillDate) {
      validationWarnings.push('Date Sequence Discrepancy: Invoice Date is after Shipping Bill Date.');
    }
  }

  const promptDeleteShipment = () => {
    if (!shipment) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Export Shipment',
      itemName: shipment.invoiceNumber,
      itemType: 'Export Shipment',
      isArchiveOnly: false,
      isLoading: false,
      errorMessage: null,
      action: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true, errorMessage: null }));
        try {
          await api.deleteShipment(shipment.id);
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          if (onDeleted) onDeleted();
          onClose();
        } catch (err: any) {
          setConfirmModal((prev) => ({
            ...prev,
            isLoading: false,
            errorMessage: err.message || 'Failed to delete shipment due to active dependencies.',
          }));
        }
      },
      archiveAction: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true, errorMessage: null }));
        try {
          await api.archiveShipment(shipment.id, 'User archived from shipment detail view');
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          if (onDeleted) onDeleted();
          onClose();
        } catch (err: any) {
          setConfirmModal((prev) => ({
            ...prev,
            isLoading: false,
            errorMessage: err.message || 'Failed to archive shipment.',
          }));
        }
      },
    });
  };

  const promptArchiveShipment = () => {
    if (!shipment) return;
    setConfirmModal({
      isOpen: true,
      title: 'Archive Export Shipment',
      itemName: shipment.invoiceNumber,
      itemType: 'Export Shipment',
      isArchiveOnly: true,
      isLoading: false,
      errorMessage: null,
      action: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true, errorMessage: null }));
        try {
          await api.archiveShipment(shipment.id, 'User safely archived export shipment');
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          if (onDeleted) onDeleted();
          onClose();
        } catch (err: any) {
          setConfirmModal((prev) => ({
            ...prev,
            isLoading: false,
            errorMessage: err.message || 'Failed to archive shipment.',
          }));
        }
      },
    });
  };

  const promptDeleteDocument = (docId: string, filename: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Document',
      itemName: filename,
      itemType: 'Original Document',
      isArchiveOnly: false,
      isLoading: false,
      errorMessage: null,
      action: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true, errorMessage: null }));
        try {
          await api.deleteDocument(docId);
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          await loadData();
          if (onDeleted) onDeleted();
        } catch (err: any) {
          setConfirmModal((prev) => ({
            ...prev,
            isLoading: false,
            errorMessage: err.message || 'Failed to delete document.',
          }));
        }
      },
    });
  };

  const openEditBrc = () => {
    setActionError(null);
    setBrcNumber(shipment?.brcRecord?.brcNumber || '');
    setBrcStatus((shipment?.brcRecord?.status as any) || 'PENDING');
    setBrcIssueDate(shipment?.brcRecord?.issueDate || '');
    setBrcRealisationDate(shipment?.brcRecord?.realisationDate || '');
    setBrcUploadMode(shipment?.brcRecord?.uploadMode || 'SINGLE');
    setBrcRemarks(shipment?.brcRecord?.remarks || '');
    setIsEditingBrc(true);
  };

  const handleSaveBrc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipment) return;
    setActionError(null);
    try {
      await api.updateBrc(shipment.brcRecord?.id || shipment.id, {
        brcNumber,
        status: brcStatus,
        issueDate: brcIssueDate || undefined,
        realisationDate: brcRealisationDate || undefined,
        uploadMode: brcUploadMode,
        remarks: brcRemarks || undefined,
      });
      setIsEditingBrc(false);
      await loadData();
      if (onDeleted) onDeleted();
    } catch (err: any) {
      setActionError(err.message || 'Failed to save BRC');
    }
  };

  const promptResetBrc = () => {
    if (!shipment) return;
    setConfirmModal({
      isOpen: true,
      title: 'Reset Bank Realisation Certificate',
      itemName: shipment.invoiceNumber,
      itemType: 'BRC Record',
      isArchiveOnly: false,
      isLoading: false,
      errorMessage: null,
      action: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true, errorMessage: null }));
        try {
          await api.resetBrc(shipment.brcRecord?.id || shipment.id);
          setIsEditingBrc(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          await loadData();
          if (onDeleted) onDeleted();
        } catch (err: any) {
          setConfirmModal((prev) => ({
            ...prev,
            isLoading: false,
            errorMessage: err.message || 'Failed to reset BRC.',
          }));
        }
      },
    });
  };

  const openEditIncentive = (inc: any) => {
    setActionError(null);
    setEditingIncentive(inc);
    setIncType(inc.type);
    setIncClaimed(inc.claimedAmount || 0);
    setIncStatus(inc.status || 'CLAIMED');
    setIncReceived(inc.receivedAmount || 0);
    setIncReceivedDate(inc.receivedDate || '');
    setIncScrollNo(inc.scrollNumber || '');
    setIncRemarks(inc.remarks || '');
  };

  const handleSaveIncentive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncentive) return;
    setActionError(null);
    try {
      await api.updateIncentive(editingIncentive.id, {
        status: incStatus as any,
        claimedAmount: Number(incClaimed),
        receivedAmount: Number(incReceived),
        receivedDate: incReceivedDate || undefined,
        scrollNumber: incScrollNo || undefined,
        remarks: incRemarks || undefined,
      });
      setEditingIncentive(null);
      await loadData();
      if (onDeleted) onDeleted();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update incentive');
    }
  };

  const promptDeleteIncentive = (incId: string, incTypeName: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete ${incTypeName} Record`,
      itemName: `${incTypeName} for ${shipment?.invoiceNumber || 'Shipment'}`,
      itemType: 'Export Incentive Claim',
      isArchiveOnly: false,
      isLoading: false,
      errorMessage: null,
      action: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true, errorMessage: null }));
        try {
          await api.deleteIncentive(incId);
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          await loadData();
          if (onDeleted) onDeleted();
        } catch (err: any) {
          setConfirmModal((prev) => ({
            ...prev,
            isLoading: false,
            errorMessage: err.message || 'Failed to delete incentive.',
          }));
        }
      },
    });
  };

  const promptDeallocate = (allocId: string, amountUsd: number, irm?: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reverse Payment Allocation',
      itemName: `$${amountUsd.toLocaleString()} from ${irm || 'FIRC Remittance'}`,
      itemType: 'Payment Allocation',
      isArchiveOnly: false,
      isLoading: false,
      errorMessage: null,
      action: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true, errorMessage: null }));
        try {
          await api.deallocatePayment(allocId);
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          await loadData();
          if (onDeleted) onDeleted();
        } catch (err: any) {
          setConfirmModal((prev) => ({
            ...prev,
            isLoading: false,
            errorMessage: err.message || 'Failed to reverse allocation.',
          }));
        }
      },
    });
  };

  const openCreateIncentive = () => {
    setActionError(null);
    setIsAddingIncentive(true);
    setIncType('DRAWBACK');
    setIncClaimed(0);
    setIncStatus('CLAIMED');
    setIncReceived(0);
    setIncReceivedDate('');
    setIncScrollNo('');
    setIncRemarks('');
  };

  const handleCreateIncentive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipment) return;
    setActionError(null);
    try {
      await api.createIncentive({
        shipmentId: shipment.id,
        type: incType,
        claimedAmount: Number(incClaimed),
        receivedAmount: Number(incReceived),
        status: incStatus as any,
        receivedDate: incReceivedDate || undefined,
        scrollNumber: incScrollNo || undefined,
        remarks: incRemarks || undefined,
      });
      setIsAddingIncentive(false);
      await loadData();
      if (onDeleted) onDeleted();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create incentive');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
              EXP
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                  {shipment?.invoiceNumber || 'Shipment Details'}
                </h2>
                <span className="font-mono text-[11px] sm:text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {shipment?.normalizedInvoiceKey}
                </span>
                <span
                  className={`text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    shipment?.paymentStatus === 'FULLY_PAID'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : shipment?.paymentStatus === 'PART_PAID'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}
                >
                  {shipment?.paymentStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Buyer: <strong>{shipment?.consigneeName}</strong> | Shipping Bill: <strong>{shipment?.shippingBillNumber}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {!isViewer && shipment && (
              <>
                <button
                  onClick={() => onOpenEdit(shipment)}
                  className="h-8 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Edit size={14} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => onOpenAllocate(shipment)}
                  className="h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus size={14} />
                  <span>Allocate</span>
                </button>
                <button
                  onClick={promptArchiveShipment}
                  title="Safely archive this shipment"
                  className="h-8 px-3 bg-amber-950/80 hover:bg-amber-900 text-amber-300 rounded-lg text-xs font-semibold border border-amber-800/60 transition-colors inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Archive size={14} />
                  <span>Archive</span>
                </button>
                <button
                  onClick={promptDeleteShipment}
                  title="Delete this shipment"
                  className="h-8 px-3 bg-red-950/80 hover:bg-red-900 text-red-300 rounded-lg text-xs font-semibold border border-red-800/60 transition-colors inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors inline-flex items-center justify-center shrink-0 ml-auto sm:ml-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 sm:px-6 text-xs font-medium overflow-x-auto whitespace-nowrap scrollbar-none shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 sm:px-4 border-b-2 font-semibold transition-colors shrink-0 ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Invoice &amp; Shipping
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-3 px-3 sm:px-4 border-b-2 font-semibold transition-colors shrink-0 ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Documents ({shipment?.documents?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-3 px-3 sm:px-4 border-b-2 font-semibold transition-colors shrink-0 ${
              activeTab === 'payments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            3. FIRC &amp; Payments
          </button>
          <button
            onClick={() => setActiveTab('brc')}
            className={`py-3 px-3 sm:px-4 border-b-2 font-semibold transition-colors shrink-0 ${
              activeTab === 'brc'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            4. BRC Tracking
          </button>
          <button
            onClick={() => setActiveTab('incentives')}
            className={`py-3 px-3 sm:px-4 border-b-2 font-semibold transition-colors shrink-0 ${
              activeTab === 'incentives'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            5. Incentives
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-600" />
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-red-500 hover:text-red-800 font-semibold px-1.5 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading && (
            <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
              Loading shipment records...
            </div>
          )}

          {!loading && shipment && (
            <>
              {validationWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                  <div className="flex items-center space-x-2 text-xs font-bold text-amber-800">
                    <AlertTriangle size={15} />
                    <span>System Validation Discrepancies ({validationWarnings.length})</span>
                  </div>
                  {validationWarnings.map((warn, i) => (
                    <p key={i} className="text-xs text-amber-700 ml-6">
                      • {warn}
                    </p>
                  ))}
                </div>
              )}

              {activeTab === 'overview' && <ShipmentOverviewTab shipment={shipment} />}

              {activeTab === 'documents' && (
                <ShipmentDocumentsTab
                  shipment={shipment}
                  isViewer={isViewer}
                  onOpenUpload={onOpenUpload}
                  onPromptDeleteDocument={promptDeleteDocument}
                  onError={setActionError}
                />
              )}

              {activeTab === 'payments' && (
                <ShipmentPaymentsTab
                  shipment={shipment}
                  isViewer={isViewer}
                  onOpenAllocate={onOpenAllocate}
                  onPromptDeallocate={promptDeallocate}
                />
              )}

              {activeTab === 'brc' && (
                <ShipmentBrcTab
                  shipment={shipment}
                  isViewer={isViewer}
                  isEditingBrc={isEditingBrc}
                  brcNumber={brcNumber}
                  setBrcNumber={setBrcNumber}
                  brcStatus={brcStatus}
                  setBrcStatus={setBrcStatus}
                  brcIssueDate={brcIssueDate}
                  setBrcIssueDate={setBrcIssueDate}
                  brcRealisationDate={brcRealisationDate}
                  setBrcRealisationDate={setBrcRealisationDate}
                  brcUploadMode={brcUploadMode}
                  setBrcUploadMode={setBrcUploadMode}
                  brcRemarks={brcRemarks}
                  setBrcRemarks={setBrcRemarks}
                  onOpenEditBrc={openEditBrc}
                  onCancelEditBrc={() => setIsEditingBrc(false)}
                  onSaveBrc={handleSaveBrc}
                  onPromptResetBrc={promptResetBrc}
                />
              )}

              {activeTab === 'incentives' && (
                <ShipmentIncentivesTab
                  shipment={shipment}
                  isViewer={isViewer}
                  isAddingIncentive={isAddingIncentive}
                  editingIncentive={editingIncentive}
                  incType={incType}
                  setIncType={setIncType}
                  incClaimed={incClaimed}
                  setIncClaimed={setIncClaimed}
                  incStatus={incStatus}
                  setIncStatus={setIncStatus}
                  incReceived={incReceived}
                  setIncReceived={setIncReceived}
                  incReceivedDate={incReceivedDate}
                  setIncReceivedDate={setIncReceivedDate}
                  incScrollNo={incScrollNo}
                  setIncScrollNo={setIncScrollNo}
                  incRemarks={incRemarks}
                  setIncRemarks={setIncRemarks}
                  onOpenCreateIncentive={openCreateIncentive}
                  onCancelCreateIncentive={() => setIsAddingIncentive(false)}
                  onCreateIncentive={handleCreateIncentive}
                  onOpenEditIncentive={openEditIncentive}
                  onCancelEditIncentive={() => setEditingIncentive(null)}
                  onSaveIncentive={handleSaveIncentive}
                  onPromptDeleteIncentive={promptDeleteIncentive}
                />
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        itemName={confirmModal.itemName}
        itemType={confirmModal.itemType}
        isArchiveOnly={confirmModal.isArchiveOnly}
        isLoading={confirmModal.isLoading}
        errorMessage={confirmModal.errorMessage}
        onConfirm={confirmModal.action}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, errorMessage: null }))}
        onArchiveAlternative={confirmModal.archiveAction}
      />
    </div>
  );
};
