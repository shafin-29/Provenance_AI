"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ShieldCheck, ShieldAlert, Shield, AlertOctagon,
  Eye, Radio,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import type {
  ShieldStats, ShieldActivityDay, Incident, IncidentStats,
} from "../../../types/api";

/* ─────────── Helpers ─────────── */
function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const severityColors: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#F59E0B",
  low: "#3B82F6",
};

const severityBadge: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  high: { bg: "#FFF7ED", text: "#9A3412", border: "#FED7AA" },
  medium: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  low: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
};

const changeTypeColors: Record<string, string> = {
  FORMATTING: "#71717A",
  ADDITIVE: "#3B82F6",
  MODIFIED: "#F59E0B",
  CONTRADICTORY: "#EF4444",
};

/* ─────────── Skeleton ─────────── */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/* ─────────── Main Page ─────────── */
export default function ShieldStatusPage() {
  const { getToken } = useAuth();
  const [shieldStats, setShieldStats] = useState<ShieldStats | null>(null);
  const [incidentStats, setIncidentStats] = useState<IncidentStats | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[] | null>(null);
  const [activity, setActivity] = useState<ShieldActivityDay[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const [statsRes, incStatsRes, incidentsRes, activityRes] = await Promise.allSettled([
        fetch(`${baseUrl}/api/shield/stats`, { headers }),
        fetch(`${baseUrl}/api/incidents/stats`, { headers }),
        fetch(`${baseUrl}/api/incidents?limit=5`, { headers }),
        fetch(`${baseUrl}/api/shield/activity?days=7`, { headers }),
      ]);

      if (statsRes.status === "fulfilled" && statsRes.value.ok)
        setShieldStats(await statsRes.value.json());
      if (incStatsRes.status === "fulfilled" && incStatsRes.value.ok)
        setIncidentStats(await incStatsRes.value.json());
      if (incidentsRes.status === "fulfilled" && incidentsRes.value.ok)
        setRecentIncidents(await incidentsRes.value.json());
      if (activityRes.status === "fulfilled" && activityRes.value.ok)
        setActivity(await activityRes.value.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeCount = incidentStats?.activeIncidents ?? 0;
  const highestSeverity = incidentStats
    ? incidentStats.criticalCount > 0
      ? "critical"
      : incidentStats.highCount > 0
        ? "high"
        : incidentStats.mediumCount > 0
          ? "medium"
          : "low"
    : "low";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ════════ 1. SHIELD STATUS HERO ════════ */}
      {loading ? (
        <Skeleton className="h-[120px] w-full rounded-xl" />
      ) : activeCount === 0 ? (
        /* ── ALL CLEAR ── */
        <div
          className="rounded-xl p-6 md:p-8 flex items-center justify-between"
          style={{
            background: "linear-gradient(135deg, #F0FDF4, #ffffff)",
            border: "1px solid #BBF7D0",
          }}
        >
          <div className="flex items-start gap-4">
            <ShieldCheck size={32} className="text-[#10B981] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-[20px] font-semibold text-[#14532D] mb-1">
                Pipeline Protected
              </h2>
              <p className="text-[14px] text-[#166534] mb-3 max-w-lg">
                ProvenanceAI has actively monitored your pipeline.
                No incidents in the last 24 hours.
              </p>
              <div className="flex items-center gap-2 text-[13px] text-[#166534] flex-wrap">
                <span>{shieldStats?.chunksInspectedToday ?? 0} chunks inspected today</span>
                <span className="text-[#86EFAC]">·</span>
                <span>
                  {(shieldStats?.chunksQuarantinedToday ?? 0) +
                    (shieldStats?.chunksSubstitutedToday ?? 0)}{" "}
                  stale chunks intercepted
                </span>
                <span className="text-[#86EFAC]">·</span>
                <span>{shieldStats?.responsesProtectedToday ?? 0} responses protected</span>
              </div>
            </div>
          </div>
          <div className="hidden md:block shrink-0 ml-4">
            <ShieldCheck
              size={64}
              className="text-[#10B981]"
              style={{ animation: "shieldPulse 3s ease-in-out infinite" }}
            />
          </div>
        </div>
      ) : (
        /* ── ACTIVE INCIDENTS ── */
        <div
          className="rounded-xl p-6 md:p-8 flex items-center justify-between"
          style={{
            background:
              highestSeverity === "critical" || highestSeverity === "high"
                ? "linear-gradient(135deg, #FFF5F5, #ffffff)"
                : highestSeverity === "medium"
                  ? "linear-gradient(135deg, #FFFBEB, #ffffff)"
                  : "linear-gradient(135deg, #EFF6FF, #ffffff)",
            border: `1px solid ${
              highestSeverity === "critical" || highestSeverity === "high"
                ? "#FECACA"
                : highestSeverity === "medium"
                  ? "#FDE68A"
                  : "#BFDBFE"
            }`,
            borderLeft: `4px solid ${
              highestSeverity === "critical" || highestSeverity === "high"
                ? "#EF4444"
                : highestSeverity === "medium"
                  ? "#F59E0B"
                  : "#3B82F6"
            }`,
          }}
        >
          <div className="flex items-start gap-4">
            <ShieldAlert
              size={32}
              className="shrink-0 mt-0.5"
              style={{
                color:
                  highestSeverity === "critical" || highestSeverity === "high"
                    ? "#EF4444"
                    : highestSeverity === "medium"
                      ? "#F59E0B"
                      : "#3B82F6",
              }}
            />
            <div>
              <h2
                className="text-[20px] font-semibold mb-1"
                style={{
                  color:
                    highestSeverity === "critical" || highestSeverity === "high"
                      ? "#7F1D1D"
                      : highestSeverity === "medium"
                        ? "#78350F"
                        : "#1E3A5F",
                }}
              >
                {highestSeverity === "critical" || highestSeverity === "high"
                  ? "Action Required"
                  : highestSeverity === "medium"
                    ? "Incidents Detected"
                    : "Low Priority Alerts"}
              </h2>
              <p
                className="text-[14px] mb-3"
                style={{
                  color:
                    highestSeverity === "critical" || highestSeverity === "high"
                      ? "#7F1D1D"
                      : highestSeverity === "medium"
                        ? "#78350F"
                        : "#1E3A5F",
                }}
              >
                {highestSeverity === "critical" || highestSeverity === "high"
                  ? `${activeCount} active incident(s) need your attention`
                  : highestSeverity === "medium"
                    ? `${activeCount} pipeline incidents detected — remediation in progress`
                    : `${activeCount} minor changes detected — no action required`}
              </p>
              <Link
                href="/incidents"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-primary hover:text-accent-hover transition-colors"
              >
                View Incidents →
              </Link>
            </div>
          </div>
          <div className="hidden md:block shrink-0 ml-4">
            <AlertOctagon
              size={64}
              style={{
                color:
                  highestSeverity === "critical" || highestSeverity === "high"
                    ? "#EF4444"
                    : highestSeverity === "medium"
                      ? "#F59E0B"
                      : "#3B82F6",
              }}
            />
          </div>
        </div>
      )}

      {/* ════════ 2. STATS ROW ════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))
        ) : (
          <>
            {/* Chunks Inspected */}
            <div className="bg-white border border-[#E4E4E7] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye size={16} className="text-[#3B82F6]" />
                <span className="text-[12px] text-text-muted font-medium uppercase tracking-wide">
                  Chunks Inspected Today
                </span>
              </div>
              <div className="text-[28px] font-bold text-text-primary">
                {shieldStats?.chunksInspectedToday ?? 0}
              </div>
              <div className="text-[12px] text-text-muted">by the Provenance Shield</div>
            </div>

            {/* Auto-Remediated */}
            <div
              className="bg-white rounded-lg p-4"
              style={{
                border: `1px solid ${
                  (shieldStats?.chunksQuarantinedToday ?? 0) +
                    (shieldStats?.chunksSubstitutedToday ?? 0) >
                  0
                    ? "#BBF7D0"
                    : "#E4E4E7"
                }`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={16} className="text-[#10B981]" />
                <span className="text-[12px] text-text-muted font-medium uppercase tracking-wide">
                  Auto-Remediated Today
                </span>
              </div>
              <div
                className="text-[28px] font-bold"
                style={{
                  color:
                    (shieldStats?.chunksQuarantinedToday ?? 0) +
                      (shieldStats?.chunksSubstitutedToday ?? 0) >
                    0
                      ? "#10B981"
                      : undefined,
                }}
              >
                {(shieldStats?.chunksQuarantinedToday ?? 0) +
                  (shieldStats?.chunksSubstitutedToday ?? 0)}
              </div>
              <div className="text-[12px] text-text-muted">stale chunks caught before LLM</div>
            </div>

            {/* Active Incidents */}
            <div
              className="bg-white rounded-lg p-4"
              style={{
                border: `1px solid ${activeCount > 0 ? "#FECACA" : "#E4E4E7"}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertOctagon
                  size={16}
                  className={activeCount > 0 ? "text-[#EF4444]" : "text-[#10B981]"}
                />
                <span className="text-[12px] text-text-muted font-medium uppercase tracking-wide">
                  {activeCount > 0 ? "Active Incidents" : "No Active Incidents"}
                </span>
              </div>
              <div
                className="text-[28px] font-bold"
                style={{ color: activeCount > 0 ? "#EF4444" : "#10B981" }}
              >
                {activeCount}
              </div>
            </div>

            {/* Blast Radius */}
            <div className="bg-white border border-[#E4E4E7] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Radio size={16} className="text-accent-primary" />
                <span className="text-[12px] text-text-muted font-medium uppercase tracking-wide">
                  Past Responses at Risk
                </span>
              </div>
              <div
                className="text-[28px] font-bold"
                style={{
                  color: (incidentStats?.totalBlastRadius ?? 0) > 0 ? "#F59E0B" : undefined,
                }}
              >
                {incidentStats?.totalBlastRadius ?? 0}
              </div>
              <div className="text-[12px] text-text-muted">across all active incidents</div>
            </div>
          </>
        )}
      </div>

      {/* ════════ 3. RECENT INCIDENTS ════════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">
            Recent Incidents
          </h3>
          <Link
            href="/incidents"
            className="text-[13px] font-medium text-accent-primary hover:text-accent-hover transition-colors"
          >
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-lg" />
            ))}
          </div>
        ) : !recentIncidents || recentIncidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldCheck size={40} className="text-[#10B981] mb-3" />
            <h4 className="text-[14px] font-medium text-text-primary mb-1">No incidents yet</h4>
            <p className="text-[13px] text-text-muted max-w-sm">
              ProvenanceAI is monitoring your pipeline. You&apos;ll be notified automatically if
              anything needs attention.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentIncidents.map((inc) => (
              <Link
                key={inc.id}
                href={`/incidents/${inc.id}`}
                className="block bg-white border border-[#E4E4E7] rounded-lg p-4 hover:border-accent-primary/40 transition-colors"
                style={{
                  borderLeft: `4px solid ${severityColors[inc.severity] || "#E4E4E7"}`,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-mono font-medium text-text-primary">
                    {inc.sourceId ?? "Unknown source"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] uppercase font-semibold px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: severityBadge[inc.severity]?.bg,
                        color: severityBadge[inc.severity]?.text,
                        border: `1px solid ${severityBadge[inc.severity]?.border}`,
                      }}
                    >
                      {inc.severity}
                    </span>
                    <span
                      className={`text-[11px] uppercase font-semibold px-2 py-0.5 rounded ${
                        inc.status === "active"
                          ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]"
                          : "bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]"
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-text-muted">
                  {inc.changeType && (
                    <span
                      className="uppercase text-[11px] px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${changeTypeColors[inc.changeType] || "#71717A"}15`,
                        color: changeTypeColors[inc.changeType] || "#71717A",
                      }}
                    >
                      {inc.changeType}
                    </span>
                  )}
                  {inc.blastRadius > 0 && (
                    <span>{inc.blastRadius} responses at risk</span>
                  )}
                  <span>·</span>
                  <span>{relativeTime(inc.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ════════ 4. SHIELD ACTIVITY CHART ════════ */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted mb-4">
          Shield Activity — Last 7 Days
        </h3>

        {loading ? (
          <Skeleton className="h-[200px] w-full rounded-lg" />
        ) : !activity || activity.every((d) => d.clean === 0 && d.intercepted === 0) ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[13px] text-text-muted max-w-sm">
              No shield activity yet — instrument your pipeline with the SDK to start seeing data.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={activity} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#71717A" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#71717A" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #E4E4E7",
                  borderRadius: 8,
                  fontSize: 13,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: "#71717A" }}
              />
              <Bar dataKey="clean" name="Clean" fill="#10B981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="intercepted" name="Intercepted" fill="#EF4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Shield pulse animation */}
      <style jsx global>{`
        @keyframes shieldPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
