/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  DollarSign,
  FileSpreadsheet,
  Download,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  CreditCard,
  Award,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  PlusCircle,
  Globe,
  Anchor,
  ShieldCheck,
  Mail,
  Calendar,
  FileCheck2,
  Coins,
  Percent,
} from 'lucide-react';
import { Shipment, ConsigneeMaster, Role } from '../types/index.ts';
import { api } from '../api/client.ts';

interface CompanyLedgerViewProps {
  selectedFyId: string;
  initialCompanyName?: string;
  onSelectShipment: (id: string) => void;
  onOpenNewShipment?: () => void;
  userRole: Role;
  refreshKey?: number;
}

type LedgerSubTab = 'shipments' | 'remittances' | 'incentives-brc';
type StatusFilter = 'ALL' | 'FULLY_PAID' | 'PENDING' | 'BRC_REALISED' | 'BRC_PENDING';

export const CompanyLedgerView: React.FC<CompanyLedgerViewProps> = ({
  selectedFyId,
  initialCompanyName = 'S K Global Ventures Private Limited',
  onSelectShipment,
  onOpenNewShipment,
  userRole,
  refreshKey,
}) => {
  const [consignees, setConsignees] = useState<ConsigneeMaster[]>([]);
  const [selectedConsigneeId, setSelectedConsigneeId] = useState<string>('');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [activeSubTab, setActiveSubTab] = useState<LedgerSubTab>('shipments');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedFyId, refreshKey, initialCompanyName]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cList, sList] = await Promise.all([
        api.getConsignees(),
        api.getShipments({ financialYearId: selectedFyId }),
      ]);
      setConsignees(cList);
      setShipments(sList);

      // Lock strictly to the requested company
      if (initialCompanyName) {
        const match = cList.find(
          (c) =>
            c.name.toLowerCase().includes(initialCompanyName.toLowerCase()) ||
            initialCompanyName.toLowerCase().includes(c.name.toLowerCase())
        );
        if (match) {
          setSelectedConsigneeId(match.id);
        } else if (cList.length > 0) {
          setSelectedConsigneeId(cList[0].id);
        }
      } else if (cList.length > 0) {
        setSelectedConsigneeId(cList[0].id);
      }
    } catch (err) {
      console.error('Failed to load company ledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedConsignee = consignees.find((c) => c.id === selectedConsigneeId);
  const companyDisplayName = selectedConsignee?.name || initialCompanyName;

  // Filter shipments strictly for this specific company
  const companyShipments = useMemo(() => {
    return shipments.filter(
      (s) =>
        (selectedConsigneeId && s.consigneeId === selectedConsigneeId) ||
        (selectedConsignee && s.consigneeName?.toLowerCase() === selectedConsignee.name.toLowerCase()) ||
        (initialCompanyName && s.consigneeName?.toLowerCase().includes(initialCompanyName.toLowerCase()))
    );
  }, [shipments, selectedConsigneeId, selectedConsignee, initialCompanyName]);

  // Status and search filtering
  const filteredShipments = useMemo(() => {
    return companyShipments.filter((s) => {
      // Status filter
      if (statusFilter === 'FULLY_PAID' && s.paymentStatus !== 'FULLY_PAID') return false;
      if (statusFilter === 'PENDING' && (s.paymentStatus === 'FULLY_PAID' || Number(s.balanceDueUsd || 0) <= 0)) return false;
      if (statusFilter === 'BRC_REALISED' && s.brcRecord?.status !== 'REALISED') return false;
      if (statusFilter === 'BRC_PENDING' && s.brcRecord?.status === 'REALISED') return false;

      // Text search
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.shippingBillNumber.toLowerCase().includes(q) ||
        (s.blNumber && s.blNumber.toLowerCase().includes(q)) ||
        (s.vesselName && s.vesselName.toLowerCase().includes(q)) ||
        (s.remarks && s.remarks.toLowerCase().includes(q)) ||
        (s.portCode && s.portCode.toLowerCase().includes(q))
      );
    });
  }, [companyShipments, statusFilter, search]);

  // Aggregated allocations list for the Remittances tab
  const companyAllocations = useMemo(() => {
    return companyShipments.flatMap((s) =>
      (s.allocations || []).map((a) => ({
        ...a,
        invoiceNumber: s.invoiceNumber,
        invoiceDate: s.invoiceDate,
        shippingBillNumber: s.shippingBillNumber,
        invoiceValueUsd: s.invoiceValueUsd,
      }))
    );
  }, [companyShipments]);

  // Aggregated incentives list
  const companyIncentives = useMemo(() => {
    return companyShipments.flatMap((s) =>
      (s.incentives || []).map((inc) => ({
        ...inc,
        invoiceNumber: s.invoiceNumber,
        shippingBillNumber: s.shippingBillNumber,
        shippingBillDate: s.shippingBillDate,
      }))
    );
  }, [companyShipments]);

  // Financial aggregates
  const totalBilledUsd = useMemo(
    () => companyShipments.reduce((sum, s) => sum + Number(s.invoiceValueUsd || 0), 0),
    [companyShipments]
  );
  const totalRealisedUsd = useMemo(
    () => companyShipments.reduce((sum, s) => sum + Number(s.totalPaidUsd || 0), 0),
    [companyShipments]
  );
  const balanceDueUsd = Math.max(0, totalBilledUsd - totalRealisedUsd);
  const totalRealisedInr = useMemo(
    () => companyShipments.reduce((sum, s) => sum + Number(s.realisedInr || 0), 0),
    [companyShipments]
  );
  const averageRate = totalRealisedUsd > 0 ? totalRealisedInr / totalRealisedUsd : 0;
  const realisationPercentage = totalBilledUsd > 0 ? (totalRealisedUsd / totalBilledUsd) * 100 : 0;

  const totalDbk = useMemo(
    () =>
      companyShipments.reduce((sum, s) => {
        const inc = s.incentives?.find((i) => i.type === 'DRAWBACK');
        return sum + Number(inc?.claimedAmount || 0);
      }, 0),
    [companyShipments]
  );
  const totalRodtep = useMemo(
    () =>
      companyShipments.reduce((sum, s) => {
        const inc = s.incentives?.find((i) => i.type === 'RODTEP');
        return sum + Number(inc?.claimedAmount || 0);
      }, 0),
    [companyShipments]
  );
  const totalRosctl = useMemo(
    () =>
      companyShipments.reduce((sum, s) => {
        const inc = s.incentives?.find((i) => i.type === 'ROSCTL');
        return sum + Number(inc?.claimedAmount || 0);
      }, 0),
    [companyShipments]
  );
  const totalIncentivesInr = totalDbk + totalRodtep + totalRosctl;

  const fullyPaidCount = companyShipments.filter((s) => s.paymentStatus === 'FULLY_PAID').length;
  const pendingCount = companyShipments.filter((s) => s.paymentStatus !== 'FULLY_PAID' && Number(s.balanceDueUsd || 0) > 0).length;
  const brcRealisedCount = companyShipments.filter((s) => s.brcRecord?.status === 'REALISED').length;
  const brcPendingCount = companyShipments.filter((s) => s.brcRecord?.status !== 'REALISED').length;

  const handleExportCompanyCsv = () => {
    const sheetName = selectedConsignee?.name || 'Export Tracker';
    void api.downloadExportCsv(sheetName, selectedFyId);
  };

  const handleExportFullExcel = () => {
    void api.downloadExportWorkbook(selectedFyId);
  };

  const isViewer = userRole === 'VIEWER';

  return (
    <div className="space-y-6">
      {/* 1. Executive Company Header & Account Dossier */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        {/* Main Header Bar */}
        <div className="p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 border-b border-slate-100">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
                <Building2 size={22} className="text-blue-400" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {companyDisplayName}
                  </h1>
                  {consignees.length > 1 && (
                    <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-medium text-slate-500">Switch Ledger:</span>
                      <select
                        value={selectedConsigneeId}
                        onChange={(e) => setSelectedConsigneeId(e.target.value)}
                        className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                      >
                        {consignees.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="font-semibold text-slate-700">Dedicated Account Ledger</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>Financial Year {selectedFyId.replace('fy-', '')}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>{companyShipments.length} Total Shipments</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <ShieldCheck size={13} className="text-emerald-600" />
                    Strictly Isolated Buyer Ledger
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!isViewer && onOpenNewShipment && (
              <button
                onClick={onOpenNewShipment}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <PlusCircle size={15} />
                <span>New Shipment</span>
              </button>
            )}

            <button
              onClick={handleExportCompanyCsv}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              title={`Download CSV statement for ${companyDisplayName}`}
            >
              <Download size={14} className="text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleExportFullExcel}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              title="Download master workbook with all sheets"
            >
              <FileSpreadsheet size={14} className="text-blue-300" />
              <span>Full Workbook</span>
            </button>
          </div>
        </div>

        {/* Buyer Master Metadata Strip */}
        {selectedConsignee && (
          <div className="bg-slate-50/70 px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs border-t border-slate-100">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Globe size={12} className="text-slate-400" />
                Destination & Port
              </span>
              <p className="font-semibold text-slate-800">
                {selectedConsignee.country}
                <span className="text-slate-400 font-normal ml-1">
                  ({selectedConsignee.portOfDischarge || 'LKCMB - Colombo'})
                </span>
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Calendar size={12} className="text-slate-400" />
                Payment Terms
              </span>
              <p className="font-semibold text-slate-800 truncate" title={selectedConsignee.paymentTerms}>
                {selectedConsignee.paymentTerms || 'DA 90 Days from BL'}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Coins size={12} className="text-slate-400" />
                Billing Currency
              </span>
              <p className="font-semibold text-slate-800">
                {selectedConsignee.currency || 'USD'}
                <span className="text-slate-400 font-normal ml-1.5">(Forex Realisation)</span>
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Mail size={12} className="text-slate-400" />
                Remittance Contact
              </span>
              <p className="font-semibold text-slate-800 truncate" title={selectedConsignee.contactEmail}>
                {selectedConsignee.contactEmail || 'remittance@buyer.lk'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Executive Realisation & Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Invoiced */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Total Invoiced (USD)</span>
            <DollarSign size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight">
            ${totalBilledUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>{companyShipments.length} export invoice{companyShipments.length === 1 ? '' : 's'}</span>
            <span className="font-medium text-slate-700">100% Invoiced</span>
          </div>
        </div>

        {/* Total Realised */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Realised Forex (USD)</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 tracking-tight">
            ${totalRealisedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="text-emerald-700 font-semibold">{realisationPercentage.toFixed(1)}% Realised</span>
            <span className="text-slate-400">{fullyPaidCount} fully settled</span>
          </div>
        </div>

        {/* Balance Due */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Balance Due (USD)</span>
            <AlertTriangle size={16} className={balanceDueUsd > 0 ? 'text-amber-500' : 'text-slate-400'} />
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${
              balanceDueUsd > 0 ? 'text-amber-600' : 'text-slate-800'
            }`}
          >
            ${balanceDueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>{balanceDueUsd === 0 ? 'Zero outstanding' : `${pendingCount} pending payment`}</span>
            <span className="font-medium text-slate-700">
              {balanceDueUsd === 0 ? 'Compliant' : 'Awaiting FIRC'}
            </span>
          </div>
        </div>

        {/* Realised INR */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Net Realised (INR)</span>
            <CreditCard size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight">
            ₹{totalRealisedInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Avg FX: {averageRate > 0 ? `₹${averageRate.toFixed(2)}` : '—'}</span>
            <span className="text-slate-700 font-medium">Credited to Bank</span>
          </div>
        </div>
      </div>

      {/* Realisation Status Progress Strip */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-1.5 flex-1 max-w-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Realisation Settlement Progress</span>
            <span className="font-mono tabular-nums text-blue-700 font-bold">{realisationPercentage.toFixed(1)}% Completed</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/60">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, realisationPercentage))}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 shrink-0">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Government Incentives</span>
            <span className="font-bold text-slate-900 font-mono tabular-nums">₹{totalIncentivesInr.toLocaleString()}</span>
            <span className="text-slate-400 text-[10px] ml-1">(DBK: ₹{Math.round(totalDbk / 1000)}k)</span>
          </div>
          <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">eBRC Compliance</span>
            <span className="font-semibold text-slate-800 font-mono tabular-nums">
              {brcRealisedCount} Realised / {companyShipments.length} Total
            </span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Sub-Tabs & Filters */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        {/* Top Tab Bar & Filter Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Segmented Sub-Tabs */}
          <div className="flex items-center p-1 bg-slate-200/70 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setActiveSubTab('shipments')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSubTab === 'shipments'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Export Shipments ({companyShipments.length})
            </button>
            <button
              onClick={() => setActiveSubTab('remittances')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSubTab === 'remittances'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              FIRC Allocations ({companyAllocations.length})
            </button>
            <button
              onClick={() => setActiveSubTab('incentives-brc')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSubTab === 'incentives-brc'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Incentives & eBRC ({companyIncentives.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice, SB, BL, vessel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Shipments Sub-View Status Filter Bar */}
        {activeSubTab === 'shipments' && (
          <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px] font-medium mr-1">Filter Invoices:</span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({companyShipments.length})
            </button>
            <button
              onClick={() => setStatusFilter('FULLY_PAID')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'FULLY_PAID'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Fully Settled ({fullyPaidCount})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pending Realisation ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('BRC_REALISED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'BRC_REALISED'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              eBRC Closed ({brcRealisedCount})
            </button>
            <button
              onClick={() => setStatusFilter('BRC_PENDING')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'BRC_PENDING'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              eBRC Pending ({brcPendingCount})
            </button>

            <span className="ml-auto text-[11px] text-slate-400">
              Showing {filteredShipments.length} of {companyShipments.length} records
            </span>
          </div>
        )}

        {/* Content View 1: Shipments Table */}
        {activeSubTab === 'shipments' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice No & Date</th>
                  <th className="py-3 px-3">Shipping Bill</th>
                  <th className="py-3 px-3">Bill of Lading</th>
                  <th className="py-3 px-3 text-right">Invoice Value (USD)</th>
                  <th className="py-3 px-3">FIRC / IRM Allocation</th>
                  <th className="py-3 px-3 text-right">Realised USD</th>
                  <th className="py-3 px-3 text-right">Balance Due</th>
                  <th className="py-3 px-3 text-right">Realised INR</th>
                  <th className="py-3 px-3">BRC Status</th>
                  <th className="py-3 px-3">Settlement</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-500" />
                      Loading account ledger for {companyDisplayName}...
                    </td>
                  </tr>
                ) : filteredShipments.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <FileText size={28} className="mx-auto mb-2 text-slate-300" />
                      No matching shipments found for {companyDisplayName}.
                    </td>
                  </tr>
                ) : (
                  filteredShipments.map((s) => {
                    const alloc = s.allocations?.[0];
                    const brc = s.brcRecord;

                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                        onClick={() => onSelectShipment(s.id)}
                      >
                        {/* Invoice No & Date */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 group-hover:text-blue-600 flex items-center space-x-1.5">
                            <span>{s.invoiceNumber}</span>
                            <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                          </div>
                          <div className="text-[11px] text-slate-400 font-normal mt-0.5">{s.invoiceDate}</div>
                        </td>

                        {/* Shipping Bill */}
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-800">{s.shippingBillNumber}</div>
                          <div className="text-[11px] text-slate-400 font-normal">
                            {s.shippingBillDate} · {s.portCode}
                          </div>
                        </td>

                        {/* Bill of Lading */}
                        <td className="py-3.5 px-3">
                          <div className="font-medium text-slate-700">{s.blNumber || '—'}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[130px]" title={s.vesselName}>
                            {s.vesselName || 'Pending vessel'}
                          </div>
                        </td>

                        {/* Invoice Value USD */}
                        <td className="py-3.5 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                          ${Number(s.invoiceValueUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <div className="text-[10px] text-slate-400 font-normal">
                            {s.packageCount ? `${s.packageCount} pkgs` : ''}
                          </div>
                        </td>

                        {/* FIRC / IRM */}
                        <td className="py-3.5 px-3">
                          {alloc?.paymentIrm ? (
                            <div>
                              <span className="font-mono text-blue-700 font-semibold">{alloc.paymentIrm}</span>
                              <div className="text-[10px] text-slate-400">
                                {alloc.allocatedAt ? alloc.allocatedAt.split('T')[0] : 'Allocated'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-amber-600 text-[11px] flex items-center space-x-1">
                              <Clock size={12} />
                              <span>Pending FIRC</span>
                            </span>
                          )}
                        </td>

                        {/* Realised USD */}
                        <td className="py-3.5 px-3 text-right font-semibold font-mono tabular-nums text-emerald-700">
                          ${Number(s.totalPaidUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Balance Due */}
                        <td className="py-3.5 px-3 text-right font-semibold font-mono tabular-nums">
                          {Number(s.balanceDueUsd || 0) > 0 ? (
                            <span className="text-amber-600">
                              ${Number(s.balanceDueUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">0.00</span>
                          )}
                        </td>

                        {/* Realised INR */}
                        <td className="py-3.5 px-3 text-right font-medium font-mono tabular-nums text-slate-800">
                          ₹{Number(s.realisedInr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {s.averageRealisedRate ? (
                            <div className="text-[10px] text-slate-400 font-normal">@{s.averageRealisedRate.toFixed(2)}</div>
                          ) : null}
                        </td>

                        {/* BRC Status */}
                        <td className="py-3.5 px-3">
                          {brc?.status === 'REALISED' ? (
                            <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              <span>Realised {brc.brcNumber ? `(${brc.brcNumber.slice(-6)})` : ''}</span>
                            </span>
                          ) : brc?.status === 'ISSUED' ? (
                            <span className="text-blue-700 font-medium text-[11px]">Issued by Bank</span>
                          ) : (
                            <span className="text-amber-600 font-medium text-[11px] flex items-center gap-1">
                              <Clock size={12} />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>

                        {/* Payment Status */}
                        <td className="py-3.5 px-3">
                          {s.paymentStatus === 'FULLY_PAID' ? (
                            <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              <span>Settled</span>
                            </span>
                          ) : s.paymentStatus === 'PART_PAID' ? (
                            <span className="text-blue-700 font-medium text-[11px] flex items-center gap-1">
                              <Clock size={12} />
                              <span>Part-Paid</span>
                            </span>
                          ) : (
                            <span className="text-rose-700 font-medium text-[11px]">
                              Unpaid
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onSelectShipment(s.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Open shipment detail dossier"
                          >
                            <ExternalLink size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Content View 2: FIRC Remittances Breakdown */}
        {activeSubTab === 'remittances' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">FIRC / IRM Number</th>
                  <th className="py-3 px-3">Linked Invoice</th>
                  <th className="py-3 px-3">Shipping Bill</th>
                  <th className="py-3 px-3 text-right">Allocated Amount (USD)</th>
                  <th className="py-3 px-3 text-right">FX Rate Applied</th>
                  <th className="py-3 px-3">Allocation Date</th>
                  <th className="py-3 px-4">Allocation Notes</th>
                  <th className="py-3 px-3 text-center">Invoice View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {companyAllocations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <CreditCard size={28} className="mx-auto mb-2 text-slate-300" />
                      No FIRC payment allocations recorded yet for this company.
                    </td>
                  </tr>
                ) : (
                  companyAllocations.map((a, idx) => (
                    <tr key={a.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {a.paymentIrm || 'FIRC Pending'}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {a.invoiceNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {a.shippingBillNumber || '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono tabular-nums text-emerald-700">
                        ${Number(a.allocatedAmountUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                        {a.paymentExchangeRate
                          ? `₹${a.paymentExchangeRate.toFixed(2)}`
                          : averageRate > 0
                          ? `₹${averageRate.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {a.allocatedAt ? a.allocatedAt.split('T')[0] : 'Settled'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate" title={a.notes}>
                        {a.notes || 'Inward remittance settled'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => a.shipmentId && onSelectShipment(a.shipmentId)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="View Invoice"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Content View 3: Incentives & eBRC Register */}
        {activeSubTab === 'incentives-brc' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice & SB</th>
                  <th className="py-3 px-3">Incentive Type</th>
                  <th className="py-3 px-3 text-right">Claimed (INR)</th>
                  <th className="py-3 px-3 text-right">Received (INR)</th>
                  <th className="py-3 px-3">Scroll / Ref No</th>
                  <th className="py-3 px-3">Claim Status</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {companyIncentives.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Award size={28} className="mx-auto mb-2 text-slate-300" />
                      No government incentive records logged for this company's exports.
                    </td>
                  </tr>
                ) : (
                  companyIncentives.map((inc, idx) => (
                    <tr key={inc.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{inc.invoiceNumber}</div>
                        <div className="text-[10px] text-slate-400">SB: {inc.shippingBillNumber || '—'}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {inc.type === 'DRAWBACK' ? 'Duty Drawback (DBK)' : inc.type}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        ₹{Number(inc.claimedAmount).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        ₹{Number(inc.receivedAmount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {inc.scrollNumber || 'Pending Scroll'}
                      </td>
                      <td className="py-3 px-3">
                        {inc.status === 'RECEIVED' ? (
                          <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            <span>Received</span>
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium text-[11px] flex items-center gap-1">
                            <Clock size={12} />
                            <span>Pending Customs Credit</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {inc.remarks || 'Direct customs bank scroll'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Statistics */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            Account: <strong className="text-slate-800">{companyDisplayName}</strong> · FY {selectedFyId.replace('fy-', '')}
          </div>
          <div className="flex items-center space-x-4">
            <span>
              Invoices: <strong className="text-slate-800">{companyShipments.length}</strong>
            </span>
            <span>·</span>
            <span>
              Realised USD: <strong className="text-emerald-700">${totalRealisedUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </span>
            <span>·</span>
            <span>
              Realised INR: <strong className="text-slate-800">₹{totalRealisedInr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
