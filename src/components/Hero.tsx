import { motion, type Variants } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowRightCircle, Coins, Fingerprint, Network } from 'lucide-react'
import { EASE_OUT_EXPO, PROTOCOLS } from '../lib/brand'

/**
 * Staggered entry animation. `custom` carries the index so each element
 * (heading=0, subtext=1, cta=2) is offset by 0.15s.
 */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: EASE_OUT_EXPO },
  }),
}

/** Shared inline-icon treatment for the icons embedded in the heading. */
const inlineIcon: React.CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'middle',
  position: 'relative',
  top: -2,
}

export default function Hero() {
  const navigate = useNavigate()

  return (
    <section
      className="relative z-10 mx-auto w-full max-w-[1280px] px-5 sm:px-8"
      style={{ paddingTop: 'clamp(40px, 8vw, 72px)' }}
    >
      <div style={{ maxWidth: 600 }}>
        {/* Heading with inline icons */}
        <motion.h1
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.65rem, 5vw, 3rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
            color: '#192837',
            marginBottom: 24,
          }}
        >
          <Fingerprint size={24} color="#192837" style={inlineIcon} /> The Passport &amp;{' '}
          <Coins size={24} color="#192837" style={inlineIcon} /> Wallet for the Agentic{' '}
          <Network size={24} color="#192837" style={inlineIcon} /> Economy
        </motion.h1>

        {/* Subtext */}
        <motion.p
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
            lineHeight: 1.65,
            opacity: 0.8,
            maxWidth: 580,
            marginBottom: 32,
          }}
        >
          Your AI agent is missing two things: an ID it can prove and a wallet
          it can pay from. A-Identity gives it both. Agents verify each other,
          then settle in stablecoins. You step in only when real value moves.
        </motion.p>

        {/* Three protocols, each its own color */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mb-8 flex flex-wrap items-center gap-2"
        >
          {PROTOCOLS.map((p) => (
            <a
              key={p.label}
              href={p.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-transform hover:scale-[1.05]"
              style={{ background: `${p.color}1A`, color: p.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
              {p.label}
            </a>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap items-center gap-3"
        >
          <motion.button
            type="button"
            onClick={() => navigate('/signup')}
            whileHover={{ scale: 1.04, filter: 'brightness(1.1)' }}
            whileTap={{ scale: 0.96 }}
            style={{
              background: '#7342E2',
              color: '#fff',
              borderRadius: 50,
              padding: '17px 24px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 'clamp(0.9rem, 2vw, 1rem)',
              boxShadow: '0 4px 24px rgba(115,66,226,0.28)',
              minWidth: 210,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 32,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Get Your Agent ID
            <ArrowRightCircle size={20} />
          </motion.button>

          <motion.a
            href="#developers"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              background: 'var(--color-login-bg)',
              color: 'var(--color-text)',
              borderRadius: 50,
              padding: '17px 24px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 'clamp(0.9rem, 2vw, 1rem)',
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            Read the SDK
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
