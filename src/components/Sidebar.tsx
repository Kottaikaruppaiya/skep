/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  PlusCircle,
  Search,
  CreditCard,
  Award,
  FileCheck2,
  FileText,
  Building2,
  Landmark,
  FileDown,
  Receipt,
  Users,
  Settings,
  Eye,
  BarChart3,
  UsersRound,
  X,
  Calendar,
} from 'lucide-react';
import { Role } from '../types/index.ts';

export type NavItemKey =
  | 'dashboard'
  | 'quick-view'
  | 'summary-reports'
  | 'shipments'
  | 'new-shipment'
  | 'lookup'
  | 'payments'
  | 'brc'
  | 'incentives'
  | 'documents'
  | 'sk-global-ledger'
  | 'shasvanth-ledger'
  | 'precision-tex-ledger'
  | 'tex-fab-ledger'
  | 'winfield-ledger'
  | 'consignee-summary'
  | 'consignee-master'
  | 'bank-master'
  | 'excel'
  | 'gst-entry'
  | 'b2b-dashboard'
  | 'b2b-monthly'
  | 'b2b-monthly-detail'
  | 'b2b-register'
  | 'b2b-suppliers'
  | 'b2b-import'
  | 'b2b-reports'
  | 'users'
  | 'settings';

interface SidebarProps {
  currentTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  userRole: Role;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  isOpenMobile,
  onCloseMobile,
}) => {
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isViewer = userRole === 'VIEWER';

  const handleItemClick = (tab: NavItemKey) => {
    onSelectTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 text-xs">
      {/* Overview */}
      <div>
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Overview & Analytics
        </div>
        <div className="space-y-1">
          <NavItem
            icon={<LayoutDashboard size={16} />}
            label="Dashboard"
            active={currentTab === 'dashboard'}
            onClick={() => handleItemClick('dashboard')}
          />
          <NavItem
            icon={<Eye size={16} />}
            label="Quick View"
            active={currentTab === 'quick-view'}
            onClick={() => handleItemClick('quick-view')}
          />
          <NavItem
            icon={<BarChart3 size={16} />}
            label="Summary Reports"
            active={currentTab === 'summary-reports'}
            onClick={() => handleItemClick('summary-reports')}
          />
        </div>
      </div>

      {/* Shipments & Realisation */}
      <div>
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Export Operations
        </div>
        <div className="space-y-1">
          <NavItem
            icon={<FileSpreadsheet size={16} />}
            label="Export Shipments"
            active={currentTab === 'shipments'}
            onClick={() => handleItemClick('shipments')}
          />
          {!isViewer && (
            <NavItem
              icon={<PlusCircle size={16} className="text-emerald-400" />}
              label="New Shipment"
              active={currentTab === 'new-shipment'}
              onClick={() => handleItemClick('new-shipment')}
            />
          )}
          <NavItem
            icon={<Search size={16} />}
            label="Invoice Lookup"
            active={currentTab === 'lookup'}
            onClick={() => handleItemClick('lookup')}
          />
          <NavItem
            icon={<CreditCard size={16} />}
            label="Payments & Allocations"
            active={currentTab === 'payments'}
            onClick={() => handleItemClick('payments')}
          />
          <NavItem
            icon={<FileCheck2 size={16} />}
            label="BRC / eBRC Tracking"
            active={currentTab === 'brc'}
            onClick={() => handleItemClick('brc')}
          />
          <NavItem
            icon={<Award size={16} />}
            label="Incentives (DBK/RoDTEP)"
            active={currentTab === 'incentives'}
            onClick={() => handleItemClick('incentives')}
          />
          <NavItem
            icon={<FileText size={16} />}
            label="Document Review & Vault"
            active={currentTab === 'documents'}
            onClick={() => handleItemClick('documents')}
          />
        </div>
      </div>

      {/* B2B GST Management */}
      <div>
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          B2B GST Management
        </div>
        <div className="space-y-1">
          <NavItem
            icon={<LayoutDashboard size={16} className="text-teal-400" />}
            label="B2B Dashboard"
            active={currentTab === 'b2b-dashboard'}
            onClick={() => handleItemClick('b2b-dashboard')}
          />
          <NavItem
            icon={<Calendar size={16} className="text-blue-400" />}
            label="Monthly GST Entries"
            active={currentTab === 'b2b-monthly' || currentTab === 'b2b-monthly-detail'}
            onClick={() => handleItemClick('b2b-monthly')}
          />
          <NavItem
            icon={<FileText size={16} className="text-indigo-400" />}
            label="B2B Invoice Register"
            active={currentTab === 'b2b-register'}
            onClick={() => handleItemClick('b2b-register')}
          />
          <NavItem
            icon={<Building2 size={16} className="text-amber-400" />}
            label="Supplier Master"
            active={currentTab === 'b2b-suppliers'}
            onClick={() => handleItemClick('b2b-suppliers')}
          />
          <NavItem
            icon={<FileDown size={16} className="text-emerald-400" />}
            label="Excel / CSV Import"
            active={currentTab === 'b2b-import'}
            onClick={() => handleItemClick('b2b-import')}
          />
          <NavItem
            icon={<Receipt size={16} className="text-purple-400" />}
            label="GST Reports & Export"
            active={currentTab === 'b2b-reports'}
            onClick={() => handleItemClick('b2b-reports')}
          />
        </div>
      </div>

      {/* Company Ledgers (Worksheets 7-11) */}
      <div>
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Buyer Ledgers (5 Companies)
        </div>
        <div className="space-y-1">
          <NavItem
            icon={<Building2 size={16} className="text-amber-400" />}
            label="SK Global Ventures"
            active={currentTab === 'sk-global-ledger'}
            onClick={() => handleItemClick('sk-global-ledger')}
          />
          <NavItem
            icon={<Building2 size={16} className="text-cyan-400" />}
            label="Shasvanth Impex"
            active={currentTab === 'shasvanth-ledger'}
            onClick={() => handleItemClick('shasvanth-ledger')}
          />
          <NavItem
            icon={<Building2 size={16} className="text-emerald-400" />}
            label="Precision Tex Lanka"
            active={currentTab === 'precision-tex-ledger'}
            onClick={() => handleItemClick('precision-tex-ledger')}
          />
          <NavItem
            icon={<Building2 size={16} className="text-indigo-400" />}
            label="Tex Fab Lanka"
            active={currentTab === 'tex-fab-ledger'}
            onClick={() => handleItemClick('tex-fab-ledger')}
          />
          <NavItem
            icon={<Building2 size={16} className="text-purple-400" />}
            label="Winfield Merchant"
            active={currentTab === 'winfield-ledger'}
            onClick={() => handleItemClick('winfield-ledger')}
          />
        </div>
      </div>

      {/* Masters & Data */}
      <div>
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Masters & Reports
        </div>
        <div className="space-y-1">
          <NavItem
            icon={<UsersRound size={16} />}
            label="Consignee Summary"
            active={currentTab === 'consignee-summary'}
            onClick={() => handleItemClick('consignee-summary')}
          />
          <NavItem
            icon={<Building2 size={16} />}
            label="Consignee Master"
            active={currentTab === 'consignee-master'}
            onClick={() => handleItemClick('consignee-master')}
          />
          <NavItem
            icon={<Landmark size={16} />}
            label="Bank Master"
            active={currentTab === 'bank-master'}
            onClick={() => handleItemClick('bank-master')}
          />
          <NavItem
            icon={<FileDown size={16} />}
            label="Excel Import & Export"
            active={currentTab === 'excel'}
            onClick={() => handleItemClick('excel')}
          />
        </div>
      </div>

      {/* Administration */}
      <div>
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Security & Controls
        </div>
        <div className="space-y-1">
          {isSuperAdmin && (
            <NavItem
              icon={<Users size={16} className="text-indigo-400" />}
              label="User Management"
              active={currentTab === 'users'}
              onClick={() => handleItemClick('users')}
            />
          )}
          <NavItem
            icon={<Settings size={16} />}
            label="Application Settings"
            active={currentTab === 'settings'}
            onClick={() => handleItemClick('settings')}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-300 flex-col flex-shrink-0 border-r border-slate-800 select-none">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-slate-950">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
            SKE
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight leading-tight">
              S K Enterprises
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Export & Realisation</p>
          </div>
        </div>

        {/* Navigation Sections */}
        {navContent}

        {/* System Status Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 text-[11px] flex items-center justify-between">
          <span className="text-slate-400 font-medium">System Status</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Online & Compliant
          </span>
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Body */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-slate-300 shadow-2xl z-10 border-r border-slate-800 select-none">
            {/* Drawer Header with Close Button */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-md">
                  SKE
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-tight leading-tight">
                    S K Enterprises
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium">Export Navigation</p>
                </div>
              </div>

              <button
                onClick={onCloseMobile}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Sections */}
            {navContent}

            {/* System Status Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 text-[11px] flex items-center justify-between">
              <span className="text-slate-400 font-medium">System Status</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Online & Compliant
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-2.5 px-3 py-2.5 min-h-[44px] rounded-lg font-medium text-left transition-colors cursor-pointer text-xs ${
        active
          ? 'bg-blue-600 text-white shadow-sm font-semibold'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
};
