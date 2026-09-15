import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileSignature,
  Gauge,
  HandCoins,
  Home,
  KeyRound,
  Layers3,
  Menu,
  MessageSquareMore,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
  Wrench,
  X,
} from 'lucide-react';

interface PublicLandingPageProps {
  onLogin: () => void;
}

const slides = [
  {
    eyebrow: 'Real estate agency operations, simplified',
    title: 'One platform to run your entire real estate business.',
    description:
      'Manage listings, applications, agents, commissions, payouts and reporting from one connected workspace.',
    image:
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=2200&q=85',
  },
  {
    eyebrow: 'Built for modern property teams',
    title: 'Move every deal from enquiry to payout with clarity.',
    description:
      'Give your team a structured workflow for sales, rentals, approvals, documents and commission processing.',
    image:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2200&q=85',
  },
  {
    eyebrow: 'Grow without losing control',
    title: 'See your agency performance from one dashboard.',
    description:
      'Track transactions, REN performance, earnings, outstanding items and operational reports in real time.',
    image:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=2200&q=85',
  },
];

const coreFeatures = [
  {
    icon: Building2,
    title: 'Listings & Projects',
    description: 'Organise properties, projects, locations and listing information in one structured system.',
  },
  {
    icon: ClipboardCheck,
    title: 'Sales & Rental Applications',
    description: 'Manage application workflows, transaction records, approvals and supporting documentation.',
  },
  {
    icon: UsersRound,
    title: 'REN & Staff Management',
    description: 'Maintain agent and staff records, access, individual percentages and operational setup.',
  },
  {
    icon: HandCoins,
    title: 'Commission & Payouts',
    description: 'Track commission entitlement, pending payouts, overriding fees and payment processing.',
  },
  {
    icon: FileSignature,
    title: 'Digital Documentation',
    description: 'Support e-signing and digital workflows to reduce manual paperwork and turnaround time.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Performance',
    description: 'Review business performance, property transactions, earnings, rankings and payout reports.',
  },
];

const helpItems = [
  {
    icon: Layers3,
    title: 'Centralise operations',
    copy: 'Replace scattered spreadsheets, chats and manual tracking with one reliable system of record.',
  },
  {
    icon: Gauge,
    title: 'Speed up transactions',
    copy: 'Create cleaner workflows so teams know what is pending, approved, paid and completed.',
  },
  {
    icon: ShieldCheck,
    title: 'Improve control',
    copy: 'Give management better visibility over staff activity, commissions, payouts and transaction data.',
  },
  {
    icon: Sparkles,
    title: 'Build a scalable agency',
    copy: 'Standardise processes so the business can grow across more agents, teams and branches.',
  },
];

const expansionFeatures = [
  { icon: WalletCards, label: 'Rental collection & deposits' },
  { icon: Wrench, label: 'Maintenance management' },
  { icon: CalendarCheck2, label: 'Tenancy & renewal workflows' },
  { icon: MessageSquareMore, label: 'Tenant / owner communication' },
  { icon: KeyRound, label: 'Smart property integrations' },
  { icon: Home, label: 'Owner & tenant portals' },
];

const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ onLogin }) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % slides.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, []);

  const activeSlide = useMemo(() => slides[slideIndex], [slideIndex]);

  const goToSlide = (index: number) => {
    setSlideIndex((index + slides.length) % slides.length);
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/88 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <button onClick={() => scrollTo('home')} className="flex items-center gap-3 text-left text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-none tracking-tight">ApexRealtor</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.23em] text-cyan-300/80">
                Real Estate SaaS
              </p>
            </div>
          </button>

          <nav className="hidden items-center gap-8 lg:flex">
            <button onClick={() => scrollTo('solutions')} className="text-sm font-medium text-slate-300 transition hover:text-white">
              How We Help
            </button>
            <button onClick={() => scrollTo('features')} className="text-sm font-medium text-slate-300 transition hover:text-white">
              Features
            </button>
            <button onClick={() => scrollTo('workflow')} className="text-sm font-medium text-slate-300 transition hover:text-white">
              Workflow
            </button>
            <button onClick={() => scrollTo('future')} className="text-sm font-medium text-slate-300 transition hover:text-white">
              Platform Vision
            </button>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <button
              onClick={onLogin}
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Login
            </button>
            <button
              onClick={() => scrollTo('features')}
              className="flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Explore Platform
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white lg:hidden"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-slate-950 px-5 pb-5 pt-3 lg:hidden">
            <div className="flex flex-col gap-1">
              {[
                ['solutions', 'How We Help'],
                ['features', 'Features'],
                ['workflow', 'Workflow'],
                ['future', 'Platform Vision'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-200 hover:bg-white/5"
                >
                  {label}
                </button>
              ))}
              <button onClick={onLogin} className="mt-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950">
                Login to ApexRealtor
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        <section id="home" className="relative min-h-[760px] overflow-hidden bg-slate-950 pt-20 lg:min-h-screen">
          <div className="absolute inset-0">
            {slides.map((slide, index) => (
              <div
                key={slide.image}
                className={`absolute inset-0 transition-opacity duration-1000 ${index === slideIndex ? 'opacity-100' : 'opacity-0'}`}
              >
                <img src={slide.image} alt="Modern real estate" className="h-full w-full object-cover" />
              </div>
            ))}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/88 to-slate-950/35" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/20" />
          </div>

          <div className="relative mx-auto flex min-h-[680px] max-w-7xl items-center px-5 py-20 sm:px-8 lg:min-h-[calc(100vh-80px)] lg:px-10">
            <div className="max-w-3xl text-white">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200 backdrop-blur">
                <Sparkles className="h-4 w-4" />
                {activeSlide.eyebrow}
              </div>
              <h1 className="text-4xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-5xl lg:text-7xl">
                {activeSlide.title}
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                {activeSlide.description}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={onLogin}
                  className="group flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                >
                  Login to Workspace
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>
                <button
                  onClick={() => scrollTo('solutions')}
                  className="rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
                >
                  See How It Works
                </button>
              </div>

              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-300">
                {['Agency operations', 'Commission control', 'Digital workflows'].map((label) => (
                  <span key={label} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => goToSlide(slideIndex - 1)}
            className="absolute bottom-9 right-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:right-24"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => goToSlide(slideIndex + 1)}
            className="absolute bottom-9 right-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:right-10"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-11 left-5 flex gap-2 sm:left-8 lg:left-10">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-1.5 rounded-full transition-all ${index === slideIndex ? 'w-9 bg-cyan-300' : 'w-4 bg-white/30'}`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </section>

        <section id="solutions" className="bg-[#f6f8fa] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-700">How ApexRealtor helps</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                  Less admin. Better visibility. Faster real estate operations.
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-slate-600 lg:justify-self-end">
                ApexRealtor is designed for agencies that need more control over transactions, teams, commissions and reporting without relying on disconnected spreadsheets and manual follow-up.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {helpItems.map(({ icon: Icon, title, copy }, index) => (
                <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-bold text-slate-300">0{index + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-slate-950">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-700">Core platform</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                Everything your agency needs to manage the transaction lifecycle.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-600">
                These capabilities reflect the current ApexRealtor system and the operational workflows already supported by the platform.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {coreFeatures.map(({ icon: Icon, title, description }) => (
                <article key={title} className="group rounded-3xl border border-slate-200 bg-white p-7 transition hover:border-cyan-200 hover:shadow-[0_24px_70px_-38px_rgba(8,145,178,0.35)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 transition group-hover:bg-cyan-600 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
                  <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    Built into ApexRealtor
                    <CheckCircle2 className="h-4 w-4 text-cyan-600" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="overflow-hidden bg-slate-950 py-20 text-white sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">Connected workflow</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                  From property opportunity to agent payout, keep every step connected.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
                  Instead of managing each stage in a different spreadsheet or chat group, ApexRealtor provides a single operational flow that management can monitor.
                </p>
                <button
                  onClick={onLogin}
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                >
                  Access the System
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="relative rounded-[32px] border border-white/10 bg-white/[0.06] p-6 backdrop-blur sm:p-8">
                <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="relative space-y-3">
                  {[
                    ['01', 'Property / Project', 'Create the property and transaction context.'],
                    ['02', 'Agent / REN', 'Assign the responsible agent or team.'],
                    ['03', 'Sale / Rental Application', 'Capture the transaction and supporting information.'],
                    ['04', 'Approval & Documentation', 'Manage checks, e-signing and required records.'],
                    ['05', 'Commission & Payout', 'Calculate, review and process agent earnings.'],
                    ['06', 'Reporting', 'Measure transactions, earnings and business performance.'],
                  ].map(([number, title, description]) => (
                    <div key={number} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-900/65 p-4 sm:items-center">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-xs font-black text-slate-950">
                        {number}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{title}</p>
                        <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="future" className="bg-[#f6f8fa] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="rounded-[36px] border border-slate-200 bg-white p-7 shadow-sm sm:p-10 lg:p-12">
              <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                    <Sparkles className="h-4 w-4" />
                    Platform vision
                  </div>
                  <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                    Extend ApexRealtor beyond the deal into complete property operations.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
                    ApexRealtor can expand beyond agency transactions into a broader property-management ecosystem as these modules are developed.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {expansionFeatures.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{label}</p>
                        <p className="mt-0.5 text-xs text-slate-400">Potential future module</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="overflow-hidden rounded-[36px] bg-gradient-to-br from-cyan-600 via-cyan-700 to-slate-900 px-7 py-12 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-14 lg:py-14">
              <div className="max-w-2xl">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-100">ApexRealtor</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                  One connected workspace for your real estate agency.
                </h2>
                <p className="mt-4 text-base leading-7 text-cyan-50/85">
                  Bring your listings, team, transactions, commissions and reporting together in one secure platform.
                </p>
              </div>
              <button
                onClick={onLogin}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-slate-100 sm:w-auto lg:mt-0"
              >
                Login to ApexRealtor
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-950 py-10 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white">ApexRealtor</p>
              <p className="text-xs">Real Estate Agency Management System</p>
            </div>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} ApexRealtor. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default PublicLandingPage;
