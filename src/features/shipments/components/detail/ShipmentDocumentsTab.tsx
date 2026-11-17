/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import type { Shipment } from '../../../../shared/types/index.ts';
import { api } from '../../../../core/api/index.ts';

interface ShipmentDocumentsTabProps {
  shipment: Shipment;
  isViewer: boolean;
  onOpenUpload: (shipment: Shipment) => void;
  onPromptDeleteDocument: (docId: string, filename: string) => void;
  onError: (message: string) => void;
}

export const ShipmentDocumentsTab: React.FC<ShipmentDocumentsTabProps> = ({
  shipment,
  isViewer,
  onOpenUpload,
  onPromptDeleteDocument,
  onError,
}) => {
  const handleDownload = async (docId: string, filename: string) => {
    try {
      await api.downloadDocument(docId, filename);
    } catch (err: any) {
      onError(err?.message || 'Failed to download document.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Original Stored Documents</h3>
          <p className="text-xs text-slate-500">
            Files stored privately in{' '}
            <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">
              storage/FY{shipment.financialYearLabel}/{shipment.normalizedInvoiceKey}
            </code>
          </p>
        </div>
        {!isViewer && (
          <button
            onClick={() => onOpenUpload(shipment)}
            className="h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus size={14} />
            <span>Upload Document</span>
          </button>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="p-3">Category</th>
              <th className="p-3">Original Filename</th>
              <th className="p-3">Version</th>
              <th className="p-3">Size</th>
              <th className="p-3">Review Status</th>
              <th className="p-3">Uploaded By</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shipment.documents?.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50/80">
                <td className="p-3 font-semibold text-slate-900">
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 text-[11px]">
                    {doc.category.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-3 text-slate-700 font-mono text-[11px]">{doc.originalFilename}</td>
                <td className="p-3 text-slate-600">v{doc.version}</td>
                <td className="p-3 text-slate-500">{(doc.fileSizeBytes / 1024).toFixed(1)} KB</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium text-[10px]">
                    {doc.reviewStatus}
                  </span>
                </td>
                <td className="p-3 text-slate-600">{doc.uploadedByName}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end space-x-1.5">
                    <button
                      type="button"
                      onClick={() => void handleDownload(doc.id, doc.originalFilename)}
                      className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </button>
                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => onPromptDeleteDocument(doc.id, doc.originalFilename)}
                        title="Delete Document"
                        className="p-1 rounded hover:bg-red-50 text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(!shipment.documents || shipment.documents.length === 0) && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  No documents uploaded yet for this shipment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
