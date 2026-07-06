import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import BlogCover from '../BlogCover'
import { USE_CASES } from '../../lib/usecases'
import { EASE_OUT_EXPO } from '../../lib/brand'

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: EASE_OUT_EXPO },
}

/**
 * Use-case showcase in the case-study style: dark cards with an outcome title
 * over generative brand art, a "Learn more" arrow, and arrow-driven horizontal
 * scrolling. Titles carry the story; no stock photos, no invented customers.
 */
export default function UseCases() {
  const track = useRef<HTMLDivElement>(null)

  const scroll = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    el.scrollBy({ left: dir * Math.min(el.clientWidth, 420), behavior: 'smooth' })
  }

  return (
    <section id="use-cases" className="w-full bg-cream px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <motion.span {...reveal} className="text-sm font-semibold tracking-wide text-accent">
              Use Cases
            </motion.span>
            <motion.h2
              {...reveal}
              className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              What agents actually do here.
            </motion.h2>
          </div>
          {/* Arrow navigation, reference-style */}
          <motion.div {...reveal} className="hidden shrink-0 gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Scroll use cases left"
              className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 text-ink/60 transition-colors hover:bg-ink/5"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Scroll use cases right"
              className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 text-ink/60 transition-colors hover:bg-ink/5"
            >
              <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>

        {/* Horizontal track of dark showcase cards */}
        <motion.div
          {...reveal}
          ref={track}
          className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {USE_CASES.map((uc) => (
            <Link
              key={uc.slug}
              to={`/use-cases/${uc.slug}`}
              className="group relative flex h-[400px] w-[85%] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-3xl sm:w-[46%] lg:w-[335px]"
            >
              {/* Generative brand art as the backdrop */}
              <BlogCover
                accent={uc.accent}
                seed={uc.seed}
                className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-[1.05]"
              />
              {/* Legibility gradient */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, rgba(10,17,24,0.92) 0%, rgba(10,17,24,0.45) 45%, rgba(10,17,24,0.15) 100%)',
                }}
              />
              <div className="relative p-7">
                <div
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: uc.accent === '#7342E2' ? '#B79DF5' : undefined }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>{uc.service}</span>
                </div>
                <h3 className="mt-2 text-[22px] font-bold leading-snug tracking-tight text-white">
                  {uc.title}
                </h3>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white/90">
                  Learn more
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </div>
              </div>
            </Link>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
