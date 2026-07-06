import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  Bot,
  CreditCard,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  SlidersHorizontal,
  Store,
} from 'lucide-react'
import Logo from '../../components/Logo'
import { useAuth } from '../../store/auth'
import { APP_NAME } from '../../lib/brand'
import { useMcpHealth } from '../../hooks/useMcp'

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/agent-id', label: 'Agent ID', icon: Fingerprint, end: false },
  { to: '/app/wallet', label: 'Wallet', icon: CreditCard, end: false },
  { to: '/app/settlements', label: 'Settlements', icon: ArrowLeftRight, end: false },
  { to: '/app/marketplace', label: 'Agent House', icon: Store, end: false },
  { to: '/app/permissions', label: 'Permissions', icon: SlidersHorizontal, end: false },
] as const

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const mcpOnline = useMcpHealth()

  const current = [...NAV].reverse().find((n) => location.pathname.startsWith(n.to))
  const title = current?.label ?? 'Overview'

  const onLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen w-full bg-cream text-ink">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink/10 bg-white px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <Logo size={28} />
          <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="mb-3 px-3">
          <span className="text-[10px] font-semibold tracking-widest text-ink/35">
            Agent Console
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white' : 'text-ink/70 hover:bg-ink/5'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* MCP server status */}
        <div className="mb-2 mt-2 rounded-xl border border-ink/8 bg-ink/[0.03] px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bot size={13} className="text-accent" />
              <span className="text-xs font-semibold text-ink/70">MCP server</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  mcpOnline === null
                    ? 'animate-pulse bg-ink/25'
                    : mcpOnline
                      ? 'bg-emerald-400'
                      : 'bg-red-400'
                }`}
              />
              <span className="text-[11px] text-ink/40">
                {mcpOnline === null ? 'checking' : mcpOnline ? 'online' : 'offline'}
              </span>
            </div>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-ink/40">
            {mcpOnline
              ? 'Live data from localhost:3399'
              : 'Run: cd mcp && npm run start:http'}
          </p>
        </div>

        <div className="mb-3 rounded-xl border border-ink/8 bg-ink/[0.03] px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-ink/40">Human-on-the-loop</span>
          </div>
          <p className="text-[11px] leading-relaxed text-ink/40">
            Keys, contracts, real value require your approval.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5"
        >
          <LogOut size={18} />
          Log out
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-ink/10 bg-cream/80 px-5 py-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size={24} />
          </div>
          {/* Breadcrumb (desktop): context without duplicating the page heading. */}
          <div className="hidden items-center gap-1.5 text-sm md:flex">
            <span className="text-ink/40">Agent Console</span>
            <span className="text-ink/25">/</span>
            <span className="font-medium text-ink/70">{title}</span>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3">
            {/* MCP status dot (mobile) */}
            <div className="flex items-center gap-1.5 md:hidden">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  mcpOnline ? 'bg-emerald-400' : 'bg-ink/20'
                }`}
              />
              <span className="text-xs text-ink/40">MCP</span>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs font-bold text-white">
              {user ? initials(user.name) : 'AI'}
            </div>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-ink/10 bg-white px-4 py-2 md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white' : 'text-ink/70'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
