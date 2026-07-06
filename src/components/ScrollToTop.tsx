import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Scrolls to the top whenever the path changes, so navigating to a new page
 * (e.g. from a footer link) does not land mid-scroll. Hash links are left
 * alone so in-page anchors still work.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}
