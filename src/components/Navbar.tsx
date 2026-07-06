import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import Logo from './Logo'
import AuthButtons from './AuthButtons'
import MobileMenu from './MobileMenu'
import { APP_NAME, NAV_LINKS } from '../lib/brand'

/**
 * Top navigation bar. Holds the mobile-menu open state and renders the
 * slide-in sheet. Constrained to a 1280px centered track, layered above
 * the background video (z-10).
 */
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <nav className="relative z-10 mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        {/* Left: logo + wordmark */}
        <Link to="/" aria-label={`${APP_NAME} home`} className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
        </Link>

        {/* Center: links (desktop only) */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="text-sm font-medium opacity-70 transition-opacity hover:opacity-100"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right: auth buttons (desktop only) */}
        <div className="hidden md:flex">
          <AuthButtons />
        </div>

        {/* Mobile: hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-black/5 md:hidden"
        >
          <Menu size={26} color="#192837" />
        </button>
      </nav>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
