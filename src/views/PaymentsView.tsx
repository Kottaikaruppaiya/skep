import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  PlusCircle,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  DollarSign,
  Edit,
  Trash2,
  Search,
  X,
  Download,
} from 'lucide-react';
import { Payment, BankMaster, Role } from '../types/index.ts';
import { api } from '../api/client.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';

interface PaymentsViewProps {
  banks: BankMaster[];
  userRole: Role;
  onSelectShipment: (id: string) => void;
  onRefresh?: () => void;
  refreshKey?: number;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  banks,
  userRole,
  onSelectShipment,
  onRefresh,
  refreshKey,
}) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Payment Form
  const [irmNumber, setIrmNumber] = useState('');
  const [senderReference, setSenderReference] = useState('');
  const [verifiedAmount, setVerifiedAmount] = useState<number>(50000);
  const [inrAmount, setInrAmount] = useState<number>(4225000);
  const [exchangeRate, setExchangeRate] = useState<number>(84.5);
  const [valueDate, setValueDate] = useState(new Date().toISOString().split('T')[0]);
  const [creditDate, setCreditDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankId, setBankId] = useState(banks[0]?.id || '');
  const [purposeCode, setPurposeCode] = useState('P0102');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Payment Form
  const [editIrmNumber, setEditIrmNumber] = useState('');
  const [editSenderReference, setEditSenderReference] = useState('');
  const [editVerifiedAmount, setEditVerifiedAmount] = useState<number>(0);
  const [editInrAmount, setEditInrAmount] = useState<number>(0);
  const [editExchangeRate, setEditExchangeRate] = useState<number>(0);
  const [editValueDate, setEditValueDate] = useState('');
  const [editCreditDate, setEditCreditDate] = useState('');
  const [editBankId, setEditBankId] = useState('');
  const [editPurposeCode, setEditPurposeCode] = useState('P0102');
  const [editRemarks, setEditRemarks] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await api.getPayments();
      setPayments(data);
    } catch (e: any) {
      console.error(e);
      setActionMessage({ text: e.message || 'Error loading payments', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [refreshKey]);

  useEffect(() => {
    if (!bankId && banks.length > 0) {
      setBankId(banks[0].id);
    }
  }, [banks, bankId]);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const effectiveBankId = bankId || banks[0]?.id;
    if (!effectiveBankId) {
      setFormError('Please configure an Authorised Dealer Bank first.');
      return;
    }
    try {
      await api.createPayment({
        irmNumber,
        senderReference,
        verifiedAmount,
        inrAmount,
        exchangeRate,
        valueDate,
        creditDate,
        bankId: effectiveBankId,
        purposeCode,
        remarks,
      });
      setShowNewModal(false);
      setIrmNumber('');
      setSenderReference('');
      setRemarks('');
      setActionMessage({ text: `Payment ${irmNumber} created successfully.`, type: 'success' });
      setTimeout(() => setActionMessage(null), 4000);
      loadPayments();
      onRefresh?.();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create payment.');
    }
  };

  const openEditModal = (p: Payment) => {
    setEditingPayment(p);
    setEditIrmNumber(p.irmNumber);
    setEditSenderReference(p.senderReference || '');
    setEditVerifiedAmount(p.verifiedAmount);
    setEditInrAmount(p.inrAmount || 0);
    setEditExchangeRate(p.exchangeRate || 0);
    setEditValueDate(p.valueDate);
    setEditCreditDate(p.creditDate);
    setEditBankId(p.bankId);
    setEditPurposeCode(p.purposeCode || 'P0102');
    setEditRemarks(p.remarks || '');
    setEditError(null);
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    setEditError(null);
    try {
      await api.updatePayment(editingPayment.id, {
        irmNumber: editIrmNumber,
        senderReference: editSenderReference,
        verifiedAmount: editVerifiedAmount,
        inrAmount: editInrAmount,
        exchangeRate: editExchangeRate,
        valueDate: editValueDate,
        creditDate: editCreditDate,
        bankId: editBankId,
        purposeCode: editPurposeCode,
        remarks: editRemarks,
      });
      setEditingPayment(null);
      setActionMessage({ text: `Payment ${editIrmNumber} updated successfully.`, type: 'success' });
      setTimeout(() => setActionMessage(null), 4000);
      loadPayments();
      onRefresh?.();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update payment.');
    }
  };

  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    payment: Payment | null;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    payment: null,
    loading: false,
    error: null,
  });

  const [deallocateModalState, setDeallocateModalState] = useState<{
    isOpen: boolean;
    allocation: any | null;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    allocation: null,
    loading: false,
    error: null,
  });

  const handleConfirmDeletePayment = async () => {
    if (!deleteModalState.payment) return;
    setDeleteModalState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.deletePayment(deleteModalState.payment.id);
      setActionMessage({ text: `Payment ${deleteModalState.payment.irmNumber} deleted.`, type: 'success' });
      setDeleteModalState({ isOpen: false, payment: null, loading: false, error: null });
      setTimeout(() => setActionMessage(null), 4000);
      loadPayments();
      onRefresh?.();
    } catch (err: any) {
      setDeleteModalState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to delete payment.',
      }));
    }
  };

  const handleConfirmDeallocate = async () => {
    if (!deallocateModalState.allocation) return;
    setDeallocateModalState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.deallocatePayment(deallocateModalState.allocation.id);
      setActionMessage({
        text: `Allocation of $${deallocateModalState.allocation.allocatedAmountUsd.toLocaleString()} reversed successfully.`,
        type: 'success',
      });
      setDeallocateModalState({ isOpen: false, allocation: null, loading: false, error: null });
      setTimeout(() => setActionMessage(null), 4000);
      loadPayments();
      onRefresh?.();
    } catch (err: any) {
      setDeallocateModalState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to reverse allocation.',
      }));
    }
  };

  const isViewer = userRole === 'VIEWER';

  const filteredPayments = payments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.irmNumber.toLowerCase().includes(q) ||
      (p.senderReference && p.senderReference.toLowerCase().includes(q)) ||
      (p.bankName && p.bankName.toLowerCase().includes(q))
    );
  });

  const totalVerifiedUsd = payments.reduce((sum, p) => sum + p.verifiedAmount, 0);
  const totalAllocatedUsd = payments.reduce((sum, p) => sum + (p.totalAllocatedUsd || 0), 0);
  const totalAvailableUsd = payments.reduce((sum, p) => sum + (p.availableBalanceUsd || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard size={20} className="text-blue-600 flex-shrink-0" />
            <span>Foreign Inward Remittance Certificates (FIRC / IRM)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Verified bank inward payments, multi-invoice allocation pool, and real-time available balances
          </p>
        </div>

        {!isViewer && (
          <button
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle size={15} />
            <span>Record Inward FIRC</span>
          </button>
        )}
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-500 hover:text-slate-800 font-bold p-1">
            ×
          </button>
        </div>
      )}

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Inward Remittance
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1">${totalVerifiedUsd.toLocaleString()}</div>
          <span className="text-xs text-slate-400">{payments.length} Registered FIRCs</span>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            Total Allocated to Invoices
          </span>
          <div className="text-2xl font-bold text-blue-800 mt-1">${totalAllocatedUsd.toLocaleString()}</div>
          <span className="text-xs text-blue-600">Settled against export shipments</span>
        </div>

        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Available Inward Balance
          </span>
          <div className="text-2xl font-bold text-emerald-800 mt-1">${totalAvailableUsd.toLocaleString()}</div>
          <span className="text-xs text-emerald-600">Available to allocate to unpaid shipments</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by IRM reference, sender ref, or bank..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:bg-white focus:border-blue-500 transition-all"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filteredPayments.length}</strong> of <strong>{payments.length}</strong> payment records
        </div>
      </div>

      {/* Inward Remittances Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs flex flex-col">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
          <table className="w-full text-left text-xs whitespace-nowrap min-w-[1100px]">
            <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="p-3">IRM Reference</th>
                <th className="p-3">Sender Reference</th>
                <th className="p-3">Bank Name</th>
                <th className="p-3">Credit Date</th>
                <th className="p-3 text-right">Verified Remittance (USD)</th>
                <th className="p-3 text-right">Allocated to Shipments</th>
                <th className="p-3 text-right font-bold text-emerald-400">Available Balance</th>
                <th className="p-3 text-right">Exchange Rate</th>
                <th className="p-3 text-right">Credited INR</th>
                <th className="p-3 text-center">Allocations</th>
                <th className="p-3 text-right min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-400 animate-pulse">
                    Loading payment registers...
                  </td>
                </tr>
              )}

              {!loading && filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-400">
                    No payment records found matching the query.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-700">{p.irmNumber}</td>
                    <td className="p-3 text-slate-700 font-mono text-[11px]">{p.senderReference || '—'}</td>
                    <td className="p-3 text-slate-800 font-medium">{p.bankName}</td>
                    <td className="p-3 text-slate-600">{p.creditDate}</td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      ${p.verifiedAmount.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-700">
                      ${(p.totalAllocatedUsd || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-700">
                      ${(p.availableBalanceUsd || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-slate-600">₹{p.exchangeRate || '—'}</td>
                    <td className="p-3 text-right font-semibold text-slate-800">
                      ₹{p.inrAmount ? p.inrAmount.toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-full font-semibold text-[10px] text-slate-700">
                        {p.allocations?.length || 0} Invoices
                      </span>
                    </td>
                    <td className="p-3 text-right min-w-[100px]">
                      {!isViewer && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            title="Edit Inward Payment"
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteModalState({
                              isOpen: true,
                              payment: p,
                              loading: false,
                              error: null,
                            })}
                            title="Delete Payment"
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Allocations Drilldown List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Payment Allocations Ledger (Multi-Invoice Distribution)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPayments.map((p) => (
            <div key={p.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-mono font-bold text-blue-700 text-xs">{p.irmNumber}</span>
                <span className="text-[11px] text-slate-500">
                  Total: <strong>${p.verifiedAmount.toLocaleString()}</strong> | Available: <strong className="text-emerald-700">${(p.availableBalanceUsd || 0).toLocaleString()}</strong>
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {p.allocations && p.allocations.length > 0 ? (
                  p.allocations.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => onSelectShipment(a.shipmentId)}
                      className="p-2 bg-slate-50 hover:bg-blue-50/50 rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer group"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 group-hover:text-blue-700">
                          {a.shipmentInvoiceNo || 'Invoice'}
                        </span>
                        <span className="text-slate-400 text-[10px] ml-2">Date: {a.allocatedAt.split('T')[0]}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-emerald-700">${a.allocatedAmountUsd.toLocaleString()}</span>
                        {!isViewer && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeallocateModalState({
                                isOpen: true,
                                allocation: a,
                                loading: false,
                                error: null,
                              });
                            }}
                            title="Reverse / Deallocate Payment"
                            className="p-1 rounded text-red-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <ArrowRight size={13} className="text-slate-400 group-hover:text-blue-600" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-3 text-center text-slate-400 text-xs">
                    No active allocations on this FIRC yet.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Payment Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Record New Inward FIRC Remittance</h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center space-x-2">
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">IRM Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IRM26052026001"
                    value={irmNumber}
                    onChange={(e) => setIrmNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Sender Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. CUST-TT-94821"
                    value={senderReference}
                    onChange={(e) => setSenderReference(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Verified USD Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={verifiedAmount}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setVerifiedAmount(v);
                      setInrAmount(Math.round(v * exchangeRate * 100) / 100);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Realised Rate (INR)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={exchangeRate}
                    onChange={(e) => {
                      const r = parseFloat(e.target.value) || 0;
                      setExchangeRate(r);
                      setInrAmount(Math.round(verifiedAmount * r * 100) / 100);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Credited INR Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={inrAmount}
                    onChange={(e) => setInrAmount(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Credit Date</label>
                  <input
                    type="date"
                    required
                    value={creditDate}
                    onChange={(e) => setCreditDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">Authorised Dealer Bank</label>
                  <select
                    value={bankId}
                    onChange={(e) => setBankId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (AD Code: {b.adCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">Remarks / Narrative</label>
                  <input
                    type="text"
                    placeholder="e.g. Inward TT from buyer for export invoice..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="h-9 px-4 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Save Inward Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Edit Inward Payment — {editingPayment.irmNumber}</h3>
              <button onClick={() => setEditingPayment(null)} className="p-1 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdatePayment} className="p-6 space-y-4 text-xs">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center space-x-2">
                  <AlertCircle size={15} />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">IRM Number</label>
                  <input
                    type="text"
                    required
                    value={editIrmNumber}
                    onChange={(e) => setEditIrmNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Sender Reference</label>
                  <input
                    type="text"
                    value={editSenderReference}
                    onChange={(e) => setEditSenderReference(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Verified USD Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editVerifiedAmount}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setEditVerifiedAmount(v);
                      if (editExchangeRate) setEditInrAmount(Math.round(v * editExchangeRate * 100) / 100);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Realised Rate (INR)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editExchangeRate}
                    onChange={(e) => {
                      const r = parseFloat(e.target.value) || 0;
                      setEditExchangeRate(r);
                      setEditInrAmount(Math.round(editVerifiedAmount * r * 100) / 100);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Credited INR Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editInrAmount}
                    onChange={(e) => setEditInrAmount(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Credit Date</label>
                  <input
                    type="date"
                    required
                    value={editCreditDate}
                    onChange={(e) => setEditCreditDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">Authorised Dealer Bank</label>
                  <select
                    value={editBankId}
                    onChange={(e) => setEditBankId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (AD Code: {b.adCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">Remarks / Narrative</label>
                  <input
                    type="text"
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="h-9 px-4 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Update Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Payment Modal */}
      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        title="Delete Foreign Inward Remittance"
        itemName={deleteModalState.payment?.irmNumber || ''}
        itemType="Inward FIRC Payment"
        isLoading={deleteModalState.loading}
        errorMessage={deleteModalState.error}
        onConfirm={handleConfirmDeletePayment}
        onCancel={() => setDeleteModalState({ isOpen: false, payment: null, loading: false, error: null })}
      />

      {/* Deallocate Payment Modal */}
      <ConfirmationModal
        isOpen={deallocateModalState.isOpen}
        title="Reverse Payment Allocation"
        itemName={`$${(deallocateModalState.allocation?.allocatedAmountUsd || 0).toLocaleString()} for ${deallocateModalState.allocation?.shipmentInvoiceNo || 'Shipment'}`}
        itemType="Payment Allocation"
        isLoading={deallocateModalState.loading}
        errorMessage={deallocateModalState.error}
        onConfirm={handleConfirmDeallocate}
        onCancel={() => setDeallocateModalState({ isOpen: false, allocation: null, loading: false, error: null })}
      />
    </div>
  );
};
