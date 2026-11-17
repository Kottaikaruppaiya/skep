/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  Ship,
  DollarSign,
  FilePlus,
  Info,
  Calendar,
  Layers,
  KeyRound,
  Check,
} from 'lucide-react';
import { ConsigneeMaster, BankMaster, FinancialYear } from '../types/index.ts';
import { api } from '../api/client.ts';
import { formatFileSize, normalizeInvoiceKey } from '../shared/utils/normalizer.ts';
import {
  type BrcMode,
  type ExtractionResultSummary,
  type SelectedFileItem,
} from '../features/shipments/components/new-shipment/types.ts';
import { DocumentUploadCard } from '../features/shipments/components/new-shipment/DocumentUploadCard.tsx';
import { SmartBatchDropzone } from '../features/shipments/components/new-shipment/SmartBatchDropzone.tsx';
import { BrcUploadSlotCard } from '../features/shipments/components/new-shipment/BrcUploadSlotCard.tsx';
import { CommercialDetailsSection } from '../features/shipments/components/new-shipment/CommercialDetailsSection.tsx';

interface NewShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedFyId: string;
  financialYears: FinancialYear[];
  consignees: ConsigneeMaster[];
  banks: BankMaster[];
}

export const NewShipmentModal: React.FC<NewShipmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedFyId,
  financialYears,
  consignees,
  banks,
}) => {
  const defaultFy =
    financialYears.find(
      (f) => f.label.includes('2026') || f.id.includes('2026') || f.isCurrent
    )?.id || selectedFyId || 'fy-2026-27';

  const [fyId, setFyId] = useState(defaultFy);

  // Invoice Number (Unique, Primary)
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [normalizedKey, setNormalizedKey] = useState('');
  const [isCheckingUnique, setIsCheckingUnique] = useState(false);
  const [isUnique, setIsUnique] = useState<boolean | null>(null);
  const [existingInvoiceNumber, setExistingInvoiceNumber] = useState<string | null>(null);

  // Document Files (up to 7 documents)
  const [invoiceFile, setInvoiceFile] = useState<SelectedFileItem | null>(null);
  const [sbFile, setSbFile] = useState<SelectedFileItem | null>(null);
  const [blFile, setBlFile] = useState<SelectedFileItem | null>(null);
  const [brcMode, setBrcMode] = useState<BrcMode>('SINGLE');
  const [brcFile1, setBrcFile1] = useState<SelectedFileItem | null>(null);
  const [brcFile2, setBrcFile2] = useState<SelectedFileItem | null>(null);
  const [fircFile, setFircFile] = useState<SelectedFileItem | null>(null);
  const [additionalFile, setAdditionalFile] = useState<SelectedFileItem | null>(null);

  // Remarks & Commercial Details
  const [remarks, setRemarks] = useState('');
  const [showOptionalDetails, setShowOptionalDetails] = useState(true);
  const [consigneeId, setConsigneeId] = useState(consignees[0]?.id || '');
  const [bankId, setBankId] = useState(banks[0]?.id || '');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceValueUsd, setInvoiceValueUsd] = useState<number | ''>('');
  const [shippingBillNumber, setShippingBillNumber] = useState('');
  const [shippingBillDate, setShippingBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [sbExchangeRate, setSbExchangeRate] = useState<number>(92.1);
  const [fobValueInr, setFobValueInr] = useState<number | ''>('');
  const [blNumber, setBlNumber] = useState('');
  const [blDate, setBlDate] = useState('');
  const [vesselName, setVesselName] = useState('');
  const [portCode, setPortCode] = useState('INMAA1');
  const [packageCount, setPackageCount] = useState<number | ''>('');

  // Extraction tracking state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState('');
  const [extractionResult, setExtractionResult] = useState<ExtractionResultSummary | null>(null);
  const [extractedSources, setExtractedSources] = useState<Record<string, string>>({});

  // UI State
  const [submitting, setSubmitting] = useState(false);
  const [submitProgressText, setSubmitProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);
  const [isDragOverBatch, setIsDragOverBatch] = useState(false);

  // Hidden input refs
  const batchInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const sbInputRef = useRef<HTMLInputElement>(null);
  const blInputRef = useRef<HTMLInputElement>(null);
  const brc1InputRef = useRef<HTMLInputElement>(null);
  const brc2InputRef = useRef<HTMLInputElement>(null);
  const fircInputRef = useRef<HTMLInputElement>(null);
  const additionalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const match = financialYears.find(
        (f) => f.label.includes('2026') || f.id.includes('2026') || f.isCurrent
      )?.id;
      setFyId(match || selectedFyId || 'fy-2026-27');
      if (consignees[0]?.id && !consigneeId) {
        setConsigneeId(consignees[0].id);
      }
      if (banks[0]?.id && !bankId) {
        setBankId(banks[0].id);
      }
    }
  }, [isOpen, financialYears, selectedFyId, consignees, banks, consigneeId, bankId]);

  useEffect(() => {
    if (!invoiceNumber.trim()) {
      setNormalizedKey('');
      setIsUnique(null);
      setExistingInvoiceNumber(null);
      return;
    }

    const nKey = normalizeInvoiceKey(invoiceNumber);
    setNormalizedKey(nKey);
    setIsCheckingUnique(true);

    const timer = setTimeout(async () => {
      try {
        const res = await api.checkInvoiceUnique(invoiceNumber.trim(), fyId);
        setIsUnique(res.isUnique);
        setExistingInvoiceNumber(res.existingInvoiceNumber || null);
      } catch (e) {
        console.warn('Uniqueness check error:', e);
      } finally {
        setIsCheckingUnique(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [invoiceNumber, fyId]);

  useEffect(() => {
    if (typeof invoiceValueUsd === 'number' && invoiceValueUsd > 0) {
      const rate = typeof sbExchangeRate === 'number' && sbExchangeRate > 0 ? sbExchangeRate : 92.1;
      const calcFob = Math.round(invoiceValueUsd * rate * 100) / 100;
      setFobValueInr(calcFob);
    }
  }, [invoiceValueUsd, sbExchangeRate]);

  const handleSuggestNextInvoice = async () => {
    try {
      const all = await api.getShipments({ financialYearId: fyId });
      let maxNum = 0;
      for (const s of all) {
        const m = s.invoiceNumber.match(/(\d+)$/);
        if (m) {
          const val = parseInt(m[1], 10);
          if (val > maxNum) maxNum = val;
        }
      }
      const nextNum = maxNum > 0 ? maxNum + 1 : 1;
      const padded = String(nextNum).padStart(3, '0');
      setInvoiceNumber(`SKE/26-27/${padded}`);
    } catch {
      setInvoiceNumber('SKE/26-27/271');
    }
  };

  const handleAutoPadInput = (raw: string) => {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const padded = trimmed.padStart(3, '0');
      setInvoiceNumber(`SKE/26-27/${padded}`);
    } else {
      setInvoiceNumber(raw);
    }
  };

  const handleClearForm = () => {
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setShippingBillNumber('');
    setShippingBillDate(new Date().toISOString().split('T')[0]);
    setInvoiceValueUsd('');
    setSbExchangeRate(92.1);
    setFobValueInr('');
    setBlNumber('');
    setBlDate('');
    setVesselName('');
    setRemarks('');
    setPortCode('INMAA1');
    setPackageCount('');
    setInvoiceFile(null);
    setSbFile(null);
    setBlFile(null);
    setBrcFile1(null);
    setBrcFile2(null);
    setFircFile(null);
    setAdditionalFile(null);
    setError(null);
    setExtractionResult(null);
    setExtractedSources({});
  };

  const runBatchExtraction = async (explicitFiles?: {
    inv?: File | null;
    sb?: File | null;
    bl?: File | null;
    brc1?: File | null;
    brc2?: File | null;
    firc?: File | null;
    add?: File | null;
  }) => {
    const fInv = explicitFiles?.inv !== undefined ? explicitFiles.inv : invoiceFile?.file;
    const fSb = explicitFiles?.sb !== undefined ? explicitFiles.sb : sbFile?.file;
    const fBl = explicitFiles?.bl !== undefined ? explicitFiles.bl : blFile?.file;
    const fBrc1 = explicitFiles?.brc1 !== undefined ? explicitFiles.brc1 : brcFile1?.file;
    const fBrc2 = explicitFiles?.brc2 !== undefined ? explicitFiles.brc2 : brcFile2?.file;
    const fFirc = explicitFiles?.firc !== undefined ? explicitFiles.firc : fircFile?.file;
    const fAdd = explicitFiles?.add !== undefined ? explicitFiles.add : additionalFile?.file;

    const filesToUpload = [fInv, fSb, fBl, fBrc1, fBrc2, fFirc, fAdd].filter(Boolean) as File[];
    if (filesToUpload.length === 0) {
      setError('Please select or drop at least one document PDF to extract.');
      return;
    }

    setIsExtracting(true);
    setError(null);
    setExtractionProgress(`Analyzing ${filesToUpload.length} document${filesToUpload.length > 1 ? 's' : ''}...`);

    try {
      const formData = new FormData();
      if (fInv) formData.append('invoiceDoc', fInv);
      if (fSb) formData.append('shippingBillDoc', fSb);
      if (fBl) formData.append('blDoc', fBl);
      if (fBrc1) formData.append('brcDoc1', fBrc1);
      if (fBrc2) formData.append('brcDoc2', fBrc2);
      if (fFirc) formData.append('fircDoc', fFirc);
      if (fAdd) formData.append('additionalDoc', fAdd);

      const res = await api.extractDocumentsBatch(formData);

      if (res.success && res.mergedDraft) {
        const draft = res.mergedDraft;
        const sources: Record<string, string> = {};

        if (draft.invoiceNumber) {
          setInvoiceNumber(draft.invoiceNumber);
          sources.invoiceNumber = 'Commercial Invoice';
        }
        if (draft.invoiceDate) {
          setInvoiceDate(draft.invoiceDate);
          sources.invoiceDate = 'Commercial Invoice';
        }
        if (typeof draft.invoiceValueUsd === 'number') {
          setInvoiceValueUsd(draft.invoiceValueUsd);
          sources.invoiceValueUsd = 'Commercial Invoice / FIRC';
        }
        if (typeof draft.packageCount === 'number') {
          setPackageCount(draft.packageCount);
          sources.packageCount = 'Commercial Invoice / BL';
        }
        if (draft.shippingBillNumber) {
          setShippingBillNumber(draft.shippingBillNumber);
          sources.shippingBillNumber = 'Shipping Bill';
        }
        if (draft.shippingBillDate) {
          setShippingBillDate(draft.shippingBillDate);
          sources.shippingBillDate = 'Shipping Bill';
        }
        if (typeof draft.sbExchangeRate === 'number') {
          setSbExchangeRate(draft.sbExchangeRate);
          sources.sbExchangeRate = 'Shipping Bill (CBIC Rate)';
        }
        if (typeof draft.fobValueInr === 'number') {
          setFobValueInr(draft.fobValueInr);
          sources.fobValueInr = 'Shipping Bill Customs FOB';
        }
        if (draft.portCode) {
          setPortCode(draft.portCode);
          sources.portCode = 'Shipping Bill';
        }
        if (draft.blNumber) {
          setBlNumber(draft.blNumber);
          sources.blNumber = 'Bill of Lading';
        }
        if (draft.blDate) {
          setBlDate(draft.blDate);
          sources.blDate = 'Bill of Lading';
        }
        if (draft.vesselName) {
          setVesselName(draft.vesselName);
          sources.vesselName = 'Shipping Bill / BL';
        }

        if (draft.consigneeName) {
          const match = consignees.find(
            (c) =>
              c.name.toLowerCase().includes(draft.consigneeName.toLowerCase().slice(0, 10)) ||
              draft.consigneeName.toLowerCase().includes(c.name.toLowerCase().slice(0, 10))
          );
          if (match) {
            setConsigneeId(match.id);
            sources.consigneeId = `Matched: ${match.name}`;
          }
        }

        if (draft.bankName) {
          const matchBank = banks.find(
            (b) =>
              b.name.toLowerCase().includes(draft.bankName.toLowerCase().slice(0, 4)) ||
              draft.bankName.toLowerCase().includes(b.name.toLowerCase().slice(0, 4))
          );
          if (matchBank) {
            setBankId(matchBank.id);
            sources.bankId = `Matched: ${matchBank.name}`;
          }
        }

        setExtractedSources(sources);
        const count = Object.keys(draft.extractedFields || {}).length;
        const missing = draft.missingFields || [];
        setExtractionResult({
          fieldsExtracted: count,
          missingFields: missing,
          docCount: filesToUpload.length,
          summaryText: `Extracted ${count} fields across ${filesToUpload.length} document(s).`,
        });

        setShowOptionalDetails(true);
      }
    } catch (err: any) {
      setError(`Batch extraction error: ${err.message || 'Unable to extract PDF content'}`);
    } finally {
      setIsExtracting(false);
      setExtractionProgress('');
    }
  };

  const processBatchFileList = (files: FileList | File[]) => {
    const fileList = Array.from(files).slice(0, 7);
    if (fileList.length === 0) return;

    let newInv = invoiceFile;
    let newSb = sbFile;
    let newBl = blFile;
    let newBrc1 = brcFile1;
    let newBrc2 = brcFile2;
    let newFirc = fircFile;
    let newAdd = additionalFile;

    for (const f of fileList) {
      const fn = f.name.toLowerCase();
      const item: SelectedFileItem = {
        file: f,
        name: f.name,
        size: formatFileSize(f.size),
      };

      if (fn.includes('invoice') || fn.includes('inv_') || fn.includes('commercial')) {
        newInv = item;
      } else if (fn.includes('shipping') || fn.includes('sb_') || fn.includes('shipping_bill')) {
        newSb = item;
      } else if (fn.includes('bl_') || fn.includes('bl ') || fn.includes('lading') || fn.startsWith('bl')) {
        newBl = item;
      } else if (fn.includes('firc') || fn.includes('irm') || fn.includes('remittance') || fn.includes('payment')) {
        newFirc = item;
      } else if (fn.includes('brc') || fn.includes('ebrc')) {
        if (!newBrc1) {
          newBrc1 = item;
        } else {
          newBrc2 = item;
          setBrcMode('MULTIPLE');
        }
      } else {
        newAdd = item;
      }
    }

    if (newInv) setInvoiceFile(newInv);
    if (newSb) setSbFile(newSb);
    if (newBl) setBlFile(newBl);
    if (newBrc1) setBrcFile1(newBrc1);
    if (newBrc2) setBrcFile2(newBrc2);
    if (newFirc) setFircFile(newFirc);
    if (newAdd) setAdditionalFile(newAdd);

    void runBatchExtraction({
      inv: newInv?.file,
      sb: newSb?.file,
      bl: newBl?.file,
      brc1: newBrc1?.file,
      brc2: newBrc2?.file,
      firc: newFirc?.file,
      add: newAdd?.file,
    });
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (item: SelectedFileItem | null) => void,
    categoryType?: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const item: SelectedFileItem = {
      file,
      name: file.name,
      size: formatFileSize(file.size),
    };
    setter(item);

    if (categoryType === 'INVOICE' && !invoiceNumber) {
      const nameParts = file.name.replace(/\.[^/.]+$/, '').split(/[-_ ]+/);
      const possibleNum = nameParts.find((p) => /\d{2,}/.test(p));
      if (possibleNum) {
        setInvoiceNumber(`SKE/26-27/${possibleNum.padStart(3, '0')}`);
      }
    }

    e.target.value = '';
  };

  const resetForm = () => {
    setInvoiceNumber('');
    setInvoiceFile(null);
    setSbFile(null);
    setBlFile(null);
    setBrcMode('SINGLE');
    setBrcFile1(null);
    setBrcFile2(null);
    setFircFile(null);
    setAdditionalFile(null);
    setRemarks('');
    setError(null);
    setSuccessToast(false);
    setExtractionResult(null);
    setExtractedSources({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!invoiceNumber.trim()) {
      setError('Invoice Number is required and acts as the unique primary key.');
      return;
    }

    if (isUnique === false) {
      setError(
        `Invoice number "${invoiceNumber}" is not unique in Financial Year ${
          financialYears.find((f) => f.id === fyId)?.label || fyId
        }. Existing invoice: ${existingInvoiceNumber}.`
      );
      return;
    }

    setSubmitting(true);
    setSubmitProgressText('Creating shipment record & uploading documents...');

    try {
      const formData = new FormData();
      formData.append('financialYearId', fyId);
      formData.append('invoiceNumber', invoiceNumber.trim());
      formData.append('brcUploadMode', brcMode);
      if (remarks.trim()) formData.append('remarks', remarks.trim());

      if (consigneeId) formData.append('consigneeId', consigneeId);
      if (bankId) formData.append('bankId', bankId);
      if (invoiceDate) formData.append('invoiceDate', invoiceDate);
      if (invoiceValueUsd !== '') formData.append('invoiceValueUsd', String(invoiceValueUsd));
      if (shippingBillNumber.trim()) formData.append('shippingBillNumber', shippingBillNumber.trim());
      if (shippingBillDate) formData.append('shippingBillDate', shippingBillDate);
      if (sbExchangeRate) formData.append('sbExchangeRate', String(sbExchangeRate));
      if (fobValueInr !== '') formData.append('fobValueInr', String(fobValueInr));
      if (blNumber.trim()) formData.append('blNumber', blNumber.trim());
      if (blDate) formData.append('blDate', blDate);
      if (vesselName.trim()) formData.append('vesselName', vesselName.trim());
      if (portCode.trim()) formData.append('portCode', portCode.trim());
      if (packageCount !== '') formData.append('packageCount', String(packageCount));

      if (invoiceFile?.file) formData.append('invoiceDoc', invoiceFile.file);
      if (sbFile?.file) formData.append('shippingBillDoc', sbFile.file);
      if (blFile?.file) formData.append('blDoc', blFile.file);
      if (brcFile1?.file) formData.append('brcDoc1', brcFile1.file);
      if (brcMode === 'MULTIPLE' && brcFile2?.file) {
        formData.append('brcDoc2', brcFile2.file);
      }
      if (fircFile?.file) formData.append('fircDoc', fircFile.file);
      if (additionalFile?.file) formData.append('additionalDoc', additionalFile.file);

      setSubmitProgressText('Saving files to vault & syncing ledgers...');
      await api.createShipmentWithDocuments(formData);

      setSuccessToast(true);
      setTimeout(() => {
        resetForm();
        onSuccess();
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err.message || 'Failed to create shipment. Please verify data fields.');
    } finally {
      setSubmitting(false);
      setSubmitProgressText('');
    }
  };

  const attachedFileCount = [
    invoiceFile,
    sbFile,
    blFile,
    brcFile1,
    brcMode === 'MULTIPLE' ? brcFile2 : null,
    fircFile,
    additionalFile,
  ].filter(Boolean).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold">
              <Upload size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">New Export Shipment</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Auto-Extraction Enabled
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Upload up to 7 documents, auto-extract all ledger fields, edit missing values, and record Remarks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start space-x-2.5">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-red-900">Submission Error</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {successToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center space-x-2">
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
              <span className="font-bold">Shipment successfully created and documents registered!</span>
            </div>
          )}

          <SmartBatchDropzone
            batchInputRef={batchInputRef}
            isDragOverBatch={isDragOverBatch}
            setIsDragOverBatch={setIsDragOverBatch}
            onProcessFiles={processBatchFileList}
            attachedFileCount={attachedFileCount}
            isExtracting={isExtracting}
            extractionProgress={extractionProgress}
            onRunExtraction={() => void runBatchExtraction()}
            extractionResult={extractionResult}
          />

          {/* SECTION 1: FINANCIAL YEAR & INVOICE NUMBER */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  1. Financial Year &amp; Primary Identification
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Unique Primary Key</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-600" />
                    Financial Year <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    Default 2026-2027
                  </span>
                </label>
                <select
                  value={fyId}
                  onChange={(e) => setFyId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {financialYears.map((fy) => (
                    <option key={fy.id} value={fy.id}>
                      FY {fy.label} {fy.isCurrent ? '(Current Fiscal Year)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Organizes export trackers, BRC deadlines, and statutory realization.
                </p>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-600" />
                    Invoice No. (Unique, Primary) <span className="text-red-500">*</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSuggestNextInvoice}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                    >
                      Suggest Next #
                    </button>
                    {extractedSources.invoiceNumber ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Extracted from Invoice
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        Primary Key
                      </span>
                    )}
                  </div>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. SKE/26-27/020 (or type number e.g. 271)"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    onBlur={(e) => handleAutoPadInput(e.target.value)}
                    className={`w-full border rounded-lg p-2.5 bg-white text-xs font-bold text-slate-900 tracking-wide focus:outline-hidden focus:ring-2 ${
                      isUnique === false
                        ? 'border-red-400 focus:ring-red-500 bg-red-50/30'
                        : isUnique === true
                        ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/20'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                  {isCheckingUnique && (
                    <span className="absolute right-3 top-2.5 text-[11px] text-slate-400 animate-pulse">
                      Checking...
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center justify-between text-[11px]">
                  {normalizedKey ? (
                    <span className="font-mono text-slate-500">
                      Key: <strong className="text-slate-700">{normalizedKey}</strong>
                    </span>
                  ) : (
                    <span className="text-slate-400">Unique identifier across fiscal year</span>
                  )}

                  {isUnique === true && (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <Check size={12} className="text-emerald-600" />
                      Unique in this FY
                    </span>
                  )}
                  {isUnique === false && (
                    <span className="text-red-700 font-bold flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                      <AlertCircle size={12} className="text-red-600" />
                      Duplicate: already exists ({existingInvoiceNumber})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: DOCUMENT VAULT UPLOAD (UP TO 7 FILES) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  2. Document Vault Upload (Up to 7 Individual Slots)
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {attachedFileCount} of 7 slots attached
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <DocumentUploadCard
                title="Commercial Invoice"
                badgeText="Slot 1"
                categoryBadge="Invoice & Line Items"
                icon={<FileText size={18} className="text-blue-600" />}
                accentColor="blue"
                selectedFile={invoiceFile}
                onSelectClick={() => invoiceInputRef.current?.click()}
                onRemove={() => setInvoiceFile(null)}
                subtitle="Exports Invoice No, USD Value, Packages"
              />
              <input
                ref={invoiceInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileSelect(e, setInvoiceFile, 'INVOICE')}
              />

              <DocumentUploadCard
                title="Shipping Bill"
                badgeText="Slot 2"
                categoryBadge="Customs SB Document"
                icon={<FileSpreadsheet size={18} className="text-indigo-600" />}
                accentColor="indigo"
                selectedFile={sbFile}
                onSelectClick={() => sbInputRef.current?.click()}
                onRemove={() => setSbFile(null)}
                subtitle="Customs SB No, Date, CBIC Rate, FOB INR"
              />
              <input
                ref={sbInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileSelect(e, setSbFile, 'SB')}
              />

              <DocumentUploadCard
                title="Bill of Lading"
                badgeText="Slot 3"
                categoryBadge="Carrier / MTD Document"
                icon={<Ship size={18} className="text-cyan-600" />}
                accentColor="cyan"
                selectedFile={blFile}
                onSelectClick={() => blInputRef.current?.click()}
                onRemove={() => setBlFile(null)}
                subtitle="Carrier BL No, Date, Vessel, Container"
              />
              <input
                ref={blInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileSelect(e, setBlFile, 'BL')}
              />

              <BrcUploadSlotCard
                brcMode={brcMode}
                onChangeMode={(mode) => {
                  setBrcMode(mode);
                  if (mode === 'SINGLE') setBrcFile2(null);
                }}
                brcFile1={brcFile1}
                brcFile2={brcFile2}
                onSelectSlot1={() => brc1InputRef.current?.click()}
                onRemoveSlot1={() => setBrcFile1(null)}
                onSelectSlot2={() => brc2InputRef.current?.click()}
                onRemoveSlot2={() => setBrcFile2(null)}
              />
              <input
                ref={brc1InputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileSelect(e, setBrcFile1, 'BRC1')}
              />
              <input
                ref={brc2InputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileSelect(e, setBrcFile2, 'BRC2')}
              />

              <DocumentUploadCard
                title="FIRC / Payment Receipt"
                badgeText="Slot 6"
                categoryBadge="Inward Remittance Advice"
                icon={<DollarSign size={18} className="text-emerald-600" />}
                accentColor="emerald"
                selectedFile={fircFile}
                onSelectClick={() => fircInputRef.current?.click()}
                onRemove={() => setFircFile(null)}
                subtitle="Foreign Inward Remittance Certificate / IRM"
              />
              <input
                ref={fircInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileSelect(e, setFircFile, 'FIRC')}
              />

              <DocumentUploadCard
                title="Additional Documents"
                badgeText="Slot 7"
                categoryBadge="Supplementary"
                icon={<FilePlus size={18} className="text-purple-600" />}
                accentColor="purple"
                selectedFile={additionalFile}
                onSelectClick={() => additionalInputRef.current?.click()}
                onRemove={() => setAdditionalFile(null)}
                subtitle="Packing list, Certificate of Origin, Test Report"
                optional={true}
              />
              <input
                ref={additionalInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileSelect(e, setAdditionalFile, 'ADDITIONAL')}
              />
            </div>
          </div>

          {/* SECTION 3: TEXT REMARKS */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Info size={14} className="text-blue-600" />
                3. Text Remarks <span className="text-slate-400 text-[11px] font-normal">(Synced across all views &amp; exports)</span>
              </label>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                Exported to Invoice Lookup &amp; Ledgers
              </span>
            </div>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter custom remarks, special buyer terms, container numbers, LC references, or statutory notes..."
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* SECTION 4: COMMERCIAL DETAILS */}
          <CommercialDetailsSection
            showOptionalDetails={showOptionalDetails}
            onToggle={() => setShowOptionalDetails(!showOptionalDetails)}
            consignees={consignees}
            banks={banks}
            extractedSources={extractedSources}
            consigneeId={consigneeId}
            setConsigneeId={setConsigneeId}
            bankId={bankId}
            setBankId={setBankId}
            invoiceDate={invoiceDate}
            setInvoiceDate={setInvoiceDate}
            invoiceValueUsd={invoiceValueUsd}
            setInvoiceValueUsd={setInvoiceValueUsd}
            packageCount={packageCount}
            setPackageCount={setPackageCount}
            shippingBillNumber={shippingBillNumber}
            setShippingBillNumber={setShippingBillNumber}
            shippingBillDate={shippingBillDate}
            setShippingBillDate={setShippingBillDate}
            sbExchangeRate={sbExchangeRate}
            setSbExchangeRate={setSbExchangeRate}
            fobValueInr={fobValueInr}
            setFobValueInr={setFobValueInr}
            blNumber={blNumber}
            setBlNumber={setBlNumber}
            blDate={blDate}
            setBlDate={setBlDate}
            vesselName={vesselName}
            setVesselName={setVesselName}
            portCode={portCode}
            setPortCode={setPortCode}
          />

          {/* Modal Footer Controls */}
          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                Ready to commit: <strong>{attachedFileCount}</strong> document{attachedFileCount === 1 ? '' : 's'} attached
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleClearForm}
                disabled={submitting}
                className="px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Clear Form
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 sm:flex-initial px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || isUnique === false || !invoiceNumber.trim()}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{submitProgressText || 'Saving Shipment & Files...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Create Shipment &amp; Sync Ledgers</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
