"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  AlertOctagon, Eye, CheckCircle, AlertCircle, Clock, Zap,
} from "lucide-react";
import type { Incident, IncidentStats } from "../../../types/api";

/* ─── Helpers ─── */
function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const severityBadge: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  high: { bg: "#FFF7ED", text: "#9A3412", border: "#FED7AA" },
  medium: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  low: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
};

const severityLeftBorder: Record<string, string> = {
  critical: "#EF4444", high: "#F97316", medium: "#F59E0B", low: "#3B82F6",
};

const changeTypeChip: Record<string, { bg: string; text: string }> = {
  FORMATTING: { bg: "#71717A15", text: "#71717A" },
  ADDITIVE: { bg: "#3B82F615", text: "#3B82F6" },
  MODIFIED: { bg: "#F59E0B15", text: "#F59E0B" },
  CONTRADICTORY: { bg: "#EF444415", text: "#EF4444" },
};

function diffBarColor(score: number) {
  if (score > 0.95) return "#10B981";
  if (score > 0.7) return "#3B82F6";
  if (score > 0.4) return "#F59E0B";
  return "#EF4444";
}

function actionLabel(action: string | null, embeddingsAffected: number) {
  switch (action) {
    case "QUARANTINE_AND_REINGEST":
      return `Quarantined ${embeddingsAffected} embeddings`;
    case "EMERGENCY_QUARANTINE":
      return `Emergency quarantine + alert`;
    case "MONITOR":
      return "Monitoring — no action";
    case "LOW_PRIORITY_ALERT":
      return "Low priority alert sent";
    default:
      return action || "—";
  }
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/* ─── Main Page ─── */
export default function IncidentsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"createdAt" | "severity" | "blastRadius">("createdAt");

  const fetchData = useCallback(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      params.set("limit", "200");

      const [incRes, statsRes] = await Promise.allSettled([
        fetch(`${baseUrl}/api/incidents?${params}`, { headers }),
        fetch(`${baseUrl}/api/incidents/stats`, { headers }),
      ]);

      if (incRes.status === "fulfilled" && incRes.value.ok)
        setIncidents(await incRes.value.json());
      if (statsRes.status === "fulfilled" && statsRes.value.ok)
        setStats(await statsRes.value.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [getToken, statusFilter, severityFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const resolveAllLow = async () => {
    if (!incidents) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const token = await getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const lowActive = incidents.filter((i) => i.severity === "low" && i.status === "active");
    await Promise.allSettled(
      lowActive.map((i) =>
        fetch(`${baseUrl}/api/incidents/${i.id}/resolve`, {
          method: "POST",
          headers,
          body: JSON.stringify({ resolvedBy: "manual", notes: "Bulk resolved all low" }),
        })
      )
    );
    fetchData();
  };

  const resolveOne = async (id: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const token = await getToken();
    await fetch(`${baseUrl}/api/incidents/${id}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ resolvedBy: "manual" }),
    });
    fetchData();
  };

  const acknowledgeOne = async (id: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const token = await getToken();
    await fetch(`${baseUrl}/api/incidents/${id}/acknowledge`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    fetchData();
  };

  // Sort
  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = incidents
    ? [...incidents].sort((a, b) => {
        if (sortBy === "severity") return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
        if (sortBy === "blastRadius") return b.blastRadius - a.blastRadius;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : [];

  const statusTabs = ["all", "active", "resolved", "acknowledged"];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Incidents</h1>
          <p className="text-[14px] text-text-muted mt-1">Automatic pipeline protection events</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resolveAllLow}
            className="h-[34px] px-4 text-[13px] font-medium border border-[#E4E4E7] rounded-lg bg-white text-text-secondary hover:bg-surface-raised transition-colors"
          >
            Resolve All Low
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[80px] rounded-lg" />
          ))
        ) : (
          <>
            <div className="bg-white border border-[#E4E4E7] rounded-lg p-4">
              <div className="text-[12px] text-text-muted font-medium uppercase mb-1">Active</div>
              <div className="text-[24px] font-bold" style={{ color: (stats?.activeIncidents ?? 0) > 0 ? "#EF4444" : "#10B981" }}>
                {stats?.activeIncidents ?? 0}
              </div>
            </div>
            <div className="bg-white border border-[#E4E4E7] rounded-lg p-4">
              <div className="text-[12px] text-text-muted font-medium uppercase mb-1">Critical</div>
              <div className="text-[24px] font-bold" style={{ color: (stats?.criticalCount ?? 0) > 0 ? "#EF4444" : undefined }}>
                {stats?.criticalCount ?? 0}
              </div>
            </div>
            <div className="bg-white border border-[#E4E4E7] rounded-lg p-4">
              <div className="text-[12px] text-text-muted font-medium uppercase mb-1">Avg Resolution</div>
              <div className="text-[24px] font-bold text-text-primary">
                {stats?.avgResolutionHours ? `${stats.avgResolutionHours}h` : "—"}
              </div>
            </div>
            <div className="bg-white border border-[#E4E4E7] rounded-lg p-4">
              <div className="text-[12px] text-text-muted font-medium uppercase mb-1">Total Blast Radius</div>
              <div className="text-[24px] font-bold" style={{ color: (stats?.totalBlastRadius ?? 0) > 0 ? "#F59E0B" : undefined }}>
                {stats?.totalBlastRadius ?? 0}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-surface-raised rounded-lg p-1">
          {statusTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors capitalize ${
                statusFilter === tab
                  ? "bg-white text-accent-primary shadow-sm border-b-2 border-accent-primary"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-muted">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-[13px] border border-[#E4E4E7] rounded-lg px-3 py-1.5 bg-white text-text-primary"
          >
            <option value="createdAt">Newest</option>
            <option value="severity">Severity</option>
            <option value="blastRadius">Blast Radius</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-[13px] border border-[#E4E4E7] rounded-lg px-3 py-1.5 bg-white text-text-primary"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[56px] rounded-lg" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertOctagon size={40} className="text-text-muted mb-3" />
          <h4 className="text-[14px] font-medium text-text-primary mb-1">No incidents found</h4>
          <p className="text-[13px] text-text-muted">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#E4E4E7]">
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Severity</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Source</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Change</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Diff</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Blast</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Auto-Action</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Status</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Time</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => router.push(`/incidents/${inc.id}`)}
                  className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                  style={{ borderLeft: `4px solid ${severityLeftBorder[inc.severity] || "#E4E4E7"}` }}
                >
                  <td className="py-3 px-3">
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
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[13px] font-mono font-medium text-text-primary">
                      {inc.sourceId ?? "—"}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {inc.changeType && (
                      <span
                        className="text-[11px] uppercase px-2 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: changeTypeChip[inc.changeType]?.bg || "#71717A15",
                          color: changeTypeChip[inc.changeType]?.text || "#71717A",
                        }}
                      >
                        {inc.changeType}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {inc.semanticDiffScore !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-[60px] h-[6px] bg-[#F4F4F5] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(inc.semanticDiffScore ?? 0) * 100}%`,
                              backgroundColor: diffBarColor(inc.semanticDiffScore ?? 0),
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-text-muted">
                          {(inc.semanticDiffScore ?? 0).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-[13px] font-medium ${inc.blastRadius > 0 ? "text-[#EF4444]" : "text-text-muted"}`}>
                      {inc.blastRadius}
                    </span>
                    {inc.blastRadius > 0 && (
                      <div className="text-[11px] text-text-muted">at risk</div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[12px] text-text-secondary">
                      {actionLabel(inc.action, inc.embeddingsAffected)}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[11px] uppercase font-semibold px-2 py-0.5 rounded ${
                        inc.status === "active"
                          ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]"
                          : inc.status === "resolved"
                            ? "bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]"
                            : "bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]"
                      }`}
                    >
                      {inc.status}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-[12px] text-text-secondary">{relativeTime(inc.createdAt)}</div>
                    <div className="text-[11px] text-text-muted">
                      {new Date(inc.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/incidents/${inc.id}`}
                        className="p-1.5 rounded hover:bg-surface-raised transition-colors text-text-muted hover:text-text-primary"
                        title="View"
                      >
                        <Eye size={14} />
                      </Link>
                      {inc.status === "active" && (
                        <>
                          <button
                            onClick={() => resolveOne(inc.id)}
                            className="p-1.5 rounded hover:bg-[#F0FDF4] transition-colors text-text-muted hover:text-[#10B981]"
                            title="Resolve"
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button
                            onClick={() => acknowledgeOne(inc.id)}
                            className="p-1.5 rounded hover:bg-[#FFFBEB] transition-colors text-text-muted hover:text-[#F59E0B]"
                            title="Acknowledge"
                          >
                            <AlertCircle size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
