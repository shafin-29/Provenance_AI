"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck, Zap, GitCompare, Bell, Lock, Radio,
  Check, X as XIcon, Menu, X, ArrowRight,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import ShieldDemo from "./ShieldDemo";

/* ═══════════════════════════════════════════════════════════════════
   SECTION 1 — NAVBAR
   ═══════════════════════════════════════════════════════════════════ */
function Navbar() {
  const { userId, isLoaded } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navLinks = [
    { label: "How it works", href: "#how-it-works" },
    { label: "Features", href: "#features" },
    { label: "Docs", href: "/sdk" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm transition-all duration-200 ${
        scrolled ? "border-b border-[#E4E4E7]" : "border-b border-transparent"
      }`}
      style={{ height: 56 }}
    >
      <div className="mx-auto max-w-[1200px] h-full flex items-center justify-between px-5 md:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="relative w-7 h-7">
            <Image src="/pro_logo.png" alt="ProvenanceAI" fill className="object-contain" priority />
          </div>
          <span className="font-semibold text-[15px] text-[#09090B] tracking-tight">
            ProvenanceAI
          </span>
        </Link>

        {/* Center links — desktop */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-[14px] text-[#52525B] hover:text-[#09090B] transition-colors duration-150"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right — desktop */}
        <div className="hidden md:flex items-center gap-3">
          {isLoaded && userId ? (
            <Link
              href="/shield"
              className="inline-flex items-center justify-center h-[34px] px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[13px] font-medium rounded-[6px] transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-[13px] text-[#52525B] hover:text-[#09090B] transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center h-[34px] px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[13px] font-medium rounded-[6px] transition-colors"
              >
                Get started free
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1 text-[#52525B] hover:text-[#09090B]"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-[#E4E4E7] px-5 py-4 space-y-3">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="block text-[14px] text-[#52525B] hover:text-[#09090B] py-1"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-[#F4F4F5] space-y-2">
            {isLoaded && userId ? (
              <Link
                href="/shield"
                className="block text-center h-[38px] leading-[38px] bg-[#7C3AED] text-white text-[13px] font-medium rounded-[6px]"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="block text-center text-[13px] text-[#52525B] py-1"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="block text-center h-[38px] leading-[38px] bg-[#7C3AED] text-white text-[13px] font-medium rounded-[6px]"
                >
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 2 — HERO
   ═══════════════════════════════════════════════════════════════════ */
function Hero() {
  return (
    <section
      className="pt-[56px] flex flex-col items-center justify-center px-5 md:px-8"
      style={{ minHeight: "100vh" }}
    >
      <div className="max-w-[720px] text-center mx-auto mb-10 mt-12 md:mt-0">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center px-3.5 py-1 mb-6 rounded-full text-[12px] font-medium"
          style={{
            color: "#7C3AED",
            backgroundColor: "#7C3AED10",
            border: "1px solid #7C3AED30",
          }}
        >
          AI Pipeline Safety Layer — Always On
        </div>

        {/* Headline */}
        <h1
          className="text-[28px] md:text-[42px] font-semibold leading-[1.2] tracking-tight mb-5"
          style={{ color: "#09090B", maxWidth: 720 }}
        >
          Your RAG pipeline is one stale
          <br className="hidden md:block" /> embedding away from disaster.
        </h1>

        {/* Subheadline */}
        <p
          className="text-[16px] md:text-[18px] leading-[1.6] mb-8 mx-auto"
          style={{ color: "#71717A", maxWidth: 560 }}
        >
          ProvenanceAI sits inside your pipeline as an invisible safety layer. It intercepts stale
          chunks before they reach your LLM, quarantines bad embeddings automatically, and sends
          you a complete incident report — with everything already handled.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center h-[44px] px-6 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[15px] font-medium rounded-lg transition-colors"
          >
            Start protecting your pipeline
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center h-[44px] px-6 border border-[#E4E4E7] text-[#09090B] text-[15px] font-medium rounded-lg hover:bg-[#FAFAFA] transition-colors"
          >
            See how it works ↓
          </Link>
        </div>

        {/* Trust line */}
        <p className="text-[13px]" style={{ color: "#71717A" }}>
          Free forever plan · 3 lines of Python to instrument · No credit card required
        </p>
      </div>

      {/* Live Shield Demo */}
      <div className="w-full max-w-[760px] mx-auto pb-12">
        <ShieldDemo />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 3 — SOCIAL PROOF BAR
   ═══════════════════════════════════════════════════════════════════ */
function SocialProofBar() {
  return (
    <div className="bg-[#FAFAFA] border-t border-b border-[#E4E4E7] py-4">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8 text-center">
        <p className="text-[13px] text-[#71717A]">
          Built for engineers at companies building production AI
        </p>
        <p className="text-[13px] text-[#A1A1AA] mt-1">
          Fintech RAG systems · Healthcare AI · Legal document AI · Insurance chatbots · Compliance
          platforms
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 4 — HOW IT WORKS
   ═══════════════════════════════════════════════════════════════════ */
interface Step {
  num: string;
  title: string;
  description: string;
  codePreview: string;
  colorAccent?: string;
}

const steps: Step[] = [
  {
    num: "01",
    title: "Install the SDK",
    description:
      "One pip install. No infrastructure changes. No new databases. No YAML config files.",
    codePreview: "pip install provenance-ai",
  },
  {
    num: "02",
    title: "Wrap your existing retriever",
    description:
      "One line change. Your pipeline continues exactly as before — the Shield runs invisibly inside.",
    codePreview: "retriever = sdk.wrap(your_retriever)",
  },
  {
    num: "03",
    title: "Ingest your source files",
    description:
      "SDK fingerprints every document with a lineage token that survives chunking, embedding, and vector database storage.",
    codePreview: 'docs = sdk.ingest("policy.pdf")',
  },
  {
    num: "04",
    title: "The Shield handles everything else",
    description:
      "Staleness detection, auto-quarantine, semantic diff classification, blast radius assessment, Slack/email incident reports — all automatic. You only hear from ProvenanceAI when something actually needs your attention.",
    codePreview: "✓ Shield active",
    colorAccent: "#10B981",
  },
];

const codeLines = [
  { text: 'from provenance_ai import ProvenanceAIClient, SafeMode', color: "#E4E4E7" },
  { text: '', color: "" },
  { text: 'sdk = ProvenanceAIClient(', color: "#E4E4E7" },
  { text: '    api_url="https://your-api.railway.app",', color: "#A6E3A1" },
  { text: '    api_key="prov_live_xxxxxxxxxxxxxxxx",', color: "#A6E3A1" },
  { text: '    pipeline_id="insurance-rag-v1",', color: "#A6E3A1" },
  { text: '    safe_mode=SafeMode.SUBSTITUTE', color: "#CBA6F7" },
  { text: ')', color: "#E4E4E7" },
  { text: '', color: "" },
  { text: '# Step 1: Ingest your documents', color: "#6C7086" },
  { text: 'docs = sdk.ingest("policy_document.pdf")', color: "#E4E4E7" },
  { text: 'vectorstore.add_documents([doc for doc, _ in docs])', color: "#E4E4E7" },
  { text: '', color: "" },
  { text: '# Step 2: Wrap your retriever (one line)', color: "#6C7086" },
  { text: 'retriever = sdk.wrap(vectorstore.as_retriever())', color: "#E4E4E7" },
  { text: '', color: "" },
  { text: '# Step 3: Use in your chain — unchanged', color: "#6C7086" },
  { text: 'chain = RetrievalQA.from_chain_type(', color: "#E4E4E7" },
  { text: '    llm=llm,', color: "#E4E4E7" },
  { text: '    retriever=retriever  # Shield is active inside here', color: "#E4E4E7" },
  { text: ')', color: "#E4E4E7" },
  { text: '', color: "" },
  { text: "# That's it. The Shield handles everything else.", color: "#6C7086" },
  { text: '# Stale chunks intercepted automatically.', color: "#6C7086" },
  { text: '# Incidents created automatically.', color: "#6C7086" },
  { text: '# You get Slack/email when something needs attention.', color: "#6C7086" },
];

// Line ranges highlighted per step
const stepHighlights: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7],  // Step 1: SDK init
  [9, 10, 11],                 // Step 2: ingest → actually step 3 in code
  [13, 14],                    // Step 3: wrap
  Array.from({ length: 26 }, (_, i) => i), // Step 4: all
];

function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    stepRefs.current.forEach((el, idx) => {
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveStep(idx);
        },
        { threshold: 0.6, rootMargin: "-20% 0px -20% 0px" }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const highlighted = new Set(stepHighlights[activeStep] || []);

  return (
    <section id="how-it-works" className="py-20 md:py-28">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C3AED] mb-3 block">
            HOW IT WORKS
          </span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-[#09090B] leading-[1.15] tracking-tight">
            Installs in 3 lines.
            <br />
            <span className="text-[#52525B]">Protects automatically forever after.</span>
          </h2>
        </div>

        {/* Two columns */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Left — Steps */}
          <div className="lg:w-[45%] space-y-4">
            {steps.map((step, idx) => (
              <div
                key={step.num}
                ref={(el) => { stepRefs.current[idx] = el; }}
                className="rounded-lg p-5 transition-all duration-300"
                style={{
                  borderLeft: activeStep === idx ? "2px solid #7C3AED" : "2px solid transparent",
                  backgroundColor: activeStep === idx ? "#7C3AED08" : "transparent",
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="text-[12px] font-bold rounded-full w-7 h-7 flex items-center justify-center"
                    style={{
                      backgroundColor: step.colorAccent ? `${step.colorAccent}15` : "#7C3AED15",
                      color: step.colorAccent || "#7C3AED",
                    }}
                  >
                    {step.num}
                  </span>
                  <h3 className="text-[15px] font-semibold text-[#09090B]">{step.title}</h3>
                </div>
                <p className="text-[14px] text-[#71717A] leading-[1.6] mb-3 ml-10">
                  {step.description}
                </p>
                <div className="ml-10">
                  <code
                    className="inline-block text-[12px] font-mono px-3 py-1.5 rounded-md"
                    style={{
                      backgroundColor: "#1E1E2E",
                      color: step.colorAccent || "#A6E3A1",
                    }}
                  >
                    {step.codePreview}
                  </code>
                </div>
              </div>
            ))}
          </div>

          {/* Right — Code card */}
          <div className="lg:w-[55%]">
            <div className="sticky top-20 bg-[#1E1E2E] rounded-xl p-5 md:p-6 overflow-x-auto">
              <div className="flex items-center gap-1.5 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
                <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span className="text-[11px] text-[#6C7086] ml-2 font-mono">instrument.py</span>
              </div>
              <pre className="text-[12px] font-mono leading-[1.8]">
                {codeLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="transition-all duration-300"
                    style={{
                      opacity: highlighted.has(idx) ? 1 : 0.3,
                      backgroundColor: highlighted.has(idx)
                        ? activeStep === 3
                          ? "#10B98108"
                          : "#7C3AED08"
                        : "transparent",
                      borderRadius: 4,
                      padding: "0 4px",
                      marginLeft: -4,
                      marginRight: -4,
                      color: line.color || "#E4E4E7",
                    }}
                  >
                    {line.text || "\u00A0"}
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 5 — BEFORE/AFTER COMPARISON
   ═══════════════════════════════════════════════════════════════════ */
const withoutItems = [
  "Stale embedding reaches LLM undetected",
  "Wrong answer delivered to user",
  "Engineer manually digs through logs",
  "Session ID copy-pasted into a dashboard",
  "Root cause found hours later",
  "847 more users affected while investigating",
  "Compliance team asks for audit trail you don't have",
];

const withItems = [
  "Shield intercepts stale chunk at retrieval time",
  "Clean chunks forwarded to LLM automatically",
  "Incident created with full lineage context",
  "Slack/email sent with everything already handled",
  "Root cause identified in 0 seconds (automatic)",
  "Zero users affected — blocked before LLM",
  "Full audit trail auto-generated",
];

function Comparison() {
  return (
    <section className="py-20 md:py-28 bg-[#FAFAFA]">
      <div className="mx-auto max-w-[900px] px-5 md:px-8">
        <div className="text-center mb-12">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C3AED] mb-3 block">
            THE DIFFERENCE
          </span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-[#09090B] leading-[1.15] tracking-tight">
            From passive logging to active protection.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-[#E4E4E7] rounded-lg overflow-hidden">
          {/* Without */}
          <div>
            <div className="px-5 py-3 bg-[#FEF2F2] border-b border-[#E4E4E7]">
              <span className="text-[13px] font-semibold text-[#7F1D1D]">
                Without ProvenanceAI
              </span>
            </div>
            {withoutItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-5 h-[44px] border-b border-[#F4F4F5] last:border-0"
                style={{ backgroundColor: i % 2 === 1 ? "#FAFAFA" : "white" }}
              >
                <XIcon size={14} className="text-[#EF4444] shrink-0" />
                <span className="text-[13px] text-[#52525B]">{item}</span>
              </div>
            ))}
          </div>

          {/* With */}
          <div className="border-t md:border-t-0 md:border-l border-[#E4E4E7]">
            <div className="px-5 py-3 bg-[#F0FDF4] border-b border-[#E4E4E7]">
              <span className="text-[13px] font-semibold text-[#14532D]">
                With ProvenanceAI
              </span>
            </div>
            {withItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-5 h-[44px] border-b border-[#F4F4F5] last:border-0"
                style={{ backgroundColor: i % 2 === 1 ? "#FAFAFA" : "white" }}
              >
                <Check size={14} className="text-[#10B981] shrink-0" />
                <span className="text-[13px] text-[#52525B]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 6 — FEATURES
   ═══════════════════════════════════════════════════════════════════ */
const features = [
  {
    icon: ShieldCheck,
    iconColor: "#10B981",
    title: "Real-Time Shield",
    description:
      "Intercepts every retrieved chunk before it reaches your LLM. Stale and quarantined chunks are blocked in under 20ms — faster than your LLM can process them.",
  },
  {
    icon: Zap,
    iconColor: "#7C3AED",
    title: "Auto-Remediation",
    description:
      "When staleness is detected, the Remediation Engine automatically quarantines bad embeddings, computes semantic diff, and triggers re-ingestion — no human input needed.",
  },
  {
    icon: GitCompare,
    iconColor: "#3B82F6",
    title: "Semantic Diff Engine",
    description:
      'Not all changes are equal. ProvenanceAI classifies changes as Formatting, Additive, Modified, or Contradictory — so you only get alerted when meaning changes, not just bytes.',
  },
  {
    icon: Bell,
    iconColor: "#F59E0B",
    title: "Incident Reports",
    description:
      "Every automatic remediation generates a full incident report with root cause, blast radius, semantic diff score, and exact re-ingestion command — sent to Slack and email.",
  },
  {
    icon: Lock,
    iconColor: "#EF4444",
    title: "Quarantine Mode",
    description:
      "One-click (or automatic) tombstoning of bad embeddings. Quarantined sources cannot be retrieved by your pipeline until you release them — an emergency safety brake.",
  },
  {
    icon: Radio,
    iconColor: "#7C3AED",
    title: "Blast Radius Assessment",
    description:
      'Know exactly how many past LLM responses used stale data. Not just "something is wrong" — but "847 responses over 42 days used this outdated document."',
  },
];

function Features() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="text-center mb-16">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C3AED] mb-3 block">
            FEATURES
          </span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-[#09090B] leading-[1.15] tracking-tight">
            Every layer of your pipeline, protected.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="bg-white border border-[#E4E4E7] rounded-lg p-6 transition-all duration-200 hover:border-[#7C3AED30] hover:shadow-[0_4px_12px_#7C3AED10]"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${f.iconColor}12` }}
                >
                  <Icon size={20} style={{ color: f.iconColor }} />
                </div>
                <h3 className="text-[15px] font-semibold text-[#09090B] mb-2">{f.title}</h3>
                <p className="text-[13px] text-[#71717A] leading-[1.6]">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 7 — SAFE MODES
   ═══════════════════════════════════════════════════════════════════ */
const safeModes = [
  {
    mode: "PASS",
    chipColor: "#008000",
    title: "Visibility Only",
    description:
      "Shield monitors all chunks and logs lineage data. Nothing is blocked. Use when first instrumenting a pipeline to see what's there before taking action.",
    code: "safe_mode=SafeMode.PASS",
    highlight: false,
  },
  {
    mode: "WARN",
    chipColor: "#E0BC00",
    title: "Alert Without Blocking",
    description:
      "Stale chunks pass through with metadata warnings attached. Your pipeline continues normally. You get Slack/email with the staleness details.",
    code: "safe_mode=SafeMode.WARN",
    highlight: false,
  },
  {
    mode: "SUBSTITUTE",
    chipColor: "#7C3AED",
    title: "Auto-Replace Stale Chunks",
    description:
      "Shield quarantines stale chunks and attempts to find fresh substitutes. If no substitute is available, the stale chunk passes through with a warning. Best for most production RAG systems.",
    code: "safe_mode=SafeMode.SUBSTITUTE",
    highlight: false,
    badgeLabel: "Default",
  },
  {
    mode: "BLOCK",
    chipColor: "#EF4444",
    title: "Zero Tolerance",
    description:
      "If stale chunks exceed your threshold, the entire retrieval is blocked. A ShieldBlockedError is raised. Use for regulated industries where a wrong answer is a liability — not just a bug.",
    code: "safe_mode=SafeMode.BLOCK",
    highlight: false,
  },
];

function SafeModes() {
  return (
    <section className="py-20 md:py-28 bg-[#FAFAFA]">
      <div className="mx-auto max-w-[1000px] px-5 md:px-8">
        <div className="text-center mb-16">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C3AED] mb-3 block">
            SAFE MODES
          </span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-[#09090B] leading-[1.15] tracking-tight">
            You choose how aggressive the Shield is.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {safeModes.map((sm) => (
            <div
              key={sm.mode}
              className="bg-white rounded-lg p-5 transition-all duration-200"
              style={{
                border: sm.highlight ? "2px solid #7C3AED" : "1px solid #E4E4E7",
                backgroundColor: sm.highlight ? "#7C3AED08" : "white",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-[11px] font-bold uppercase px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${sm.chipColor}15`,
                    color: sm.chipColor,
                  }}
                >
                  {sm.mode}
                </span>
                {sm.highlight && (
                  <span className="text-[11px] text-[#7C3AED] font-medium bg-[#7C3AED10] px-2 py-0.5 rounded">
                    Default
                  </span>
                )}
              </div>
              <h3 className="text-[15px] font-semibold text-[#09090B] mb-2">{sm.title}</h3>
              <p className="text-[13px] text-[#71717A] leading-[1.6] mb-4">{sm.description}</p>
              <code className="inline-block text-[12px] font-mono px-3 py-1.5 rounded-md bg-[#1E1E2E] text-[#A6E3A1]">
                {sm.code}
              </code>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 8 — PRICING
   ═══════════════════════════════════════════════════════════════════ */
interface PricingPlan {
  name: string;
  price: string;
  period: string;
  subtitle: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted: boolean;
  badge?: string;
}

const plans: PricingPlan[] = [
  {
    name: "Free",
    price: "$0",
    period: "/ month",
    subtitle: "For individual engineers and experiments",
    features: [
      "Up to 50,000 shield events/month",
      "1 pipeline · 7-day incident history",
      "SafeMode: PASS and WARN only",
      "Email alerts",
      "Pinecone + Chroma support",
    ],
    cta: "Start free",
    ctaHref: "/sign-up",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/ month",
    subtitle: "For production RAG systems",
    features: [
      "Up to 1,000,000 shield events/month",
      "Unlimited pipelines",
      "All SafeModes (SUBSTITUTE + BLOCK)",
      "Auto-quarantine + auto-remediation",
      "Slack + email incident reports",
      "90-day incident history",
      "Semantic diff engine",
      "Blast radius assessment",
    ],
    cta: "Start free trial",
    ctaHref: "/sign-up",
    highlighted: true,
    badge: "Most popular",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    subtitle: "For regulated industries",
    features: [
      "Unlimited shield events",
      "Unlimited pipelines + retention",
      "Custom block thresholds",
      "SOC 2 compliance reports",
      "HIPAA audit trail",
      "Dedicated Slack support channel",
      "SLA guarantee",
      "On-prem deployment option",
    ],
    cta: "Contact us",
    ctaHref: "mailto:hello@provenanceai.com",
    highlighted: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="mx-auto max-w-[1100px] px-5 md:px-8">
        <div className="text-center mb-16">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C3AED] mb-3 block">
            PRICING
          </span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-[#09090B] leading-[1.15] tracking-tight">
            Start free. Scale when you need to.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="bg-white rounded-xl p-6 flex flex-col relative"
              style={{
                border: plan.highlighted ? "2px solid #7C3AED" : "1px solid #E4E4E7",
              }}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#7C3AED] text-white text-[11px] font-medium rounded-full">
                  {plan.badge}
                </div>
              )}
              <h3 className="text-[18px] font-bold text-[#09090B] mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[32px] font-bold text-[#09090B]">{plan.price}</span>
                {plan.period && (
                  <span className="text-[14px] text-[#71717A]">{plan.period}</span>
                )}
              </div>
              <p className="text-[13px] text-[#71717A] mb-5">{plan.subtitle}</p>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      size={14}
                      className="text-[#10B981] shrink-0 mt-0.5"
                    />
                    <span className="text-[13px] text-[#52525B]">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={`flex items-center justify-center h-[40px] rounded-lg text-[14px] font-medium transition-colors ${
                  plan.highlighted
                    ? "bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                    : "border border-[#E4E4E7] text-[#09090B] hover:bg-[#FAFAFA]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-[13px] text-[#71717A] mt-8">
          All plans include a 14-day free trial on Pro features. No credit card required to start.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 9 — FINAL CTA
   ═══════════════════════════════════════════════════════════════════ */
function FinalCTA() {
  return (
    <section className="py-20 md:py-24 bg-[#09090B]">
      <div className="mx-auto max-w-[600px] px-5 md:px-8 text-center">
        {/* Pre-headline */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <ShieldCheck size={20} className="text-[#10B981]" />
          <span className="text-[13px] text-[#71717A]">
            Join engineers who stopped debugging AI blindly
          </span>
        </div>

        <h2 className="text-[28px] md:text-[36px] font-bold text-white leading-[1.15] tracking-tight mb-5">
          Your pipeline deserves a safety layer.
        </h2>
        <p className="text-[15px] text-[#71717A] leading-[1.6] mb-8 max-w-[460px] mx-auto">
          3 lines of Python. Always-on protection. Automatic remediation. You only hear from us
          when something actually needs your attention.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center h-[44px] px-6 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[15px] font-medium rounded-lg transition-colors"
          >
            Start protecting your pipeline
          </Link>
          <Link
            href="/sdk"
            className="inline-flex items-center justify-center h-[44px] px-6 border border-[#27272A] text-white text-[15px] font-medium rounded-lg hover:bg-[#18181B] transition-colors"
          >
            View SDK docs
          </Link>
        </div>

        <p className="text-[12px] text-[#52525B]">
          Free forever plan · No credit card · Cancel anytime
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 10 — FOOTER
   ═══════════════════════════════════════════════════════════════════ */
const productLinks = [
  { label: "Shield Status", href: "/shield" },
  { label: "Incidents", href: "/incidents" },
  { label: "Quarantine", href: "/quarantine" },
  { label: "Live Pipeline", href: "/pipeline" },
  { label: "SDK Setup", href: "/sdk" },
];

const devLinks = [
  { label: "Documentation", href: "/sdk" },
  { label: "SDK Reference", href: "/sdk" },
  { label: "GitHub", href: "https://github.com", external: true },
  { label: "API Reference", href: "/sdk" },
];

const companyLinks = [
  { label: "About", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Contact", href: "mailto:hello@provenanceai.com" },
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
];

function Footer() {
  return (
    <footer className="bg-white border-t border-[#E4E4E7]">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-6 h-6">
                <Image src="/pro_logo.png" alt="ProvenanceAI" fill className="object-contain" />
              </div>
              <span className="font-semibold text-[14px] text-[#09090B] tracking-tight">
                ProvenanceAI
              </span>
            </div>
            <p className="text-[13px] text-[#71717A] leading-[1.5]">
              AI pipeline safety layer — always on
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#71717A] mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              {productLinks.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[13px] text-[#52525B] hover:text-[#09090B] transition-colors"
                  >
                    {l.label}
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
              {devLinks.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[13px] text-[#52525B] hover:text-[#09090B] transition-colors"
                    {...(l.external ? { target: "_blank", rel: "noopener" } : {})}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#71717A] mb-4">
              Company
            </h4>
            <ul className="space-y-2.5">
              {companyLinks.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[13px] text-[#52525B] hover:text-[#09090B] transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-[#E4E4E7] gap-4">
          <p className="text-[12px] text-[#71717A]">
            © 2026 ProvenanceAI. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            {/* X/Twitter */}
            <a href="https://twitter.com" target="_blank" rel="noopener" className="text-[#71717A] hover:text-[#09090B] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {/* GitHub */}
            <a href="https://github.com" target="_blank" rel="noopener" className="text-[#71717A] hover:text-[#09090B] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            {/* LinkedIn */}
            <a href="https://linkedin.com" target="_blank" rel="noopener" className="text-[#71717A] hover:text-[#09090B] transition-colors">
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

/* ═══════════════════════════════════════════════════════════════════
   MAIN LANDING PAGE — EXPORT
   ═══════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <SocialProofBar />
      <HowItWorks />
      <Comparison />
      <Features />
      <SafeModes />
      <FinalCTA />
      <Footer />
    </div>
  );
}
