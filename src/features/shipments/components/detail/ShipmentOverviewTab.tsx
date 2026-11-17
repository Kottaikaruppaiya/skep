/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Shipment } from '../../../../shared/types/index.ts';

interface ShipmentOverviewTabProps {
  shipment: Shipment;
}

export const ShipmentOverviewTab: React.FC<ShipmentOverviewTabProps> = ({ shipment }) => {
  const realisedPct =
    shipment.invoiceValueUsd > 0
      ? (((shipment.totalPaidUsd || 0) / shipment.invoiceValueUsd) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Invoice Value
          </span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            ${shipment.invoiceValueUsd.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">USD Standard Value</span>
        </div>

        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            Realised Amount
          </span>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            ${(shipment.totalPaidUsd || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-600">{realisedPct}% Realised</span>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
            Outstanding Balance
          </span>
          <div className="text-xl font-bold text-amber-700 mt-1">
            ${(shipment.balanceDueUsd || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-amber-600">Balance USD Due</span>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Customs FOB Value
          </span>
          <div className="text-xl font-bold text-blue-700 mt-1">
            ₹{shipment.fobValueInr.toLocaleString()}
          </div>
          <span className="text-[11px] text-blue-600">Rate: ₹{shipment.sbExchangeRate} / USD</span>
        </div>
      </div>

      {/* Shipment Data Grid */}
      <div className="grid grid-cols-2 gap-6">
        <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-white">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
            Commercial Invoice Data
          </h3>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-slate-500">Invoice Number:</span>
            <span className="font-semibold text-slate-900">{shipment.invoiceNumber}</span>

            <span className="text-slate-500">Normalized Identity:</span>
            <span className="font-mono text-slate-800">{shipment.normalizedInvoiceKey}</span>

            <span className="text-slate-500">Invoice Date:</span>
            <span className="font-medium text-slate-800">{shipment.invoiceDate}</span>

            <span className="text-slate-500">Buyer / Consignee:</span>
            <span className="font-semibold text-slate-800">{shipment.consigneeName}</span>

            <span className="text-slate-500">Port of Loading:</span>
            <span className="font-medium text-slate-800">{shipment.portCode}</span>

            <span className="text-slate-500">Total Packages:</span>
            <span className="font-medium text-slate-800">{shipment.packageCount || 'N/A'}</span>

            <span className="text-slate-500">Review Status:</span>
            <span className="font-semibold text-blue-700">{shipment.reviewStatus}</span>
          </div>
        </div>

        <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-white">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
            Customs &amp; Transport Data
          </h3>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-slate-500">Shipping Bill No:</span>
            <span className="font-semibold text-slate-900">{shipment.shippingBillNumber}</span>

            <span className="text-slate-500">Shipping Bill Date:</span>
            <span className="font-medium text-slate-800">{shipment.shippingBillDate}</span>

            <span className="text-slate-500">CBIC Customs Rate:</span>
            <span className="font-medium text-slate-800">₹{shipment.sbExchangeRate}</span>

            <span className="text-slate-500">FOB Value (INR):</span>
            <span className="font-semibold text-slate-800">₹{shipment.fobValueInr.toLocaleString()}</span>

            <span className="text-slate-500">Bill of Lading No:</span>
            <span className="font-medium text-slate-800">{shipment.blNumber || 'Pending'}</span>

            <span className="text-slate-500">Vessel / Voyage:</span>
            <span className="font-medium text-slate-800">{shipment.vesselName || 'Pending'}</span>

            <span className="text-slate-500">Mandatory FIRC Evidence:</span>
            <span className={shipment.hasFircEvidence ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
              {shipment.hasFircEvidence ? 'Linked & Verified' : 'Missing (Action Required)'}
            </span>
          </div>
        </div>
      </div>

      {shipment.remarks && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
          <strong>Remarks:</strong> {shipment.remarks}
        </div>
      )}
    </div>
  );
};
