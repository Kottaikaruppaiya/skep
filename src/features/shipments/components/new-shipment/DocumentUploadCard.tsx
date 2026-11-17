/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Upload, Trash2, Check } from 'lucide-react';
import type { SelectedFileItem } from './types.ts';

export interface DocumentUploadCardProps {
  title: string;
  badgeText: string;
  categoryBadge: string;
  icon: React.ReactNode;
  accentColor: 'blue' | 'indigo' | 'cyan' | 'amber' | 'emerald' | 'purple';
  selectedFile: SelectedFileItem | null;
  onSelectClick: () => void;
  onRemove: () => void;
  subtitle: string;
  optional?: boolean;
}

const COLOR_MAP: Record<DocumentUploadCardProps['accentColor'], string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
};

export const DocumentUploadCard: React.FC<DocumentUploadCardProps> = ({
  title,
  badgeText,
  categoryBadge,
  icon,
  accentColor,
  selectedFile,
  onSelectClick,
  onRemove,
  subtitle,
  optional = false,
}) => {
  return (
    <div
      className={`border rounded-xl p-3.5 bg-white shadow-xs flex flex-col justify-between transition-all ${
        selectedFile
          ? 'border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/10'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${COLOR_MAP[accentColor]}`}>
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-slate-800">{title}</h4>
                {optional && (
                  <span className="text-[10px] text-slate-400 font-normal">(opt)</span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block">{categoryBadge}</span>
            </div>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              optional ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            {badgeText}
          </span>
        </div>

        <div className="my-2 min-h-[72px] flex flex-col justify-center">
          {selectedFile ? (
            <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-bold text-slate-800 truncate block text-[11px]">
                  {selectedFile.name}
                </span>
                <span className="text-[10px] text-emerald-700 font-medium block truncate">
                  {selectedFile.size} • Ready to upload
                </span>
              </div>
              <button
                type="button"
                onClick={onRemove}
                className="w-7 h-7 flex items-center justify-center shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Remove file"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSelectClick}
              className="w-full h-full border border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-3 text-center cursor-pointer transition-colors bg-slate-50/60 hover:bg-blue-50/50 group flex flex-col items-center justify-center"
            >
              <Upload size={16} className="text-slate-400 group-hover:text-blue-600 mb-1 transition-colors" />
              <span className="text-[11px] font-semibold text-slate-700 group-hover:text-blue-700 block">
                Choose or Drop File
              </span>
              <span className="text-[10px] text-slate-400">PDF, JPG, PNG (Max 25MB)</span>
            </button>
          )}
        </div>
      </div>

      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-between">
        <span className="truncate">{subtitle}</span>
        {selectedFile && (
          <span className="text-emerald-600 font-bold flex items-center gap-0.5 text-[10px] shrink-0 ml-1">
            <Check size={11} /> Attached
          </span>
        )}
      </div>
    </div>
  );
};
