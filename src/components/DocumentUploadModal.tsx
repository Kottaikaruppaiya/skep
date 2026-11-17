/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { Shipment, DocumentCategory } from '../types/index.ts';
import { api } from '../api/client.ts';

interface DocumentUploadModalProps {
  shipment: Shipment | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  shipment,
  onClose,
  onSuccess,
}) => {
  const [category, setCategory] = useState<DocumentCategory>('COMMERCIAL_INVOICE');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!shipment) return null;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      formData.append('shipmentId', shipment.id);
      formData.append('financialYear', shipment.financialYearLabel || '2026-27');
      formData.append('invoiceKey', shipment.normalizedInvoiceKey);

      await api.uploadDocument(formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-md max-h-[92vh] flex flex-col rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Upload size={18} className="text-blue-400" />
            <h3 className="font-bold text-sm">Upload Export Document</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-start space-x-2">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice:</span>
              <span className="font-semibold text-slate-800">{shipment.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Storage Directory:</span>
              <span className="font-mono text-[10px] text-blue-700">
                storage/FY{shipment.financialYearLabel}/{shipment.normalizedInvoiceKey}/
              </span>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Document Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-medium"
            >
              <option value="COMMERCIAL_INVOICE">Commercial Invoice</option>
              <option value="SHIPPING_BILL">Shipping Bill</option>
              <option value="FIRC_PAYMENT">FIRC / Inward Payment Advice</option>
              <option value="BILL_OF_LADING">Bill of Lading / Transport Doc</option>
              <option value="BRC_COPY_1">BRC Copy 1 (eBRC / Bank Statement)</option>
              <option value="BRC_COPY_2">BRC Copy 2 (DGFT EDPMS Copy)</option>
              <option value="ADDITIONAL_DOC">Additional Supporting Document</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Select File (PDF or Document)</label>
            <input
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs"
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
              className="h-9 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {loading ? 'Uploading & Extracting...' : 'Upload & Extract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
