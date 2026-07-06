import { useNavigate } from 'react-router-dom'

type AuthButtonsProps = {
  /** Stack vertically (mobile sheet) instead of inline (desktop navbar). */
  stacked?: boolean
  /** Optional callback fired after a button navigates (e.g. close the sheet). */
  onNavigate?: () => void
}

/**
 * The "Start For Free" + "Sign In" pill pair. Shared between the desktop
 * navbar and the mobile sheet so both stay visually identical.
 */
export default function AuthButtons({ stacked = false, onNavigate }: AuthButtonsProps) {
  const navigate = useNavigate()

  const go = (path: string) => () => {
    navigate(path)
    onNavigate?.()
  }

  return (
    <div className={stacked ? 'flex flex-col gap-3' : 'flex items-center gap-3'}>
      <button
        type="button"
        onClick={go('/signup')}
        className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]"
        style={{ background: 'var(--color-accent)' }}
      >
        Start For Free
      </button>
      <button
        type="button"
        onClick={go('/login')}
        className="rounded-full px-5 py-2.5 text-sm font-semibold transition-transform duration-200 hover:scale-[1.03]"
        style={{ background: 'var(--color-login-bg)', color: 'var(--color-text)' }}
      >
        Sign In
      </button>
    </div>
  )
}
