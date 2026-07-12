import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Problem from '../components/sections/Problem'
import Pillars from '../components/sections/Pillars'
import Web25Layer from '../components/sections/Web25Layer'
import UseCases from '../components/sections/UseCases'
import Positioning from '../components/sections/Positioning'
import Vision from '../components/sections/Vision'
import DeveloperExperience from '../components/sections/DeveloperExperience'
import BlogTeaser from '../components/sections/BlogTeaser'
import FAQ from '../components/sections/FAQ'
import SiteFooter from '../components/sections/SiteFooter'
import { BACKGROUND_VIDEO } from '../lib/brand'

/**
 * Public landing surface. The hero is a full-viewport block with the
 * background video; the narrative sections flow underneath on solid
 * backgrounds: problem, pillars, web2.5, positioning, vision, developers, faq, footer.
 */
export default function Landing() {
  return (
    <div className="w-full" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
      {/* Hero block */}
      <header className="relative min-h-screen w-full overflow-hidden pt-[72px]">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={BACKGROUND_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <Navbar />
        <Hero />
      </header>

      {/* Narrative sections */}
      <Problem />
      <Pillars />
      <Web25Layer />
      <UseCases />
      <Positioning />
      <Vision />
      <DeveloperExperience />
      <BlogTeaser />
      <FAQ />
      <SiteFooter />
    </div>
  )
}
