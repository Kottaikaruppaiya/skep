/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UsersRound, ArrowRight, Building2, Globe, Search, Filter, Calendar, DollarSign, CheckCircle2, Download } from 'lucide-react';
import { ConsigneeMaster, Shipment } from '../types/index.ts';
import { api } from '../api/client.ts';

interface ConsigneeSummaryViewProps {
  selectedFyId: string;
  onSelectShipment: (id: string) => void;
  refreshKey?: number;
}

export const ConsigneeSummaryView: React.FC<ConsigneeSummaryViewProps> = ({
  selectedFyId,
  onSelectShipment,
  refreshKey,
}) => {
  const [consignees, setConsignees] = useState<ConsigneeMaster[]>([]);
  const [fyShipments, setFyShipments] = useState<Shipment[]>([]);
  const [allShipments, setAllShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);

  // Filters & Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'CURRENT_FY' | 'ALL_YEARS'>('CURRENT_FY');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'ACTIVE_WITH_INVOICES'>('ALL');
  const [ledgerScope, setLedgerScope] = useState<'AUTO' | 'ALL_YEARS'>('AUTO');

  const loadData = async () => {
    setLoading(true);
    try {
      const [cList, sList, allSList] = await Promise.all([
        api.getConsignees(),
        api.getShipments({ financialYearId: selectedFyId }),
        api.getShipments({ financialYearId: 'ALL' }),
      ]);
      setConsignees(cList);
      setFyShipments(sList);
      setAllShipments(allSList);

      if (cList.length > 0 && !selectedBuyerId) {
        setSelectedBuyerId(cList[0].id);
      }
    } catch (e) {
      console.error('Error loading consignee summary data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFyId, refreshKey]);

  // Use the appropriate shipment set based on the scope toggle
  const activeShipmentSet = scopeFilter === 'CURRENT_FY' && selectedFyId !== 'ALL' ? fyShipments : allShipments;

  // Build aggregated summary ensuring NO buyers or shipments are lost
  // 1. Start with registered consignees
  const knownBuyerMap = new Map<string, ConsigneeMaster>();
  for (const c of consignees) {
    knownBuyerMap.set(c.id, c);
  }

  // 2. Discover any additional buyers from shipments that might not be in ConsigneeMaster yet
  for (const s of activeShipmentSet) {
    if (s.consigneeId && !knownBuyerMap.has(s.consigneeId)) {
      knownBuyerMap.set(s.consigneeId, {
        id: s.consigneeId,
        name: s.consigneeName || 'Unknown Buyer',
        country: 'Unspecified',
        portOfDischarge: s.portCode || '',
        paymentTerms: '',
        currency: 'USD',
        isActive: true,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      });
    } else if (!s.consigneeId && s.consigneeName) {
      const pseudoId = `pseudo-${s.consigneeName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      if (!knownBuyerMap.has(pseudoId)) {
        knownBuyerMap.set(pseudoId, {
          id: pseudoId,
          name: s.consigneeName,
          country: 'Unspecified',
          portOfDischarge: s.portCode || '',
          paymentTerms: '',
          currency: 'USD',
          isActive: true,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        });
      }
    }
  }

  const allAvailableBuyers = Array.from(knownBuyerMap.values());

  const summary = allAvailableBuyers.map((c) => {
    // Match shipments by ID or case-insensitive name match
    const cShipments = activeShipmentSet.filter(
      (s) =>
        s.consigneeId === c.id ||
        (s.consigneeName && c.name && s.consigneeName.trim().toLowerCase() === c.name.trim().toLowerCase())
    );

    const cLifetimeShipments = allShipments.filter(
      (s) =>
        s.consigneeId === c.id ||
        (s.consigneeName && c.name && s.consigneeName.trim().toLowerCase() === c.name.trim().toLowerCase())
    );

    const totalInvoicedUsd = cShipments.reduce((sum, s) => sum + (Number(s.invoiceValueUsd) || 0), 0);
    const totalFobInr = cShipments.reduce((sum, s) => sum + (Number(s.fobValueInr) || 0), 0);
    const totalRealisedUsd = cShipments.reduce((sum, s) => sum + (Number(s.totalPaidUsd) || 0), 0);
    const totalRealisedInr = cShipments.reduce((sum, s) => sum + (Number(s.realisedInr) || 0), 0);
    const totalPkgs = cShipments.reduce((sum, s) => sum + (Number(s.packageCount) || 0), 0);
    const avgRate = totalInvoicedUsd > 0 ? totalFobInr / totalInvoicedUsd : 0;
    const outstandingUsd = Math.max(0, totalInvoicedUsd - totalRealisedUsd);

    let dbkClaimed = 0, dbkRecd = 0;
    let rodtepClaimed = 0, rodtepRecd = 0;
    let rosctlClaimed = 0, rosctlRecd = 0;

    for (const s of cShipments) {
      if (s.incentives) {
        for (const inc of s.incentives) {
          if (inc.type === 'DRAWBACK') {
            dbkClaimed += Number(inc.claimedAmount || 0);
            dbkRecd += Number(inc.receivedAmount || 0);
          } else if (inc.type === 'RODTEP') {
            rodtepClaimed += Number(inc.claimedAmount || 0);
            rodtepRecd += Number(inc.receivedAmount || 0);
          } else if (inc.type === 'ROSCTL') {
            rosctlClaimed += Number(inc.claimedAmount || 0);
            rosctlRecd += Number(inc.receivedAmount || 0);
          }
        }
      }
    }

    const dbkPending = Math.max(0, dbkClaimed - dbkRecd);
    const rodtepPending = Math.max(0, rodtepClaimed - rodtepRecd);
    const rosctlPending = Math.max(0, rosctlClaimed - rosctlRecd);
    const totalIncentivesPending = dbkPending + rodtepPending + rosctlPending;
    const netForexInr = cShipments.reduce((sum, s) => {
      const sPaid = Number(s.totalPaidUsd || 0);
      const sInr = Number(s.realisedInr || 0);
      const sBal = s.balanceDueUsd ?? Math.max(0, Number(s.invoiceValueUsd || 0) - sPaid);
      if (sBal <= 0 && sPaid > 0 && sInr > 0) {
        return sum + (sInr - Number(s.fobValueInr || 0));
      }
      return sum;
    }, 0);

    const lifetimeInvoicedUsd = cLifetimeShipments.reduce((sum, s) => sum + (Number(s.invoiceValueUsd) || 0), 0);
    const lifetimeRealisedUsd = cLifetimeShipments.reduce((sum, s) => sum + (Number(s.totalPaidUsd) || 0), 0);
    const lifetimeOutstandingUsd = Math.max(0, lifetimeInvoicedUsd - lifetimeRealisedUsd);

    return {
      ...c,
      shipmentCount: cShipments.length,
      totalPkgs,
      totalInvoicedUsd,
      totalFobInr,
      avgRate,
      totalRealisedUsd,
      outstandingUsd,
      dbkClaimed,
      dbkPending,
      rodtepClaimed,
      rodtepPending,
      rosctlClaimed,
      rosctlPending,
      totalIncentivesPending,
      netForexInr,
      shipments: cShipments,
      lifetimeShipmentCount: cLifetimeShipments.length,
      lifetimeInvoicedUsd,
      lifetimeRealisedUsd,
      lifetimeOutstandingUsd,
      lifetimeShipments: cLifetimeShipments,
    };
  });

  // Filter based on search and activity
  const filteredSummary = summary.filter((c) => {
    if (activityFilter === 'ACTIVE_WITH_INVOICES' && c.shipmentCount === 0) {
      return false;
    }

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.country && c.country.toLowerCase().includes(q)) ||
      (c.portOfDischarge && c.portOfDischarge.toLowerCase().includes(q)) ||
      (c.paymentTerms && c.paymentTerms.toLowerCase().includes(q))
    );
  });

  const activeBuyer = summary.find((c) => c.id === selectedBuyerId) || filteredSummary[0] || summary[0];

  // Determine which shipments to display in the ledger dossier
  const ledgerShipments =
    ledgerScope === 'ALL_YEARS' || scopeFilter === 'ALL_YEARS' || selectedFyId === 'ALL'
      ? activeBuyer?.lifetimeShipments || []
      : activeBuyer?.shipments || [];

  return (
    <div className="space-y-6">
      {/* View Header with Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UsersRound size={20} className="text-blue-600" />
            <span>Consignee Summary (All 16 Canonical Workbook Fields)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Overseas buyer exposure, total invoiced volume, remittances, and running ledger cards
          </p>
        </div>

        {/* Action Controls & Scope Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              void api.downloadExportCsv(
                'Consignee Summary',
                selectedFyId,
                `Consignee_Summary_${selectedFyId === 'ALL' ? 'All_FYs' : selectedFyId}.csv`
              )
            }
            className="h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <Download size={13} className="text-blue-600" />
            <span>Export CSV</span>
          </button>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search buyer, country, port..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setScopeFilter('CURRENT_FY')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                scopeFilter === 'CURRENT_FY'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Selected FY ({selectedFyId === 'ALL' ? 'All FYs' : selectedFyId})
            </button>
            <button
              onClick={() => setScopeFilter('ALL_YEARS')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                scopeFilter === 'ALL_YEARS'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lifetime (All Years)
            </button>
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setActivityFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                activityFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Buyers ({summary.length})
            </button>
            <button
              onClick={() => setActivityFilter('ACTIVE_WITH_INVOICES')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                activityFilter === 'ACTIVE_WITH_INVOICES'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              With Invoices ({summary.filter((c) => c.shipmentCount > 0).length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Aggregation Table: Full 16 Canonical Columns */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1450px] text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold sticky top-0 z-10">
              <tr>
                <th className="p-3">1. Consignee</th>
                <th className="p-3 text-center">2. Invoices</th>
                <th className="p-3 text-center">3. Pkgs</th>
                <th className="p-3 text-right">4. Invoice USD</th>
                <th className="p-3 text-right">5. FOB Value INR</th>
                <th className="p-3 text-right">6. Avg Rate</th>
                <th className="p-3 text-right">7. Received USD</th>
                <th className="p-3 text-right font-bold text-amber-400">8. Outstanding USD</th>
                <th className="p-3 text-right">9. DBK Claimed</th>
                <th className="p-3 text-right">10. DBK Pending</th>
                <th className="p-3 text-right">11. RoDTEP Claimed</th>
                <th className="p-3 text-right">12. RoDTEP Pending</th>
                <th className="p-3 text-right">13. RoSCTL Claimed</th>
                <th className="p-3 text-right">14. RoSCTL Pending</th>
                <th className="p-3 text-right font-bold text-purple-300">15. All Inc. Pending</th>
                <th className="p-3 text-right font-bold text-emerald-400">16. Net Forex INR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && (
                <tr>
                  <td colSpan={16} className="p-12 text-center text-slate-400 animate-pulse">
                    Aggregating consignee ledger records...
                  </td>
                </tr>
              )}

              {!loading && filteredSummary.length === 0 && (
                <tr>
                  <td colSpan={16} className="p-12 text-center text-slate-400">
                    No buyers found matching current filter or search criteria.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredSummary.map((c) => {
                  const isSelected = activeBuyer?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedBuyerId(c.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/80 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3 text-slate-900 font-bold flex items-center gap-2">
                        <Globe size={14} className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
                        <span className="truncate max-w-[220px]" title={c.name}>{c.name}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            c.shipmentCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {c.shipmentCount}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono tabular-nums text-slate-700">
                        {c.totalPkgs || 0}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        ${c.totalInvoicedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums text-slate-700">
                        ₹{c.totalFobInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                        {c.avgRate > 0 ? `₹${c.avgRate.toFixed(2)}` : '—'}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                        ${c.totalRealisedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums font-bold text-amber-700">
                        ${c.outstandingUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                        ₹{c.dbkClaimed.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums text-amber-700">
                        ₹{c.dbkPending.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                        ₹{c.rodtepClaimed.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums text-amber-700">
                        ₹{c.rodtepPending.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                        ₹{c.rosctlClaimed.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums text-amber-700">
                        ₹{c.rosctlPending.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums font-bold text-purple-700">
                        ₹{c.totalIncentivesPending.toLocaleString()}
                      </td>
                      <td className={`p-3 text-right font-mono tabular-nums font-bold ${c.netForexInr >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {c.netForexInr >= 0 ? '+' : ''}₹{c.netForexInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Row count footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Displaying <strong className="text-slate-800">{filteredSummary.length}</strong> of{' '}
            <strong className="text-slate-800">{summary.length}</strong> total overseas buyers
          </span>
          <span className="font-medium text-slate-600">
            {scopeFilter === 'CURRENT_FY' && selectedFyId !== 'ALL'
              ? `Filtered to FY ${selectedFyId}`
              : 'Viewing all financial years'}
          </span>
        </div>
      </div>

      {/* Buyer Ledger Card Dossier */}
      {activeBuyer && (
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-3 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold uppercase">
                  Dossier
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Buyer Ledger Card: {activeBuyer.name}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Country: <strong>{activeBuyer.country || 'Unspecified'}</strong> | Port:{' '}
                <strong>{activeBuyer.portOfDischarge || 'Standard'}</strong> | Payment Terms:{' '}
                <strong>{activeBuyer.paymentTerms || 'Standard Terms'}</strong>
              </p>
            </div>

            {/* Financial summary numbers & scope toggler for this specific buyer */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setLedgerScope('AUTO')}
                  className={`px-2 py-1 rounded font-semibold transition-colors ${
                    ledgerScope === 'AUTO'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Selected FY ({activeBuyer.shipmentCount})
                </button>
                <button
                  onClick={() => setLedgerScope('ALL_YEARS')}
                  className={`px-2 py-1 rounded font-semibold transition-colors ${
                    ledgerScope === 'ALL_YEARS'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lifetime ({activeBuyer.lifetimeShipmentCount})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-600">
                  Total Invoiced:{' '}
                  <strong className="text-slate-900">
                    $
                    {(ledgerScope === 'ALL_YEARS'
                      ? activeBuyer.lifetimeInvoicedUsd
                      : activeBuyer.totalInvoicedUsd
                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
                <span className="text-emerald-700">
                  Realised:{' '}
                  <strong>
                    $
                    {(ledgerScope === 'ALL_YEARS'
                      ? activeBuyer.lifetimeRealisedUsd
                      : activeBuyer.totalRealisedUsd
                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
                <span className="text-amber-700 font-bold">
                  Outstanding:{' '}
                  <strong>
                    $
                    {(ledgerScope === 'ALL_YEARS'
                      ? activeBuyer.lifetimeOutstandingUsd
                      : activeBuyer.outstandingUsd
                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Ledger Invoices Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="p-2.5">Invoice No.</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Shipping Bill</th>
                  <th className="p-2.5">Port / Vessel</th>
                  <th className="p-2.5 text-right">Invoiced USD (Debit)</th>
                  <th className="p-2.5 text-right">Realised USD (Credit)</th>
                  <th className="p-2.5 text-right font-bold text-amber-700">Balance Due</th>
                  <th className="p-2.5 text-center">Payment Status</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {ledgerShipments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      <div>No shipments recorded for {activeBuyer.name} in this financial year.</div>
                      {activeBuyer.lifetimeShipmentCount > 0 && ledgerScope !== 'ALL_YEARS' && (
                        <button
                          onClick={() => setLedgerScope('ALL_YEARS')}
                          className="mt-2 text-xs text-blue-600 font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <span>View {activeBuyer.lifetimeShipmentCount} lifetime invoice(s) across all financial years</span>
                          <ArrowRight size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  ledgerShipments.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-bold text-slate-900">{s.invoiceNumber}</td>
                      <td className="p-2.5 text-slate-600">{s.invoiceDate}</td>
                      <td className="p-2.5 font-semibold text-slate-800">
                        {s.shippingBillNumber || '—'}
                      </td>
                      <td className="p-2.5 text-slate-500 font-mono text-[11px]">
                        {s.portCode || '—'} {s.vesselName ? `| ${s.vesselName}` : ''}
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        ${Number(s.invoiceValueUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">
                        ${Number(s.totalPaidUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-right font-bold text-amber-700">
                        ${Number(s.balanceDueUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => onSelectShipment(s.id)}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] inline-flex items-center gap-0.5"
                        >
                          <span>Open Dossier</span>
                          <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
