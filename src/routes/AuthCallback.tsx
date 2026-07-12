import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../store/auth'

/** Lands here from an emailed magic link (?token=…), verifies it, and signs in. */
export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const loginWithMagicToken = useAuth((s) => s.loginWithMagicToken)
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const token = params.get('token')
    if (!token) {
      setError('This sign-in link is missing its token.')
      return
    }
    loginWithMagicToken(token)
      .then(() => navigate('/app', { replace: true }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Sign-in failed.'))
  }, [params, navigate, loginWithMagicToken])

  return (
    <main className="grid min-h-screen place-items-center px-5" style={{ background: 'var(--color-cream)' }}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-[0_24px_64px_rgba(25,40,55,0.10)]">
        {error ? (
          <>
            <h1 className="text-lg font-bold text-ink">Sign-in link problem</h1>
            <p className="mt-2 text-sm text-ink/60">{error}</p>
            <Link
              to="/login"
              className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-ink">Signing you in</h1>
            <p className="mt-2 text-sm text-ink/60">Verifying your link.</p>
          </>
        )}
      </div>
    </main>
  )
}
