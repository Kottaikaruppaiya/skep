/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Shipment } from '../../../../shared/types/index.ts';

interface ShipmentBrcTabProps {
  shipment: Shipment;
  isViewer: boolean;
  isEditingBrc: boolean;
  brcNumber: string;
  setBrcNumber: (v: string) => void;
  brcStatus: 'PENDING' | 'ISSUED' | 'REALISED' | 'OVERDUE';
  setBrcStatus: (v: 'PENDING' | 'ISSUED' | 'REALISED' | 'OVERDUE') => void;
  brcIssueDate: string;
  setBrcIssueDate: (v: string) => void;
  brcRealisationDate: string;
  setBrcRealisationDate: (v: string) => void;
  brcUploadMode: 'SINGLE' | 'MULTIPLE';
  setBrcUploadMode: (v: 'SINGLE' | 'MULTIPLE') => void;
  brcRemarks: string;
  setBrcRemarks: (v: string) => void;
  onOpenEditBrc: () => void;
  onCancelEditBrc: () => void;
  onSaveBrc: (e: React.FormEvent) => void;
  onPromptResetBrc: () => void;
}

export const ShipmentBrcTab: React.FC<ShipmentBrcTabProps> = ({
  shipment,
  isViewer,
  isEditingBrc,
  brcNumber,
  setBrcNumber,
  brcStatus,
  setBrcStatus,
  brcIssueDate,
  setBrcIssueDate,
  brcRealisationDate,
  setBrcRealisationDate,
  brcUploadMode,
  setBrcUploadMode,
  brcRemarks,
  setBrcRemarks,
  onOpenEditBrc,
  onCancelEditBrc,
  onSaveBrc,
  onPromptResetBrc,
}) => {
  return (
    <div className="space-y-4">
      <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Bank Realisation Certificate (BRC) Status</h3>
            <p className="text-xs text-slate-500">DGFT Statement of Bank Realisation / eBRC</p>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                shipment.brcRecord?.status === 'REALISED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : shipment.brcRecord?.status === 'ISSUED'
                  ? 'bg-blue-100 text-blue-800'
                  : shipment.brcRecord?.status === 'OVERDUE'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {shipment.brcRecord?.status || 'PENDING'}
            </span>
            {!isViewer && !isEditingBrc && (
              <div className="flex items-center space-x-1.5 ml-2">
                <button
                  onClick={onOpenEditBrc}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded transition-colors"
                >
                  Edit BRC Details
                </button>
                {(shipment.brcRecord?.status === 'ISSUED' || shipment.brcRecord?.status === 'REALISED') && (
                  <button
                    onClick={onPromptResetBrc}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded transition-colors cursor-pointer"
                  >
                    Reset BRC
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {isEditingBrc ? (
          <form onSubmit={onSaveBrc} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 text-xs">
            <div className="font-bold text-slate-800 text-sm">Update Bank Realisation Certificate</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">BRC Reference Number</label>
                <input
                  type="text"
                  value={brcNumber}
                  onChange={(e) => setBrcNumber(e.target.value)}
                  placeholder="e.g. BRC-2026-08892"
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">BRC Realisation Status</label>
                <select
                  value={brcStatus}
                  onChange={(e) => setBrcStatus(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="ISSUED">ISSUED</option>
                  <option value="REALISED">REALISED</option>
                  <option value="OVERDUE">OVERDUE</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Certificate Issue Date</label>
                <input
                  type="date"
                  value={brcIssueDate}
                  onChange={(e) => setBrcIssueDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Bank Realisation Date</label>
                <input
                  type="date"
                  value={brcRealisationDate}
                  onChange={(e) => setBrcRealisationDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Upload Mode</label>
                <select
                  value={brcUploadMode}
                  onChange={(e) => setBrcUploadMode(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="SINGLE">SINGLE (1 File Mode)</option>
                  <option value="MULTIPLE">MULTIPLE (2 Files Mode)</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Remarks / Bank EDPMS Notes</label>
                <input
                  type="text"
                  value={brcRemarks}
                  onChange={(e) => setBrcRemarks(e.target.value)}
                  placeholder="Optional remarks"
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onCancelEditBrc}
                className="px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm"
              >
                Save BRC Details
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">BRC Reference Number:</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">
                {shipment.brcRecord?.brcNumber || 'Awaiting issuance'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block">Upload Mode:</span>
              <span className="font-semibold text-slate-800">
                {shipment.brcRecord?.uploadMode === 'SINGLE' ? 'Single BRC Mode (1 File)' : 'Multiple Mode (2 Files)'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block">Issue Date:</span>
              <span className="font-medium text-slate-800">{shipment.brcRecord?.issueDate || '—'}</span>
            </div>

            <div>
              <span className="text-slate-500 block">Bank Realisation Date:</span>
              <span className="font-medium text-slate-800">{shipment.brcRecord?.realisationDate || '—'}</span>
            </div>

            <div>
              <span className="text-slate-500 block">Statutory Realisation Deadline:</span>
              <span className="font-semibold text-amber-700">{shipment.brcRecord?.statutoryDeadline || '—'}</span>
            </div>

            <div>
              <span className="text-slate-500 block">Net Realised USD:</span>
              <span className="font-bold text-slate-900">
                ${(shipment.brcRecord?.realisedAmount || shipment.totalPaidUsd || 0).toLocaleString()}
              </span>
            </div>

            {shipment.brcRecord?.remarks && (
              <div className="col-span-2 pt-2 border-t border-slate-100">
                <span className="text-slate-500 block">BRC Notes:</span>
                <span className="text-slate-800">{shipment.brcRecord.remarks}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
