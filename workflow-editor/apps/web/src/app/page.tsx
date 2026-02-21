'use client';

import { useState } from 'react';
import {
  MessageSquare,
  Plug,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Menu,
  X,
  Twitter,
  Linkedin,
  Github,
} from 'lucide-react';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
];

const features = [
  {
    icon: MessageSquare,
    title: 'Chat-First Interface',
    desc: 'Describe what you want automated in plain English. No code, no flowcharts — just conversation.',
  },
  {
    icon: Plug,
    title: '30+ Integrations',
    desc: 'Connect to Slack, Salesforce, HubSpot, Google Workspace, and dozens more out of the box.',
  },
  {
    icon: ShieldCheck,
    title: 'Built-in Approvals',
    desc: 'Every automation includes human-in-the-loop checkpoints. Nothing runs without your sign-off.',
  },
  {
    icon: Sparkles,
    title: 'Smart Suggestions',
    desc: 'blockd learns your workflows and proactively suggests automations that save your team hours.',
  },
];

const steps = [
  {
    num: '01',
    title: 'Describe',
    desc: 'Tell blockd what you want to automate using plain English. "When a new lead comes in, enrich it and notify my team."',
  },
  {
    num: '02',
    title: 'Review',
    desc: 'blockd drafts the workflow and shows you every step. Approve, tweak, or reject — you\'re always in control.',
  },
  {
    num: '03',
    title: 'Automate',
    desc: 'Hit go and your automation runs reliably in the background. Monitor, pause, or update anytime.',
  },
];

const faqs = [
  {
    q: 'Do I need to know how to code?',
    a: 'Not at all. blockd is designed for business teams. You describe what you want in plain English and blockd handles the rest.',
  },
  {
    q: 'How does the approval system work?',
    a: 'Every automation includes configurable checkpoints where a human must approve before the workflow continues. You decide what needs sign-off.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. We use end-to-end encryption, SOC 2 compliant infrastructure, and never store your credentials on our servers. Your data stays yours.',
  },
  {
    q: 'What integrations do you support?',
    a: 'We support 30+ integrations including Slack, Salesforce, HubSpot, Google Workspace, Jira, Notion, and more. New integrations are added monthly.',
  },
  {
    q: 'How much does blockd cost?',
    a: 'We offer flexible plans based on your team size and automation volume. Request a demo and we\'ll walk you through pricing tailored to your needs.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-200 rounded-xl">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left font-semibold text-zinc-900"
      >
        {q}
        {open ? <ChevronUp className="w-5 h-5 shrink-0 text-orange-500" /> : <ChevronDown className="w-5 h-5 shrink-0 text-zinc-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 text-zinc-600 leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-zinc-900 overflow-x-hidden">
      {/* Gradient top - matches joinblockd.com */}
      <div
        className="fixed inset-x-0 top-0 h-[600px] pointer-events-none z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,237,229,0.15) 0%, rgba(255,255,255,0) 100%)',
        }}
      />
      {/* Radial glow behind hero */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none z-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255,107,0,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Navbar - floating style like useyolo */}
      <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-6 md:px-0">
        <div className="w-full max-w-5xl">
          <div className="flex h-14 items-center justify-between px-5 rounded-2xl bg-white/80 backdrop-blur-md border border-zinc-200/60 shadow-sm">
            <a href="/" className="flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <img src="/blockd-logo.png" alt="blockd" className="w-7 h-7" />
              <span className="text-lg font-semibold text-zinc-900">blockd</span>
            </a>

            {/* Desktop links - centered pill */}
            <div className="hidden md:block">
              <ul className="flex items-center rounded-full h-10 px-2">
                {navLinks.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors tracking-tight"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://www.joinblockd.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex items-center justify-center h-8 px-4 text-sm font-medium tracking-wide rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-all active:scale-95 shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_3px_-1.5px_rgba(16,24,40,0.06),0_1px_1px_rgba(16,24,40,0.08)]"
              >
                Request Demo
              </a>
              <button className="md:hidden border border-zinc-200 size-8 rounded-md cursor-pointer flex items-center justify-center" onClick={() => setMobileOpen(!mobileOpen)}>
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <div className="md:hidden mt-2 rounded-xl border border-zinc-200/60 bg-white/95 backdrop-blur-md shadow-sm px-5 py-4 space-y-3">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-medium text-zinc-500 hover:text-zinc-900"
                >
                  {l.label}
                </a>
              ))}
              <a
                href="https://www.joinblockd.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-orange-500 text-white text-sm font-medium px-5 py-2 rounded-full text-center"
              >
                Request Demo
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-orange-200 bg-orange-50 text-orange-600 text-xs font-medium tracking-wide uppercase">
          AI-Native Automation
        </div>
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Simplified Automation
          <br />
          <span className="text-orange-500">with Trust</span>
        </h1>
        <p className="text-lg sm:text-xl text-zinc-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Describe what you want automated in plain English. blockd builds, runs,
          and monitors your workflows — with human approvals at every step.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://www.joinblockd.com"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-8 py-3 rounded-lg text-base transition flex items-center gap-2"
          >
            Request Demo <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#how-it-works"
            className="text-zinc-600 hover:text-zinc-900 font-medium text-base transition"
          >
            See how it works →
          </a>
        </div>

        {/* Mock product screenshot */}
        <div className="mt-16 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 shadow-xl shadow-orange-500/5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare className="w-4 h-4 text-orange-500" />
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-left text-zinc-700">
                &quot;When a new lead fills out our contact form, enrich their data with Clearbit, add them to HubSpot, and notify my sales team on Slack.&quot;
              </div>
            </div>
            <div className="flex items-start gap-3 justify-end">
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-left text-zinc-700 max-w-md">
                Got it! I&apos;ve created a 3-step workflow: <strong>Form Trigger</strong> → <strong>Clearbit Enrichment</strong> → <strong>HubSpot + Slack</strong>. Ready for your review. ✅
              </div>
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gradient divider */}
      <div
        className="relative z-0 h-32 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, transparent, rgba(255,237,229,0.1))',
        }}
      />

      {/* Features */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Built for teams that move fast
          </h2>
          <p className="text-zinc-600 max-w-xl mx-auto">
            Everything you need to automate your business processes — without the complexity.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-200 p-6 hover:border-orange-300 transition bg-white"
            >
              <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            How it works
          </h2>
          <p className="text-zinc-600 max-w-xl mx-auto">
            Three simple steps to automate any business process.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.num} className="text-center md:text-left">
              <div className="text-5xl font-bold text-orange-500/20 mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {s.num}
              </div>
              <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-10 sm:p-14 text-center">
          <p
            className="text-xl sm:text-2xl font-medium leading-relaxed mb-6 italic"
            style={{ fontFamily: "'Poly', 'Georgia', serif" }}
          >
            &quot;blockd replaced three different tools and cut our workflow setup time from days to minutes. The approval system gives our compliance team peace of mind.&quot;
          </p>
          <div>
            <p className="font-semibold">Sarah Chen</p>
            <p className="text-sm text-zinc-500">Head of Operations, Acme Corp</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 max-w-3xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Frequently asked questions
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f) => (
            <FAQItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center" style={{
        background: 'linear-gradient(180deg, transparent 0%, rgba(255,237,229,0.08) 50%, transparent 100%)',
      }}>
        <h2
          className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Ready to simplify your workflows?
        </h2>
        <p className="text-zinc-600 mb-8 max-w-xl mx-auto">
          Join teams automating their business with plain English — no code required.
        </p>
        <a
          href="https://www.joinblockd.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-8 py-3 rounded-lg text-base transition"
        >
          Request Demo <ArrowRight className="w-4 h-4" />
        </a>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <span className="flex items-center gap-2 text-lg font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <img src="/blockd-logo.png" alt="blockd" className="w-6 h-6" />
                blockd
              </span>
              <p className="text-sm text-zinc-500 mt-1">Simplified Automation with Trust</p>
            </div>
            <div className="flex items-center gap-6">
              <a href="#features" className="text-sm text-zinc-500 hover:text-zinc-900 transition">Features</a>
              <a href="#how-it-works" className="text-sm text-zinc-500 hover:text-zinc-900 transition">How it Works</a>
              <a href="#faq" className="text-sm text-zinc-500 hover:text-zinc-900 transition">FAQ</a>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="text-zinc-400 hover:text-zinc-600 transition"><Twitter className="w-5 h-5" /></a>
              <a href="#" className="text-zinc-400 hover:text-zinc-600 transition"><Linkedin className="w-5 h-5" /></a>
              <a href="#" className="text-zinc-400 hover:text-zinc-600 transition"><Github className="w-5 h-5" /></a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-zinc-100 text-center text-sm text-zinc-400">
            © {new Date().getFullYear()} blockd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
