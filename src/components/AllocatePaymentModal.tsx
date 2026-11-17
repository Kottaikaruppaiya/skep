/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, DollarSign, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Shipment, Payment } from '../types/index.ts';
import { api } from '../api/client.ts';

interface AllocatePaymentModalProps {
  shipment: Shipment | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const AllocatePaymentModal: React.FC<AllocatePaymentModalProps> = ({
  shipment,
  onClose,
  onSuccess,
}) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [allocatedAmountUsd, setAllocatedAmountUsd] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shipment) {
      const balanceDue = shipment.balanceDueUsd || shipment.invoiceValueUsd;
      setAllocatedAmountUsd(balanceDue);

      api.getPayments().then((list) => {
        const available = list.filter((p) => (p.availableBalanceUsd || 0) > 0);
        setPayments(available);
        if (available.length > 0) {
          setSelectedPaymentId(available[0].id);
        }
      });
    }
  }, [shipment]);

  if (!shipment) return null;

  const selectedPayment = payments.find((p) => p.id === selectedPaymentId);
  const maxAllocatable = Math.min(
    selectedPayment?.availableBalanceUsd || 0,
    shipment.balanceDueUsd || shipment.invoiceValueUsd
  );

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!selectedPaymentId) {
        throw new Error('Please select an Inward Payment remittance.');
      }
      if (allocatedAmountUsd <= 0) {
        throw new Error('Allocated amount must be strictly greater than $0.');
      }

      await api.allocatePayment({
        paymentId: selectedPaymentId,
        shipmentId: shipment.id,
        allocatedAmountUsd,
        notes,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Allocation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-lg max-h-[92vh] flex flex-col rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <DollarSign className="text-emerald-400" size={20} />
            <h3 className="font-bold text-sm">Allocate FIRC Payment</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleAllocate} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-start space-x-2">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Shipment Summary */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Target Invoice:</span>
              <span className="font-semibold text-slate-800">{shipment.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Total:</span>
              <span className="font-bold text-slate-900">${shipment.invoiceValueUsd.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-amber-700 font-semibold">
              <span>Remaining Balance Due:</span>
              <span>${(shipment.balanceDueUsd || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Select Payment */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Select Inward Remittance (FIRC / IRM)
            </label>
            <select
              value={selectedPaymentId}
              onChange={(e) => setSelectedPaymentId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-medium"
            >
              {payments.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.irmNumber} — Avail: ${p.availableBalanceUsd?.toLocaleString()} of ${p.verifiedAmount.toLocaleString()} ({p.bankName})
                </option>
              ))}
              {payments.length === 0 && <option value="">No payments with available balance</option>}
            </select>
          </div>

          {selectedPayment && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1">
              <div className="flex justify-between">
                <span>Total FIRC Amount:</span>
                <span className="font-bold">${selectedPayment.verifiedAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Already Allocated:</span>
                <span>${(selectedPayment.totalAllocatedUsd || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-800">
                <span>Remaining Available Balance:</span>
                <span>${(selectedPayment.availableBalanceUsd || 0).toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <div className="flex justify-between items-center mb-1 h-5">
              <label className="font-semibold text-slate-700">Allocation Amount (USD)</label>
              {maxAllocatable > 0 && (
                <button
                  type="button"
                  onClick={() => setAllocatedAmountUsd(maxAllocatable)}
                  className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] cursor-pointer px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors shrink-0"
                >
                  Set Max: ${maxAllocatable.toLocaleString()}
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              required
              max={maxAllocatable}
              value={allocatedAmountUsd}
              onChange={(e) => setAllocatedAmountUsd(parseFloat(e.target.value) || 0)}
              className="w-full border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Notes / Internal Reference</label>
            <input
              type="text"
              placeholder="e.g. Wire transfer settlement"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || maxAllocatable <= 0}
              className="h-9 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {loading ? 'Allocating...' : 'Confirm Allocation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
