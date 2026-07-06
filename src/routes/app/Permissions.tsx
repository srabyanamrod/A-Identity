import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bot, CreditCard, Lock, Shield } from 'lucide-react'
import { useAuth } from '../../store/auth'
import { LogOut } from 'lucide-react'

type ToggleItem = {
  key: string
  label: string
  desc: string
  on: boolean
  locked?: boolean
  danger?: boolean
}

type Group = {
  title: string
  icon: React.ComponentType<{ size?: number }>
  color: string
  items: ToggleItem[]
}

const INITIAL_GROUPS: Group[] = [
  {
    title: 'Agent Control',
    icon: Bot,
    color: '#7342E2',
    items: [
      {
        key: 'agent_active',
        label: 'Agent active',
        desc: 'Master switch. Off means the agent cannot act or transact.',
        on: true,
      },
      {
        key: 'a2a_pay',
        label: 'Agent-to-agent payments',
        desc: 'Let the agent pay other verified agents autonomously, within your spend limits.',
        on: true,
      },
      {
        key: 'a2h_pay',
        label: 'Agent-to-human payments',
        desc: 'Allow the agent to pay human wallet addresses. Requires 2-of-2 by default.',
        on: false,
      },
    ],
  },
  {
    title: 'Spending Limits',
    icon: CreditCard,
    color: '#2775CA',
    items: [
      {
        key: 'daily_cap',
        label: 'Daily spend cap',
        desc: 'The agent cannot spend more than $50.00 USDC per day. Resets at midnight UTC.',
        on: true,
      },
      {
        key: 'auto_approve',
        label: 'Auto-approve under $1.00',
        desc: 'Single payments below $1.00 USDC settle without prompting you.',
        on: true,
      },
      {
        key: 'per_tx_cap',
        label: 'Per-transaction cap ($5.00)',
        desc: 'Any single payment above $5.00 USDC pauses for your explicit approval.',
        on: true,
      },
    ],
  },
  {
    title: 'Access Controls',
    icon: Shield,
    color: '#1AAB7A',
    items: [
      {
        key: 'payee_allowlist',
        label: 'Payee allowlist',
        desc: 'Only agents on your approved list can receive payments. Everyone else is blocked.',
        on: false,
      },
      {
        key: 'require_2of2',
        label: 'Require 2-of-2 approval',
        desc: 'Both the agent and you must sign any payment. Maximum safety, slower autonomy.',
        on: false,
      },
      {
        key: 'rep_gate',
        label: 'Reputation gate',
        desc: 'The agent will only transact with other agents scoring 300 or above.',
        on: true,
      },
    ],
  },
  {
    title: 'Safety',
    icon: Lock,
    color: '#EF4444',
    items: [
      {
        key: 'freeze',
        label: 'Freeze all activity',
        desc: 'Emergency off switch. Pauses all payments and agent actions immediately.',
        on: false,
        danger: true,
      },
    ],
  },
]

export default function Permissions() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()

  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS)

  const toggle = (groupTitle: string, key: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.title !== groupTitle
          ? g
          : {
              ...g,
              items: g.items.map((item) =>
                item.key === key ? { ...item, on: !item.on } : item,
              ),
            },
      ),
    )
  }

  const activeCount = groups.flatMap((g) => g.items).filter((i) => i.on).length
  const totalCount = groups.flatMap((g) => g.items).length
  const frozen = groups
    .flatMap((g) => g.items)
    .find((i) => i.key === 'freeze')?.on

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-bold tracking-tight">Permissions</h2>
      <p className="mt-1 text-sm text-ink/55">
        You are in control. Set what your agent can do, who it can pay, and how much it
        can spend. Think of this as your agent's bank account settings.
      </p>

      {/* Summary bar */}
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-5 py-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
          <Shield size={18} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink">
            {activeCount} of {totalCount} controls active
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(activeCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
        {frozen && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            <AlertTriangle size={12} />
            Frozen
          </div>
        )}
      </div>

      {/* Permission groups */}
      <div className="mt-4 flex flex-col gap-4">
        {groups.map((group) => (
          <section key={group.title} className="rounded-2xl border border-ink/10 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <div
                className="grid h-8 w-8 place-items-center rounded-lg text-white"
                style={{ background: group.color }}
              >
                <group.icon size={15} />
              </div>
              <h3 className="font-semibold text-ink">{group.title}</h3>
            </div>
            <ul className="divide-y divide-ink/8">
              {group.items.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        item.danger ? 'text-red-600' : 'text-ink'
                      }`}
                    >
                      {item.label}
                    </div>
                    <div className="mt-0.5 text-xs text-ink/50">{item.desc}</div>
                  </div>
                  <Toggle
                    on={item.on}
                    danger={item.danger}
                    onChange={() => toggle(group.title, item.key)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Profile section */}
      <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-6">
        <h3 className="mb-4 font-semibold">Profile</h3>
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-lg font-bold text-white">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <div className="font-semibold">{user?.name}</div>
            <div className="text-sm text-ink/55">{user?.email}</div>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => { logout(); navigate('/') }}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-5 py-3 text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/5"
      >
        <LogOut size={16} />
        Log out
      </button>

      <p className="mt-6 text-xs text-ink/35">
        Changes take effect immediately for new actions. Pending settlements complete under
        the rules that were active when they started.
      </p>
    </div>
  )
}

function Toggle({
  on,
  danger,
  onChange,
}: {
  on: boolean
  danger?: boolean
  onChange: () => void
}) {
  const activeColor = danger ? 'bg-red-500' : 'bg-accent'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? activeColor : 'bg-ink/20'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
