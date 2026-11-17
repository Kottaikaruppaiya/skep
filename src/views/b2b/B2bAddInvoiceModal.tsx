/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Building2, FileText, Calculator, ShieldCheck, Hash } from 'lucide-react';
import { api } from '../../api/client.ts';
import type { B2bInvoice, Supplier } from '../../types/index.ts';
import { getDefaultGstrPeriodLabel, isValidGstin, normalizeGstin } from '../../shared/utils/normalizer.ts';

interface B2bAddInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: B2bInvoice | null;
  defaultPeriodKey?: string;
}

export const B2bAddInvoiceModal: React.FC<B2bAddInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  defaultPeriodKey,
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [supplierGstin, setSupplierGstin] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceType, setInvoiceType] = useState('Regular');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [gstrPeriod, setGstrPeriod] = useState(defaultPeriodKey || getDefaultGstrPeriodLabel());

  const [taxableValue, setTaxableValue] = useState<number | ''>(0);
  const [applicableTaxRate, setApplicableTaxRate] = useState<number | ''>('');
  const [integratedTax, setIntegratedTax] = useState<number | ''>(0);
  const [centralTax, setCentralTax] = useState<number | ''>(0);
  const [stateUtTax, setStateUtTax] = useState<number | ''>(0);
  const [cess, setCess] = useState<number | ''>(0);
  const [invoiceValue, setInvoiceValue] = useState<number | ''>(0);

  const [itcAvailability, setItcAvailability] = useState<'Yes' | 'No'>('Yes');
  const [reason, setReason] = useState('');
  const [reverseCharge, setReverseCharge] = useState<'N' | 'Y'>('N');
  const [filingDate, setFilingDate] = useState('');
  const [source, setSource] = useState('');

  const [irn, setIrn] = useState('');
  const [irnDate, setIrnDate] = useState('');

  // Computed total GST
  const computedTotalGst =
    (Number(integratedTax) || 0) +
    (Number(centralTax) || 0) +
    (Number(stateUtTax) || 0) +
    (Number(cess) || 0);

  // Load suppliers for autocomplete
  useEffect(() => {
    if (isOpen) {
      api.getB2bSuppliers().then(setSuppliers).catch(console.error);
    }
  }, [isOpen]);

  // Sync initialData when editing
  useEffect(() => {
    if (initialData) {
      setSupplierGstin(initialData.supplierGstin || '');
      setSupplierName(initialData.supplierName || '');
      setPlaceOfSupply(initialData.placeOfSupply || '');
      setInvoiceNumber(initialData.invoiceNumber || '');
      setInvoiceType(initialData.invoiceType || 'Regular');
      setInvoiceDate(initialData.invoiceDate || new Date().toISOString().split('T')[0]);
      setGstrPeriod(initialData.gstrPeriod || defaultPeriodKey || getDefaultGstrPeriodLabel());
      setTaxableValue(initialData.taxableValue ?? 0);
      setApplicableTaxRate(
        initialData.applicableTaxRate !== undefined && initialData.applicableTaxRate !== null
          ? initialData.applicableTaxRate
          : ''
      );
      setIntegratedTax(initialData.integratedTax ?? 0);
      setCentralTax(initialData.centralTax ?? 0);
      setStateUtTax(initialData.stateUtTax ?? 0);
      setCess(initialData.cess ?? 0);
      setInvoiceValue(initialData.invoiceValue ?? 0);
      setItcAvailability(initialData.itcAvailability === 'No' ? 'No' : 'Yes');
      setReason(initialData.reason || '');
      setReverseCharge(initialData.reverseCharge === 'Y' ? 'Y' : 'N');
      setFilingDate(initialData.filingDate || '');
      setSource(initialData.source || '');
      setIrn(initialData.irn || '');
      setIrnDate(initialData.irnDate || '');
    } else {
      resetForm();
      if (defaultPeriodKey) setGstrPeriod(defaultPeriodKey);
    }
    setError(null);
  }, [initialData, defaultPeriodKey, isOpen]);

  const resetForm = () => {
    setSupplierGstin('');
    setSupplierName('');
    setPlaceOfSupply('');
    setInvoiceNumber('');
    setInvoiceType('Regular');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setGstrPeriod(defaultPeriodKey || getDefaultGstrPeriodLabel());
    setTaxableValue(0);
    setApplicableTaxRate('');
    setIntegratedTax(0);
    setCentralTax(0);
    setStateUtTax(0);
    setCess(0);
    setInvoiceValue(0);
    setItcAvailability('Yes');
    setReason('');
    setReverseCharge('N');
    setFilingDate('');
    setSource('');
    setIrn('');
    setIrnDate('');
  };

  const handleSupplierGstinChange = (val: string) => {
    const clean = normalizeGstin(val);
    setSupplierGstin(clean);
    const matched = suppliers.find((s) => s.gstin.toUpperCase() === clean);
    if (matched) {
      setSupplierName(matched.legalName);
      if (matched.state && !placeOfSupply.trim()) setPlaceOfSupply(matched.state);
    }
  };

  // Recalculate invoice value when taxable value or tax changes
  const handleTaxableChange = (val: number) => {
    setTaxableValue(val);
    const totalGst = (Number(integratedTax) || 0) + (Number(centralTax) || 0) + (Number(stateUtTax) || 0) + (Number(cess) || 0);
    setInvoiceValue(Math.round((val + totalGst) * 100) / 100);
  };

  const handleTaxChange = (field: 'igst' | 'cgst' | 'sgst' | 'cess', val: number) => {
    const igstVal = field === 'igst' ? val : Number(integratedTax) || 0;
    const cgstVal = field === 'cgst' ? val : Number(centralTax) || 0;
    const sgstVal = field === 'sgst' ? val : Number(stateUtTax) || 0;
    const cessVal = field === 'cess' ? val : Number(cess) || 0;

    if (field === 'igst') setIntegratedTax(val);
    if (field === 'cgst') setCentralTax(val);
    if (field === 'sgst') setStateUtTax(val);
    if (field === 'cess') setCess(val);

    const newTotalGst = igstVal + cgstVal + sgstVal + cessVal;
    const base = Number(taxableValue) || 0;
    setInvoiceValue(Math.round((base + newTotalGst) * 100) / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanGstin = normalizeGstin(supplierGstin);
    if (!isValidGstin(cleanGstin)) {
      setError('Please provide a valid 15-character Supplier GSTIN (e.g., 33AAACH2748P1ZP).');
      return;
    }
    if (!supplierName.trim()) {
      setError('Supplier Trade/Legal Name is required.');
      return;
    }
    if (!invoiceNumber.trim()) {
      setError('Invoice Number is required.');
      return;
    }
    if (!invoiceDate) {
      setError('Invoice Date is required.');
      return;
    }
    if (!gstrPeriod.trim()) {
      setError('GSTR Period is required (e.g., "August 2026" or "2026-08").');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplierGstin: cleanGstin,
        supplierName: supplierName.trim(),
        placeOfSupply: placeOfSupply.trim() || undefined,
        invoiceNumber: invoiceNumber.trim(),
        invoiceType,
        invoiceDate,
        gstrPeriod: gstrPeriod.trim(),
        taxableValue: Number(taxableValue) || 0,
        applicableTaxRate: applicableTaxRate === '' ? undefined : Number(applicableTaxRate),
        integratedTax: Number(integratedTax) || 0,
        centralTax: Number(centralTax) || 0,
        stateUtTax: Number(stateUtTax) || 0,
        cess: Number(cess) || 0,
        invoiceValue: Number(invoiceValue) || 0,
        itcAvailability,
        reason: reason.trim() || undefined,
        reverseCharge,
        filingDate: filingDate || undefined,
        source: source.trim() || undefined,
        irn: irn.trim() || undefined,
        irnDate: irnDate || undefined,
      };

      if (initialData?.id) {
        await api.updateB2bInvoice(initialData.id, payload);
      } else {
        await api.createB2bInvoice(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save B2B invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {initialData ? 'Edit B2B Inward Purchase Invoice' : 'Add New B2B Inward Purchase Invoice'}
              </h2>
              <p className="text-xs text-slate-300">
                GSTR-2B Inward Tax Invoice Entry with Full 21-Field GSTR Compliance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body with 5 Sections */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* SECTION 1: Supplier & Basic Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 text-slate-800 font-semibold text-sm">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Section 1: Supplier Information</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GSTIN of Supplier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={supplierGstin}
                  onChange={(e) => handleSupplierGstinChange(e.target.value)}
                  placeholder="e.g. 33AAACH2748P1ZP"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden uppercase font-mono font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trade / Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. KOTHARI TEXTILE MILLS PVT LTD"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Place of Supply (POS)
                </label>
                <input
                  type="text"
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  placeholder="e.g. 33-Tamil Nadu"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Invoice Identification & GSTR Period */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 text-slate-800 font-semibold text-sm">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Section 2: Invoice Details & GSTR Period</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-089"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Type
                </label>
                <select
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="Regular">Regular</option>
                  <option value="Deemed Exp">Deemed Export</option>
                  <option value="SEZ supplies with payment">SEZ supplies with payment</option>
                  <option value="SEZ supplies without payment">SEZ supplies without payment</option>
                  <option value="Intra-State supplies attracting IGST">Intra-State with IGST</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GSTR Period <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={gstrPeriod}
                  onChange={(e) => setGstrPeriod(e.target.value)}
                  placeholder="e.g. August 2026 or 2026-08"
                  className="w-full px-3 py-2 text-sm bg-blue-50 border border-blue-300 text-blue-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold"
                  required
                />
                <span className="text-[10px] text-slate-500">Determines monthly filing bucket</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: Taxable Values & Taxes */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span>Section 3: Taxable Value & Tax Breakdown</span>
              </div>
              <div className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md font-semibold">
                Total GST: ₹{computedTotalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Taxable Value (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxableValue}
                  onChange={(e) => handleTaxableChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tax Rate %
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={applicableTaxRate}
                  placeholder="Optional"
                  onChange={(e) =>
                    setApplicableTaxRate(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Integrated Tax (IGST ₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={integratedTax}
                  onChange={(e) => handleTaxChange('igst', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Central Tax (CGST ₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={centralTax}
                  onChange={(e) => handleTaxChange('cgst', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  State/UT Tax (SGST ₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={stateUtTax}
                  onChange={(e) => handleTaxChange('sgst', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cess (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cess}
                  onChange={(e) => handleTaxChange('cess', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Invoice Value (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={invoiceValue}
                  onChange={(e) => setInvoiceValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
                <span className="text-[10px] text-slate-500">Auto-filled as Taxable + Total GST (editable)</span>
              </div>
            </div>
          </div>

          {/* SECTION 4: ITC & Compliance Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 text-slate-800 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Section 4: ITC Eligibility & GST Compliance</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ITC Availability
                </label>
                <select
                  value={itcAvailability}
                  onChange={(e) => setItcAvailability(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="Yes">Yes (Available)</option>
                  <option value="No">No (Ineligible)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reverse Charge (RCM)
                </label>
                <select
                  value={reverseCharge}
                  onChange={(e) => setReverseCharge(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="N">No (Regular)</option>
                  <option value="Y">Yes (Reverse Charge)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier Filing Date
                </label>
                <input
                  type="date"
                  value={filingDate}
                  onChange={(e) => setFilingDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Source Return
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="">Unspecified / Blank</option>
                  <option value="GSTR-1">GSTR-1</option>
                  <option value="GSTR-1/IFF">GSTR-1/IFF</option>
                  <option value="GSTR-5">GSTR-5</option>
                  <option value="GSTR-6">GSTR-6</option>
                </select>
              </div>

              {itcAvailability === 'No' && (
                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ITC Ineligibility Reason
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Ineligible under section 17(5)"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              )}
            </div>
          </div>

          {/* SECTION 5: E-Invoice (IRN) Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 text-slate-800 font-semibold text-sm">
              <Hash className="w-4 h-4 text-blue-600" />
              <span>Section 5: E-Invoice (IRN) Details</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Reference Number (IRN - 64 Character Hash)
                </label>
                <input
                  type="text"
                  maxLength={64}
                  value={irn}
                  onChange={(e) => setIrn(e.target.value)}
                  placeholder="e.g. 7b4d9a1f2c3e4b5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IRN Date
                </label>
                <input
                  type="date"
                  value={irnDate}
                  onChange={(e) => setIrnDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {submitting ? (
                <>Saving Invoice...</>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {initialData ? 'Update Invoice' : 'Save Invoice'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
