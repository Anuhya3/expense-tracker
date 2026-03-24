import {
  BarChart3, Receipt, RefreshCw, Download, Brain, Globe,
  Users, Zap, Shield, ArrowRight, Github, ExternalLink,
  TrendingDown, CheckCircle2, Database, Layers,
} from 'lucide-react';
import ThemeToggle from './components/ThemeToggle';

// ── Types ──────────────────────────────────────────────────────────────────

interface LiveStats {
  totalExpenses: number;
  totalSpend: number;
  activeCategories: number;
  monthlyAvg: number;
}

// ── Server-side data fetch with ISR (revalidate every hour) ───────────────

async function getLiveStats(): Promise<LiveStats> {
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://server-one-dusky-56.vercel.app';

  try {
    // Step 1: authenticate with demo credentials server-side
    const loginRes = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@expense.app', password: 'demo123' }),
      next: { revalidate: 3600 }, // ISR — regenerate at most once per hour
    });

    if (!loginRes.ok) throw new Error('Login failed');
    const { token } = await loginRes.json();

    // Step 2: fetch analytics in parallel
    const [summaryRes, categoryRes, expensesRes] = await Promise.all([
      fetch(`${API}/api/analytics/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 3600 },
      }),
      fetch(`${API}/api/analytics/by-category?months=12`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 3600 },
      }),
      fetch(`${API}/api/expenses?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 3600 },
      }),
    ]);

    const [summary, categories, expenses] = await Promise.all([
      summaryRes.json(),
      categoryRes.json(),
      expensesRes.json(),
    ]);

    return {
      totalExpenses: expenses?.pagination?.total ?? 215,
      totalSpend: categories?.total ?? 41948,
      activeCategories: categories?.breakdown?.length ?? 10,
      monthlyAvg: Math.round(
        (categories?.total ?? 41948) / 12
      ),
    };
  } catch {
    // Graceful fallback — show seed data counts if API is unreachable
    return {
      totalExpenses: 215,
      totalSpend: 41948,
      activeCategories: 10,
      monthlyAvg: 3496,
    };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function NavBar() {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://client-six-inky-54.vercel.app';
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0f1117]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-gray-900" />
          </div>
          <span className="font-semibold text-sm tracking-tight">ExpenseFlow</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/Anuhya3/expense-tracker"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
          <ThemeToggle />
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Open App
          </a>
        </div>
      </div>
    </nav>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{value}</div>
      <div className="text-sm font-medium text-gray-300">{label}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="group relative p-6 rounded-2xl border border-white/5 bg-[#161b22] hover:border-white/10 hover:bg-[#1c2129] transition-all duration-200">
      {badge && (
        <span className="absolute top-4 right-4 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {badge}
        </span>
      )}
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}

function TechBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${color}`}
    >
      {label}
    </span>
  );
}

// ── Page (Server Component) ────────────────────────────────────────────────

export default async function LandingPage() {
  const stats = await getLiveStats();
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://client-six-inky-54.vercel.app';

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <NavBar />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 hero-grid overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 glow-blue pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-80 h-80 glow-purple pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-gray-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live data · Refreshes hourly via ISR
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight mb-6">
            Track every pound.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
              Know where it goes.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
            ExpenseFlow is a production-grade full-stack expense tracker with AI receipt scanning,
            multi-currency support, shared group expenses, real-time analytics, and GraphQL API.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-colors text-sm"
            >
              Try Demo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="https://github.com/Anuhya3/expense-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 border border-white/10 text-gray-300 font-medium rounded-xl hover:border-white/20 hover:text-white transition-colors text-sm"
            >
              <Github className="w-4 h-4" />
              View Source
            </a>
          </div>

          {/* Demo credentials hint */}
          <div className="mt-6 inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-gray-500">
            <span>Demo login:</span>
            <code className="text-gray-300 font-mono">demo@expense.app</code>
            <span>/</span>
            <code className="text-gray-300 font-mono">demo123</code>
          </div>
        </div>
      </section>

      {/* ── Live Stats (ISR data) ──────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Live from the demo database
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold">
              Real data, server-rendered
            </h2>
            <p className="text-gray-400 text-sm mt-2">
              Fetched server-side at build time and regenerated every hour (Next.js ISR)
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-12">
            <StatCard
              label="Expenses tracked"
              value={formatCount(stats.totalExpenses)}
              sub="across all categories"
            />
            <StatCard
              label="Total spend tracked"
              value={formatCurrency(stats.totalSpend)}
              sub="last 12 months"
            />
            <StatCard
              label="Active categories"
              value={String(stats.activeCategories)}
              sub="from food to travel"
            />
            <StatCard
              label="Monthly average"
              value={formatCurrency(stats.monthlyAvg)}
              sub="per user"
            />
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              What's inside
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold">
              Every feature you&apos;d build yourself
            </h2>
            <p className="text-gray-400 text-sm mt-2 max-w-xl mx-auto">
              Designed as a portfolio project showcasing modern full-stack patterns.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<BarChart3 className="w-5 h-5 text-blue-400" />}
              title="Smart Analytics"
              description="Interactive charts with category breakdowns, 30-day trends, budget tracking, and AI-generated spending insights. Powered by MongoDB aggregation pipelines."
            />
            <FeatureCard
              icon={<Brain className="w-5 h-5 text-violet-400" />}
              title="AI Receipt Scanner"
              description="Upload a receipt photo and Claude AI extracts the amount, description, and category automatically. Falls back to keyword matching in demo mode."
              badge="AI"
            />
            <FeatureCard
              icon={<Users className="w-5 h-5 text-green-400" />}
              title="Shared Group Expenses"
              description="Create groups, invite members, split bills equally or by exact amounts. Greedy debt-simplification algorithm minimises the number of settlements."
            />
            <FeatureCard
              icon={<Globe className="w-5 h-5 text-amber-400" />}
              title="Multi-Currency"
              description="Add expenses in any of 30 currencies. Live exchange rates cached for 1 hour from open.er-api.com. Stores original amount + conversion rate for audit trail."
            />
            <FeatureCard
              icon={<RefreshCw className="w-5 h-5 text-cyan-400" />}
              title="Recurring Expenses"
              description="Weekly, monthly, or yearly recurring templates. Generate due expenses in bulk, pause/resume, and track next due dates automatically."
            />
            <FeatureCard
              icon={<Download className="w-5 h-5 text-pink-400" />}
              title="CSV & PDF Export"
              description="Export filtered expenses to CSV or a beautifully formatted PDF report generated server-side with PDFKit. No client-side PDF libraries needed."
            />
            <FeatureCard
              icon={<Zap className="w-5 h-5 text-yellow-400" />}
              title="Redis Caching"
              description="Analytics endpoints cached in Redis with 2–5 minute TTLs. Non-blocking SCAN-based cache invalidation on every write. Falls back gracefully if Redis is down."
              badge="Perf"
            />
            <FeatureCard
              icon={<Layers className="w-5 h-5 text-indigo-400" />}
              title="GraphQL API"
              description="Full GraphQL layer alongside REST using Apollo Server 4. Apollo Sandbox enabled in development. Custom Date scalar, auth guard, and ISR-friendly resolvers."
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5 text-red-400" />}
              title="JWT Auth + RBAC"
              description="Stateless JWT authentication with role-based access control. Helmet, CORS, and express-rate-limit for production hardening. Passwords hashed with bcrypt."
            />
          </div>
        </div>
      </section>

      {/* ── Tech Stack ────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-8">
            Tech stack
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <TechBadge label="React 18" color="text-cyan-400 border-cyan-500/20 bg-cyan-500/5" />
            <TechBadge label="TypeScript" color="text-blue-400 border-blue-500/20 bg-blue-500/5" />
            <TechBadge label="Next.js 14" color="text-white border-white/10 bg-white/5" />
            <TechBadge label="Node.js" color="text-green-400 border-green-500/20 bg-green-500/5" />
            <TechBadge label="Express" color="text-gray-300 border-gray-500/20 bg-gray-500/5" />
            <TechBadge label="MongoDB" color="text-green-400 border-green-500/20 bg-green-500/5" />
            <TechBadge label="Redis" color="text-red-400 border-red-500/20 bg-red-500/5" />
            <TechBadge label="GraphQL" color="text-pink-400 border-pink-500/20 bg-pink-500/5" />
            <TechBadge label="Apollo Server 4" color="text-violet-400 border-violet-500/20 bg-violet-500/5" />
            <TechBadge label="JWT" color="text-amber-400 border-amber-500/20 bg-amber-500/5" />
            <TechBadge label="Tailwind CSS" color="text-sky-400 border-sky-500/20 bg-sky-500/5" />
            <TechBadge label="Vite" color="text-purple-400 border-purple-500/20 bg-purple-500/5" />
            <TechBadge label="Vitest" color="text-yellow-400 border-yellow-500/20 bg-yellow-500/5" />
            <TechBadge label="Docker" color="text-blue-400 border-blue-500/20 bg-blue-500/5" />
            <TechBadge label="GitHub Actions" color="text-gray-300 border-gray-500/20 bg-gray-500/5" />
            <TechBadge label="Claude AI" color="text-orange-400 border-orange-500/20 bg-orange-500/5" />
            <TechBadge label="Vercel" color="text-white border-white/10 bg-white/5" />
            <TechBadge label="MongoDB Atlas" color="text-green-400 border-green-500/20 bg-green-500/5" />
          </div>
        </div>
      </section>

      {/* ── Architecture callout ───────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-white/5 bg-[#161b22] p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Database className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">
                  How this page is rendered
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">
                  This landing page is a <strong className="text-gray-200">Next.js 14 Server Component</strong>.
                  On each deployment (or every hour via ISR), it authenticates with the ExpenseFlow
                  API server-side and fetches live analytics. The HTML arrives fully rendered —
                  no loading spinners, no client-side API calls, zero JavaScript for the stats.
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  {[
                    'Server-side fetch with next: { revalidate: 3600 } (ISR)',
                    'Graceful fallback to seed data if API is unreachable',
                    'Zero client JS for above-the-fold content',
                    'next-themes for dark/light with no flash on load',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to explore?
          </h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            The demo is live with 200+ seeded expenses, shared groups, recurring
            templates, and real analytics. No sign-up required — just use the demo credentials.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
            >
              Open ExpenseFlow
              <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="https://github.com/Anuhya3/expense-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-8 py-3.5 border border-white/10 text-gray-300 font-medium rounded-xl hover:border-white/20 hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              Star on GitHub
            </a>
          </div>
          {/* Credentials block */}
          <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/5 text-sm">
            <p className="text-gray-500 mb-3 text-xs uppercase tracking-wider font-semibold">Demo credentials</p>
            <div className="flex flex-col sm:flex-row justify-center gap-6 font-mono text-sm">
              <div className="text-center">
                <div className="text-gray-500 text-xs mb-1">email</div>
                <div className="text-gray-200">demo@expense.app</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-xs mb-1">password</div>
                <div className="text-gray-200">demo123</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="py-8 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center">
              <TrendingDown className="w-3 h-3 text-gray-300" />
            </div>
            <span>ExpenseFlow — portfolio project</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Anuhya3/expense-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <Github className="w-3.5 h-3.5" /> GitHub
            </a>
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Live App
            </a>
            <span>Built with Next.js 14 + ISR</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
