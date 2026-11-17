/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Shipment } from '../../../../shared/types/index.ts';

interface ShipmentIncentivesTabProps {
  shipment: Shipment;
  isViewer: boolean;
  isAddingIncentive: boolean;
  editingIncentive: any | null;
  incType: 'DRAWBACK' | 'RODTEP' | 'ROSCTL';
  setIncType: (v: 'DRAWBACK' | 'RODTEP' | 'ROSCTL') => void;
  incClaimed: number;
  setIncClaimed: (v: number) => void;
  incStatus: string;
  setIncStatus: (v: string) => void;
  incReceived: number;
  setIncReceived: (v: number) => void;
  incReceivedDate: string;
  setIncReceivedDate: (v: string) => void;
  incScrollNo: string;
  setIncScrollNo: (v: string) => void;
  incRemarks: string;
  setIncRemarks: (v: string) => void;
  onOpenCreateIncentive: () => void;
  onCancelCreateIncentive: () => void;
  onCreateIncentive: (e: React.FormEvent) => void;
  onOpenEditIncentive: (inc: any) => void;
  onCancelEditIncentive: () => void;
  onSaveIncentive: (e: React.FormEvent) => void;
  onPromptDeleteIncentive: (incId: string, incTypeName: string) => void;
}

export const ShipmentIncentivesTab: React.FC<ShipmentIncentivesTabProps> = ({
  shipment,
  isViewer,
  isAddingIncentive,
  editingIncentive,
  incType,
  setIncType,
  incClaimed,
  setIncClaimed,
  incStatus,
  setIncStatus,
  incReceived,
  setIncReceived,
  incReceivedDate,
  setIncReceivedDate,
  incScrollNo,
  setIncScrollNo,
  incRemarks,
  setIncRemarks,
  onOpenCreateIncentive,
  onCancelCreateIncentive,
  onCreateIncentive,
  onOpenEditIncentive,
  onCancelEditIncentive,
  onSaveIncentive,
  onPromptDeleteIncentive,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Export Incentives &amp; Subsidies</h3>
          <p className="text-xs text-slate-500">
            Government incentive claims (Duty Drawback DBK, RoDTEP, RoSCTL) for Invoice {shipment.invoiceNumber}
          </p>
        </div>
        {!isViewer && (
          <button
            onClick={onOpenCreateIncentive}
            className="h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus size={14} />
            <span>Add Incentive</span>
          </button>
        )}
      </div>

      {isAddingIncentive && (
        <form onSubmit={onCreateIncentive} className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3 text-xs">
          <div className="font-bold text-slate-900 text-sm">Add New Incentive Claim</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Scheme Type *</label>
              <select
                value={incType}
                onChange={(e) => setIncType(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
              >
                <option value="DRAWBACK">Duty Drawback (DBK)</option>
                <option value="RODTEP">RoDTEP</option>
                <option value="ROSCTL">RoSCTL</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Claimed Amount (INR) *</label>
              <input
                type="number"
                required
                min={0}
                value={incClaimed || ''}
                onChange={(e) => setIncClaimed(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono font-semibold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Status</label>
              <select
                value={incStatus}
                onChange={(e) => setIncStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white"
              >
                <option value="CLAIMED">CLAIMED</option>
                <option value="PART_RECEIVED">PART_RECEIVED</option>
                <option value="RECEIVED">RECEIVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Received (INR)</label>
              <input
                type="number"
                min={0}
                value={incReceived || ''}
                onChange={(e) => setIncReceived(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono text-emerald-700 font-semibold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Scroll Number / Ref</label>
              <input
                type="text"
                value={incScrollNo}
                onChange={(e) => setIncScrollNo(e.target.value)}
                placeholder="e.g. SCROLL/2026/0991"
                className="w-full border border-slate-300 rounded-lg p-2 font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Receipt Date</label>
              <input
                type="date"
                value={incReceivedDate}
                onChange={(e) => setIncReceivedDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-2 border-t border-blue-200">
            <button
              type="button"
              onClick={onCancelCreateIncentive}
              className="px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-600 bg-white hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm"
            >
              Save Incentive
            </button>
          </div>
        </form>
      )}

      {editingIncentive && (
        <form onSubmit={onSaveIncentive} className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3 text-xs">
          <div className="font-bold text-slate-900 text-sm">
            Edit Incentive: {editingIncentive.type === 'DRAWBACK' ? 'Duty Drawback (DBK)' : editingIncentive.type}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Claimed Amount (INR)</label>
              <input
                type="number"
                min={0}
                value={incClaimed}
                onChange={(e) => setIncClaimed(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono font-semibold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Claim Status</label>
              <select
                value={incStatus}
                onChange={(e) => setIncStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
              >
                <option value="CLAIMED">CLAIMED</option>
                <option value="PART_RECEIVED">PART_RECEIVED</option>
                <option value="RECEIVED">RECEIVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Received Amount (INR)</label>
              <input
                type="number"
                min={0}
                value={incReceived}
                onChange={(e) => setIncReceived(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono text-emerald-700 font-semibold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Credit / Receipt Date</label>
              <input
                type="date"
                value={incReceivedDate}
                onChange={(e) => setIncReceivedDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Scroll Number</label>
              <input
                type="text"
                value={incScrollNo}
                onChange={(e) => setIncScrollNo(e.target.value)}
                placeholder="e.g. SCR-2026-443"
                className="w-full border border-slate-300 rounded-lg p-2 font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Remarks</label>
              <input
                type="text"
                value={incRemarks}
                onChange={(e) => setIncRemarks(e.target.value)}
                placeholder="Optional notes"
                className="w-full border border-slate-300 rounded-lg p-2"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-2 border-t border-amber-200">
            <button
              type="button"
              onClick={onCancelEditIncentive}
              className="px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-600 bg-white hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </form>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="p-3">Incentive Type</th>
              <th className="p-3">Claimed (INR)</th>
              <th className="p-3">Status</th>
              <th className="p-3">Received (INR)</th>
              <th className="p-3">Received Date</th>
              <th className="p-3">Pending Balance</th>
              <th className="p-3">Scroll No</th>
              {!isViewer && <th className="p-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shipment.incentives?.map((inc) => (
              <tr key={inc.id} className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-900">
                  {inc.type === 'DRAWBACK' ? 'Duty Drawback (DBK)' : inc.type}
                </td>
                <td className="p-3 font-medium text-slate-800">₹{inc.claimedAmount.toLocaleString()}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
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
                <td className="p-3 font-bold text-emerald-700">₹{inc.receivedAmount.toLocaleString()}</td>
                <td className="p-3 text-slate-600">{inc.receivedDate || '—'}</td>
                <td className="p-3 font-semibold text-amber-700">₹{(inc.outstandingBalance || 0).toLocaleString()}</td>
                <td className="p-3 font-mono text-slate-600">{inc.scrollNumber || '—'}</td>
                {!isViewer && (
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center space-x-1.5">
                      <button
                        onClick={() => onOpenEditIncentive(inc)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          onPromptDeleteIncentive(inc.id, inc.type === 'DRAWBACK' ? 'Duty Drawback' : inc.type)
                        }
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title="Delete incentive claim"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {(!shipment.incentives || shipment.incentives.length === 0) && (
              <tr>
                <td colSpan={isViewer ? 7 : 8} className="p-8 text-center text-slate-400">
                  No export incentives recorded for this shipment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
