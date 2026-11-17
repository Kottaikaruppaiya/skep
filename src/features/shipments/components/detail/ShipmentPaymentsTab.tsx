/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus } from 'lucide-react';
import type { Shipment } from '../../../../shared/types/index.ts';

interface ShipmentPaymentsTabProps {
  shipment: Shipment;
  isViewer: boolean;
  onOpenAllocate: (shipment: Shipment) => void;
  onPromptDeallocate: (allocId: string, amountUsd: number, irm?: string) => void;
}

export const ShipmentPaymentsTab: React.FC<ShipmentPaymentsTabProps> = ({
  shipment,
  isViewer,
  onOpenAllocate,
  onPromptDeallocate,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Linked Inward Payments (FIRC)</h3>
          <p className="text-xs text-slate-500">
            Allocated foreign currency remittances against Invoice {shipment.invoiceNumber}
          </p>
        </div>
        {!isViewer && (
          <button
            onClick={() => onOpenAllocate(shipment)}
            className="h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus size={14} />
            <span>Allocate Another Payment</span>
          </button>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="p-3">IRM Reference No</th>
              <th className="p-3">Allocated USD</th>
              <th className="p-3">Allocated Date</th>
              <th className="p-3">Allocated By</th>
              <th className="p-3">Notes</th>
              {!isViewer && <th className="p-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shipment.allocations?.map((alloc) => (
              <tr key={alloc.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-semibold text-blue-700">{alloc.paymentIrm}</td>
                <td className="p-3 font-bold text-slate-900">${alloc.allocatedAmountUsd.toLocaleString()}</td>
                <td className="p-3 text-slate-600">{alloc.allocatedAt.split('T')[0]}</td>
                <td className="p-3 text-slate-600">{alloc.allocatedByName}</td>
                <td className="p-3 text-slate-500">{alloc.notes || '—'}</td>
                {!isViewer && (
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onPromptDeallocate(alloc.id, alloc.allocatedAmountUsd, alloc.paymentIrm)}
                      className="text-red-600 hover:text-red-800 font-medium px-2 py-1 bg-red-50 hover:bg-red-100 rounded transition-colors cursor-pointer"
                    >
                      Deallocate
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {(!shipment.allocations || shipment.allocations.length === 0) && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  No payments allocated to this invoice yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
