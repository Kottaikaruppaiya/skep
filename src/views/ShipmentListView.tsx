import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  PlusCircle,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  Edit,
  Trash2,
  Archive,
} from 'lucide-react';
import { Shipment, ConsigneeMaster, Role } from '../types/index.ts';
import { api } from '../api/client.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';

interface ShipmentListViewProps {
  selectedFyId: string;
  consignees: ConsigneeMaster[];
  onSelectShipment: (id: string) => void;
  onOpenNewShipment: () => void;
  onOpenAllocate: (shipment: Shipment) => void;
  onOpenEdit?: (shipment: Shipment) => void;
  onRefresh?: () => void;
  userRole: Role;
  refreshKey?: number;
}

export const ShipmentListView: React.FC<ShipmentListViewProps> = ({
  selectedFyId,
  consignees,
  onSelectShipment,
  onOpenNewShipment,
  onOpenAllocate,
  onOpenEdit,
  onRefresh,
  userRole,
  refreshKey,
}) => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [consigneeFilter, setConsigneeFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('');
  const [pageSize, setPageSize] = useState<number | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadShipments = async () => {
    setLoading(true);
    try {
      const data = await api.getShipments({
        financialYearId: selectedFyId,
        consigneeId: consigneeFilter || undefined,
        paymentStatus: paymentStatusFilter || undefined,
        reviewStatus: reviewStatusFilter || undefined,
        search: search || undefined,
      });
      setShipments(data);
    } catch (e: any) {
      console.error(e);
      setActionMessage({ text: e.message || 'Error loading shipments', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
  }, [selectedFyId, consigneeFilter, paymentStatusFilter, reviewStatusFilter, search, refreshKey]);

  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    shipment: Shipment | null;
    isArchiveOnly: boolean;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    shipment: null,
    isArchiveOnly: false,
    loading: false,
    error: null,
  });

  const openDeleteModal = (s: Shipment, archiveOnly = false) => {
    setDeleteModalState({
      isOpen: true,
      shipment: s,
      isArchiveOnly: archiveOnly,
      loading: false,
      error: null,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalState.shipment) return;
    setDeleteModalState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.deleteShipment(deleteModalState.shipment.id);
      setActionMessage({
        text: `Shipment ${deleteModalState.shipment.invoiceNumber} permanently deleted.`,
        type: 'success',
      });
      setDeleteModalState({ isOpen: false, shipment: null, isArchiveOnly: false, loading: false, error: null });
      setTimeout(() => setActionMessage(null), 4000);
      loadShipments();
      onRefresh?.();
    } catch (err: any) {
      setDeleteModalState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to delete shipment due to active dependencies.',
      }));
    }
  };

  const handleConfirmArchive = async () => {
    if (!deleteModalState.shipment) return;
    setDeleteModalState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.archiveShipment(deleteModalState.shipment.id, 'User archived from shipment register');
      setActionMessage({
        text: `Shipment ${deleteModalState.shipment.invoiceNumber} safely archived. Financial records preserved.`,
        type: 'success',
      });
      setDeleteModalState({ isOpen: false, shipment: null, isArchiveOnly: false, loading: false, error: null });
      setTimeout(() => setActionMessage(null), 4000);
      loadShipments();
      onRefresh?.();
    } catch (err: any) {
      setDeleteModalState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to archive shipment.',
      }));
    }
  };

  const isViewer = userRole === 'VIEWER';

  // Pagination calculation
  const totalCount = shipments.length;
  const displayedShipments =
    pageSize === 'ALL'
      ? shipments
      : shipments.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-blue-600 flex-shrink-0" />
            <span>Master Export Tracker (System of Record)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Export shipments, customs valuations, FIRC payment realizations, and BRC statuses
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
          {!isViewer && (
            <button
              onClick={onOpenNewShipment}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer flex-1 sm:flex-none justify-center"
            >
              <PlusCircle size={15} />
              <span>New Shipment</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void api.downloadExportWorkbook(selectedFyId)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-all flex items-center space-x-1.5 flex-1 sm:flex-none justify-center cursor-pointer"
          >
            <Download size={14} />
            <span>Export Tracker (.xlsx)</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-500 hover:text-slate-800 font-bold p-1">
            ×
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col md:flex-row flex-wrap items-stretch md:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center space-x-2 flex-1 w-full md:min-w-[240px]">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice no, SB no, normalized key, buyer, port, or BL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Consignee Filter */}
          <select
            aria-label="Filter by Consignee"
            value={consigneeFilter}
            onChange={(e) => setConsigneeFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium h-8 outline-none cursor-pointer"
          >
            <option value="">All Consignees / Buyers</option>
            {consignees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Payment Status Filter */}
          <select
            aria-label="Filter by Payment Status"
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium h-8 outline-none cursor-pointer"
          >
            <option value="">All Payment Statuses</option>
            <option value="FULLY_PAID">Fully Paid</option>
            <option value="PART_PAID">Part Paid</option>
            <option value="UNPAID">Unpaid</option>
            <option value="EXCESS_RECEIVED">Excess Received</option>
          </select>

          {/* Review Status Filter */}
          <select
            aria-label="Filter by Review Status"
            value={reviewStatusFilter}
            onChange={(e) => setReviewStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium h-8 outline-none cursor-pointer"
          >
            <option value="">All Review States</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="EXTRACTED">Extracted</option>
          </select>

          {/* Rows per page selector */}
          <div className="flex items-center gap-1.5 text-slate-500 font-medium pl-2 border-l border-slate-200">
            <span>Show:</span>
            <select
              aria-label="Rows per page"
              value={String(pageSize)}
              onChange={(e) => {
                const val = e.target.value;
                setPageSize(val === 'ALL' ? 'ALL' : Number(val));
                setCurrentPage(1);
              }}
              className="border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 font-medium h-8 outline-none cursor-pointer"
            >
              <option value="ALL">All ({totalCount})</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>

          {(search || consigneeFilter || paymentStatusFilter || reviewStatusFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setConsigneeFilter('');
                setPaymentStatusFilter('');
                setReviewStatusFilter('');
              }}
              className="px-2.5 h-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main High-Density Financial Table */}
      <div className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto max-h-[calc(100vh-270px)] overflow-y-auto">
          <table className="w-full text-left text-xs whitespace-nowrap min-w-[1250px]">
            <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3">Invoice No.</th>
                <th className="p-3">Normalized Key</th>
                <th className="p-3">Date</th>
                <th className="p-3">Buyer (Consignee)</th>
                <th className="p-3">Port</th>
                <th className="p-3 text-right">Invoice (USD)</th>
                <th className="p-3">Shipping Bill</th>
                <th className="p-3">SB Date</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">FOB Value (INR)</th>
                <th className="p-3">FIRC / IRM</th>
                <th className="p-3 text-right">Realised USD</th>
                <th className="p-3 text-right">Balance Due</th>
                <th className="p-3 text-center">Payment Status</th>
                <th className="p-3 text-center">BRC Status</th>
                <th className="p-3 text-right min-w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={17} className="p-12 text-center text-slate-400 animate-pulse">
                    Loading shipment records...
                  </td>
                </tr>
              )}

              {!loading && displayedShipments.length === 0 && (
                <tr>
                  <td colSpan={17} className="p-12 text-center text-slate-400">
                    No shipments found matching the selected filters.
                  </td>
                </tr>
              )}

              {!loading &&
                displayedShipments.map((s, idx) => {
                  const alloc = s.allocations?.[0];
                  const rowNum = pageSize === 'ALL' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      onClick={() => onSelectShipment(s.id)}
                    >
                      <td className="p-3 text-center font-mono text-slate-400">{rowNum}</td>
                      <td className="p-3 font-bold text-slate-900 group-hover:text-blue-700">
                        {s.invoiceNumber}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        {s.normalizedInvoiceKey}
                      </td>
                      <td className="p-3 text-slate-600">{s.invoiceDate}</td>
                      <td className="p-3 font-medium text-slate-800 max-w-[180px] truncate" title={s.consigneeName}>
                        {s.consigneeName}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{s.portCode}</td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        ${s.invoiceValueUsd.toLocaleString()}
                      </td>
                      <td className="p-3 font-semibold text-slate-800">{s.shippingBillNumber}</td>
                      <td className="p-3 text-slate-600">{s.shippingBillDate}</td>
                      <td className="p-3 text-right text-slate-600">₹{s.sbExchangeRate}</td>
                      <td className="p-3 text-right font-semibold text-slate-800">
                        ₹{s.fobValueInr.toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-blue-700 font-medium">
                        {alloc?.paymentIrm || (s.hasFircEvidence ? 'FIRC Linked' : '—')}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-700">
                        ${(s.totalPaidUsd || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-bold text-amber-700">
                        ${(s.balanceDueUsd || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.paymentStatus === 'FULLY_PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.paymentStatus === 'PART_PAID'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {s.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            s.brcRecord?.status === 'REALISED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.brcRecord?.status === 'ISSUED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {s.brcRecord?.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="p-3 text-right min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onSelectShipment(s.id)}
                            title="View Shipment Detail"
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-700 transition-colors cursor-pointer"
                          >
                            <Eye size={15} />
                          </button>
                          {!isViewer && (
                            <>
                              <button
                                onClick={() => {
                                  if (onOpenEdit) onOpenEdit(s);
                                  else onSelectShipment(s.id);
                                }}
                                title="Edit Shipment"
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                              >
                                <Edit size={15} />
                              </button>
                              {(s.balanceDueUsd || 0) > 0 && (
                                <button
                                  onClick={() => onOpenAllocate(s)}
                                  title="Allocate Inward Payment"
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-emerald-50 text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
                                >
                                  <CreditCard size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => openDeleteModal(s, true)}
                                title="Safely Archive Shipment"
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-50 text-amber-600 hover:text-amber-800 transition-colors cursor-pointer"
                              >
                                <Archive size={15} />
                              </button>
                              <button
                                onClick={() => openDeleteModal(s, false)}
                                title="Delete Shipment"
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Summary and Pagination */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3 font-medium">
          <div className="flex items-center space-x-2">
            <span>
              Showing <strong>{displayedShipments.length}</strong> of <strong>{totalCount}</strong> shipments
              {selectedFyId === 'ALL' ? ' (All Financial Years)' : ` (${selectedFyId})`}
            </span>
          </div>

          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center space-x-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}

          <span className="text-slate-500 hidden md:inline">
            Click row for full shipment details, documents & reconciliation view.
          </span>
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        title={deleteModalState.isArchiveOnly ? 'Archive Export Shipment' : 'Delete Export Shipment'}
        itemName={deleteModalState.shipment?.invoiceNumber || ''}
        itemType="Export Shipment"
        isArchiveOnly={deleteModalState.isArchiveOnly}
        isLoading={deleteModalState.loading}
        errorMessage={deleteModalState.error}
        onConfirm={deleteModalState.isArchiveOnly ? handleConfirmArchive : handleConfirmDelete}
        onCancel={() => setDeleteModalState({ isOpen: false, shipment: null, isArchiveOnly: false, loading: false, error: null })}
        onArchiveAlternative={!deleteModalState.isArchiveOnly ? handleConfirmArchive : undefined}
      />
    </div>
  );
};
