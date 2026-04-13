"use client";

import { useState, useEffect, useCallback } from "react";

/* ─── Color tokens ─── */
const C = {
  gray: "#6B7280",
  cyan: "#22D3EE",
  amber: "#F59E0B",
  red: "#EF4444",
  green: "#10B981",
  white: "#E4E4E7",
  muted: "#71717A",
  violet: "#7C3AED",
};

/* ─── Terminal Line ─── */
function TermLine({ color, children }: { color: string; children: string }) {
  return (
    <div className="leading-[1.8]" style={{ color }}>
      {children}
    </div>
  );
}

/* ─── Incident Row ─── */
function IncidentRow({
  label,
  children,
  visible,
}: {
  label: string;
  children: React.ReactNode;
  visible: boolean;
}) {
  return (
    <div
      className="transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        maxHeight: visible ? 120 : 0,
        overflow: "hidden",
      }}
    >
      <div className="flex items-start gap-3 py-2 border-b border-[#F4F4F5] last:border-0">
        <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide w-[100px] shrink-0 pt-0.5">
          {label}
        </span>
        <div className="text-[13px]">{children}</div>
      </div>
    </div>
  );
}

/* ─── Semantic Diff Bar ─── */
function DiffBar({ value, visible }: { value: number; visible: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[100px] h-[6px] bg-[#F4F4F5] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#EF4444] rounded-full"
          style={{
            width: visible ? `${value * 100}%` : "0%",
            transition: "width 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
      <span
        className="text-[12px] font-mono text-[#EF4444] transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {value.toFixed(2)}
      </span>
      <span
        className="text-[11px] text-[#EF4444] transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        Meaning changed significantly
      </span>
    </div>
  );
}

/* ─── Slack Notification ─── */
function SlackNotification({ visible }: { visible: boolean }) {
  return (
    <div
      className="absolute top-4 right-[-12px] md:right-[-20px] z-10 w-[220px]"
      style={{
        transform: visible ? "translateX(0)" : "translateX(30px)",
        opacity: visible ? 1 : 0,
        transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="bg-white border border-[#E4E4E7] rounded-lg p-3 shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-4 h-4 bg-[#7C3AED] rounded text-white text-[9px] flex items-center justify-center font-bold">
            S
          </div>
          <span className="text-[11px] font-semibold text-[#09090B]">ProvenanceAI</span>
        </div>
        <p className="text-[11px] text-[#09090B] font-medium mb-0.5">
          🚨 CRITICAL: policy_v7.pdf
        </p>
        <p className="text-[11px] text-[#52525B]">14 embeddings quarantined automatically</p>
        <p className="text-[11px] text-[#52525B] mb-2">847 past responses at risk</p>
        <span className="text-[11px] text-[#7C3AED] font-medium cursor-pointer">
          View Incident →
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MAIN DEMO COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function ShieldDemo() {
  const [phase, setPhase] = useState(0);
  const [fading, setFading] = useState(false);
  const [cycle, setCycle] = useState(0);

  const resetAndLoop = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setPhase(0);
      setFading(false);
      setCycle((c) => c + 1);
    }, 600);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 2400);
    const t4 = setTimeout(() => setPhase(4), 3600);
    const t5 = setTimeout(() => setPhase(5), 4200);
    const t6 = setTimeout(() => setPhase(6), 4800);
    const tReset = setTimeout(resetAndLoop, 8000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      clearTimeout(tReset);
    };
  }, [cycle, resetAndLoop]);

  return (
    <div
      className="relative mx-auto max-w-[720px] overflow-visible"
      style={{
        opacity: fading ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      {/* Container */}
      <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between h-9 px-4 bg-[#F4F4F5] border-b border-[#E4E4E7]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <div className="w-2 h-2 rounded-full bg-[#10B981]" />
          </div>
          <span className="text-[12px] font-mono text-[#71717A]">
            provenance_ai — shield demo
          </span>
          <div className="flex items-center gap-1.5">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
            </div>
            <span className="text-[12px] text-[#10B981] font-medium">Shield Active</span>
          </div>
        </div>

        {/* Two panels */}
        <div className="flex flex-col md:flex-row min-h-[320px]">
          {/* ── LEFT PANEL: Terminal ── */}
          <div className="w-full md:w-[40%] bg-[#1E1E2E] p-4 md:p-5 font-mono text-[12px] leading-[1.8] overflow-hidden border-b md:border-b-0 md:border-r border-[#2A2A3C]">
            {/* Line 1 - always visible */}
            <TermLine color={C.gray}>&gt; Running RAG query...</TermLine>
            <TermLine color={C.gray}>&gt; query: &quot;What is the coverage limit?&quot;</TermLine>

            {/* Line 2 */}
            <div
              style={{
                opacity: phase >= 1 ? 1 : 0,
                transform: phase >= 1 ? "translateY(0)" : "translateY(4px)",
                transition: "all 0.4s ease",
                marginTop: 8,
              }}
            >
              <TermLine color={C.cyan}>&gt; Retrieving top 4 chunks...</TermLine>
            </div>

            {/* Line 3 - chunks */}
            <div
              style={{
                opacity: phase >= 2 ? 1 : 0,
                transform: phase >= 2 ? "translateY(0)" : "translateY(4px)",
                transition: "all 0.4s ease",
                marginTop: 8,
              }}
            >
              <TermLine color={C.gray}>chunk_1: policy_v9.pdf [✓ clean]</TermLine>
              <TermLine color={C.gray}>chunk_2: rates_2024.pdf [✓ clean]</TermLine>
              <TermLine color={phase >= 3 ? C.red : C.amber}>
                {phase >= 3
                  ? "chunk_3: policy_v7.pdf [✗ STALE]"
                  : "chunk_3: policy_v7.pdf [⚠ checking...]"}
              </TermLine>
              <TermLine color={C.gray}>chunk_4: coverage_addendum.txt [✓ clean]</TermLine>
            </div>

            {/* Line 4 - shield detects */}
            <div
              style={{
                opacity: phase >= 3 ? 1 : 0,
                transform: phase >= 3 ? "translateY(0)" : "translateY(4px)",
                transition: "all 0.4s ease",
                marginTop: 8,
              }}
            >
              <TermLine color={C.red}>SHIELD: chunk_3 is STALE</TermLine>
              <TermLine color={C.red}>source: policy_v7.pdf (42 days stale)</TermLine>
              <TermLine color={C.red}>action: QUARANTINING...</TermLine>
            </div>

            {/* Line 5 - quarantined */}
            <div
              style={{
                opacity: phase >= 4 ? 1 : 0,
                transform: phase >= 4 ? "translateY(0)" : "translateY(4px)",
                transition: "all 0.4s ease",
                marginTop: 8,
              }}
            >
              <TermLine color={C.green}>SHIELD: chunk_3 quarantined ✓</TermLine>
              <TermLine color={C.green}>clean chunks forwarded to LLM: 3/4</TermLine>
              <TermLine color={C.green}>response protected ✓</TermLine>
            </div>
          </div>

          {/* ── RIGHT PANEL: Shield Report ── */}
          <div className="w-full md:w-[60%] bg-white p-4 md:p-5 relative overflow-visible">
            {/* Title */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[13px] font-semibold text-[#09090B]">
                Incident Auto-Generated
              </span>
              <div className="w-4 h-4 flex items-center justify-center">
                {phase >= 4 ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="7" fill="#10B981" />
                    <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : phase >= 2 ? (
                  <div
                    className="w-3.5 h-3.5 border-2 border-[#7C3AED] border-t-transparent rounded-full"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full bg-[#E4E4E7]" />
                )}
              </div>
            </div>

            {/* Incident rows */}
            <IncidentRow label="SOURCE" visible={phase >= 2}>
              <span className="font-mono text-[#09090B]">policy_v7.pdf</span>
            </IncidentRow>

            <IncidentRow label="PIPELINE" visible={phase >= 2}>
              <span className="font-mono text-[#71717A]">insurance-rag-v1</span>
            </IncidentRow>

            <IncidentRow label="CHANGE TYPE" visible={phase >= 3}>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                CONTRADICTORY
              </span>
            </IncidentRow>

            <IncidentRow label="SEMANTIC DIFF" visible={phase >= 3}>
              <DiffBar value={0.38} visible={phase >= 3} />
            </IncidentRow>

            <IncidentRow label="AUTO-ACTION" visible={phase >= 4}>
              <div className="text-[#10B981]">
                <div>✓ Quarantined 14 embeddings</div>
                <div>✓ Alert sent via Slack</div>
              </div>
            </IncidentRow>

            <IncidentRow label="BLAST RADIUS" visible={phase >= 5}>
              <div>
                <span className="text-[24px] font-bold text-[#EF4444]">847</span>
                <div className="text-[12px] text-[#71717A]">past responses used stale data</div>
              </div>
            </IncidentRow>

            {/* Slack notification */}
            <SlackNotification visible={phase >= 6} />
          </div>
        </div>
      </div>

      {/* Keyframes */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
