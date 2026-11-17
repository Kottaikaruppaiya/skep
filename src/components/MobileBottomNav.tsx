/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  PlusCircle,
  CreditCard,
  Menu,
} from 'lucide-react';
import { NavItemKey } from './Sidebar.tsx';
import { Role } from '../types/index.ts';

interface MobileBottomNavProps {
  currentTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  onOpenNewShipment: () => void;
  onToggleMenu: () => void;
  userRole: Role;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenNewShipment,
  onToggleMenu,
  userRole,
}) => {
  const isViewer = userRole === 'VIEWER';

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg px-2 pb-safe"
    >
      <div className="grid grid-cols-5 items-center h-16 max-w-md mx-auto">
        {/* 1. Dashboard */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] transition-colors ${
            currentTab === 'dashboard'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard size={20} className={currentTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px] tracking-tight mt-1">Dashboard</span>
        </button>

        {/* 2. Shipments */}
        <button
          onClick={() => onSelectTab('shipments')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] transition-colors ${
            currentTab === 'shipments'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet size={20} className={currentTab === 'shipments' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px] tracking-tight mt-1">Shipments</span>
        </button>

        {/* 3. New Shipment (Hero Action Button) */}
        <div className="flex items-center justify-center">
          <button
            onClick={isViewer ? () => onSelectTab('lookup') : onOpenNewShipment}
            title={isViewer ? 'Search Invoice' : 'Create New Shipment'}
            className="flex flex-col items-center justify-center w-11 h-11 -mt-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-95"
            aria-label={isViewer ? 'Search Invoices' : 'Create New Shipment'}
          >
            <PlusCircle size={22} className="stroke-[2.5]" />
          </button>
        </div>

        {/* 4. Payments (FIRC) */}
        <button
          onClick={() => onSelectTab('payments')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] transition-colors ${
            currentTab === 'payments'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <CreditCard size={20} className={currentTab === 'payments' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px] tracking-tight mt-1">Payments</span>
        </button>

        {/* 5. More / Menu Drawer Toggle */}
        <button
          onClick={onToggleMenu}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-slate-500 dark:text-slate-400 hover:text-slate-800 transition-colors"
          aria-label="Open Full Navigation Menu"
        >
          <Menu size={20} className="stroke-2" />
          <span className="text-[10px] tracking-tight mt-1">Menu</span>
        </button>
      </div>
    </nav>
  );
};
