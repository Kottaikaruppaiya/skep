/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlertTriangle, Trash2, Archive, X, Loader2, AlertCircle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  entityName?: string;
  itemName?: string;
  entityType?: string;
  itemType?: string;
  message?: string;
  confirmText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  showArchiveOption?: boolean;
  isArchiveOnly?: boolean;
  onArchive?: () => Promise<void> | void;
  onArchiveAlternative?: () => Promise<void> | void;
  archiveText?: string;
  error?: string | null;
  errorMessage?: string | null;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  entityName,
  itemName,
  entityType,
  itemType,
  message,
  confirmText = 'Delete Permanently',
  confirmVariant = 'danger',
  showArchiveOption = false,
  isArchiveOnly = false,
  onArchive,
  onArchiveAlternative,
  archiveText = 'Archive Safely Instead',
  error: externalError,
  errorMessage,
  isLoading = false,
}) => {
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetName = itemName || entityName || 'Selected Item';
  const targetType = itemType || entityType || 'record';
  const closeFn = onCancel || onClose || (() => {});
  const displayError = errorMessage || externalError || internalError;
  const isSubmitting = isLoading || internalSubmitting;
  const actualArchiveFn = onArchiveAlternative || onArchive;
  const actualShowArchive = showArchiveOption || Boolean(actualArchiveFn);

  const handleConfirmAction = async () => {
    setInternalError(null);
    setInternalSubmitting(true);
    try {
      await onConfirm();
      closeFn();
    } catch (err: any) {
      setInternalError(err.message || 'Operation failed.');
    } finally {
      setInternalSubmitting(false);
    }
  };

  const handleArchiveAction = async () => {
    if (!actualArchiveFn) return;
    setInternalError(null);
    setInternalSubmitting(true);
    try {
      await actualArchiveFn();
      closeFn();
    } catch (err: any) {
      setInternalError(err.message || 'Archival failed.');
    } finally {
      setInternalSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                confirmVariant === 'danger'
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-amber-100 text-amber-600'
              }`}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 id="confirm-modal-title" className="font-bold text-slate-900 text-sm">
                {title}
              </h3>
              <p className="text-[11px] text-slate-400">
                Confirm action on {targetType}
              </p>
            </div>
          </div>
          <button
            onClick={closeFn}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5 text-xs">
          {/* Target Entity Box */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Target {targetType}
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm block break-all">
              {targetName}
            </span>
          </div>

          <p className="text-slate-600 leading-relaxed">
            {message ||
              `Are you sure you want to perform this operation? This will permanently affect database records and dependent calculations.`}
          </p>

          {/* Error Message if blocked or failed */}
          {displayError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-xs text-rose-900">
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>Action Blocked by Business Logic</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-800 pl-5">
                {displayError}
              </p>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={closeFn}
            disabled={isSubmitting}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {actualShowArchive && actualArchiveFn && (
            <button
              type="button"
              onClick={handleArchiveAction}
              disabled={isSubmitting}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Archive size={14} />
              <span>{archiveText}</span>
            </button>
          )}

          {!isArchiveOnly && (
            <button
              type="button"
              onClick={handleConfirmAction}
              disabled={isSubmitting}
              className={`px-4 py-2 font-bold text-white rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                confirmVariant === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300'
                  : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {confirmVariant === 'danger' && <Trash2 size={14} />}
                  <span>{confirmText}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
