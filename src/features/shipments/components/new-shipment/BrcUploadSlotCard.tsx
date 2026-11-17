/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Award, Upload, Trash2 } from 'lucide-react';
import type { BrcMode, SelectedFileItem } from './types.ts';

interface BrcUploadSlotCardProps {
  brcMode: BrcMode;
  onChangeMode: (mode: BrcMode) => void;
  brcFile1: SelectedFileItem | null;
  brcFile2: SelectedFileItem | null;
  onSelectSlot1: () => void;
  onRemoveSlot1: () => void;
  onSelectSlot2: () => void;
  onRemoveSlot2: () => void;
}

export const BrcUploadSlotCard: React.FC<BrcUploadSlotCardProps> = ({
  brcMode,
  onChangeMode,
  brcFile1,
  brcFile2,
  onSelectSlot1,
  onRemoveSlot1,
  onSelectSlot2,
  onRemoveSlot2,
}) => {
  return (
    <div className="border border-slate-200 rounded-xl p-3.5 bg-white shadow-xs flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">BRC Copy</h4>
              <span className="text-[10px] text-slate-400">eBRC Realisation Record</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-100 p-1 rounded-lg grid grid-cols-2 gap-1 text-[11px] font-semibold mb-2.5">
          <button
            type="button"
            onClick={() => onChangeMode('SINGLE')}
            className={`h-7 px-2 rounded-md text-center transition-all cursor-pointer flex items-center justify-center ${
              brcMode === 'SINGLE'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Single (1 BRC)
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('MULTIPLE')}
            className={`h-7 px-2 rounded-md text-center transition-all cursor-pointer flex items-center justify-center ${
              brcMode === 'MULTIPLE'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Multiple (2 BRCs)
          </button>
        </div>

        <div className="space-y-2">
          <div className="p-2 border border-slate-200 rounded-lg bg-slate-50/70 text-xs flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">
                {brcMode === 'MULTIPLE' ? 'BRC Slot 4 (Part 1)' : 'BRC Slot 4 (Single)'}
              </span>
              {brcFile1 ? (
                <span className="font-semibold text-slate-800 truncate block text-[11px]">
                  {brcFile1.name} ({brcFile1.size})
                </span>
              ) : (
                <span className="text-slate-400 text-[11px] block">No file selected</span>
              )}
            </div>
            {brcFile1 ? (
              <button
                type="button"
                onClick={onRemoveSlot1}
                className="w-7 h-7 flex items-center justify-center shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSelectSlot1}
                className="h-7 px-2.5 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
              >
                <Upload size={11} /> Browse
              </button>
            )}
          </div>

          {brcMode === 'MULTIPLE' && (
            <div className="p-2 border border-slate-200 rounded-lg bg-slate-50/70 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">
                  BRC Slot 5 (Part 2)
                </span>
                {brcFile2 ? (
                  <span className="font-semibold text-slate-800 truncate block text-[11px]">
                    {brcFile2.name} ({brcFile2.size})
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px] block">No file selected</span>
                )}
              </div>
              {brcFile2 ? (
                <button
                  type="button"
                  onClick={onRemoveSlot2}
                  className="w-7 h-7 flex items-center justify-center shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSelectSlot2}
                  className="h-7 px-2.5 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                >
                  <Upload size={11} /> Browse
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        {brcMode === 'SINGLE'
          ? 'Single bank realisation eBRC'
          : 'Split realisations with multiple eBRC certificates'}
      </div>
    </div>
  );
};
