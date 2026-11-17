/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Download,
  TrendingUp,
  Calendar,
  Building2,
  Award,
  Landmark,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { Shipment, ConsigneeMaster, BankMaster, Payment } from '../types/index.ts';
import { api } from '../api/client.ts';

interface SummaryReportsViewProps {
  selectedFyId: string;
  refreshKey?: number;
}

export const SummaryReportsView: React.FC<SummaryReportsViewProps> = ({
  selectedFyId,
  refreshKey,
}) => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [consignees, setConsignees] = useState<ConsigneeMaster[]>([]);
  const [banks, setBanks] = useState<BankMaster[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getShipments({ financialYearId: selectedFyId !== 'ALL' ? selectedFyId : undefined }),
      api.getConsignees(),
      api.getBanks(),
      api.getPayments(),
    ])
      .then(([sData, cData, bData, pData]) => {
        setShipments(sData);
        setConsignees(cData);
        setBanks(bData);
        setPayments(pData);
      })
      .catch((err) => console.error('Error fetching summary report data:', err))
      .finally(() => setLoading(false));
  }, [selectedFyId, refreshKey]);

  // 1. Cross-tabulation by Actual Buyer (Part 9.1) — strict matching, never fall back to first buyer
  const buyerCrossTab = useMemo(() => {
    const stats: Record<
      string,
      {
        bills: number;
        billedUsd: number;
        realisedUsd: number;
        realisedInr: number;
        fobInr: number;
        netForexInr: number;
      }
    > = {};

    const buyerColumns: string[] = [];
    const registerBuyer = (label: string) => {
      const normalized = label.trim().toUpperCase();
      if (!normalized) return 'UNSPECIFIED CONSIGNEE';
      if (!stats[normalized]) {
        stats[normalized] = {
          bills: 0,
          billedUsd: 0,
          realisedUsd: 0,
          realisedInr: 0,
          fobInr: 0,
          netForexInr: 0,
        };
        buyerColumns.push(normalized);
      }
      return normalized;
    };

    const consigneeById = new Map<string, ConsigneeMaster>();
    for (const c of consignees) {
      consigneeById.set(c.id, c);
      registerBuyer(c.name);
    }

    const total = {
      bills: 0,
      billedUsd: 0,
      realisedUsd: 0,
      realisedInr: 0,
      fobInr: 0,
      netForexInr: 0,
    };

    for (const s of shipments) {
      const masterBuyer = s.consigneeId ? consigneeById.get(s.consigneeId) : undefined;
      const buyerLabel = masterBuyer?.name || s.consigneeName || 'UNSPECIFIED CONSIGNEE';
      const matchedBuyer = registerBuyer(buyerLabel);

      const totalPaid = s.totalPaidUsd || 0;
      const balUsd = s.balanceDueUsd ?? Math.max(0, s.invoiceValueUsd - totalPaid);
      const realisedRate = s.averageRealisedRate || s.sbExchangeRate || 0;
      const realisedInr = s.realisedInr ?? (totalPaid * realisedRate);
      const fobInr = s.fobValueInr || 0;
      const forex = balUsd === 0 && totalPaid > 0 ? realisedInr - fobInr : 0;

      stats[matchedBuyer].bills += 1;
      stats[matchedBuyer].billedUsd += s.invoiceValueUsd;
      stats[matchedBuyer].realisedUsd += totalPaid;
      stats[matchedBuyer].realisedInr += realisedInr;
      stats[matchedBuyer].fobInr += fobInr;
      stats[matchedBuyer].netForexInr += forex;

      total.bills += 1;
      total.billedUsd += s.invoiceValueUsd;
      total.realisedUsd += totalPaid;
      total.realisedInr += realisedInr;
      total.fobInr += fobInr;
      total.netForexInr += forex;
    }

    return { buyerColumns, stats, total };
  }, [shipments, consignees]);

  // 2. Incentive Scheme Summary (Part 9.1)
  const incentiveSchemes = useMemo(() => {
    let dbkClaimed = 0;
    let dbkReceived = 0;
    let rodtepClaimed = 0;
    let rodtepReceived = 0;
    let rosctlClaimed = 0;
    let rosctlReceived = 0;

    for (const s of shipments) {
      if (s.incentives) {
        for (const inc of s.incentives) {
          if (inc.type === 'DRAWBACK') {
            dbkClaimed += inc.claimedAmount;
            dbkReceived += inc.receivedAmount;
          } else if (inc.type === 'RODTEP') {
            rodtepClaimed += inc.claimedAmount;
            rodtepReceived += inc.receivedAmount;
          } else if (inc.type === 'ROSCTL') {
            rosctlClaimed += inc.claimedAmount;
            rosctlReceived += inc.receivedAmount;
          }
        }
      }
    }

    const totalClaimed = dbkClaimed + rodtepClaimed + rosctlClaimed;
    const totalReceived = dbkReceived + rodtepReceived + rosctlReceived;

    return [
      {
        name: 'Duty Drawback (DBK)',
        code: 'DBK',
        claimed: dbkClaimed,
        received: dbkReceived,
        pending: Math.max(0, dbkClaimed - dbkReceived),
        pct: dbkClaimed > 0 ? (dbkReceived / dbkClaimed) * 100 : 0,
      },
      {
        name: 'Remission of Duties and Taxes (RoDTEP)',
        code: 'RoDTEP',
        claimed: rodtepClaimed,
        received: rodtepReceived,
        pending: Math.max(0, rodtepClaimed - rodtepReceived),
        pct: rodtepClaimed > 0 ? (rodtepReceived / rodtepClaimed) * 100 : 0,
      },
      {
        name: 'Rebate of State and Central Taxes (RoSCTL)',
        code: 'RoSCTL',
        claimed: rosctlClaimed,
        received: rosctlReceived,
        pending: Math.max(0, rosctlClaimed - rosctlReceived),
        pct: rosctlClaimed > 0 ? (rosctlReceived / rosctlClaimed) * 100 : 0,
      },
      {
        name: 'Total Government Export Incentives',
        code: 'TOTAL',
        claimed: totalClaimed,
        received: totalReceived,
        pending: Math.max(0, totalClaimed - totalReceived),
        pct: totalClaimed > 0 ? (totalReceived / totalClaimed) * 100 : 0,
        isTotal: true,
      },
    ];
  }, [shipments]);

  // 3. Bank-wise Realisation breakdown (Part 9.1) — attributed per allocation's actual bank
  const bankBreakdown = useMemo(() => {
    const map: Record<
      string,
      { bankName: string; shipmentIds: Set<string>; realisedUsd: number; realisedInr: number }
    > = {};

    const bankByName = new Map<string, BankMaster>();
    for (const b of banks) {
      map[b.id] = {
        bankName: b.name,
        shipmentIds: new Set(),
        realisedUsd: 0,
        realisedInr: 0,
      };
      bankByName.set(b.name.trim().toLowerCase(), b);
    }

    const paymentById = new Map<string, Payment>();
    for (const p of payments) {
      paymentById.set(p.id, p);
    }

    for (const s of shipments) {
      const allocs = s.allocations || [];
      for (const a of allocs) {
        const payment = paymentById.get(a.paymentId);
        let targetId = payment?.bankId;
        if (!targetId && a.paymentBankName) {
          targetId = bankByName.get(a.paymentBankName.trim().toLowerCase())?.id;
        }
        const fallbackKey = targetId || `unassigned:${a.paymentBankName || 'Unknown'}`;
        if (!map[fallbackKey]) {
          map[fallbackKey] = {
            bankName: a.paymentBankName || payment?.bankName || 'Unassigned AD Bank',
            shipmentIds: new Set(),
            realisedUsd: 0,
            realisedInr: 0,
          };
        }

        const allocUsd = Number(a.allocatedAmountUsd || 0);
        const fxRate =
          Number(a.paymentExchangeRate || payment?.exchangeRate || 0) ||
          (s.totalPaidUsd && s.realisedInr ? s.realisedInr / s.totalPaidUsd : s.averageRealisedRate || s.sbExchangeRate || 0);
        const allocInr = allocUsd * fxRate;

        map[fallbackKey].shipmentIds.add(s.id);
        map[fallbackKey].realisedUsd += allocUsd;
        map[fallbackKey].realisedInr += allocInr;
      }
    }

    return Object.values(map).map((entry) => ({
      bankName: entry.bankName,
      bills: entry.shipmentIds.size,
      realisedUsd: entry.realisedUsd,
      realisedInr: entry.realisedInr,
    }));
  }, [shipments, banks, payments]);

  // 4. Monthly Breakdown
  const monthlyData = useMemo(() => {
    const map: Record<
      string,
      {
        monthLabel: string;
        shipmentCount: number;
        invoicedUsd: number;
        realisedUsd: number;
        fobInr: number;
        realisedInr: number;
        incentivesClaimed: number;
        incentivesReceived: number;
      }
    > = {};

    for (const s of shipments) {
      const d = new Date(s.invoiceDate);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' });

      if (!map[mKey]) {
        map[mKey] = {
          monthLabel: mLabel,
          shipmentCount: 0,
          invoicedUsd: 0,
          realisedUsd: 0,
          fobInr: 0,
          realisedInr: 0,
          incentivesClaimed: 0,
          incentivesReceived: 0,
        };
      }

      map[mKey].shipmentCount += 1;
      map[mKey].invoicedUsd += s.invoiceValueUsd;
      map[mKey].realisedUsd += s.totalPaidUsd || 0;
      map[mKey].fobInr += s.fobValueInr;
      map[mKey].realisedInr += s.realisedInr || 0;

      if (s.incentives) {
        for (const inc of s.incentives) {
          map[mKey].incentivesClaimed += inc.claimedAmount;
          map[mKey].incentivesReceived += inc.receivedAmount;
        }
      }
    }

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, v]) => v);
  }, [shipments]);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
        Aggregating Worksheet 5: Summary financial statements...
      </div>
    );
  }

  const { buyerColumns, stats, total } = buyerCrossTab;
  const realizationPct = total.billedUsd > 0 ? (total.realisedUsd / total.billedUsd) * 100 : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 size={22} className="text-blue-600" />
            <span>Summary Financial Reports &amp; Cross-Tabulation</span>
          </h2>
          <p className="text-xs text-slate-500">
            Worksheet 5: Buyer matrices, incentive scheme realization, bank distribution, and Forex reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void api.downloadExportCsv(
                'Summary',
                selectedFyId,
                `SKE_Summary_Report_${selectedFyId}_${new Date().toISOString().split('T')[0]}.csv`
              )
            }
            className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download size={14} className="text-blue-600" />
            <span>Export Summary CSV</span>
          </button>
        </div>
      </div>

      {/* FINANCIAL RECONCILIATION & FOREX CARD (Part 9.1) */}
      <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl text-white shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700 pb-4">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase block">
              Worksheet 5 Financial Core
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              Forex &amp; Bank Realisation Master Reconciliation
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-slate-300 font-mono">
              Overall Realisation: <strong className="text-emerald-400">{realizationPct.toFixed(1)}%</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Total Billed (USD)</span>
            <div className="text-lg font-bold font-mono text-white mt-0.5">
              ${total.billedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-slate-400">Total Commercial Invoices</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Realised Bank (USD)</span>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              ${total.realisedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-emerald-400/80">Inward Remittance Credits</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Customs FOB (INR)</span>
            <div className="text-lg font-bold font-mono text-slate-300 mt-0.5">
              ₹{total.fobInr.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-slate-400">Export Shipping Bill Val</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Bank Realised (INR)</span>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              ₹{total.realisedInr.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-slate-400">FIRC Inward Amount</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Net Forex Gain/Loss (INR)</span>
            <div className={`text-lg font-bold font-mono mt-0.5 ${total.netForexInr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {total.netForexInr >= 0 ? '+' : ''}₹{total.netForexInr.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-slate-400">Realised INR − FOB INR</span>
          </div>
        </div>
      </div>

      {/* 1. CONSIGNEE CROSS-TABULATION MATRIX (Part 9.1) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 size={16} className="text-blue-600" />
            <span>Overseas Consignee Matrix ({buyerColumns.length} Buyers + Consolidated Total)</span>
          </h3>
          <span className="text-xs text-slate-400">Canonical Worksheet 5 Layout</span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3 w-48">Financial Metric</th>
                  {buyerColumns.map((b) => (
                    <th key={b} className="p-3 text-right max-w-[150px] truncate" title={b}>
                      {b.replace(' PRIVATE LIMITED', '').replace(' PVT LTD', '')}
                    </th>
                  ))}
                  <th className="p-3 text-right bg-slate-800 text-amber-400 font-bold">Consolidated Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {/* Row 1: Total Bills */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-sans font-semibold text-slate-900">Total Bills (Count)</td>
                  {buyerColumns.map((b) => (
                    <td key={b} className="p-3 text-right text-slate-700">
                      {stats[b].bills}
                    </td>
                  ))}
                  <td className="p-3 text-right font-bold text-slate-900 bg-slate-50/70">{total.bills}</td>
                </tr>

                {/* Row 2: Billed USD */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-sans font-semibold text-slate-900">Billed Value (USD)</td>
                  {buyerColumns.map((b) => (
                    <td key={b} className="p-3 text-right text-slate-900">
                      ${stats[b].billedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  ))}
                  <td className="p-3 text-right font-bold text-slate-900 bg-slate-50/70">
                    ${total.billedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Row 3: Realised USD */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-sans font-semibold text-slate-900">Realised Value (USD)</td>
                  {buyerColumns.map((b) => (
                    <td key={b} className="p-3 text-right text-emerald-700 font-semibold">
                      ${stats[b].realisedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  ))}
                  <td className="p-3 text-right font-bold text-emerald-700 bg-slate-50/70">
                    ${total.realisedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Row 4: Customs FOB INR */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-sans font-semibold text-slate-900">Customs FOB (INR)</td>
                  {buyerColumns.map((b) => (
                    <td key={b} className="p-3 text-right text-slate-700">
                      ₹{stats[b].fobInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  ))}
                  <td className="p-3 text-right font-bold text-slate-800 bg-slate-50/70">
                    ₹{total.fobInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Row 5: Realised INR */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-sans font-semibold text-slate-900">Realised Bank (INR)</td>
                  {buyerColumns.map((b) => (
                    <td key={b} className="p-3 text-right text-emerald-700">
                      ₹{stats[b].realisedInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  ))}
                  <td className="p-3 text-right font-bold text-emerald-700 bg-slate-50/70">
                    ₹{total.realisedInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Row 6: Net Forex Gain/Loss INR */}
                <tr className="bg-slate-50/50 hover:bg-slate-100">
                  <td className="p-3 font-sans font-bold text-slate-900">Net Forex Gain/Loss (INR)</td>
                  {buyerColumns.map((b) => {
                    const fx = stats[b].netForexInr;
                    return (
                      <td key={b} className={`p-3 text-right font-bold ${fx >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {fx >= 0 ? '+' : ''}₹{fx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                  <td className={`p-3 text-right font-bold bg-slate-100 ${total.netForexInr >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {total.netForexInr >= 0 ? '+' : ''}₹{total.netForexInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. INCENTIVE SCHEME SUMMARY TABLE (Part 9.1) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Award size={16} className="text-amber-600" />
            <span>Government Export Incentive Scheme Performance</span>
          </h3>
          <span className="text-xs text-slate-400">Duty Drawback, RoDTEP &amp; RoSCTL</span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3">Incentive Scheme</th>
                <th className="p-3 text-right">Total Claimed (INR)</th>
                <th className="p-3 text-right">Received (INR)</th>
                <th className="p-3 text-right">Pending Credit (INR)</th>
                <th className="p-3 text-center w-36">% Realised</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {incentiveSchemes.map((scheme) => (
                <tr
                  key={scheme.code}
                  className={scheme.isTotal ? 'bg-slate-50 font-bold' : 'hover:bg-slate-50'}
                >
                  <td className="p-3 font-semibold text-slate-900 flex items-center gap-2">
                    <span>{scheme.name}</span>
                  </td>
                  <td className="p-3 text-right font-mono text-slate-700">
                    ₹{scheme.claimed.toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-emerald-700">
                    ₹{scheme.received.toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-amber-700">
                    ₹{scheme.pending.toLocaleString()}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, scheme.pct)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] font-bold text-slate-700 w-10 text-right">
                        {scheme.pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. BANK-WISE REALISATION BREAKDOWN (Part 9.1) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Landmark size={16} className="text-purple-600" />
            <span>Bank-wise Realisation Breakdown</span>
          </h3>
          <span className="text-xs text-slate-400">Authorized Dealer Banks</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {bankBreakdown.map((b, idx) => (
            <div key={idx} className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                  AD Bank
                </span>
                <span className="text-xs font-mono font-bold text-slate-700">{b.bills} Invoices</span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 truncate" title={b.bankName}>
                {b.bankName}
              </h4>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-700 font-bold">${b.realisedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-slate-600">₹{b.realisedInr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. MONTHLY REALISATION BREAKDOWN */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Calendar size={16} className="text-blue-600" />
          <span>Monthly Volume &amp; Realisation Cadence</span>
        </h3>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3">Month</th>
                  <th className="p-3 text-center">Shipments</th>
                  <th className="p-3 text-right">Invoiced (USD)</th>
                  <th className="p-3 text-right">Realised (USD)</th>
                  <th className="p-3 text-right font-bold text-emerald-400">Realisation %</th>
                  <th className="p-3 text-right">Customs FOB (INR)</th>
                  <th className="p-3 text-right">Realised Bank (INR)</th>
                  <th className="p-3 text-right">Incentives Claimed</th>
                  <th className="p-3 text-right">Incentives Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {monthlyData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      No monthly shipments available.
                    </td>
                  </tr>
                ) : (
                  monthlyData.map((m) => {
                    const pct = m.invoicedUsd > 0 ? (m.realisedUsd / m.invoicedUsd) * 100 : 0;
                    return (
                      <tr key={m.monthLabel} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900">{m.monthLabel}</td>
                        <td className="p-3 text-center font-mono text-slate-600">{m.shipmentCount}</td>
                        <td className="p-3 text-right font-mono text-slate-900">${m.invoicedUsd.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-emerald-700 font-semibold">${m.realisedUsd.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600">{pct.toFixed(1)}%</td>
                        <td className="p-3 text-right font-mono text-slate-600">₹{m.fobInr.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-slate-800">₹{m.realisedInr.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-slate-600">₹{m.incentivesClaimed.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-emerald-700">₹{m.incentivesReceived.toLocaleString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
