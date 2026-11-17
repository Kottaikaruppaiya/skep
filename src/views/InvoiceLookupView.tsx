/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Save,
  RotateCcw,
  FileText,
  DollarSign,
  TrendingUp,
  Award,
  CreditCard,
  Building2,
  Calendar,
  History,
  Info
} from 'lucide-react';
import { api } from '../api/client.ts';
import { Shipment, ConsigneeMaster, Role } from '../types/index.ts';
import { normalizeInvoiceKey } from '../shared/utils/normalizer.ts';

interface InvoiceLookupViewProps {
  selectedFyId: string;
  onSelectShipment: (id: string) => void;
  onRefresh?: () => void;
  userRole?: Role;
  refreshKey?: number;
}

export const InvoiceLookupView: React.FC<InvoiceLookupViewProps> = ({
  selectedFyId,
  onSelectShipment,
  onRefresh,
  userRole = 'ADMIN',
  refreshKey,
}) => {
  const isViewer = userRole === 'VIEWER';
  const [inputVal, setInputVal] = useState('');
  const [results, setResults] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [allShipments, setAllShipments] = useState<Shipment[]>([]);
  const [consignees, setConsignees] = useState<ConsigneeMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 'Change To' form state
  const [changeTo, setChangeTo] = useState<{
    invoiceNumber: string;
    invoiceDate: string;
    shippingBillNumber: string;
    shippingBillDate: string;
    portCode: string;
    consigneeId: string;
    packageCount: string;
    invoiceValueUsd: string;
    sbExchangeRate: string;
    fobValueInr: string;
    dbkClaimed: string;
    dbkReceived: string;
    dbkReceivedDate: string;
    rodtepClaimed: string;
    rodtepReceived: string;
    rosctlClaimed: string;
    rosctlReceived: string;
    brcNumber: string;
    brcDate: string;
    blNumber: string;
    blDate: string;
    vesselName: string;
    remarks: string;
  }>({
    invoiceNumber: '',
    invoiceDate: '',
    shippingBillNumber: '',
    shippingBillDate: '',
    portCode: '',
    consigneeId: '',
    packageCount: '',
    invoiceValueUsd: '',
    sbExchangeRate: '',
    fobValueInr: '',
    dbkClaimed: '',
    dbkReceived: '',
    dbkReceivedDate: '',
    rodtepClaimed: '',
    rodtepReceived: '',
    rosctlClaimed: '',
    rosctlReceived: '',
    brcNumber: '',
    brcDate: '',
    blNumber: '',
    blDate: '',
    vesselName: '',
    remarks: '',
  });

  const currentNormalized = normalizeInvoiceKey(inputVal);

  // Load masters and list for auto-suggest
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.getShipments({ financialYearId: selectedFyId !== 'ALL' ? selectedFyId : undefined }),
      api.getConsignees(),
    ])
      .then(([shipmentsData, consigneesData]) => {
        if (!mounted) return;
        setAllShipments(shipmentsData);
        setConsignees(consigneesData);

        if (shipmentsData.length > 0 && !selectedShipment) {
          const match = inputVal.trim()
            ? shipmentsData.find(
                (s) =>
                  s.invoiceNumber.toLowerCase() === inputVal.trim().toLowerCase() ||
                  s.normalizedInvoiceKey === normalizeInvoiceKey(inputVal)
              )
            : shipmentsData[0];
          const chosen = match || shipmentsData[0];
          if (chosen) {
            setSelectedShipment(chosen);
            if (!inputVal.trim()) setInputVal(chosen.invoiceNumber);
          }
        }
      })
      .catch((err) => console.error('Error loading lookup prerequisites:', err));

    return () => {
      mounted = false;
    };
  }, [selectedFyId, refreshKey]);

  const handleSearch = async (queryToUse?: string) => {
    const q = (queryToUse || inputVal).trim();
    if (!q) return;

    setLoading(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      const res = await api.lookupShipments(q, selectedFyId !== 'ALL' ? selectedFyId : undefined);
      setResults(res.matches);
      if (res.matches.length > 0) {
        setSelectedShipment(res.matches[0]);
        clearChangeToInputs();
      } else {
        setSelectedShipment(null);
      }
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || 'Error looking up shipments');
    } finally {
      setLoading(false);
    }
  };

  const clearChangeToInputs = () => {
    setChangeTo({
      invoiceNumber: '',
      invoiceDate: '',
      shippingBillNumber: '',
      shippingBillDate: '',
      portCode: '',
      consigneeId: '',
      packageCount: '',
      invoiceValueUsd: '',
      sbExchangeRate: '',
      fobValueInr: '',
      dbkClaimed: '',
      dbkReceived: '',
      dbkReceivedDate: '',
      rodtepClaimed: '',
      rodtepReceived: '',
      rosctlClaimed: '',
      rosctlReceived: '',
      brcNumber: '',
      brcDate: '',
      blNumber: '',
      blDate: '',
      vesselName: '',
      remarks: '',
    });
    setSaveSuccess(null);
    setSaveError(null);
  };

  const handleSelectShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setInputVal(shipment.invoiceNumber);
    clearChangeToInputs();
  };

  const handleSaveChanges = async () => {
    if (!selectedShipment) return;

    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const updates: any = {};

      const applyField = (key: string, val: string, isNumeric = false) => {
        const trimmed = val.trim();
        if (!trimmed) return; // Keep existing
        if (trimmed.toUpperCase() === 'DEL') {
          updates[key] = isNumeric ? 0 : '';
        } else if (isNumeric) {
          const num = Number(trimmed);
          if (!isNaN(num)) updates[key] = num;
        } else {
          updates[key] = trimmed;
        }
      };

      applyField('invoiceNumber', changeTo.invoiceNumber);
      applyField('invoiceDate', changeTo.invoiceDate);
      applyField('shippingBillNumber', changeTo.shippingBillNumber);
      applyField('shippingBillDate', changeTo.shippingBillDate);
      applyField('portCode', changeTo.portCode);
      applyField('consigneeId', changeTo.consigneeId);
      applyField('packageCount', changeTo.packageCount, true);
      applyField('invoiceValueUsd', changeTo.invoiceValueUsd, true);
      applyField('sbExchangeRate', changeTo.sbExchangeRate, true);
      applyField('fobValueInr', changeTo.fobValueInr, true);
      applyField('dbkClaimed', changeTo.dbkClaimed, true);
      applyField('dbkReceived', changeTo.dbkReceived, true);
      applyField('dbkReceivedDate', changeTo.dbkReceivedDate);
      applyField('rodtepClaimed', changeTo.rodtepClaimed, true);
      applyField('rodtepReceived', changeTo.rodtepReceived, true);
      applyField('rosctlClaimed', changeTo.rosctlClaimed, true);
      applyField('rosctlReceived', changeTo.rosctlReceived, true);
      applyField('brcNumber', changeTo.brcNumber);
      applyField('brcDate', changeTo.brcDate);
      applyField('blNumber', changeTo.blNumber);
      applyField('blDate', changeTo.blDate);
      applyField('vesselName', changeTo.vesselName);
      applyField('remarks', changeTo.remarks);

      if (Object.keys(updates).length === 0) {
        setSaveError('No changes detected in any "Change To" fields.');
        setSaving(false);
        return;
      }

      const updated = await api.updateShipment(selectedShipment.id, updates);
      setSelectedShipment(updated);
      setAllShipments((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      clearChangeToInputs();
      setSaveSuccess(`Successfully updated invoice ${updated.invoiceNumber}.`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  // Extract incentive & BRC fields from selected shipment
  const dbk = selectedShipment?.incentives?.find((i) => i.type === 'DRAWBACK');
  const rodtep = selectedShipment?.incentives?.find((i) => i.type === 'RODTEP');
  const rosctl = selectedShipment?.incentives?.find((i) => i.type === 'ROSCTL');
  const brc = selectedShipment?.brcRecord;

  // Realised calculations
  const totalPaidUsd = selectedShipment?.totalPaidUsd || 0;
  const balanceDueUsd = selectedShipment?.balanceDueUsd ?? Math.max(0, (selectedShipment?.invoiceValueUsd || 0) - totalPaidUsd);
  const effectiveRate = selectedShipment?.averageRealisedRate || selectedShipment?.sbExchangeRate || 0;
  const realisedInr = selectedShipment?.realisedInr ?? (totalPaidUsd * effectiveRate);
  const fobInr = selectedShipment?.fobValueInr || 0;
  const differenceInr = realisedInr - fobInr;
  const netForexInr = balanceDueUsd === 0 ? differenceInr : 0;
  const allocationBanks = Array.from(
    new Set((selectedShipment?.allocations || []).map((a) => a.paymentBankName).filter(Boolean))
  ).join(', ');
  const allocationIrms = Array.from(
    new Set((selectedShipment?.allocations || []).map((a) => a.paymentIrm).filter(Boolean))
  ).join(', ');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Search size={22} className="text-blue-600" />
            <span>Invoice Lookup &amp; Real-time Field Editor</span>
          </h2>
          <p className="text-xs text-slate-500">
            Worksheet 2: 31-column complete inspection, formula verification &amp; verified 'Change To' field workflow
          </p>
        </div>

        {selectedShipment && (
          <button
            onClick={() => onSelectShipment(selectedShipment.id)}
            className="h-9 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-auto transition-colors"
          >
            <FileText size={15} />
            <span>Open Document Dossier</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Search & Suggestions Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by Invoice No (e.g. SKE/26-27/020), Shipping Bill No, or normalized key..."
              className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-colors"
            />
          </div>

          <button
            onClick={() => handleSearch()}
            disabled={loading}
            className="h-10 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center justify-center gap-2 shrink-0 shadow-xs"
          >
            <Search size={15} />
            <span>{loading ? 'Searching...' : 'Lookup Invoice'}</span>
          </button>
        </div>

        {/* Normalized Identity & Auto-suggest Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-blue-600" />
            <span className="text-slate-500 text-[11px]">Normalized Key:</span>
            <span className="font-mono font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded text-xs">
              {currentNormalized || 'EMPTY'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Quick Select:</span>
            <select
              value={selectedShipment?.id || ''}
              onChange={(e) => {
                const s = allShipments.find((x) => x.id === e.target.value);
                if (s) handleSelectShipment(s);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono text-slate-700 outline-none max-w-xs truncate"
            >
              <option value="">-- Choose Loaded Invoice ({allShipments.length}) --</option>
              {allShipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.invoiceNumber} — {s.consigneeName || 'Consignee'} (${s.invoiceValueUsd.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Selected Shipment Details — Full 31 Columns Form */}
      {selectedShipment ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          {/* Header Badge Strip */}
          <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-base font-bold font-mono tracking-tight text-white">
                {selectedShipment.invoiceNumber}
              </span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                FY: {selectedShipment.financialYearLabel || selectedShipment.financialYearId}
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  selectedShipment.paymentStatus === 'FULLY_PAID'
                    ? 'bg-emerald-500 text-white'
                    : selectedShipment.paymentStatus === 'PART_PAID'
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {selectedShipment.paymentStatus}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isViewer && (
                <span className="text-xs text-slate-400">
                  Rule: Enter <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono text-[10px]">DEL</kbd> in any field to clear optional values
                </span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-6">
            {/* Action Bar */}
            {!isViewer && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-100 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-blue-900 font-medium">
                  <Info size={16} className="text-blue-600" />
                  <span>
                    Change values in the <strong>Change To</strong> column below. Leave blank to retain current value.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearChangeToInputs}
                    type="button"
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <RotateCcw size={13} />
                    <span>Clear Changes</span>
                  </button>
                  <button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    type="button"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Save size={14} />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 1: Columns A–H — Shipping Bill Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-200 pb-2">
                <Building2 size={15} className="text-blue-600" />
                <span>Section 1: Shipping Bill &amp; Consignee Details (Columns A–H)</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* Column A: S.No */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Col A: S.No (ID)</span>
                  <span className="font-mono text-slate-700 font-semibold text-xs truncate block mt-1">
                    {selectedShipment.id.substring(0, 12)}...
                  </span>
                  <span className="text-[10px] text-slate-400 italic block mt-1">System Primary Key</span>
                </div>

                {/* Column B: Invoice No */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col B: Invoice No</span>
                  <div className="font-mono font-bold text-slate-900">{selectedShipment.invoiceNumber}</div>
                  {!isViewer && (
                    <input
                      type="text"
                      placeholder="Change To..."
                      value={changeTo.invoiceNumber}
                      onChange={(e) => setChangeTo({ ...changeTo, invoiceNumber: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>

                {/* Column C: Invoice Date */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col C: Invoice Date</span>
                  <div className="font-mono text-slate-800">{selectedShipment.invoiceDate}</div>
                  {!isViewer && (
                    <input
                      type="date"
                      value={changeTo.invoiceDate}
                      onChange={(e) => setChangeTo({ ...changeTo, invoiceDate: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>

                {/* Column D: Shipping Bill No */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col D: Shipping Bill No</span>
                  <div className="font-mono font-bold text-slate-900">{selectedShipment.shippingBillNumber}</div>
                  {!isViewer && (
                    <input
                      type="text"
                      placeholder="Change To..."
                      value={changeTo.shippingBillNumber}
                      onChange={(e) => setChangeTo({ ...changeTo, shippingBillNumber: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>

                {/* Column E: Shipping Bill Date */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col E: SB Date</span>
                  <div className="font-mono text-slate-800">{selectedShipment.shippingBillDate}</div>
                  {!isViewer && (
                    <input
                      type="date"
                      value={changeTo.shippingBillDate}
                      onChange={(e) => setChangeTo({ ...changeTo, shippingBillDate: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>

                {/* Column F: Port Code */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col F: Port Code</span>
                  <div className="font-mono text-slate-800">{selectedShipment.portCode}</div>
                  {!isViewer && (
                    <input
                      type="text"
                      placeholder="e.g. INNSA1 / INMAA1"
                      value={changeTo.portCode}
                      onChange={(e) => setChangeTo({ ...changeTo, portCode: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>

                {/* Column G: Consignee Name */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col G: Consignee Name</span>
                  <div className="font-semibold text-slate-900 truncate" title={selectedShipment.consigneeName}>
                    {selectedShipment.consigneeName || 'Unknown Buyer'}
                  </div>
                  {!isViewer && (
                    <select
                      value={changeTo.consigneeId}
                      onChange={(e) => setChangeTo({ ...changeTo, consigneeId: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                    >
                      <option value="">Keep current buyer</option>
                      {consignees.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Column H: No. of Pkgs */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col H: No. of Pkgs</span>
                  <div className="font-mono text-slate-800">{selectedShipment.packageCount || 0}</div>
                  {!isViewer && (
                    <input
                      type="number"
                      placeholder="Change To..."
                      value={changeTo.packageCount}
                      onChange={(e) => setChangeTo({ ...changeTo, packageCount: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 2: Columns I–K — Value & Customs FOB */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-200 pb-2">
                <DollarSign size={15} className="text-emerald-600" />
                <span>Section 2: Value &amp; Customs FOB (Columns I–K)</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Column I: Invoice Value (USD) */}
                <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase">Col I: Invoice Value (USD)</span>
                  <div className="font-mono font-bold text-emerald-900 text-sm">
                    ${selectedShipment.invoiceValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {!isViewer && (
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Change USD..."
                      value={changeTo.invoiceValueUsd}
                      onChange={(e) => setChangeTo({ ...changeTo, invoiceValueUsd: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>

                {/* Column J: FOB Value (INR) */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col J: FOB Value (INR)</span>
                  <div className="font-mono font-bold text-slate-900 text-sm">
                    ₹{selectedShipment.fobValueInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {!isViewer && (
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Change FOB INR..."
                      value={changeTo.fobValueInr}
                      onChange={(e) => setChangeTo({ ...changeTo, fobValueInr: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>

                {/* Column K: Exchange Rate */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col K: Exchange Rate</span>
                  <div className="font-mono text-slate-900 text-sm">
                    ₹{selectedShipment.sbExchangeRate.toFixed(2)}
                  </div>
                  {!isViewer && (
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Change Ex. Rate..."
                      value={changeTo.sbExchangeRate}
                      onChange={(e) => setChangeTo({ ...changeTo, sbExchangeRate: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 3: Columns L–R — Export Incentives */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-200 pb-2">
                <Award size={15} className="text-amber-600" />
                <span>Section 3: Export Incentives (Columns L–R)</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* Column L & M: Drawback Amt & Recd */}
                <div className="p-3 bg-amber-50/40 rounded-lg border border-amber-200 space-y-1">
                  <span className="text-[10px] font-bold text-amber-900 block uppercase">Col L: Drawback Claimed (INR)</span>
                  <div className="font-mono font-bold text-slate-900">₹{(dbk?.claimedAmount || 0).toLocaleString()}</div>
                  {!isViewer && (
                    <input
                      type="number"
                      placeholder="Claimed INR..."
                      value={changeTo.dbkClaimed}
                      onChange={(e) => setChangeTo({ ...changeTo, dbkClaimed: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                  <div className="pt-1 border-t border-amber-100">
                    <span className="text-[10px] font-bold text-amber-900 block uppercase">Col M: Drawback Recd</span>
                    <div className="font-mono text-emerald-700 font-semibold">₹{(dbk?.receivedAmount || 0).toLocaleString()}</div>
                    {!isViewer && (
                      <input
                        type="number"
                        placeholder="Recd INR..."
                        value={changeTo.dbkReceived}
                        onChange={(e) => setChangeTo({ ...changeTo, dbkReceived: e.target.value })}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono mt-1"
                      />
                    )}
                  </div>
                </div>

                {/* Column N: Drawback Received Date */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col N: Drawback Recd Date</span>
                  <div className="font-mono text-slate-800">{dbk?.receivedDate || 'Not Received'}</div>
                  {!isViewer && (
                    <input
                      type="date"
                      value={changeTo.dbkReceivedDate}
                      onChange={(e) => setChangeTo({ ...changeTo, dbkReceivedDate: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>

                {/* Column O & P: RoDTEP Amt & Recd */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col O: RoDTEP Claimed</span>
                  <div className="font-mono font-bold text-slate-900">₹{(rodtep?.claimedAmount || 0).toLocaleString()}</div>
                  {!isViewer && (
                    <input
                      type="number"
                      placeholder="Claimed INR..."
                      value={changeTo.rodtepClaimed}
                      onChange={(e) => setChangeTo({ ...changeTo, rodtepClaimed: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                  <div className="pt-1 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Col P: RoDTEP Recd</span>
                    <div className="font-mono text-emerald-700 font-semibold">₹{(rodtep?.receivedAmount || 0).toLocaleString()}</div>
                    {!isViewer && (
                      <input
                        type="number"
                        placeholder="Recd INR..."
                        value={changeTo.rodtepReceived}
                        onChange={(e) => setChangeTo({ ...changeTo, rodtepReceived: e.target.value })}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono mt-1"
                      />
                    )}
                  </div>
                </div>

                {/* Column Q & R: RoSCTL Amt & Recd */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col Q: RoSCTL Claimed</span>
                  <div className="font-mono font-bold text-slate-900">₹{(rosctl?.claimedAmount || 0).toLocaleString()}</div>
                  {!isViewer && (
                    <input
                      type="number"
                      placeholder="Claimed INR..."
                      value={changeTo.rosctlClaimed}
                      onChange={(e) => setChangeTo({ ...changeTo, rosctlClaimed: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                  <div className="pt-1 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Col R: RoSCTL Recd</span>
                    <div className="font-mono text-emerald-700 font-semibold">₹{(rosctl?.receivedAmount || 0).toLocaleString()}</div>
                    {!isViewer && (
                      <input
                        type="number"
                        placeholder="Recd INR..."
                        value={changeTo.rosctlReceived}
                        onChange={(e) => setChangeTo({ ...changeTo, rosctlReceived: e.target.value })}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono mt-1"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: Columns S–Z — Payment Details & BRC */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-200 pb-2">
                <CreditCard size={15} className="text-purple-600" />
                <span>Section 4: Payment Realisation &amp; BRC Details (Columns S–Z)</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* Column S: Payment Received Date */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col S: Payment Date</span>
                  <div className="font-mono text-slate-800 font-semibold mt-1">
                    {selectedShipment.allocations?.[0]?.paymentCreditDate ||
                      (selectedShipment.allocations?.[0]?.allocatedAt
                        ? selectedShipment.allocations[0].allocatedAt.split('T')[0]
                        : 'Pending')}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">From linked FIRC Inward Remittance</span>
                </div>

                {/* Column T: Amount Received (USD) */}
                <div className="p-3 bg-emerald-50/40 rounded-lg border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-900 block uppercase">Col T: Amount Recd (USD)</span>
                  <div className="font-mono font-bold text-emerald-800 text-sm mt-1">
                    ${totalPaidUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-emerald-700 block mt-1">
                    {totalPaidUsd >= selectedShipment.invoiceValueUsd ? '100% Realised' : `$${balanceDueUsd.toFixed(2)} Pending`}
                  </span>
                </div>

                {/* Column U: Amount Received (INR) */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col U: Amount Recd (INR)</span>
                  <div className="font-mono font-bold text-slate-900 text-sm mt-1">
                    ₹{realisedInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Formula: Total Paid USD × Realised Rate</span>
                </div>

                {/* Column V: Exchange Rate Received */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col V: Ex. Rate Recd</span>
                  <div className="font-mono text-slate-900 text-sm mt-1">
                    {effectiveRate > 0 ? `₹${effectiveRate.toFixed(2)}` : '—'}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Effective bank conversion rate</span>
                </div>

                {/* Column W: Bank */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col W: Bank</span>
                  <div className="font-semibold text-slate-800 mt-1">
                    {allocationBanks || '—'}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Authorised Dealer Bank</span>
                </div>

                {/* Column X: Bank Inward Remittance No. (IRM) */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col X: IRM / FIRC No</span>
                  <div className="font-mono text-slate-800 font-semibold mt-1">
                    {allocationIrms || '—'}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Bank Inward Reference</span>
                </div>

                {/* Column Y: BRC Number */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col Y: BRC Number</span>
                  <div className="font-mono font-bold text-slate-900">{brc?.brcNumber || 'Not Issued'}</div>
                  {!isViewer && (
                    <input
                      type="text"
                      placeholder="Enter BRC / DEL to clear"
                      value={changeTo.brcNumber}
                      onChange={(e) => setChangeTo({ ...changeTo, brcNumber: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>

                {/* Column Z: BRC Date */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col Z: BRC Date</span>
                  <div className="font-mono text-slate-800">{brc?.issueDate || brc?.realisationDate || 'Pending'}</div>
                  {!isViewer && (
                    <input
                      type="date"
                      value={changeTo.brcDate}
                      onChange={(e) => setChangeTo({ ...changeTo, brcDate: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 5: Columns AA–AE — Difference, Mode & Forex Calculations */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-200 pb-2">
                <TrendingUp size={15} className="text-indigo-600" />
                <span>Section 5: Difference &amp; Forex Formulas (Columns AA–AE)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                {/* Column AA: Difference */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col AA: Difference (INR)</span>
                  <div className={`font-mono font-bold text-sm mt-1 ${differenceInr >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {differenceInr >= 0 ? '+' : ''}₹{differenceInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Formula: Amount Recd INR − FOB INR</span>
                </div>

                {/* Column AB: Payment Status */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col AB: Status</span>
                  <div className="font-bold text-slate-900 mt-1">{selectedShipment.paymentStatus}</div>
                  <span className="text-[10px] text-slate-400 block mt-1">Formula: IF Realised &gt;= Inv "FULLY PAID"</span>
                </div>

                {/* Column AC: Payment Mode */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col AC: Payment Mode</span>
                  <div className="font-semibold text-slate-900 mt-1">
                    {(selectedShipment.allocations?.length || 0) > 1 ? 'Multiple Inward Remittances' : 'Single Inward Remittance'}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Formula: IF Multiple FIRCs</span>
                </div>

                {/* Column AD: Balance (USD) */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col AD: Balance (USD)</span>
                  <div className={`font-mono font-bold text-sm mt-1 ${balanceDueUsd > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    ${balanceDueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Formula: Invoice USD − Recd USD</span>
                </div>

                {/* Column AE: Forex Gain/Loss (INR) */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Col AE: Net Forex (INR)</span>
                  <div className={`font-mono font-bold text-sm mt-1 ${netForexInr >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {netForexInr >= 0 ? '+' : ''}₹{netForexInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Formula: IF Balance=0 THEN Diff INR ELSE 0</span>
                </div>
              </div>
            </div>

            {/* Optional Fields: Shipping / Logistics & Remarks */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Optional Logistics &amp; Remarks {!isViewer ? '(Type DEL to Clear)' : ''}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block font-semibold">Bill of Lading No:</span>
                  <div className="font-mono text-slate-800">{selectedShipment.blNumber || 'None'}</div>
                  {!isViewer && (
                    <input
                      type="text"
                      placeholder="Change To..."
                      value={changeTo.blNumber}
                      onChange={(e) => setChangeTo({ ...changeTo, blNumber: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono mt-1"
                    />
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-semibold">BL Date:</span>
                  <div className="font-mono text-slate-800">{selectedShipment.blDate || 'None'}</div>
                  {!isViewer && (
                    <input
                      type="date"
                      value={changeTo.blDate}
                      onChange={(e) => setChangeTo({ ...changeTo, blDate: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono mt-1"
                    />
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-semibold">Vessel Name:</span>
                  <div className="text-slate-800">{selectedShipment.vesselName || 'None'}</div>
                  {!isViewer && (
                    <input
                      type="text"
                      placeholder="Change To..."
                      value={changeTo.vesselName}
                      onChange={(e) => setChangeTo({ ...changeTo, vesselName: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs mt-1"
                    />
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-semibold">Remarks:</span>
                  <div className="text-slate-800 truncate" title={selectedShipment.remarks}>{selectedShipment.remarks || 'None'}</div>
                  {!isViewer && (
                    <input
                      type="text"
                      placeholder="Change To..."
                      value={changeTo.remarks}
                      onChange={(e) => setChangeTo({ ...changeTo, remarks: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs mt-1"
                    />
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center space-y-2">
          <Search size={32} className="mx-auto text-slate-300" />
          <h3 className="text-sm font-bold text-slate-700">No Invoice Selected</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Use the search box above to find any invoice by number or shipping bill number, or choose one from the dropdown to inspect and edit its 31 canonical workbook fields.
          </p>
        </div>
      )}
    </div>
  );
};
