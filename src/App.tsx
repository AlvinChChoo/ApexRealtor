import React, { useState } from 'react';
import { Menu, Building2, Eye, EyeOff, LockKeyhole, UserRound, ShieldCheck, BarChart3, UsersRound, ArrowRight, ArrowLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import Listing from './components/Applications/Listing';
import Rental from './components/Applications/Rental';
import SalePurchase from './components/Applications/SalePurchase';
import PendingCommPayout from "./components/Applications/PendingCommPayout";
import PendingOverridingCommPayout from "./components/Applications/PendingOverridingCommPayout";

import ESigningPage from './components/Applications/ESigningPage';

import StaffSetup from './components/Staff/StaffSetup';
import Admin from './components/Applications/Admin';
import Reports from './components/Reports/Reports';
import RenIndividualPctgSession from './components/Applications/RenIndividualPctgSession';
import Inventory from './components/Inventory/Inventory';
import InventoryAdj from './components/Inventory/InventoryAdj';
import InventoryTrans from './components/Inventory/InventoryTrans';
import PettyCashRpt from './components/Reports/PettyCashRpt';
import PettyCashSummaryReport from './components/Reports/PettyCashSummaryReport';
import CommPayoutRpt from './components/Reports/CommPayoutRpt';
import CommPayoutRptRen from './components/Applications/CommPayoutRptRen';
import OverridingFeesRpt from './components/Reports/OverridingFeesRpt';
import ClientList from './components/Reports/ClientList';
import InvOrRpt from './components/Reports/InvOrRpt';

import CommInvSummary from './components/Reports/CommInvSummary';
import PropertyTransactedRpt from './components/Reports/PropertyTransactedRpt';
import RensEarningCP58 from './components/Reports/RensEarningCP58';
import RensCloseRanking from './components/Reports/RensCloseRanking';
import RensComPayoutRanking from './components/Reports/RensComPayoutRanking';
import WithholdingTaxRpt from './components/Reports/WithholdingTaxRpt';
import CloseOnReport from './components/Reports/CloseOnReport';
import IndividualGroupPerformancePayOutRpt from './components/Reports/IndividualGroupPerformancePayOutRpt';
import IndividualGroupPerformanceCloseOnRpt from './components/Reports/IndividualGroupPerformanceCloseOnRpt';

import PerformanceReport from './components/Reports/PerformanceReport';
import Country from './components/Setting/Country';
import Project from './components/Setting/Project';
import Location from './components/Setting/Location';
import logoSrc from '/inte-logo.png?url';

import { Routes, Route, useNavigate } from 'react-router-dom';
import { RentalDetailsRouteWrapper } from "./components/Applications/RentalDetails";
import PublicLandingPage from './components/Public/PublicLandingPage';

interface SimpleLoginFormProps {
  onBack?: () => void;
}

const SimpleLoginForm: React.FC<SimpleLoginFormProps> = ({ onBack }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(username, password);

    if (!success) {
      setError('Invalid username or password');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      {/* Brand / product panel */}
      <section className="relative hidden min-h-screen overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950" />
        <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -right-20 bottom-16 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative z-10 flex items-center gap-3 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-2xl backdrop-blur">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-semibold tracking-tight">ApexRealtor</p>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-200/75">Real Estate SaaS</p>
          </div>
        </div>

        <div className="relative z-10 max-w-2xl py-12 text-white">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-slate-200 backdrop-blur-sm">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            One workspace for your real estate operations
          </div>

          <h1 className="max-w-xl text-5xl font-semibold leading-[1.06] tracking-[-0.04em] xl:text-6xl">
            Manage your agency with clarity and confidence.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 xl:text-lg">
            Centralise listings, transactions, commissions, agents and reporting in one secure platform built for modern real estate teams.
          </p>

          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
              <UsersRound className="mb-3 h-5 w-5 text-cyan-300" />
              <p className="text-sm font-semibold">Team Management</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">REN, staff and access control</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
              <Building2 className="mb-3 h-5 w-5 text-cyan-300" />
              <p className="text-sm font-semibold">Property Operations</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Sales, rental and listings</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
              <BarChart3 className="mb-3 h-5 w-5 text-cyan-300" />
              <p className="text-sm font-semibold">Business Insights</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Payouts and reporting</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500">
          <span>© {new Date().getFullYear()} ApexRealtor</span>
          <span>Agency Management Platform</span>
        </div>
      </section>

      {/* Login panel */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f8fa] px-5 py-10 sm:px-8 lg:px-12">
        <div className="absolute right-[-120px] top-[-120px] h-72 w-72 rounded-full bg-cyan-100/70 blur-3xl lg:hidden" />
        <div className="absolute bottom-[-120px] left-[-120px] h-72 w-72 rounded-full bg-amber-100/70 blur-3xl lg:hidden" />

        <div className="relative z-10 w-full max-w-[440px]">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-5 inline-flex items-center gap-2 rounded-xl px-1 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to website
            </button>
          )}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-slate-950">ApexRealtor</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Real Estate SaaS</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-34px_rgba(15,23,42,0.28)] sm:p-8 xl:p-10">
            <div className="mb-8">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                <img src={logoSrc} alt="ApexRealtor" className="max-h-10 max-w-[42px] object-contain" />
              </div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-700">Secure access</p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in to continue to your ApexRealtor workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-700">
                  Username
                </label>
                <div className="group relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-700" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    autoComplete="username"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                    Password
                  </label>
                </div>
                <div className="group relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-700" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-600/20"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-950/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in to workspace
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-6 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Secure access for authorised users only</span>
            </div>
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-slate-400">
            ApexRealtor · Real Estate Agency Management System
          </p>
        </div>
      </section>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Checking session…</div>;
  }

  // ✅ IMPORTANT: Allow public E-Signing (NO LOGIN REQUIRED)
  
  if (!user) {
    return showLogin
      ? <SimpleLoginForm onBack={() => setShowLogin(false)} />
      : <PublicLandingPage onLogin={() => setShowLogin(true)} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'listing': return <Listing />;
      case 'rental': return <Rental />;
      case 'sale-purchase': return <SalePurchase />;
      case 'inventory': return <Inventory />;
      case 'inventory-adj': return <InventoryAdj />;
      case 'inventory-trans': return <InventoryTrans />;
      case 'staff-setup': return <StaffSetup />;
      case 'staff-setup/ren-individual': return <RenIndividualPctgSession />;
      case 'staff-setup/admin': return <Admin />;
      case 'reports': return <Reports />;
      case 'reports/petty-cash': return <PettyCashRpt />;
      case 'reports/petty-cash-summary': return <PettyCashSummaryReport />;
      case 'reports/comm-payout': return <CommPayoutRpt />;
      case 'reports/comm-payout-ren': return <CommPayoutRptRen />;
      case 'reports/overriding-fees': return <OverridingFeesRpt />;
      case 'reports/client-list': return <ClientList />;
      case 'reports/pending-comm-payout': return <PendingCommPayout />;
      case 'reports/pending-overriding-comm-payout': return <PendingOverridingCommPayout />;
      case 'reports/inv-or-rpt': return <InvOrRpt />;
      case 'reports/comm-inv-summary': return <CommInvSummary />;
      case 'reports/property-transacted': return <PropertyTransactedRpt />;
      case 'reports/rens-earning-cp58': return <RensEarningCP58 />;
      case 'reports/rens-close-ranking': return <RensCloseRanking />;
      case 'reports/rens-com-payout-ranking': return <RensComPayoutRanking />;
      case 'reports/withholding-tax': return <WithholdingTaxRpt />;
      case 'reports/close-on-report': return <CloseOnReport />;
      case 'reports/individual-group-performance': return <IndividualGroupPerformancePayOutRpt />;
      case 'reports/individual-group-performance-close-on': return <IndividualGroupPerformanceCloseOnRpt />;
      case 'reports/performance-report': return <PerformanceReport />;
      case 'setting/country': return <Country />;
      case 'setting/project': return <Project />;
      case 'setting/location': return <Location />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded-lg"
      >
        <Menu size={24} />
      </button>

      <Sidebar
        currentPage={currentPage}
        onPageChange={(p) => {
          setCurrentPage(p);
          navigate('/');
        }}
        isMobileMenuOpen={isMobileMenuOpen}
        toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <main className="flex-1 overflow-y-auto lg:ml-[20vw]">
        <Routes>
          <Route path="/rental/:applicationId/:rowId?" element={<RentalDetailsRouteWrapper />} />
          <Route path="*" element={renderPage()} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  if (window.location.pathname.toLowerCase() === '/esigning') {
    return (
      <AuthProvider>
        <ESigningPage />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;