/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  Check,
  X,
  FileText,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { api } from '../../api/client.ts';
import type { Supplier, Role, B2bInvoice } from '../../types/index.ts';

interface B2bSupplierMasterViewProps {
  userRole: Role;
  onNavigateTab?: (tab: string, param?: string) => void;
}

export const B2bSupplierMasterView: React.FC<B2bSupplierMasterViewProps> = ({ userRole, onNavigateTab }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [supplierInvoices, setSupplierInvoices] = useState<B2bInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    gstin: '',
    legalName: '',
    tradeName: '',
    address: '',
    state: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isViewer = userRole === 'VIEWER';

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await api.getB2bSuppliers(search);
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [search]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({ gstin: '', legalName: '', tradeName: '', address: '', state: '' });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormData({
      gstin: sup.gstin,
      legalName: sup.legalName,
      tradeName: sup.tradeName || '',
      address: sup.address || '',
      state: sup.state || '',
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenView = async (sup: Supplier) => {
    setViewingSupplier(sup);
    setLoadingInvoices(true);
    try {
      const res = await api.getB2bInvoices({ supplierGstin: sup.gstin, limit: 0 });
      setSupplierInvoices(res.data);
    } catch (err) {
      console.error('Failed to load supplier invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleDelete = async (sup: Supplier) => {
    if (isViewer) return;
    setActionError(null);
    if (sup.invoiceCount && sup.invoiceCount > 0) {
      setActionError(`Cannot delete supplier "${sup.legalName}" because it has ${sup.invoiceCount} linked B2B invoices.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete supplier "${sup.legalName}" (${sup.gstin})?`)) {
      return;
    }

    try {
      await api.deleteB2bSupplier(sup.id);
      loadSuppliers();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete supplier.');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanGstin = formData.gstin.trim().toUpperCase();
    if (!cleanGstin || cleanGstin.length !== 15) {
      setFormError('Please enter a valid 15-character GSTIN.');
      return;
    }
    if (!formData.legalName.trim()) {
      setFormError('Supplier Legal Name is required.');
      return;
    }

    setSaving(true);
    try {
      if (editingSupplier) {
        await api.updateB2bSupplier(editingSupplier.id, {
          legalName: formData.legalName.trim(),
          tradeName: formData.tradeName.trim() || undefined,
          address: formData.address.trim() || undefined,
          state: formData.state.trim() || undefined,
        });
      } else {
        await api.createB2bSupplier({
          gstin: cleanGstin,
          legalName: formData.legalName.trim(),
          tradeName: formData.tradeName.trim() || undefined,
          address: formData.address.trim() || undefined,
          state: formData.state.trim() || undefined,
        });
      }
      setIsAddModalOpen(false);
      loadSuppliers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save supplier.');
    } finally {
      setSaving(false);
    }
  };

  const formatInr = (val?: number) => {
    return '₹' + (Number(val || 0)).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Building2 className="w-4 h-4" />
            <span>Master Records & Profiles</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">B2B Supplier Master</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Registered inward suppliers with linked invoice histories, cumulative tax contribution, and compliance tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadSuppliers}
            title="Refresh Suppliers"
            className="p-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {!isViewer && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="font-bold text-red-600">×</button>
        </div>
      )}

      {/* Search & Statistics */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="relative min-w-[280px] flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers by legal name, trade name, GSTIN, or state..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total Suppliers: <span className="font-bold text-slate-900">{suppliers.length}</span>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold tracking-wider border-b border-slate-200 whitespace-nowrap">
              <tr>
                <th className="px-3 py-3 w-10 text-center">#</th>
                <th className="px-4 py-3">Supplier GSTIN</th>
                <th className="px-4 py-3">Legal Name</th>
                <th className="px-3 py-3">Trade Name</th>
                <th className="px-3 py-3">State</th>
                <th className="px-3 py-3 text-center">Invoices</th>
                <th className="px-4 py-3 text-right">Taxable Value (₹)</th>
                <th className="px-4 py-3 text-right">Total GST (₹)</th>
                <th className="px-4 py-3 text-right">Total Value (₹)</th>
                <th className="px-3 py-3">Latest Invoice</th>
                <th className="px-3 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.length > 0 ? (
                suppliers.map((sup, idx) => (
                  <tr key={sup.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-800">{sup.gstin}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{sup.legalName}</td>
                    <td className="px-3 py-3 text-slate-600">{sup.tradeName || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{sup.state || '—'}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-full text-[11px]">
                        {sup.invoiceCount || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                      {formatInr(sup.totalTaxableValue)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                      {formatInr(sup.totalGst)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {formatInr(sup.totalInvoiceValue)}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {sup.latestInvoiceDate || '—'}
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenView(sup)}
                          title="View supplier profile & linked invoices"
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!isViewer && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(sup)}
                              title="Edit supplier"
                              className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(sup)}
                              title="Delete supplier"
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    No suppliers found matching current search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">
                  {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier GSTIN <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={15}
                  disabled={!!editingSupplier}
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g. 33AAACH2748P1ZP"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden uppercase font-mono font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  placeholder="e.g. KOTHARI TEXTILE MILLS PRIVATE LIMITED"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trade Name
                </label>
                <input
                  type="text"
                  value={formData.tradeName}
                  onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                  placeholder="e.g. Kothari Textiles"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. Tamil Nadu"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Address / City
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. Coimbatore"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Supplier Detail & Invoices Modal */}
      {viewingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div>
                <h3 className="font-bold text-base">{viewingSupplier.legalName}</h3>
                <p className="text-xs text-blue-300 font-mono">GSTIN: {viewingSupplier.gstin}</p>
              </div>
              <button
                onClick={() => setViewingSupplier(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            {/* Profile Overview */}
            <div className="p-6 border-b border-slate-200 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 uppercase font-semibold block">Total Invoices:</span>
                <span className="text-lg font-bold text-slate-900">{viewingSupplier.invoiceCount || 0}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold block">Total Taxable Value:</span>
                <span className="text-lg font-bold text-indigo-950 font-mono">{formatInr(viewingSupplier.totalTaxableValue)}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold block">Total Input GST:</span>
                <span className="text-lg font-bold text-emerald-700 font-mono">{formatInr(viewingSupplier.totalGst)}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold block">State:</span>
                <span className="text-sm font-semibold text-slate-800">{viewingSupplier.state || 'Tamil Nadu'}</span>
              </div>
            </div>

            {/* Linked Invoices Table */}
            <div className="p-6 flex-1 overflow-y-auto">
              <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Linked Inward Invoices ({supplierInvoices.length})</span>
              </h4>

              {loadingInvoices ? (
                <div className="py-8 text-center text-slate-400">Loading invoices...</div>
              ) : supplierInvoices.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">Invoice No</th>
                        <th className="px-3 py-2.5">GSTR Period</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5 text-right">Taxable (₹)</th>
                        <th className="px-3 py-2.5 text-right">Total GST (₹)</th>
                        <th className="px-3 py-2.5 text-right">Inv Value (₹)</th>
                        <th className="px-3 py-2.5 text-center">ITC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supplierInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-mono font-bold text-blue-700">{inv.invoiceNumber}</td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[11px] font-medium">
                              {inv.gstrPeriod}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{inv.invoiceDate}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-800">{formatInr(inv.taxableValue)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">{formatInr(inv.totalGst)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{formatInr(inv.invoiceValue)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.itcAvailability === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {inv.itcAvailability}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">No invoices recorded for this supplier.</div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingSupplier(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
