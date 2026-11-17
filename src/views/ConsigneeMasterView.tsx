/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Building2, PlusCircle, Edit, CheckCircle, XCircle, Search, Trash2, Globe, Filter, Download } from 'lucide-react';
import { ConsigneeMaster, Role } from '../types/index.ts';
import { api } from '../api/client.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';

interface ConsigneeMasterViewProps {
  consignees: ConsigneeMaster[];
  onRefresh: () => void;
  userRole: Role;
  refreshKey?: number;
}

export const ConsigneeMasterView: React.FC<ConsigneeMasterViewProps> = ({
  consignees: initialConsignees,
  onRefresh,
  userRole,
  refreshKey,
}) => {
  const [consigneesList, setConsigneesList] = useState<ConsigneeMaster[]>(initialConsignees || []);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [contactEmail, setContactEmail] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    consignee: ConsigneeMaster | null;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    consignee: null,
    loading: false,
    error: null,
  });
  const [pageSize, setPageSize] = useState<number | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const isViewer = userRole === 'VIEWER';

  // Load fresh data directly to avoid any stale state
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getConsignees();
      setConsigneesList(data);
    } catch (e) {
      console.error('Error fetching consignees:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialConsignees && initialConsignees.length > 0 && !refreshKey) {
      setConsigneesList(initialConsignees);
    } else {
      loadData();
    }
  }, [initialConsignees, refreshKey]);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setCountry('');
    setPortOfDischarge('');
    setPaymentTerms('100% Advance TT');
    setCurrency('USD');
    setContactEmail('');
    setIsActive(true);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (c: ConsigneeMaster) => {
    setEditingId(c.id);
    setName(c.name);
    setCountry(c.country || '');
    setPortOfDischarge(c.portOfDischarge || '');
    setPaymentTerms(c.paymentTerms || '');
    setCurrency(c.currency || 'USD');
    setContactEmail(c.contactEmail || '');
    setIsActive(c.isActive !== false);
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await api.updateConsignee(editingId, {
          name,
          country,
          portOfDischarge,
          paymentTerms,
          currency,
          contactEmail,
          isActive,
        });
      } else {
        await api.createConsignee({
          name,
          country,
          portOfDischarge,
          paymentTerms,
          currency,
          contactEmail,
          isActive,
        });
      }
      setShowModal(false);
      await loadData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error saving consignee');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalState.consignee) return;
    setDeleteModalState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.deleteConsignee(deleteModalState.consignee.id);
      setDeleteModalState({ isOpen: false, consignee: null, loading: false, error: null });
      await loadData();
      onRefresh();
    } catch (err: any) {
      setDeleteModalState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to delete buyer master record.',
      }));
    }
  };

  // Safe filter across all buyer fields
  const filteredConsignees = consigneesList.filter((c) => {
    if (statusFilter === 'ACTIVE' && c.isActive === false) return false;
    if (statusFilter === 'INACTIVE' && c.isActive !== false) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.country && c.country.toLowerCase().includes(q)) ||
      (c.portOfDischarge && c.portOfDischarge.toLowerCase().includes(q)) ||
      (c.paymentTerms && c.paymentTerms.toLowerCase().includes(q)) ||
      (c.contactEmail && c.contactEmail.toLowerCase().includes(q)) ||
      (c.currency && c.currency.toLowerCase().includes(q))
    );
  });

  // Pagination calculation
  const totalRows = filteredConsignees.length;
  const effectivePageSize = pageSize === 'ALL' ? totalRows || 1 : pageSize;
  const totalPages = Math.ceil(totalRows / effectivePageSize) || 1;
  const startIndex = pageSize === 'ALL' ? 0 : (currentPage - 1) * effectivePageSize;
  const endIndex = pageSize === 'ALL' ? totalRows : Math.min(startIndex + effectivePageSize, totalRows);
  const displayedConsignees = filteredConsignees.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 size={20} className="text-blue-600" />
            <span>Consignee Master (Overseas Buyers Registry)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Authoritative master list of foreign clients, default discharge ports, and approved credit terms
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search buyer name, country, port..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({consigneesList.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                statusFilter === 'ACTIVE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active
            </button>
          </div>

          <button
            type="button"
            onClick={() => void api.downloadExportCsv('Consignee Master', undefined, 'Consignee_Master.csv')}
            className="h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <Download size={13} className="text-blue-600" />
            <span>Export CSV</span>
          </button>

          {!isViewer && (
            <button
              onClick={openCreate}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 whitespace-nowrap"
            >
              <PlusCircle size={15} />
              <span>Add Consignee</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container: No vertical height clamp to ensure all rows display naturally */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold sticky top-0 z-10">
              <tr>
                <th className="p-3">Buyer Name</th>
                <th className="p-3">Country</th>
                <th className="p-3">Port of Discharge</th>
                <th className="p-3">Payment Terms</th>
                <th className="p-3">Currency</th>
                <th className="p-3">Contact Email</th>
                <th className="p-3 text-center">Status</th>
                {!isViewer && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && consigneesList.length === 0 ? (
                <tr>
                  <td colSpan={isViewer ? 7 : 8} className="p-10 text-center text-slate-400 animate-pulse">
                    Loading consignees registry...
                  </td>
                </tr>
              ) : displayedConsignees.length === 0 ? (
                <tr>
                  <td colSpan={isViewer ? 7 : 8} className="p-12 text-center text-slate-400">
                    No consignees found matching your search criteria.
                  </td>
                </tr>
              ) : (
                displayedConsignees.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                      <Globe size={14} className="text-blue-500 shrink-0" />
                      <span>{c.name}</span>
                    </td>
                    <td className="p-3 text-slate-700 font-medium">{c.country || '—'}</td>
                    <td className="p-3 text-slate-600">{c.portOfDischarge || '—'}</td>
                    <td className="p-3 text-slate-600">{c.paymentTerms || '—'}</td>
                    <td className="p-3 font-mono font-bold text-blue-700">{c.currency || 'USD'}</td>
                    <td className="p-3 text-slate-500">{c.contactEmail || '—'}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.isActive !== false
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {!isViewer && (
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={() => openEdit(c)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteModalState({
                              isOpen: true,
                              consignee: c,
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

        {/* Footer with Row Counts & Page Controls */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-600">
            <span>
              Showing <strong className="text-slate-900">{totalRows === 0 ? 0 : startIndex + 1}</strong> to{' '}
              <strong className="text-slate-900">{endIndex}</strong> of{' '}
              <strong className="text-slate-900">{totalRows}</strong> buyers
            </span>
            {searchTerm && <span className="text-slate-400">(filtered)</span>}
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 text-slate-600">
              <span className="text-[11px]">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold"
              >
                <option value="ALL">ALL (Show All Rows)</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>

            {pageSize !== 'ALL' && totalPages > 1 && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 border border-slate-300 rounded bg-white font-semibold disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-2 font-semibold text-slate-700">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 border border-slate-300 rounded bg-white font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Consignee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-md max-h-[90vh] flex flex-col rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-sm">
                {editingId ? 'Edit Consignee Master' : 'Add New Consignee'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Buyer / Company Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apex Logistics Europe BV"
                  className="w-full border border-slate-300 rounded-lg p-2 font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Destination Country *</label>
                <input
                  type="text"
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Netherlands"
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Port of Discharge</label>
                <input
                  type="text"
                  value={portOfDischarge}
                  onChange={(e) => setPortOfDischarge(e.target.value)}
                  placeholder="e.g. NLRTM - Rotterdam"
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. DA 30 Days from BL"
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Invoice Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-mono font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="AED">AED</option>
                    <option value="INR">INR</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="accounts@buyer.com"
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="consigneeActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="consigneeActive" className="font-semibold text-slate-700 cursor-pointer select-none">
                  Active Status (Allow selection in export shipments and invoices)
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
                  Save Consignee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Consignee Modal */}
      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        title="Delete Consignee Record"
        itemName={deleteModalState.consignee?.name || ''}
        itemType="Consignee / Buyer Master"
        isLoading={deleteModalState.loading}
        errorMessage={deleteModalState.error}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalState({ isOpen: false, consignee: null, loading: false, error: null })}
      />
    </div>
  );
};
