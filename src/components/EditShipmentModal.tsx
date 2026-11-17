/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Edit2, AlertCircle, RefreshCw, Calculator, CheckCircle2 } from 'lucide-react';
import { Shipment, ConsigneeMaster } from '../types/index.ts';
import { api } from '../api/client.ts';
import { normalizeInvoiceKey } from '../shared/utils/normalizer.ts';

interface EditShipmentModalProps {
  shipment: Shipment | null;
  consignees: ConsigneeMaster[];
  onClose: () => void;
  onSuccess: () => void;
}

export const EditShipmentModal: React.FC<EditShipmentModalProps> = ({
  shipment,
  consignees,
  onClose,
  onSuccess,
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [consigneeId, setConsigneeId] = useState('');
  const [portCode, setPortCode] = useState('');
  const [packageCount, setPackageCount] = useState<number>(0);
  const [invoiceValueUsd, setInvoiceValueUsd] = useState<number>(0);
  const [shippingBillNumber, setShippingBillNumber] = useState('');
  const [shippingBillDate, setShippingBillDate] = useState('');
  const [sbExchangeRate, setSbExchangeRate] = useState<number>(0);
  const [fobValueInr, setFobValueInr] = useState<number>(0);
  const [blNumber, setBlNumber] = useState('');
  const [blDate, setBlDate] = useState('');
  const [vesselName, setVesselName] = useState('');
  const [reviewStatus, setReviewStatus] = useState<Shipment['reviewStatus']>('CONFIRMED');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever shipment prop changes
  useEffect(() => {
    if (shipment) {
      setInvoiceNumber(shipment.invoiceNumber || '');
      setInvoiceDate(shipment.invoiceDate ? shipment.invoiceDate.split('T')[0] : '');
      setConsigneeId(shipment.consigneeId || (consignees[0]?.id || ''));
      setPortCode(shipment.portCode || 'INNSA1');
      setPackageCount(shipment.packageCount || 0);
      setInvoiceValueUsd(shipment.invoiceValueUsd || 0);
      setShippingBillNumber(shipment.shippingBillNumber || '');
      setShippingBillDate(shipment.shippingBillDate ? shipment.shippingBillDate.split('T')[0] : '');
      setSbExchangeRate(shipment.sbExchangeRate || 0);
      setFobValueInr(shipment.fobValueInr || 0);
      setBlNumber(shipment.blNumber || '');
      setBlDate(shipment.blDate ? shipment.blDate.split('T')[0] : '');
      setVesselName(shipment.vesselName || '');
      setReviewStatus(shipment.reviewStatus || 'CONFIRMED');
      setRemarks(shipment.remarks || '');
      setError(null);
    }
  }, [shipment, consignees]);

  if (!shipment) return null;

  const normalizedKey = normalizeInvoiceKey(invoiceNumber);

  const handleRecalculateFob = () => {
    const calculated = Math.round(Number(invoiceValueUsd || 0) * Number(sbExchangeRate || 0) * 100) / 100;
    setFobValueInr(calculated);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!invoiceNumber.trim()) throw new Error('Invoice Number cannot be empty.');
      if (!consigneeId) throw new Error('Please select a Buyer / Consignee.');
      if (invoiceValueUsd <= 0) throw new Error('Invoice Value (USD) must be greater than 0.');
      if (sbExchangeRate <= 0) throw new Error('Customs Exchange Rate (INR) must be greater than 0.');

      await api.updateShipment(shipment.id, {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: invoiceDate || undefined,
        consigneeId,
        portCode: portCode.trim().toUpperCase() || 'INNSA1',
        packageCount: Number(packageCount) || 0,
        invoiceValueUsd: Number(invoiceValueUsd),
        shippingBillNumber: shippingBillNumber.trim() || 'PENDING',
        shippingBillDate: shippingBillDate || undefined,
        sbExchangeRate: Number(sbExchangeRate),
        fobValueInr: Number(fobValueInr),
        blNumber: blNumber.trim() || undefined,
        blDate: blDate || undefined,
        vesselName: vesselName.trim() || undefined,
        reviewStatus,
        remarks: remarks.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update shipment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <Edit2 size={18} className="text-blue-400 shrink-0" />
            <h3 className="font-bold text-sm truncate">Edit Export Shipment — {shipment.invoiceNumber}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-start space-x-2">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Invoice Number *</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-blue-700 font-mono mt-0.5 block">
                Normalized: {normalizedKey}
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Invoice Date *</label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Buyer (Consignee) *</label>
              <select
                value={consigneeId}
                onChange={(e) => setConsigneeId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {consignees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Invoice Value (USD) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={invoiceValueUsd}
                onChange={(e) => setInvoiceValueUsd(parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Customs Port Code</label>
              <input
                type="text"
                value={portCode}
                onChange={(e) => setPortCode(e.target.value.toUpperCase())}
                placeholder="e.g. INNSA1"
                className="w-full border border-slate-300 rounded-lg p-2 uppercase font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Package Count</label>
              <input
                type="number"
                value={packageCount}
                onChange={(e) => setPackageCount(parseInt(e.target.value, 10) || 0)}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Shipping Bill No.</label>
              <input
                type="text"
                value={shippingBillNumber}
                onChange={(e) => setShippingBillNumber(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Shipping Bill Date</label>
              <input
                type="date"
                value={shippingBillDate}
                onChange={(e) => setShippingBillDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Customs Exchange Rate (INR)</label>
              <input
                type="number"
                step="0.0001"
                value={sbExchangeRate}
                onChange={(e) => setSbExchangeRate(parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1 h-5">
                <label className="font-semibold text-slate-700">FOB Value (INR)</label>
                <button
                  type="button"
                  onClick={handleRecalculateFob}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors shrink-0"
                  title="Auto-calculate FOB Value in INR (USD × Customs Rate)"
                >
                  <Calculator size={12} />
                  <span>Auto-Calc</span>
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                value={fobValueInr}
                onChange={(e) => setFobValueInr(parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Bill of Lading (BL) No.</label>
              <input
                type="text"
                value={blNumber}
                onChange={(e) => setBlNumber(e.target.value)}
                placeholder="e.g. BL-MEDU-2026-001"
                className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">BL Issue Date</label>
              <input
                type="date"
                value={blDate}
                onChange={(e) => setBlDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Vessel / Voyage</label>
              <input
                type="text"
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                placeholder="e.g. MSC LAUREN / 2603W"
                className="w-full border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Review Status</label>
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="CONFIRMED">Confirmed</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
                <option value="EXTRACTED">Extracted</option>
                <option value="MANUALLY_ENTERED">Manually Entered</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Remarks / Notes</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Operational notes, special handling, container references..."
              className="w-full border border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
              disabled={loading}
              className="h-9 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
