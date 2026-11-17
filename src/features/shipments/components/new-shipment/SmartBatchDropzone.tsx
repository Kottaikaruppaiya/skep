/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Zap, FolderOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import type { ExtractionResultSummary } from './types.ts';

interface SmartBatchDropzoneProps {
  batchInputRef: React.RefObject<HTMLInputElement | null>;
  isDragOverBatch: boolean;
  setIsDragOverBatch: (val: boolean) => void;
  onProcessFiles: (files: FileList | File[]) => void;
  attachedFileCount: number;
  isExtracting: boolean;
  extractionProgress: string;
  onRunExtraction: () => void;
  extractionResult: ExtractionResultSummary | null;
}

export const SmartBatchDropzone: React.FC<SmartBatchDropzoneProps> = ({
  batchInputRef,
  isDragOverBatch,
  setIsDragOverBatch,
  onProcessFiles,
  attachedFileCount,
  isExtracting,
  extractionProgress,
  onRunExtraction,
  extractionResult,
}) => {
  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOverBatch(true);
        }}
        onDragLeave={() => setIsDragOverBatch(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOverBatch(false);
          if (e.dataTransfer.files) {
            onProcessFiles(e.dataTransfer.files);
          }
        }}
        className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
          isDragOverBatch
            ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
            : 'border-slate-300 bg-gradient-to-b from-slate-50 to-white hover:border-blue-400'
        }`}
      >
        <input
          ref={batchInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              onProcessFiles(e.target.files);
            }
          }}
        />
        <div className="max-w-xl mx-auto flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2.5 shadow-xs">
            <Zap size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Drop Up to 7 Export Documents Here for Complete Auto-Extraction
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-3">
            Drop Invoice, Shipping Bill, BL, FIRC, BRC 1, BRC 2, &amp; Additional documents simultaneously. The system extracts all fields with zero data loss.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => batchInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FolderOpen size={14} /> Select Multiple Files (Up to 7)
            </button>
            {attachedFileCount > 0 && (
              <button
                type="button"
                disabled={isExtracting}
                onClick={onRunExtraction}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isExtracting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{extractionProgress || 'Extracting Data...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Auto-Extract from Staged Files ({attachedFileCount})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {extractionResult && (
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span className="font-bold text-emerald-950">
                Auto-Extraction Complete: {extractionResult.fieldsExtracted} fields pre-filled from {extractionResult.docCount} documents
              </span>
            </div>
            {extractionResult.missingFields.length === 0 ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px] border border-emerald-300">
                100% Extracted • 0 Missing Fields
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px] border border-amber-300">
                {extractionResult.missingFields.length} Field(s) Require User Input
              </span>
            )}
          </div>

          {extractionResult.missingFields.length > 0 && (
            <div className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
              <strong>Notice:</strong> Some documents did not contain:{' '}
              {extractionResult.missingFields.join(', ')}. You can easily type these details into the editable form fields below!
            </div>
          )}
        </div>
      )}
    </>
  );
};
