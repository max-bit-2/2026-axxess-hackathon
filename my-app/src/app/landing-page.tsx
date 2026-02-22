"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { CanvasSequence } from "./canvas-sequence";

export function LandingPage() {
  const { scrollYProgress } = useScroll();

  // Scroll animations for the Canvas Hero section (0 to 1 across the canvas component)
  // Assuming CanvasSequence is 300vh, we map the first chunk of the page scroll to these values.
  const heroProgress = useTransform(scrollYProgress, [0, 0.4], [0, 1]);
  
  const text1Opacity = useTransform(heroProgress, [0, 0.2, 0.4, 0.5], [1, 1, 0, 0]);
  const text1Y = useTransform(heroProgress, [0, 0.4], ["0%", "-50%"]);

  const text2Opacity = useTransform(heroProgress, [0.4, 0.5, 0.7, 0.8], [0, 1, 1, 0]);
  const text2Y = useTransform(heroProgress, [0.4, 0.8], ["50%", "-50%"]);

  const text3Opacity = useTransform(heroProgress, [0.75, 0.9, 1, 1], [0, 1, 1, 1]);
  const text3Y = useTransform(heroProgress, [0.75, 1], ["50%", "0%"]);

  return (
    <div className="bg-[#050505] text-white selection:bg-white/20 font-sans min-h-screen">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#050505]/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#050505]" />
          </div>
          <span className="text-white font-semibold tracking-tight text-lg">Medivance</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/signin" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/signin" className="hidden sm:inline-flex items-center justify-center px-5 py-2 rounded-full bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section with Canvas Scrubbing */}
      <div className="relative">
        <CanvasSequence
          frameCount={192}
          framePath={(index) => `/sequence/frame_${String(index).padStart(4, "0")}.jpg`}
          className="opacity-90"
        />

        {/* Floating Text overlay */}
        <div className="fixed inset-0 pointer-events-none flex flex-col items-center justify-center text-center z-10 px-6">
          <motion.div style={{ opacity: text1Opacity, y: text1Y }} className="absolute max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-medium tracking-tight mb-6">
              Precision in motion.
            </h1>
            <p className="text-lg sm:text-2xl text-neutral-400 font-light max-w-2xl mx-auto">
              Scroll down to witness absolute control over your compounding workflow.
            </p>
          </motion.div>

          <motion.div style={{ opacity: text2Opacity, y: text2Y }} className="absolute max-w-3xl mx-auto">
            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-medium tracking-tight mb-6">
              Every variable accounted for.
            </h2>
            <p className="text-lg sm:text-2xl text-neutral-400 font-light max-w-xl mx-auto">
              Deterministic safety checks ensure zero errors before the compound is even mixed.
            </p>
          </motion.div>

          <motion.div style={{ opacity: text3Opacity, y: text3Y }} className="absolute max-w-3xl mx-auto pointer-events-auto">
            <h2 className="text-5xl sm:text-7xl font-medium tracking-tight mb-8">
              CFR Part 11 Ready.
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signin">
                <div className="px-8 py-4 rounded-full bg-white text-black font-medium hover:bg-neutral-200 transition-colors cursor-pointer text-lg shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                  Start Compounding
                </div>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 
        The rest of the page appears below the sticky canvas height. 
        It has a solid background to cover the fixed canvas.
      */}
      <div className="relative z-20 bg-[#050505] border-t border-white/5">
        
        {/* Features Section */}
        <section className="py-32 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-24 max-w-3xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-6">Designed for velocity. Built for safety.</h2>
            <p className="text-neutral-400 text-lg sm:text-xl font-light">A platform that doesn&apos;t compromise. Everything you need to manage complex pharmaceutical queues with absolute confidence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Intelligent Queue", desc: "Patient context, allergies, and priority are seamlessly integrated into every job row." },
              { title: "Formula Cascades", desc: "Automatic resolution from patient-specific constraints down to company defaults." },
              { title: "AI-Assisted Verifier", desc: "Automated calculations verified against LLM citation checks to catch edge cases." },
              { title: "Immutable Audit Trail", desc: "Every state transition is securely logged for rigorous compliance and auditing." },
              { title: "Pharmacist Sign-off", desc: "Digital signature lock-in with cryptographic hashing for finalized batches." },
              { title: "Escalation Loops", desc: "Hard-stop safety boundaries automatically route dangerous formulas to senior review." },
            ].map((feature, i) => (
              <div key={i} className="p-8 rounded-3xl border border-white/5 bg-[#0A0A0A] hover:bg-[#111] transition-colors">
                <div className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mb-6">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <h3 className="text-xl font-medium mb-3">{feature.title}</h3>
                <p className="text-neutral-400 font-light leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pilot Testers Section */}
        <section className="py-24 border-y border-white/5 bg-[#0A0A0A] overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 mb-12 text-center">
            <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest">Trusted by pioneering compounding pharmacies</p>
          </div>
          {/* Infinite Marquee of logos/names */}
          <div className="flex w-full overflow-hidden group">
            <div className="flex w-max animate-marquee gap-16 px-8 items-center">
              {/* Duplicate the list to make it seamless */}
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex gap-16 items-center">
                  <div className="text-2xl font-bold text-neutral-600 tracking-tight">AuraHealth Rx</div>
                  <div className="text-2xl font-semibold text-neutral-600 tracking-tighter">NexCompound</div>
                  <div className="text-2xl font-black text-neutral-600 tracking-widest">VITA<span className="text-neutral-500">LABS</span></div>
                  <div className="text-2xl font-medium text-neutral-600">Precision<span className="italic font-light">Pharma</span></div>
                  <div className="text-2xl font-bold text-neutral-600 tracking-tight">AuraHealth Rx</div>
                  <div className="text-2xl font-semibold text-neutral-600 tracking-tighter">NexCompound</div>
                  <div className="text-2xl font-black text-neutral-600 tracking-widest">VITA<span className="text-neutral-500">LABS</span></div>
                  <div className="text-2xl font-medium text-neutral-600">Precision<span className="italic font-light">Pharma</span></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-32 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight mb-4">What our pilot users say</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-10 rounded-3xl border border-white/5 bg-gradient-to-b from-[#0A0A0A] to-[#050505]">
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                ))}
              </div>
              <p className="text-xl text-neutral-300 font-light leading-relaxed mb-8">
                &quot;The deterministic checks completely removed the anxiety from our custom dosing workflow. It&apos;s the sleekest software we&apos;ve ever used in a clinical setting.&quot;
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-neutral-800" />
                <div>
                  <div className="font-medium">Dr. Sarah Jenkins</div>
                  <div className="text-sm text-neutral-500">Lead Pharmacist, VitaLabs</div>
                </div>
              </div>
            </div>
            
            <div className="p-10 rounded-3xl border border-white/5 bg-gradient-to-b from-[#0A0A0A] to-[#050505]">
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                ))}
              </div>
              <p className="text-xl text-neutral-300 font-light leading-relaxed mb-8">
                &quot;Medivance transformed our formula resolution process from a chaotic spreadsheet mess into a perfectly oiled machine. The audit trail is flawless.&quot;
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-neutral-800" />
                <div>
                  <div className="font-medium">Michael Chen, PharmD</div>
                  <div className="text-sm text-neutral-500">Director of Operations, NexCompound</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-32 px-6">
          <div className="max-w-4xl mx-auto rounded-[40px] border border-white/10 bg-gradient-to-b from-[#0A0A0A] to-[#050505] p-12 sm:p-20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            
            <div className="inline-flex px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm font-medium mb-8">
              Enterprise
            </div>
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-6">Scale with absolute safety.</h2>
            <p className="text-neutral-400 text-lg mb-10 max-w-2xl mx-auto font-light">
              Custom integrations, priority SLA, full CFR Part 11 auditing, and dedicated success engineering for your pharmacy network.
            </p>
            <Link href="mailto:contact@medivance.app" className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white text-black font-medium hover:bg-neutral-200 transition-colors text-lg">
              Contact Us for Pricing
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6 max-w-7xl mx-auto text-sm text-neutral-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-neutral-600 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-[#050505]" />
            </div>
            <span className="font-medium tracking-tight text-neutral-400">Medivance Inc.</span>
          </div>
          <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </footer>

      </div>
    </div>
  );
}