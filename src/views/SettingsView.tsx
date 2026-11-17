/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, ShieldAlert, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { AppSettings, Role } from '../types/index.ts';
import { api } from '../api/client.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';

interface SettingsViewProps {
  userRole: Role;
  onPurgeComplete?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ userRole, onPurgeComplete }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statutoryBrcDays, setStatutoryBrcDays] = useState(270);
  const [defaultPortCode, setDefaultPortCode] = useState('INNSA1');
  const [companyName, setCompanyName] = useState('S K Enterprises');
  const [iecNumber, setIecNumber] = useState('0308019921');
  const [panNumber, setPanNumber] = useState('AAECS9812K');

  // Purge state
  const [isPurgeConfirmOpen, setIsPurgeConfirmOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getSettings()
      .then((s) => {
        setSettings(s);
        setStatutoryBrcDays(s.statutoryBrcDays);
        setDefaultPortCode(s.defaultPortCode);
        setCompanyName(s.companyName);
        setIecNumber(s.iecNumber);
        setPanNumber(s.panNumber);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await api.updateSettings({
        statutoryBrcDays,
        defaultPortCode,
        companyName,
        iecNumber,
        panNumber,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Error saving settings');
    }
  };

  const handleConfirmPurgeAllRecords = async () => {
    setIsPurging(true);
    setPurgeError(null);
    setPurgeSuccess(null);

    try {
      const res = await api.clearAllRecords();
      setPurgeSuccess(
        `All records successfully purged from system! Cleared: ${res.cleared.shipments} shipments, ${res.cleared.payments} payments, ${res.cleared.allocations} allocations, ${res.cleared.incentives} incentives, ${res.cleared.documents} documents.`
      );
      setIsPurgeConfirmOpen(false);
      if (onPurgeComplete) onPurgeComplete();
    } catch (err: any) {
      setPurgeError(err.message || 'Failed to purge operational records.');
      throw err;
    } finally {
      setIsPurging(false);
    }
  };

  const isViewer = userRole === 'VIEWER';
  const isAdminOrSuper = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings size={20} className="text-blue-600" />
          <span>Application Settings & Statutory Configuration</span>
        </h2>
        <p className="text-xs text-slate-500">
          Global regulatory parameters, default customs ports, and organisation identifiers
        </p>
      </div>

      <form onSubmit={handleSave} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-6 text-xs">
        {saveError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center justify-between font-medium">
            <span>{saveError}</span>
            <button type="button" onClick={() => setSaveError(null)} className="font-bold text-red-600">×</button>
          </div>
        )}

        {saved && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center space-x-2 font-medium">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Settings successfully committed to system database.</span>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
            Statutory & Compliance Rules
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                FEMA Statutory BRC Realisation Deadline (Days)
              </label>
              <input
                type="number"
                required
                disabled={isViewer}
                value={statutoryBrcDays}
                onChange={(e) => setStatutoryBrcDays(parseInt(e.target.value, 10) || 270)}
                className="w-full border border-slate-300 rounded-lg p-2 font-bold disabled:bg-slate-100"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Standard RBI/FEMA timeline: 270 days (9 months) from Shipping Bill export date
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Default Customs Port of Loading Code
              </label>
              <input
                type="text"
                required
                disabled={isViewer}
                value={defaultPortCode}
                onChange={(e) => setDefaultPortCode(e.target.value.toUpperCase())}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase disabled:bg-slate-100"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Default: INNSA1 (Jawaharlal Nehru Port / Nhava Sheva)
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
            Organisation Profile & Identifiers
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Registered Entity Name</label>
              <input
                type="text"
                required
                disabled={isViewer}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-semibold disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">DGFT IEC Number (10 digits)</label>
              <input
                type="text"
                required
                disabled={isViewer}
                value={iecNumber}
                onChange={(e) => setIecNumber(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">PAN Number</label>
              <input
                type="text"
                required
                disabled={isViewer}
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase disabled:bg-slate-100"
              />
            </div>
          </div>
        </div>

        {!isViewer && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <Save size={14} />
              <span>Save Configuration</span>
            </button>
          </div>
        )}
      </form>

      {/* Danger Zone: System Purge & Clean Database */}
      {isAdminOrSuper && (
        <div className="p-6 bg-red-50/50 border border-red-200 rounded-2xl shadow-2xs space-y-4 text-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 text-red-700 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-red-950">Danger Zone: Purge All Transaction Records</h3>
              <p className="text-red-800 mt-1">
                Permanently purge all export shipments, invoices, payments, allocations, incentives, BRC records, and uploaded documents.
                This provides a completely clean slate for fresh export record keeping while preserving user logins, financial years, and master lists.
              </p>
            </div>
          </div>

          {purgeSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium flex items-center space-x-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{purgeSuccess}</span>
            </div>
          )}

          {purgeError && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-xl font-medium">
              <span>{purgeError}</span>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-red-200/80">
            <span className="text-[11px] text-red-700 font-medium">
              Warning: This operation cannot be reversed once triggered.
            </span>
            <button
              type="button"
              onClick={() => {
                setPurgeError(null);
                setIsPurgeConfirmOpen(true);
              }}
              disabled={isPurging}
              className="h-9 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg font-bold text-xs shadow-xs transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={14} />
              <span>{isPurging ? 'Purging Records...' : 'Delete All Operational Records'}</span>
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isPurgeConfirmOpen}
        title="Purge All Operational Records"
        itemName="All Shipments, Payments, Allocations, Incentives, BRC & Documents"
        itemType="Database Records"
        confirmText="Purge All Records"
        message="This will permanently delete all export shipments, inward payments, allocations, incentives, BRC records, and documents. Core users, financial years, consignee & bank master registries will be preserved. This action is irreversible."
        isLoading={isPurging}
        errorMessage={purgeError}
        onConfirm={handleConfirmPurgeAllRecords}
        onCancel={() => setIsPurgeConfirmOpen(false)}
      />
    </div>
  );
};
