/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, X, ArrowRight, ExternalLink } from 'lucide-react';
import { api } from '../api/client.ts';
import { Shipment } from '../types/index.ts';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectShipment: (id: string) => void;
  selectedFyId: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectShipment,
  selectedFyId,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Shipment[]>([]);
  const [normalizedKey, setNormalizedKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setNormalizedKey('');
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.lookupShipments(query, selectedFyId);
        setResults(res.matches);
        setNormalizedKey(res.normalizedQueryKey);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, selectedFyId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-8 sm:pt-20 p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Search Input Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center space-x-3 bg-slate-50">
          <Search size={20} className="text-slate-400" />
          <input
            type="text"
            autoFocus
            placeholder="Type invoice no (e.g. SKE/26-27/020), SB No, IRM, or buyer..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 shrink-0 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="h-7 px-2.5 rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300 text-xs font-semibold shrink-0 transition-colors inline-flex items-center justify-center"
          >
            ESC
          </button>
        </div>

        {/* Normalized Identity Indicator */}
        {normalizedKey && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-xs text-blue-900">
            <span className="flex items-center gap-1.5">
              Normalized Invoice Identity:
              <strong className="font-mono bg-blue-100 px-2 py-0.5 rounded text-blue-800 font-bold">
                {normalizedKey}
              </strong>
            </span>
            <span className="text-[11px] text-blue-700">Resolves variants like SKE-26-27-20 / SKE PI 26 27 020</span>
          </div>
        )}

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
              Searching export records & payments...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              No matching shipments found for "{query}".
            </div>
          )}

          {!loading && !query && (
            <div className="py-8 text-center text-slate-400 text-xs space-y-2">
              <p>Quick Search Examples:</p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setQuery('SKE/26-27/020')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-mono text-[11px] text-slate-700"
                >
                  SKE/26-27/020
                </button>
                <button
                  onClick={() => setQuery('8392011')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-mono text-[11px] text-slate-700"
                >
                  SB 8392011
                </button>
                <button
                  onClick={() => setQuery('IRM26052026001')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-mono text-[11px] text-slate-700"
                >
                  IRM26052026001
                </button>
              </div>
            </div>
          )}

          {results.map((shipment) => (
            <div
              key={shipment.id}
              onClick={() => {
                onSelectShipment(shipment.id);
                onClose();
              }}
              className="p-3 bg-slate-50 hover:bg-blue-50/60 rounded-lg border border-slate-200 hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm text-slate-900 group-hover:text-blue-700">
                    {shipment.invoiceNumber}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                    {shipment.normalizedInvoiceKey}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      shipment.paymentStatus === 'FULLY_PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : shipment.paymentStatus === 'PART_PAID'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {shipment.paymentStatus}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Buyer: <strong>{shipment.consigneeName}</strong></span>
                  <span className="hidden sm:inline">•</span>
                  <span>SB: <strong>{shipment.shippingBillNumber}</strong></span>
                  <span className="hidden sm:inline">•</span>
                  <span>Value: <strong>${shipment.invoiceValueUsd.toLocaleString()}</strong></span>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-slate-400 group-hover:text-blue-600">
                <span className="text-xs font-medium">View Detail</span>
                <ArrowRight size={16} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
