/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  FileCheck2,
  DollarSign,
  Ship,
  Award,
  ArrowRight,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { User, Role } from '../types/index.ts';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Corporate email is required.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await api.login(email.trim(), password);
      if (res && res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      if (err?.code === 'DATABASE_UNREACHABLE') {
        setError('PostgreSQL database server is currently unreachable. Start PostgreSQL or verify DATABASE_URL.');
      } else if (err?.code === 'DATABASE_UNCONFIGURED' || err?.status === 503) {
        setError('PostgreSQL database is not configured on this runtime. Set DATABASE_URL in .env to enable authentication and data persistence.');
      } else {
        setError(err.message || 'Invalid email or password. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Background Subtle Ambient Glows */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-lg shadow-blue-500/20">
            SKE
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight text-white">S K Enterprises</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                v2026.1 Enterprise
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Export Documentation & Realisation Management System</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="flex items-center space-x-1.5 text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium text-[11px]">System Online & Compliant</span>
          </span>
          <span className="text-slate-500 text-[11px] hidden md:inline">RBI EDPMS & DGFT eBRC Compatible</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 z-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Enterprise Highlights */}
          <div className="lg:col-span-7 space-y-6 lg:pr-6">
            <div className="space-y-3">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold">
                <Sparkles size={13} className="text-blue-400" />
                <span>Financial Realisation Console</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Single-source truth for all <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">Export Documents</span> & Bank Remittances.
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-xl">
                Seamlessly track commercial invoices, Shipping Bills, FIRC foreign inward payment allocations, and statutory 270-day BRC/eBRC deadlines in one unified portal.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2.5">
                  <Ship size={17} />
                </div>
                <h2 className="text-xs font-bold text-white mb-1">Invoice & S/B Master</h2>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Auto-normalized invoice sequence keys, customs exchange rate reconciliation, and port filing tracking.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2.5">
                  <DollarSign size={17} />
                </div>
                <h2 className="text-xs font-bold text-white mb-1">FIRC Remittance Engine</h2>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Strict concurrency-safe allocation preventing over-allocation with live USD balance and realised INR tracking.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2.5">
                  <Clock size={17} />
                </div>
                <h2 className="text-xs font-bold text-white mb-1">DGFT eBRC Tracker</h2>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Automated countdown to statutory 270-day realisation limits, with Single & Multiple copy certificate archival.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2.5">
                  <Award size={17} />
                </div>
                <h2 className="text-xs font-bold text-white mb-1">Export Incentives</h2>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Duty Drawback (DBK), RoDTEP, and RoSCTL ledger with scroll status verification and outstanding balance tracking.
                </p>
              </div>
            </div>

            {/* Compliance Note */}
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 pt-1">
              <Shield size={14} className="text-slate-400 flex-shrink-0" />
              <span>Sessions are protected with signed JWT tokens, server-side revocation, and role-based access control.</span>
            </div>
          </div>

          {/* Right Column: High-Fidelity Production Login Card */}
          <div className="lg:col-span-5">
            <div className="w-full bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative">
              {/* Card Title */}
              <div className="mb-6 space-y-1.5">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Corporate Sign In</h2>
                </div>
                <p className="text-xs text-slate-400">
                  Enter your registered corporate credentials to access the export console.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-5 p-3 rounded-xl bg-red-950/70 border border-red-800/80 text-red-300 text-xs flex items-start space-x-2.5">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-400" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Corporate Email Address
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@skenterprises.com"
                      className="w-full h-11 bg-slate-950/90 border border-slate-700/80 rounded-xl pl-10 pr-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Password
                    </label>
                  </div>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter account password"
                      className="w-full h-11 bg-slate-950/90 border border-slate-700/80 rounded-xl pl-10 pr-11 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1.5 bottom-1.5 px-2 flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center space-x-2 text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="text-[11px]">Remember this device</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Encrypted Session
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying Credentials...</span>
                      </div>
                    ) : (
                      <>
                        <span>Sign In to Dashboard</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Security Statement Notice */}
              <div className="mt-6 pt-5 border-t border-slate-800/80">
                <div className="flex items-start space-x-2 text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                  <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200">Authorized Personnel Only:</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">
                      Export documentation access is restricted by role permissions. Super Admins may provision accounts and roles via User Management.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-3 border-t border-slate-900 bg-slate-950/90 text-center text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between z-10">
        <div>
          © 2026 S K Enterprises. All export records, remittances and eBRCs are strictly confidential.
        </div>
        <div className="flex items-center space-x-4 mt-1 sm:mt-0">
          <span>Security Protocol: AES-256</span>
          <span>•</span>
          <span>ISO 27001 Compliant Architecture</span>
        </div>
      </footer>
    </div>
  );
};
