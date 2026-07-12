import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import BlogCover from '../BlogCover'
import { ChainChip } from '../../routes/Blog'
import { POSTS } from '../../lib/blog'
import { EASE_OUT_EXPO } from '../../lib/brand'

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: EASE_OUT_EXPO },
}

export default function BlogTeaser() {
  const posts = POSTS.slice(0, 3)

  return (
    <section id="blog" className="w-full bg-white px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <motion.span {...reveal} className="text-base font-semibold tracking-wide text-accent">
              From the Blog
            </motion.span>
            <motion.h2
              {...reveal}
              className="mt-4 max-w-2xl text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Notes from the agentic economy.
            </motion.h2>
          </div>
          <motion.div {...reveal}>
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2.5 text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/5"
            >
              All posts <ArrowUpRight size={15} />
            </Link>
          </motion.div>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <motion.div {...reveal} key={post.slug}>
              <Link
                to={`/blog/${post.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-cream/40 transition-shadow hover:shadow-[0_18px_48px_rgba(25,40,55,0.10)]"
              >
                <div className="aspect-[16/9] w-full overflow-hidden">
                  <BlogCover
                    accent={post.accent}
                    seed={post.seed}
                    className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <ChainChip chain={post.chain} accent={post.accent} />
                  <h3 className="mt-3 text-lg font-bold leading-snug tracking-tight text-ink">
                    {post.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/60">{post.excerpt}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-ink/45">
                    <span>{post.date}</span>
                    <span className="h-1 w-1 rounded-full bg-ink/25" />
                    <span>{post.readingTime}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
