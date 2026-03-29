"use client";

import { useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  GitBranch,
  Shield,
  Database,
  Layers,
  Search,
  Zap,
  BarChart3,
  Lock,
  Check,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";

/* ─────────────────────── NAVBAR ─────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navLinks = [
    { label: "How it works", href: "#how-it-works" },
    { label: "Features", href: "#features" },
    { label: "SDK", href: "#sdk" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md transition-all duration-200 ${
        scrolled ? "border-b border-[#E4E4E7] shadow-[0_1px_3px_rgba(0,0,0,0.04)]" : "border-b border-transparent"
      }`}
      style={{ height: 56 }}
    >
      <div className="mx-auto max-w-[1200px] h-full flex items-center justify-between px-5 md:px-8">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="relative w-7 h-7">
            <Image src="/pro_logo.png" alt="ProvenanceAI Logo" fill className="object-contain" priority />
          </div>
          <span className="font-semibold text-[15px] text-[#09090B] tracking-tight">
            ProvenanceAI
          </span>
        </Link>

        {/* Center: Nav links (desktop) */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[14px] text-[#52525B] hover:text-[#09090B] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right: CTAs */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/sign-in"
            className="text-[14px] text-[#52525B] hover:text-[#09090B] transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center h-[34px] px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[13px] font-medium rounded-[6px] transition-colors"
          >
            Get started free
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 text-[#52525B]"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#E4E4E7] px-5 pb-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-2 text-[14px] text-[#52525B] hover:text-[#09090B]"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-[#E4E4E7]">
            <Link href="/sign-in" className="text-[14px] text-[#52525B] py-1">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center h-[34px] px-4 bg-[#7C3AED] text-white text-[13px] font-medium rounded-[6px]"
            >
              Get started free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─────────────────────── CODE CARD ─────────────────────── */
function CodeCard({
  filename,
  children,
  className = "",
}: {
  filename: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#1E1E2E] rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.15)] ${className}`}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#313244]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#F38BA8]" />
          <div className="w-3 h-3 rounded-full bg-[#F9E2AF]" />
          <div className="w-3 h-3 rounded-full bg-[#A6E3A1]" />
        </div>
        <span className="text-[12px] font-mono text-[#6C7086] ml-2">{filename}</span>
      </div>
      {/* Code */}
      <div className="p-5 overflow-x-auto">
        <pre className="text-[13px] leading-[1.7] font-mono">{children}</pre>
      </div>
    </div>
  );
}

/* ─────────────── SYNTAX HIGHLIGHT HELPERS ─────────────── */
const Kw = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[#CBA6F7]">{children}</span>
);
const Str = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[#A6E3A1]">{children}</span>
);
const Var = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[#89DCEB]">{children}</span>
);
const Cmt = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[#6C7086]">{children}</span>
);
const Def = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[#CDD6F4]">{children}</span>
);

/* ─────────────────────── HERO ─────────────────────── */
function Hero() {
  return (
    <section className="min-h-[calc(100vh-56px)] flex items-center pt-[56px]">
      <div className="mx-auto max-w-[1200px] w-full px-5 md:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* Eyebrow */}
            <div className="inline-flex items-center px-3 py-1 mb-6 rounded-full text-[12px] font-medium text-[#7C3AED] bg-[#7C3AED15] border border-[#7C3AED40]">
              AI Data Provenance Infrastructure
            </div>

            {/* Headline */}
            <h1 className="text-[36px] md:text-[44px] lg:text-[48px] font-bold text-[#09090B] leading-[1.1] tracking-tight mb-5">
              Find exactly which data record broke your AI.
            </h1>

            {/* Subheadline */}
            <p className="text-[16px] md:text-[17px] text-[#52525B] leading-[1.65] mb-8 max-w-[480px]">
              ProvenanceAI traces every LLM response back to the exact source
              document that influenced it. When your RAG pipeline returns a wrong
              answer, you find the root cause in 30 seconds — not 3 hours.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center h-[40px] px-5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[14px] font-medium rounded-[6px] transition-colors"
              >
                Get started
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center h-[40px] px-5 border border-[#E4E4E7] bg-white text-[#09090B] text-[14px] font-medium rounded-[6px] hover:bg-[#FAFAFA] transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/sdk"
                className="inline-flex items-center justify-center h-[40px] px-5 border border-[#E4E4E7] bg-white text-[#09090B] text-[14px] font-medium rounded-[6px] hover:bg-[#FAFAFA] transition-colors"
              >
                View SDK docs
              </Link>
            </div>

            {/* Trust line */}
            <p className="text-[13px] text-[#71717A] leading-relaxed">
              3 lines of Python to instrument · Works with LangChain ·
              Pinecone + Chroma support
            </p>
          </motion.div>

          {/* Right: Code card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          >
            <CodeCard filename="rag_pipeline.py">
              <code>
                <Kw>from</Kw> <Var>provenance_ai</Var> <Kw>import</Kw>{" "}
                <Var>ProvenanceAIClient</Var>
                {"\n\n"}
                <Var>sdk</Var> <Def>=</Def> <Var>ProvenanceAIClient</Var>
                <Def>(</Def>
                {"\n"}
                {"    "}<Var>api_url</Var><Def>=</Def>
                <Str>&quot;https://your-api.railway.app&quot;</Str>
                <Def>,</Def>
                {"\n"}
                {"    "}<Var>api_key</Var><Def>=</Def>
                <Str>&quot;prov_live_xxxxxxxxxxxxxxxx&quot;</Str>
                <Def>,</Def>
                {"\n"}
                {"    "}<Var>pipeline_id</Var><Def>=</Def>
                <Str>&quot;insurance-rag-v1&quot;</Str>
                {"\n"}
                <Def>)</Def>
                {"\n\n"}
                <Cmt># Wrap your existing pipeline (3 lines)</Cmt>
                {"\n"}
                <Var>docs</Var> <Def>=</Def> <Var>sdk</Var>
                <Def>.</Def><Var>ingest</Var><Def>(</Def>
                <Str>&quot;policy_document.pdf&quot;</Str>
                <Def>)</Def>
                {"\n"}
                <Var>retriever</Var> <Def>=</Def> <Var>sdk</Var>
                <Def>.</Def><Var>get_retriever</Var><Def>(</Def>
                {"\n"}
                {"    "}<Var>vectorstore</Var><Def>.</Def>
                <Var>as_retriever</Var><Def>(),</Def>
                {"\n"}
                {"    "}<Var>session_id</Var><Def>=</Def>
                <Str>&quot;sess_8f3a2c&quot;</Str>
                {"\n"}
                <Def>)</Def>
                {"\n\n"}
                <Cmt># That&apos;s it. Full lineage captured automatically.</Cmt>
              </code>
            </CodeCard>

            {/* Trace result indicator */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="mt-3 mx-4"
            >
              <div className="bg-[#1E1E2E] rounded-lg px-4 py-2.5 flex items-center gap-2.5 border border-[#313244]">
                <div className="w-2 h-2 rounded-full bg-[#A6E3A1] shrink-0 animate-pulse" />
                <span className="text-[11px] font-mono text-[#A6E3A1] font-medium">
                  Trace captured
                </span>
                <span className="text-[11px] font-mono text-[#6C7086]">
                  sess_8f3a2c → policy_document.pdf → chunk_14
                </span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── PROBLEM ─────────────────────── */
const problems = [
  {
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-500/10",
    title: "Stale data, confident answers",
    description:
      "A document was accurate 6 months ago. The embedding still reflects the old version. Your LLM answers confidently — and incorrectly.",
  },
  {
    icon: GitBranch,
    iconColor: "text-red-500",
    iconBg: "bg-red-500/10",
    title: "No root cause visibility",
    description:
      "When a wrong answer surfaces, you spend hours digging through logs across LangChain, Pinecone, and your data pipeline — with no single source of truth.",
  },
  {
    icon: Shield,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    title: "Compliance with no audit trail",
    description:
      "Regulated industries require traceability. You cannot prove which data record produced which output. That is a liability, not just a bug.",
  },
];

function ProblemSection() {
  return (
    <section id="how-it-works" className="py-24 md:py-32">
      <div className="mx-auto max-w-[720px] px-5 md:px-8 text-center">
        <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-[#7C3AED] mb-4 block">
          THE PROBLEM
        </span>
        <h2 className="text-[28px] md:text-[36px] font-bold text-[#09090B] leading-[1.15] tracking-tight mb-12">
          Your AI pipeline is a black box.{" "}
          <span className="text-[#52525B]">When it fails, you have no idea why.</span>
        </h2>
      </div>

      <div className="mx-auto max-w-[1000px] px-5 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {problems.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg p-5"
            >
              <div
                className={`w-9 h-9 rounded-lg ${p.iconBg} flex items-center justify-center mb-4`}
              >
                <p.icon size={18} className={p.iconColor} />
              </div>
              <h3 className="text-[14px] font-medium text-[#09090B] mb-2">
                {p.title}
              </h3>
              <p className="text-[13px] text-[#52525B] leading-[1.6]">
                {p.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center mt-12 text-[15px] font-medium text-[#09090B]"
        >
          ProvenanceAI solves all three.
        </motion.p>
      </div>
    </section>
  );
}

/* ────────────────────── HOW IT WORKS ────────────────────── */
const steps = [
  {
    icon: Database,
    title: "Ingest",
    description:
      "SDK assigns a lineage token to every source document at ingestion time.",
  },
  {
    icon: Layers,
    title: "Embed",
    description:
      "Lineage tokens propagate through chunking and embedding — surviving into the vector database.",
  },
  {
    icon: Search,
    title: "Retrieve",
    description:
      "Every retrieval event is logged — which chunks were returned, their lineage tokens, their staleness status.",
  },
  {
    icon: GitBranch,
    title: "Trace",
    description:
      "Paste any session ID. See the complete chain from LLM response back to source document in under 30 seconds.",
  },
];

function HowItWorks() {
  return (
    <section className="py-24 md:py-32 bg-[#FAFAFA]">
      <div className="mx-auto max-w-[1000px] px-5 md:px-8 text-center">
        <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-[#7C3AED] mb-4 block">
          HOW IT WORKS
        </span>
        <h2 className="text-[28px] md:text-[36px] font-bold text-[#09090B] leading-[1.15] tracking-tight mb-16">
          From source document to LLM response —{" "}
          <span className="text-[#52525B]">every step traced.</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-3 relative">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex flex-col items-center text-center relative"
            >
              {/* Number badge */}
              <div className="w-8 h-8 rounded-full bg-[#7C3AED] text-white text-[13px] font-semibold flex items-center justify-center mb-4">
                {i + 1}
              </div>

              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-[#7C3AED10] flex items-center justify-center mb-3">
                <step.icon size={20} className="text-[#7C3AED]" />
              </div>

              <h3 className="text-[14px] font-medium text-[#09090B] mb-2">
                {step.title}
              </h3>
              <p className="text-[13px] text-[#52525B] leading-[1.6] max-w-[200px]">
                {step.description}
              </p>

              {/* Arrow (desktop only) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-[16px] -right-[14px] text-[#71717A] text-[18px]">
                  →
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── FEATURES ─────────────────────── */
const features = [
  {
    icon: GitBranch,
    title: "Full Lineage Tracing",
    description:
      "Trace any LLM response back to its exact source document in a single query.",
  },
  {
    icon: AlertTriangle,
    title: "Staleness Detection",
    description:
      "Daily batch job detects when source files change and flags all downstream embeddings as stale.",
  },
  {
    icon: Shield,
    title: "Quarantine Mode",
    description:
      "One-click tombstone for bad embeddings — instantly prevent poisoned chunks from being retrieved again.",
  },
  {
    icon: Zap,
    title: "Auto-Remediation",
    description:
      "Webhook dispatch triggers automatic re-embedding when source records change — reducing TTR from hours to seconds.",
  },
  {
    icon: BarChart3,
    title: "Semantic Diff",
    description:
      "Classifies changes as formatting, additive, or contradictory — eliminating alert fatigue.",
  },
  {
    icon: Lock,
    title: "Redaction Lineage",
    description:
      "Track PII detection and redaction through the pipeline. Know exactly what was removed and where.",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="mx-auto max-w-[1000px] px-5 md:px-8">
        <div className="text-center mb-14">
          <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-[#7C3AED] mb-4 block">
            FEATURES
          </span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-[#09090B] leading-[1.15] tracking-tight">
            Everything you need to trust your AI pipeline.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="bg-white border border-[#E4E4E7] rounded-lg p-5 transition-all duration-200 hover:border-[#7C3AED66] hover:shadow-[0_4px_16px_rgba(124,58,237,0.08)] group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#7C3AED10] flex items-center justify-center mb-3 transition-colors group-hover:bg-[#7C3AED15]">
                <f.icon size={18} className="text-[#7C3AED]" />
              </div>
              <h3 className="text-[14px] font-medium text-[#09090B] mb-2">
                {f.title}
              </h3>
              <p className="text-[13px] text-[#52525B] leading-[1.6]">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Mid-page CTA */}
        <div className="flex justify-center mt-12">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center h-[40px] px-5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[14px] font-medium rounded-[6px] transition-colors"
          >
            Get started free
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── SDK SECTION ─────────────────────── */
function SDKSection() {
  const checkItems = [
    "Works with LangChain (more frameworks coming)",
    "Pinecone and Chroma support",
    "PDF and plain text ingestion",
    "Zero disruption — fails silently if backend unreachable",
    "pip install provenance-ai",
  ];

  return (
    <section id="sdk" className="py-24 md:py-32 bg-[#FAFAFA]">
      <div className="mx-auto max-w-[1000px] px-5 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left copy */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-[#7C3AED] mb-4 block">
              SDK
            </span>
            <h2 className="text-[28px] md:text-[36px] font-bold text-[#09090B] leading-[1.15] tracking-tight mb-8">
              Instrument in 3 lines.{" "}
              <span className="text-[#52525B]">
                Works with your existing pipeline.
              </span>
            </h2>

            <ul className="space-y-3 mb-8">
              {checkItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check
                    size={16}
                    className="text-[#7C3AED] mt-0.5 shrink-0"
                  />
                  <span className="text-[14px] text-[#52525B] leading-[1.5]">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
            >
              Get your API key
              <ArrowRight size={15} />
            </Link>
          </motion.div>

          {/* Right: Code */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <CodeCard filename="terminal">
              <code>
                <Def>$ </Def>
                <Var>pip install</Var> <Str>provenance-ai</Str>
              </code>
            </CodeCard>

            <div className="mt-4">
              <CodeCard filename="instrument.py">
                <code>
                  <Kw>from</Kw> <Var>provenance_ai</Var> <Kw>import</Kw>{" "}
                  <Var>ProvenanceAIClient</Var>
                  {"\n\n"}
                  <Var>sdk</Var> <Def>=</Def> <Var>ProvenanceAIClient</Var>
                  <Def>(</Def><Var>api_key</Var><Def>=</Def>
                  <Str>&quot;prov_live_...&quot;</Str><Def>)</Def>
                  {"\n"}
                  <Var>retriever</Var> <Def>=</Def> <Var>sdk</Var>
                  <Def>.</Def><Var>get_retriever</Var><Def>(</Def>
                  <Var>your_retriever</Var><Def>)</Def>
                  {"\n\n"}
                  <Cmt># Done. Every retrieval is now traced.</Cmt>
                </code>
              </CodeCard>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── FINAL CTA ─────────────────────── */
function FinalCTA() {
  return (
    <section className="py-20 md:py-24 bg-[#0A0A0B]">
      <div className="mx-auto max-w-[600px] px-5 md:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-[28px] md:text-[36px] font-bold text-white leading-[1.15] tracking-tight mb-5">
            Stop debugging AI blindly.
          </h2>
          <p className="text-[15px] text-[#71717A] leading-[1.6] mb-8 max-w-[460px] mx-auto">
            Instrument your pipeline in 10 minutes and see exactly which data is
            causing your AI to fail.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center h-[40px] px-5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[14px] font-medium rounded-[6px] transition-colors"
            >
              Get started free
            </Link>
            <Link
              href="/sdk"
              className="inline-flex items-center justify-center h-[40px] px-5 border border-[#3F3F46] text-white text-[14px] font-medium rounded-[6px] hover:bg-[#18181B] transition-colors"
            >
              View SDK docs
            </Link>
          </div>

          <p className="text-[13px] text-[#52525B]">
            3 lines of Python · Free forever plan · No credit card required
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────── FOOTER ─────────────────────── */
function Footer() {
  return (
    <footer className="bg-white border-t border-[#E4E4E7]">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-6 h-6">
                <Image
                  src="/pro_logo.png"
                  alt="ProvenanceAI"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-semibold text-[14px] text-[#09090B] tracking-tight">
                ProvenanceAI
              </span>
            </div>
            <p className="text-[13px] text-[#71717A] leading-[1.5]">
              AI data provenance infrastructure
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#71717A] mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              {["Dashboard", "SDK Setup", "Changelog"].map((t) => (
                <li key={t}>
                  <Link
                    href={t === "Dashboard" ? "/trace" : t === "SDK Setup" ? "/sdk" : "#"}
                    className="text-[13px] text-[#52525B] hover:text-[#09090B] transition-colors"
                  >
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Developers */}
          <div>
            <h4 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#71717A] mb-4">
              Developers
            </h4>
            <ul className="space-y-2.5">
              {["Documentation", "SDK Reference", "GitHub", "API Reference"].map(
                (t) => (
                  <li key={t}>
                    <Link
                      href={t === "GitHub" ? "https://github.com" : "#"}
                      className="text-[13px] text-[#52525B] hover:text-[#09090B] transition-colors"
                      {...(t === "GitHub" ? { target: "_blank", rel: "noopener" } : {})}
                    >
                      {t}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#71717A] mb-4">
              Company
            </h4>
            <ul className="space-y-2.5">
              {["About", "Blog", "Contact", "Privacy Policy", "Terms of Service"].map(
                (t) => (
                  <li key={t}>
                    <Link
                      href="#"
                      className="text-[13px] text-[#52525B] hover:text-[#09090B] transition-colors"
                    >
                      {t}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-[#E4E4E7] gap-4">
          <p className="text-[12px] text-[#71717A]">
            © 2026 ProvenanceAI. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            {/* Twitter/X */}
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener"
              className="text-[#71717A] hover:text-[#09090B] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {/* GitHub */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener"
              className="text-[#71717A] hover:text-[#09090B] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            {/* LinkedIn */}
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener"
              className="text-[#71717A] hover:text-[#09090B] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────── MAIN LANDING PAGE ─────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ scrollBehavior: "smooth" }}>
      <Navbar />
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <Features />
      <SDKSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
