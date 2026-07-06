import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Lock, Mail, User } from 'lucide-react'
import { motion } from 'framer-motion'
import Logo from './Logo'
import { useAuth } from '../store/auth'
import { APP_NAME, EASE_OUT_EXPO } from '../lib/brand'

type AuthScreenProps = {
  mode: 'login' | 'signup'
}

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to manage your agents, identities, and settlements.',
    cta: 'Sign In',
    switchText: 'New here?',
    switchCta: 'Claim an Agent ID',
    switchTo: '/signup',
  },
  signup: {
    title: 'Claim your Agent ID',
    subtitle: 'Spin up an agent-ready identity and wallet in seconds.',
    cta: 'Get Your Agent ID',
    switchText: 'Already onboarded?',
    switchCta: 'Sign in',
    switchTo: '/login',
  },
} as const

/**
 * Shared sign-in and sign-up surface. Auth is mocked for now, so any input
 * succeeds and drops you into the app. Real agent-identity auth lands in a
 * later phase.
 */
export default function AuthScreen({ mode }: AuthScreenProps) {
  const copy = COPY[mode]
  const navigate = useNavigate()
  const login = useAuth((s) => s.login)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    login(email || 'demo@a-identity.dev', mode === 'signup' ? name : undefined)
    navigate('/app')
  }

  return (
    <main
      className="grid min-h-screen w-full place-items-center px-5 py-10"
      style={{ background: 'var(--color-cream)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        className="w-full max-w-[420px] rounded-3xl bg-white p-8 shadow-[0_24px_64px_rgba(25,40,55,0.10)]"
      >
        <Link to="/" className="mb-8 inline-flex items-center gap-2">
          <Logo size={28} />
          <span className="text-lg font-bold tracking-tight text-ink">{APP_NAME}</span>
        </Link>

        <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-ink">{copy.title}</h1>
        <p className="mb-7 text-sm text-ink/60">{copy.subtitle}</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
          {mode === 'signup' && (
            <Field
              icon={<User size={18} />}
              type="text"
              placeholder="Full name"
              value={name}
              onChange={setName}
              autoComplete="name"
            />
          )}
          <Field
            icon={<Mail size={18} />}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <Field
            icon={<Lock size={18} />}
            type="password"
            placeholder="Password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          <button
            type="submit"
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            {copy.cta}
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink/60">
          {copy.switchText}{' '}
          <Link to={copy.switchTo} className="font-semibold text-accent hover:underline">
            {copy.switchCta}
          </Link>
        </p>
      </motion.div>
    </main>
  )
}

type FieldProps = {
  icon: React.ReactNode
  type: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
}

function Field({ icon, type, placeholder, value, onChange, autoComplete }: FieldProps) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream/40 px-4 py-3 transition-colors focus-within:border-accent">
      <span className="text-ink/40">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
      />
    </label>
  )
}
