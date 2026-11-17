/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Trash2,
  RefreshCw,
  UploadCloud,
  Check,
  Clock,
  RotateCw,
  Send,
  Sliders,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { DocumentRecord, Role, ReviewStatus, OcrJob, DocumentCategory, FinancialYear, BankMaster, Payment } from '../types/index.ts';
import { api } from '../api/client.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';

interface DocumentReviewViewProps {
  userRole: Role;
  selectedFyId?: string;
  financialYears?: FinancialYear[];
  banks?: BankMaster[];
  onSelectShipment: (id: string) => void;
  refreshKey?: number;
}

export const DocumentReviewView: React.FC<DocumentReviewViewProps> = ({
  userRole,
  selectedFyId,
  financialYears = [],
  banks = [],
  onSelectShipment,
  refreshKey,
}) => {
  const [activeTab, setActiveTab] = useState<'vault' | 'ocr_queue'>('ocr_queue');

  // Vault state
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fyList, setFyList] = useState<FinancialYear[]>(financialYears);
  const [bankList, setBankList] = useState<BankMaster[]>(banks);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<DocumentRecord | null>(null);

  // OCR Queue state
  const [ocrJobs, setOcrJobs] = useState<OcrJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState<OcrJob | null>(null);
  const [concurrency, setConcurrency] = useState<{ activeJobs: number; maxConcurrency: number }>({
    activeJobs: 0,
    maxConcurrency: 2,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [queueCategory, setQueueCategory] = useState<DocumentCategory>('COMMERCIAL_INVOICE');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Editable candidate fields draft for approval
  const [reviewedDraft, setReviewedDraft] = useState<Record<string, any>>({});

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await api.request<DocumentRecord[]>('/documents');
      setDocuments(data);
      if (data.length > 0) {
        if (!selectedDoc || !data.some((d) => d.id === selectedDoc.id)) {
          setSelectedDoc(data[0]);
        }
      } else {
        setSelectedDoc(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadOcrJobs = async () => {
    try {
      const res = await api.getOcrJobs();
      setOcrJobs(res.jobs);
      setConcurrency(res.concurrency);

      if (res.jobs.length > 0) {
        if (!selectedJob || !res.jobs.some((j) => j.id === selectedJob.id)) {
          selectJob(res.jobs[0]);
        } else {
          const fresh = res.jobs.find((j) => j.id === selectedJob.id);
          if (fresh && fresh.status !== selectedJob.status) {
            selectJob(fresh);
          }
        }
      } else {
        setSelectedJob(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectJob = (job: OcrJob) => {
    setSelectedJob(job);
    setCommitMessage(null);
    // Initialize editable candidate values from candidateDraft or candidateFields
    const draft: Record<string, any> = {};
    if (job.candidateDraft) {
      Object.assign(draft, job.candidateDraft);
    }
    if (job.candidateFields) {
      for (const [key, item] of Object.entries(job.candidateFields)) {
        if (item.value !== null && item.value !== undefined && draft[key] === undefined) {
          draft[key] = item.value;
        }
      }
    }
    setReviewedDraft(draft);
  };

  useEffect(() => {
    setFyList(financialYears);
  }, [financialYears]);

  useEffect(() => {
    setBankList(banks);
  }, [banks]);

  useEffect(() => {
    loadDocs();
    loadOcrJobs();
    api.getPayments().then(setPayments).catch(() => {});
    if (financialYears.length === 0) {
      api.getFinancialYears().then(setFyList).catch(() => {});
    }
    if (banks.length === 0) {
      api.getBanks().then(setBankList).catch(() => {});
    }
  }, [refreshKey]);

  // Polling for live status updates on OCR queue
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'ocr_queue') {
      interval = setInterval(() => {
        loadOcrJobs();
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeTab, selectedJob?.id]);

  const handleUpdateReviewStatus = async (id: string, status: ReviewStatus) => {
    setActionError(null);
    try {
      const updated = await api.reviewDocument(id, status);
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
      if (selectedDoc?.id === id) setSelectedDoc(updated);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update review status');
    }
  };

  const handleConfirmDeleteDocument = async () => {
    if (!deleteConfirmDoc) return;
    setDeletingId(deleteConfirmDoc.id);
    setActionError(null);
    try {
      await api.deleteDocument(deleteConfirmDoc.id);
      setDeleteConfirmDoc(null);
      await loadDocs();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete document');
      throw err;
    } finally {
      setDeletingId(null);
    }
  };

  const handleQueueUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setCommitMessage(null);
    setActionError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', queueCategory);
      const effectiveFyId =
        (selectedFyId && selectedFyId !== 'ALL' ? selectedFyId : '') ||
        fyList.find((f) => f.isCurrent)?.id ||
        fyList[0]?.id ||
        '';
      if (effectiveFyId) {
        fd.append('financialYearId', effectiveFyId);
      }

      const res = await api.queueOcrJob(fd);
      await loadOcrJobs();
      if (res.job) selectJob(res.job);
    } catch (err: any) {
      setActionError(err.message || 'Failed to queue document for OCR.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setActionError(null);
    try {
      const updated = await api.retryOcrJob(jobId);
      selectJob(updated);
      await loadOcrJobs();
    } catch (err: any) {
      setActionError(err.message || 'Retry failed.');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    setActionError(null);
    try {
      await api.deleteOcrJob(jobId);
      await loadOcrJobs();
    } catch (err: any) {
      setActionError(err.message || 'Delete job failed.');
    }
  };

  const handleApproveAndCommit = async () => {
    if (!selectedJob) return;
    setIsCommitting(true);
    setCommitMessage(null);
    setActionError(null);
    try {
      const res = await api.approveOcrJob(selectedJob.id, reviewedDraft);
      setCommitMessage(res.message || 'Approved and committed into PostgreSQL records!');
      await loadOcrJobs();
      await loadDocs();
      if (res.job) selectJob(res.job);
    } catch (err: any) {
      setActionError(err.message || 'Approval failed.');
    } finally {
      setIsCommitting(false);
    }
  };

  const isViewer = userRole === 'VIEWER';

  return (
    <div className="space-y-6">
      {/* View Header with Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu size={20} className="text-blue-600" />
            <span>Server-Side Local OCR &amp; Document Review Pipeline</span>
          </h2>
          <p className="text-xs text-slate-500">
            100% self-hosted on Ubuntu VPS • Tesseract OCR, PyMuPDF, OpenCV &amp; Poppler • Zero External Cloud APIs
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('ocr_queue')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'ocr_queue'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu size={14} />
            <span>Asynchronous OCR Queue</span>
            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] rounded-full">
              {ocrJobs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'vault'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={14} />
            <span>Document Vault</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] rounded-full">
              {documents.length}
            </span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="font-bold px-1.5 text-red-600 hover:text-red-900">×</button>
        </div>
      )}

      {/* TAB 1: ASYNCHRONOUS OCR QUEUE & STAGING */}
      {activeTab === 'ocr_queue' && (
        <div className="space-y-6">
          {/* VPS Worker Concurrency Status & Upload Bar */}
          <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Cpu size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">Ubuntu VPS Background Worker</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active Concurrency: {concurrency.activeJobs} / {concurrency.maxConcurrency}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Processes documents asynchronously without blocking Express HTTP lifecycle. Staged in private storage.
                </p>
              </div>
            </div>

            {/* Quick Upload Form */}
            {!isViewer && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={queueCategory}
                  onChange={(e) => setQueueCategory(e.target.value as DocumentCategory)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-2 font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value="COMMERCIAL_INVOICE">Commercial Invoice</option>
                  <option value="SHIPPING_BILL">Shipping Bill</option>
                  <option value="BILL_OF_LADING">Bill of Lading</option>
                  <option value="FIRC_PAYMENT">FIRC Payment</option>
                  <option value="BRC_COPY_1">BRC Copy</option>
                  <option value="ADDITIONAL_DOC">Additional Doc</option>
                </select>

                <label className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-2xs whitespace-nowrap">
                  <UploadCloud size={15} />
                  <span>{isUploading ? 'Queuing on VPS...' : 'Queue Document'}</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.tiff"
                    onChange={handleQueueUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Master-Detail Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Queue List (5 Cols) */}
            <div className="col-span-1 lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col h-[380px] lg:h-[700px]">
              <div className="p-3 bg-slate-900 text-white text-xs font-bold flex items-center justify-between">
                <span>OCR Job Queue ({ocrJobs.length})</span>
                <button
                  onClick={loadOcrJobs}
                  className="text-slate-300 hover:text-white p-1 transition-colors"
                  title="Refresh Queue"
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
                {ocrJobs.length === 0 && (
                  <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                    <Clock size={24} className="mx-auto text-slate-300" />
                    <div>No documents currently in OCR processing queue.</div>
                    <p className="text-[11px] text-slate-400">Queue a document above to test asynchronous VPS extraction.</p>
                  </div>
                )}

                {ocrJobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  const isCompleted = job.status === 'COMPLETED';
                  const isProcessing = job.status === 'PROCESSING';
                  const isFailed = job.status === 'FAILED';

                  return (
                    <div
                      key={job.id}
                      onClick={() => selectJob(job)}
                      className={`p-3.5 cursor-pointer transition-colors text-xs space-y-1.5 ${
                        isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{job.category.replace(/_/g, ' ')}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isProcessing
                              ? 'bg-blue-100 text-blue-800 border border-blue-200 animate-pulse'
                              : isFailed
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isProcessing && <RotateCw size={10} className="animate-spin" />}
                          {job.status}
                        </span>
                      </div>

                      <div className="font-mono text-[11px] text-slate-600 truncate">{job.originalFilename}</div>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>Attempts: {job.attempts}/{job.maxAttempts}</span>
                        {job.executionTimeMs && <span>{job.executionTimeMs}ms</span>}
                        {job.approvedAt && (
                          <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                            <Check size={10} /> Committed
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Candidate Review & Staging Pane (7 Cols) */}
            <div className="col-span-1 lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col min-h-[500px] lg:h-[700px] overflow-y-auto space-y-4">
              {selectedJob ? (
                <>
                  {/* Job Header & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-100 pb-3 gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase">
                          {selectedJob.category.replace(/_/g, ' ')}
                        </span>
                        {selectedJob.ocrApplied ? (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded border border-purple-200">
                            Native OCR ({selectedJob.ocrConfidence || 85}%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded border border-emerald-200">
                            Digital Vector PDF
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 mt-1 truncate">{selectedJob.originalFilename}</h3>
                      <p className="text-[11px] font-mono text-slate-400">Job ID: {selectedJob.id}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedJob.status === 'FAILED' && !isViewer && (
                        <button
                          onClick={() => handleRetryJob(selectedJob.id)}
                          className="h-8 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <RotateCw size={13} />
                          <span>Retry</span>
                        </button>
                      )}

                      {!isViewer && (
                        <button
                          onClick={() => handleDeleteJob(selectedJob.id)}
                          className="h-8 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Trash2 size={13} />
                          <span>Dismiss</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {commitMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 font-medium">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>{commitMessage}</span>
                    </div>
                  )}

                  {/* Processing / Pending state banner */}
                  {selectedJob.status === 'PROCESSING' && (
                    <div className="p-6 text-center space-y-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <RotateCw size={28} className="mx-auto text-blue-600 animate-spin" />
                      <div className="font-bold text-xs text-blue-900">
                        Document is being processed by the Ubuntu VPS OCR service...
                      </div>
                      <p className="text-[11px] text-blue-700 max-w-sm mx-auto">
                        Executing PyMuPDF digital check and OpenCV + Tesseract OCR on scanned pages.
                      </p>
                    </div>
                  )}

                  {selectedJob.status === 'PENDING' && (
                    <div className="p-6 text-center space-y-2 bg-amber-50 border border-amber-100 rounded-xl">
                      <Clock size={28} className="mx-auto text-amber-600 animate-pulse" />
                      <div className="font-bold text-xs text-amber-900">Queued in Background Pipeline</div>
                      <p className="text-[11px] text-amber-700">
                        Waiting for available concurrency worker slot. Execution will begin automatically.
                      </p>
                    </div>
                  )}

                  {selectedJob.status === 'FAILED' && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs space-y-2">
                      <div className="font-bold text-red-900 flex items-center gap-1.5">
                        <AlertTriangle size={15} />
                        <span>OCR Extraction Failed</span>
                      </div>
                      <p className="text-red-700 font-mono text-[11px]">{selectedJob.error || 'Unknown error occurred.'}</p>
                    </div>
                  )}

                  {/* Candidate Fields & Review Form */}
                  {selectedJob.status === 'COMPLETED' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Sliders size={14} className="text-blue-600" />
                          <span>Candidate Extracted Fields (Review &amp; Edit Before Commit)</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Execution: {selectedJob.executionTimeMs}ms • Staged Separately
                        </span>
                      </div>

                      {/* Editable form fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Invoice Number
                          </label>
                          <input
                            type="text"
                            value={reviewedDraft.invoiceNumber || ''}
                            onChange={(e) => setReviewedDraft({ ...reviewedDraft, invoiceNumber: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g. SKE/26-27/020"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Invoice Date
                          </label>
                          <input
                            type="date"
                            value={reviewedDraft.invoiceDate || ''}
                            onChange={(e) => setReviewedDraft({ ...reviewedDraft, invoiceDate: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Invoice Value (USD)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={reviewedDraft.invoiceValueUsd ?? ''}
                            onChange={(e) => setReviewedDraft({ ...reviewedDraft, invoiceValueUsd: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Consignee / Buyer
                          </label>
                          <input
                            type="text"
                            value={reviewedDraft.consigneeName || ''}
                            onChange={(e) => setReviewedDraft({ ...reviewedDraft, consigneeName: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g. S K Global Ventures"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Shipping Bill Number
                          </label>
                          <input
                            type="text"
                            value={reviewedDraft.shippingBillNumber || ''}
                            onChange={(e) => setReviewedDraft({ ...reviewedDraft, shippingBillNumber: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
                            placeholder="7-digit SB No"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Shipping Bill Date
                          </label>
                          <input
                            type="date"
                            value={reviewedDraft.shippingBillDate || ''}
                            onChange={(e) => setReviewedDraft({ ...reviewedDraft, shippingBillDate: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Customs Exchange Rate
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={reviewedDraft.sbExchangeRate ?? ''}
                            onChange={(e) => setReviewedDraft({ ...reviewedDraft, sbExchangeRate: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g. 85.50"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            FOB Value (INR)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={reviewedDraft.fobValueInr ?? ''}
                            onChange={(e) => setReviewedDraft({ ...reviewedDraft, fobValueInr: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500"
                            placeholder="FOB INR"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Bill of Lading / MTD No
                          </label>
                          <input
                            type="text"
                            value={reviewedDraft.blNumber || ''}
                            onChange={(e) => setReviewedDraft({ ...reviewedDraft, blNumber: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g. 736116000605"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Link Existing FIRC Payment (Optional if creating below)
                          </label>
                          <select
                            value={reviewedDraft.initialFircPaymentId || ''}
                            onChange={(e) =>
                              setReviewedDraft({
                                ...reviewedDraft,
                                initialFircPaymentId: e.target.value || undefined,
                              })
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- Create / Match by IRM Number Below --</option>
                            {payments.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.irmNumber} — Avail: ${(p.availableBalanceUsd ?? p.verifiedAmount).toLocaleString()} ({p.bankName || 'Bank'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            FIRC / IRM Number *
                          </label>
                          <input
                            type="text"
                            value={reviewedDraft.irmNumber || reviewedDraft.fircIrmNumber || ''}
                            onChange={(e) =>
                              setReviewedDraft({
                                ...reviewedDraft,
                                irmNumber: e.target.value,
                                fircIrmNumber: e.target.value,
                              })
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
                            placeholder="Inward Remittance No"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            FIRC Verified Amount (USD)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={reviewedDraft.fircAmountUsd ?? reviewedDraft.verifiedAmount ?? ''}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              setReviewedDraft({
                                ...reviewedDraft,
                                fircAmountUsd: Number.isFinite(v) ? v : undefined,
                                verifiedAmount: Number.isFinite(v) ? v : undefined,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g. 25000.00"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            FIRC Authorised Dealer Bank
                          </label>
                          <select
                            value={reviewedDraft.fircBankId || reviewedDraft.bankId || ''}
                            onChange={(e) =>
                              setReviewedDraft({
                                ...reviewedDraft,
                                fircBankId: e.target.value || undefined,
                                bankId: e.target.value || undefined,
                              })
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- Select AD Bank --</option>
                            {bankList.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} ({b.adCode})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            FIRC Realised FX Rate (Optional)
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={reviewedDraft.fircExchangeRate ?? reviewedDraft.exchangeRate ?? ''}
                            onChange={(e) => {
                              const r = parseFloat(e.target.value);
                              setReviewedDraft({
                                ...reviewedDraft,
                                fircExchangeRate: Number.isFinite(r) ? r : undefined,
                                exchangeRate: Number.isFinite(r) ? r : undefined,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g. 85.40"
                          />
                        </div>
                      </div>

                      {/* Approval CTA */}
                      {!isViewer && (
                        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg">
                          <div>
                            <div className="font-bold text-xs text-slate-800">
                              Ready to Commit Candidate Data?
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Commits the approved values into PostgreSQL and updates all related ledgers.
                            </p>
                          </div>

                          <button
                            onClick={handleApproveAndCommit}
                            disabled={isCommitting}
                            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50"
                          >
                            <ShieldCheck size={15} />
                            <span>{isCommitting ? 'Committing...' : 'Approve & Commit to Ledger'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="m-auto text-center text-xs text-slate-400 space-y-2">
                  <Cpu size={28} className="mx-auto text-slate-300" />
                  <div>Select a job from the queue to review candidate fields.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOCUMENT VAULT (PRESERVED VIEW) */}
      {activeTab === 'vault' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Document List (5 Cols) */}
          <div className="col-span-1 lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col h-[320px] lg:h-[700px]">
            <div className="p-3 bg-slate-900 text-white text-xs font-bold flex items-center justify-between">
              <span>Uploaded Export Documents ({documents.length})</span>
              <span className="text-[10px] text-slate-400">Private Server Storage</span>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {loading && (
                <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                  Loading document archive...
                </div>
              )}

              {!loading && documents.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  No documents uploaded yet.
                </div>
              )}

              {documents.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`p-3 cursor-pointer transition-colors text-xs space-y-1 ${
                      isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{doc.category.replace(/_/g, ' ')}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          doc.reviewStatus === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {doc.reviewStatus}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 truncate">{doc.originalFilename}</div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Uploaded by {doc.uploadedByName}</span>
                      <span>v{doc.version}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side-by-Side Review & Extracted Metadata Pane (7 Cols) */}
          <div className="col-span-1 lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col min-h-[500px] lg:h-[700px] overflow-y-auto space-y-4">
            {selectedDoc ? (
              <>
                {/* Document Header & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-100 pb-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase">
                        {selectedDoc.category.replace(/_/g, ' ')}
                      </span>
                      {selectedDoc.ocrApplied ? (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded flex items-center gap-1 border border-purple-200">
                          Native Local OCR ({selectedDoc.ocrConfidence || 85}%)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded border border-emerald-200">
                          Digital Vector PDF
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 mt-1 truncate">{selectedDoc.originalFilename}</h3>
                    <p className="text-[11px] font-mono text-slate-400 truncate">Path: {selectedDoc.storedPath}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void api.downloadDocument(selectedDoc.id, selectedDoc.originalFilename)}
                      className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </button>

                    {selectedDoc.shipmentId && (
                      <button
                        onClick={() => onSelectShipment(selectedDoc.shipmentId!)}
                        className="h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center justify-center transition-colors"
                      >
                        View Shipment
                      </button>
                    )}

                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmDoc(selectedDoc)}
                        disabled={deletingId === selectedDoc.id}
                        className="h-8 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        title="Permanently delete document"
                      >
                        <Trash2 size={13} />
                        <span>{deletingId === selectedDoc.id ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Review Status Selector */}
                {!isViewer && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                    <span className="font-semibold text-slate-700">Admin Review Decision:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['CONFIRMED', 'NEEDS_REVIEW', 'MANUALLY_ENTERED'] as ReviewStatus[]).map((st) => (
                        <button
                          key={st}
                          onClick={() => handleUpdateReviewStatus(selectedDoc.id, st)}
                          className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-colors inline-flex items-center justify-center ${
                            selectedDoc.reviewStatus === st
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Fields Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Locally Extracted Structured Fields &amp; Provenance
                    </h4>
                    <span className="text-[10px] text-slate-400">Zero External AI • Local Regex &amp; OCR</span>
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Field</th>
                          <th className="p-2.5">Extracted Value</th>
                          <th className="p-2.5">Confidence</th>
                          <th className="p-2.5">Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedDoc.extractedData?.fields &&
                          Object.entries(selectedDoc.extractedData.fields).map(([k, v]: [string, any]) => (
                            <tr key={k}>
                              <td className="p-2.5 font-medium text-slate-700">{k}</td>
                              <td className="p-2.5 font-bold text-slate-900 font-mono">
                                {v.value !== null ? String(v.value) : <span className="text-slate-400 font-normal">Not detected</span>}
                              </td>
                              <td className="p-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    v.confidence === 'HIGH'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : v.confidence === 'MEDIUM'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {v.confidence}
                                </span>
                              </td>
                              <td className="p-2.5 text-[11px] text-slate-500">
                                {v.extractionMethod || (selectedDoc.ocrApplied ? 'LOCAL_OCR' : 'PDF_TEXT')}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Raw Snippets */}
                {selectedDoc.extractedData?.snippets && selectedDoc.extractedData.snippets.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Source Text Snippets
                    </h4>
                    <div className="p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded-lg space-y-1 overflow-x-auto">
                      {selectedDoc.extractedData.snippets.map((snip: string, i: number) => (
                        <div key={i}>{snip}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="m-auto text-center text-xs text-slate-400">
                Select a document from the vault to inspect extracted fields.
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(deleteConfirmDoc)}
        title="Delete Export Document"
        itemName={deleteConfirmDoc?.originalFilename || ''}
        itemType="Uploaded Document"
        message={`Are you sure you want to permanently delete "${deleteConfirmDoc?.originalFilename || ''}"? Realised BRC documents cannot be deleted if they would violate BRC count requirements.`}
        isLoading={Boolean(deleteConfirmDoc && deletingId === deleteConfirmDoc.id)}
        onConfirm={handleConfirmDeleteDocument}
        onCancel={() => setDeleteConfirmDoc(null)}
      />
    </div>
  );
};
