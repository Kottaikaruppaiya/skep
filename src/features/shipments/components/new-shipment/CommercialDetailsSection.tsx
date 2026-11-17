/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import type { BankMaster, ConsigneeMaster } from '../../../../shared/types/index.ts';

interface CommercialDetailsSectionProps {
  showOptionalDetails: boolean;
  onToggle: () => void;
  consignees: ConsigneeMaster[];
  banks: BankMaster[];
  extractedSources: Record<string, string>;
  consigneeId: string;
  setConsigneeId: (v: string) => void;
  bankId: string;
  setBankId: (v: string) => void;
  invoiceDate: string;
  setInvoiceDate: (v: string) => void;
  invoiceValueUsd: number | '';
  setInvoiceValueUsd: (v: number | '') => void;
  packageCount: number | '';
  setPackageCount: (v: number | '') => void;
  shippingBillNumber: string;
  setShippingBillNumber: (v: string) => void;
  shippingBillDate: string;
  setShippingBillDate: (v: string) => void;
  sbExchangeRate: number;
  setSbExchangeRate: (v: number) => void;
  fobValueInr: number | '';
  setFobValueInr: (v: number | '') => void;
  blNumber: string;
  setBlNumber: (v: string) => void;
  blDate: string;
  setBlDate: (v: string) => void;
  vesselName: string;
  setVesselName: (v: string) => void;
  portCode: string;
  setPortCode: (v: string) => void;
}

export const CommercialDetailsSection: React.FC<CommercialDetailsSectionProps> = ({
  showOptionalDetails,
  onToggle,
  consignees,
  banks,
  extractedSources,
  consigneeId,
  setConsigneeId,
  bankId,
  setBankId,
  invoiceDate,
  setInvoiceDate,
  invoiceValueUsd,
  setInvoiceValueUsd,
  packageCount,
  setPackageCount,
  shippingBillNumber,
  setShippingBillNumber,
  shippingBillDate,
  setShippingBillDate,
  sbExchangeRate,
  setSbExchangeRate,
  fobValueInr,
  setFobValueInr,
  blNumber,
  setBlNumber,
  blDate,
  setBlDate,
  vesselName,
  setVesselName,
  portCode,
  setPortCode,
}) => {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4.5 py-3.5 bg-slate-50 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Sparkles size={14} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                4. Commercial &amp; Customs Ledger Fields
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800">
                Editable • Synchronizes with All Ledgers
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-normal mt-0.5">
              Pre-filled from uploaded documents; review or enter missing data below before saving
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
          <span className="text-[11px] font-medium">
            {showOptionalDetails ? 'Hide' : 'Expand Form'}
          </span>
          {showOptionalDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {showOptionalDetails && (
        <div className="p-4.5 border-t border-slate-200 space-y-4 text-xs animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>Consignee (Buyer)</span>
                {extractedSources.consigneeId ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">Select</span>
                )}
              </label>
              <select
                value={consigneeId}
                onChange={(e) => setConsigneeId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-xs font-medium"
              >
                {consignees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>AD Bank</span>
                {extractedSources.bankId ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">Select</span>
                )}
              </label>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-xs font-medium"
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.adCode || b.ifscCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>Invoice Date</span>
                {extractedSources.invoiceDate ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-bold">Input Required</span>
                )}
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>Invoice Value (USD)</span>
                {extractedSources.invoiceValueUsd ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-bold">Input Required</span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 24025.65"
                value={invoiceValueUsd}
                onChange={(e) =>
                  setInvoiceValueUsd(e.target.value ? parseFloat(e.target.value) : '')
                }
                className="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-900 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>Packages</span>
                {extractedSources.packageCount ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : null}
              </label>
              <input
                type="number"
                placeholder="e.g. 88"
                value={packageCount}
                onChange={(e) =>
                  setPackageCount(e.target.value ? parseInt(e.target.value, 10) : '')
                }
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>Shipping Bill No.</span>
                {extractedSources.shippingBillNumber ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-bold">Input Required</span>
                )}
              </label>
              <input
                type="text"
                placeholder="e.g. 2173318"
                value={shippingBillNumber}
                onChange={(e) => setShippingBillNumber(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>Shipping Bill Date</span>
                {extractedSources.shippingBillDate ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : null}
              </label>
              <input
                type="date"
                value={shippingBillDate}
                onChange={(e) => setShippingBillDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>Customs Ex. Rate (INR/USD)</span>
                {extractedSources.sbExchangeRate ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : null}
              </label>
              <input
                type="number"
                step="0.01"
                value={sbExchangeRate}
                onChange={(e) => setSbExchangeRate(parseFloat(e.target.value) || 92.1)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>FOB Value (INR)</span>
                {extractedSources.fobValueInr ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">USD × Rate</span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                value={fobValueInr}
                onChange={(e) =>
                  setFobValueInr(e.target.value ? parseFloat(e.target.value) : '')
                }
                placeholder="Auto-calculated"
                className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50 font-bold text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>BL Number</span>
                {extractedSources.blNumber ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : null}
              </label>
              <input
                type="text"
                placeholder="e.g. 736116000605"
                value={blNumber}
                onChange={(e) => setBlNumber(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>BL Date</span>
                {extractedSources.blDate ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : null}
              </label>
              <input
                type="date"
                value={blDate}
                onChange={(e) => setBlDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>Vessel Name</span>
                {extractedSources.vesselName ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : null}
              </label>
              <input
                type="text"
                placeholder="e.g. ZHONG GU GUI YANG"
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>Port Code</span>
                {extractedSources.portCode ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    Extracted
                  </span>
                ) : null}
              </label>
              <input
                type="text"
                value={portCode}
                onChange={(e) => setPortCode(e.target.value)}
                placeholder="e.g. INMAA1"
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
