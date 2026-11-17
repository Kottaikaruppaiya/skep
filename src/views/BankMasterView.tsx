/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Landmark, PlusCircle, Edit, Download } from 'lucide-react';
import { BankMaster, Role } from '../types/index.ts';
import { api } from '../api/client.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';

interface BankMasterViewProps {
  banks: BankMaster[];
  onRefresh: () => void;
  userRole: Role;
  refreshKey?: number;
}

export const BankMasterView: React.FC<BankMasterViewProps> = ({
  banks,
  onRefresh,
  userRole,
  refreshKey,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [adCode, setAdCode] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isViewer = userRole === 'VIEWER';

  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    bank: BankMaster | null;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    bank: null,
    loading: false,
    error: null,
  });

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setBranch('');
    setAdCode('');
    setIfscCode('');
    setSwiftCode('');
    setAccountNumber('');
    setIsActive(true);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (b: BankMaster) => {
    setEditingId(b.id);
    setName(b.name);
    setBranch(b.branch || '');
    setAdCode(b.adCode || '');
    setIfscCode(b.ifscCode || '');
    setSwiftCode(b.swiftCode || '');
    setAccountNumber(b.accountNumber || '');
    setIsActive(b.isActive !== false);
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await api.updateBank(editingId, {
          name,
          branch,
          adCode,
          ifscCode,
          swiftCode,
          accountNumber,
          isActive,
        });
      } else {
        await api.createBank({
          name,
          branch,
          adCode,
          ifscCode,
          swiftCode,
          accountNumber,
          isActive,
        });
      }
      setShowModal(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error saving bank');
    }
  };

  const filteredBanks = banks.filter((b) => {
    const q = searchTerm.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.branch && b.branch.toLowerCase().includes(q)) ||
      (b.adCode && b.adCode.toLowerCase().includes(q)) ||
      (b.ifscCode && b.ifscCode.toLowerCase().includes(q)) ||
      (b.swiftCode && b.swiftCode.toLowerCase().includes(q)) ||
      (b.accountNumber && b.accountNumber.toLowerCase().includes(q))
    );
  });

  const handleConfirmDelete = async () => {
    if (!deleteModalState.bank) return;
    setDeleteModalState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.deleteBank(deleteModalState.bank.id);
      setDeleteModalState({ isOpen: false, bank: null, loading: false, error: null });
      onRefresh();
    } catch (err: any) {
      setDeleteModalState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to delete bank master record.',
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Landmark size={20} className="text-blue-600" />
            <span>Bank Master (Authorised Dealer AD Banks)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Authorised Dealer (AD) codes, SWIFT codes, and account numbers for DGFT EDPMS and customs integration
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            placeholder="Search banks, AD code, IFSC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 sm:py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
          />

          <button
            type="button"
            onClick={() => void api.downloadExportCsv('Bank Master', undefined, 'Bank_Master.csv')}
            className="h-9 sm:h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download size={13} className="text-blue-600" />
            <span>Export Bank Master CSV</span>
          </button>

          {!isViewer && (
            <button
              onClick={openCreate}
              className="px-3.5 py-2 sm:py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center space-x-1.5 whitespace-nowrap min-h-[40px] sm:min-h-0"
            >
              <PlusCircle size={15} />
              <span>Add Bank</span>
            </button>
          )}
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold sticky top-0 z-10">
              <tr>
                <th className="p-3">Bank Name</th>
                <th className="p-3">Branch</th>
                <th className="p-3">AD Code (DGFT)</th>
                <th className="p-3">IFSC Code</th>
                <th className="p-3">SWIFT Code</th>
                <th className="p-3">Account Number</th>
                <th className="p-3 text-center">Status</th>
                {!isViewer && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredBanks.length === 0 ? (
                <tr>
                  <td colSpan={isViewer ? 7 : 8} className="p-10 text-center text-slate-400">
                    No banks found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredBanks.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{b.name}</td>
                    <td className="p-3 text-slate-700">{b.branch || '—'}</td>
                    <td className="p-3 font-mono font-bold text-blue-700">{b.adCode || '—'}</td>
                    <td className="p-3 font-mono text-slate-600">{b.ifscCode || '—'}</td>
                    <td className="p-3 font-mono text-slate-600">{b.swiftCode || '—'}</td>
                    <td className="p-3 font-mono text-slate-700">{b.accountNumber || '—'}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.isActive !== false
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {b.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {!isViewer && (
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={() => openEdit(b)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteModalState({
                              isOpen: true,
                              bank: b,
                              loading: false,
                              error: null,
                            })}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Displaying <strong className="text-slate-800">{filteredBanks.length}</strong> of{' '}
            <strong className="text-slate-800">{banks.length}</strong> authorised dealer banks
          </span>
          {searchTerm && <span className="text-slate-400 font-medium">(filtered)</span>}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-md max-h-[90vh] flex flex-col rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-sm">
                {editingId ? 'Edit Bank Master' : 'Add Authorised Dealer Bank'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Bank Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Branch Location</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">AD Code (DGFT 7-digit)</label>
                  <input
                    type="text"
                    required
                    value={adCode}
                    onChange={(e) => setAdCode(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">SWIFT Code</label>
                  <input
                    type="text"
                    value={swiftCode}
                    onChange={(e) => setSwiftCode(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="bankActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="bankActive" className="font-semibold text-slate-700 cursor-pointer select-none">
                  Active Status (Allow selection in shipments and foreign remittances)
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-9 px-4 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Save Bank Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Bank Modal */}
      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        title="Delete Bank Master Record"
        itemName={deleteModalState.bank?.name || ''}
        itemType="Authorised Dealer Bank"
        isLoading={deleteModalState.loading}
        errorMessage={deleteModalState.error}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalState({ isOpen: false, bank: null, loading: false, error: null })}
      />
    </div>
  );
};
