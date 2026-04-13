"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ShieldAlert, Lock, Bell, CheckCircle, Clock,
  GitCompare, RotateCw, ArrowLeft, Copy,
} from "lucide-react";
import type { IncidentDetail } from "../../../../types/api";

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

function diffLabel(score: number) {
  if (score > 0.95) return "Nearly identical";
  if (score > 0.7) return "Minor changes";
  if (score > 0.4) return "Significant changes";
  return "Major divergence";
}

function timelineIcon(eventType: string) {
  switch (eventType) {
    case "incident.created":
      return { icon: Clock, color: "#F97316" };
    case "shield.chunk.stale":
      return { icon: Clock, color: "#F97316" };
    case "shield.chunk.quarantined":
      return { icon: Lock, color: "#EF4444" };
    case "shield.chunk.substituted":
      return { icon: RotateCw, color: "#7C3AED" };
    case "shield.response.blocked":
      return { icon: ShieldAlert, color: "#EF4444" };
    case "shield.response.protected":
      return { icon: CheckCircle, color: "#10B981" };
    case "incident.resolved":
      return { icon: CheckCircle, color: "#10B981" };
    default:
      if (eventType.includes("alert")) return { icon: Bell, color: "#7C3AED" };
      if (eventType.includes("diff") || eventType.includes("semantic"))
        return { icon: GitCompare, color: "#3B82F6" };
      return { icon: Clock, color: "#71717A" };
  }
}

function timelineLabel(eventType: string, payload: Record<string, unknown>, sourceId: string | null) {
  switch (eventType) {
    case "incident.created":
      return `Incident created — ${payload.changeType || "change"} detected in ${sourceId || "source"}`;
    case "shield.chunk.stale":
      return `Stale chunk detected in ${sourceId || "unknown"}`;
    case "shield.chunk.quarantined":
      return `Chunk quarantined: ${sourceId || "unknown"}`;
    case "shield.chunk.substituted":
      return `Stale chunk substituted: ${sourceId || "unknown"}`;
    case "shield.response.protected":
      return "Response protected — all chunks clean";
    case "shield.response.blocked":
      return "Response BLOCKED — stale threshold exceeded";
    case "incident.resolved":
      return `Resolved by ${(payload.resolvedBy as string) || "system"}`;
    default:
      return eventType.replace(/\./g, " ");
  }
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/* ─── Main Page ─── */
export default function IncidentDetailPage() {
  const params = useParams();
  const incidentId = params.id as string;
  const { getToken } = useAuth();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/incidents/${incidentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setIncident(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [getToken, incidentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const doAction = async (action: "resolve" | "acknowledge") => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const token = await getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    await fetch(`${baseUrl}/api/incidents/${incidentId}/${action}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ resolvedBy: "manual" }),
    });
    fetchData();
  };

  const doReingest = async () => {
    if (!incident?.sourceRecordId) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const token = await getToken();
    await fetch(`${baseUrl}/api/sources/${incident.sourceRecordId}/reingest`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    fetchData();
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(`sdk.ingest('${incident?.sourceRecord?.sourceId}')`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-[300px] rounded-lg" />
            <Skeleton className="h-[120px] rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert size={40} className="text-text-muted mb-3" />
        <h4 className="text-[14px] font-medium text-text-primary mb-1">Incident not found</h4>
        <Link href="/incidents" className="text-[13px] text-accent-primary hover:text-accent-hover">
          ← Back to Incidents
        </Link>
      </div>
    );
  }

  const sev = severityBadge[incident.severity] || severityBadge.medium;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back nav */}
      <Link href="/incidents" className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft size={14} /> Incidents
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ═══ LEFT: Timeline ═══ */}
        <div className="lg:col-span-3 space-y-6">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">
            Incident Timeline
          </h3>

          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-[#E4E4E7]" />

            {incident.timeline.map((event, i) => {
              const { icon: Icon, color } = timelineIcon(event.eventType);
              return (
                <div key={event.id} className="relative pb-6 last:pb-0">
                  {/* Circle */}
                  <div
                    className="absolute left-[-18px] top-1 w-3 h-3 rounded-full border-2 border-white"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Icon size={14} style={{ color }} />
                        <span className="text-[13px] font-medium text-text-primary">
                          {timelineLabel(event.eventType, event.payload, event.sourceId)}
                        </span>
                      </div>
                      {event.payload && Object.keys(event.payload).length > 0 ? (
                        <div className="text-[12px] text-text-muted mt-0.5">
                          {event.eventType === "incident.created" && "severity" in event.payload ? (
                            <span>Severity: {String(event.payload.severity)} · Action: {String(event.payload.action)}</span>
                          ) : null}
                          {event.eventType === "incident.resolved" && "notes" in event.payload ? (
                            <span>Notes: {String(event.payload.notes)}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-text-muted whitespace-nowrap shrink-0">
                      {relativeTime(event.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Shield Events table */}
          {incident.timeline.filter((e) => e.eventType.startsWith("shield.")).length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted mb-3">
                Shield Events Linked to This Incident
              </h4>
              <div className="overflow-x-auto border border-[#E4E4E7] rounded-lg">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                      <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted">Event Type</th>
                      <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted">Source</th>
                      <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incident.timeline
                      .filter((e) => e.eventType.startsWith("shield."))
                      .slice(0, 10)
                      .map((e) => (
                        <tr key={e.id} className="border-b border-[#F4F4F5] last:border-0">
                          <td className="py-2 px-3 text-[12px] font-mono text-text-secondary">{e.eventType}</td>
                          <td className="py-2 px-3 text-[12px] font-mono text-text-muted">{e.sourceId || "—"}</td>
                          <td className="py-2 px-3 text-[12px] text-text-muted">{relativeTime(e.createdAt)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Summary + Actions ═══ */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary Card */}
          <div className="bg-white border border-[#E4E4E7] rounded-lg p-5">
            <h3 className="text-[13px] font-semibold text-text-primary mb-4">Incident Summary</h3>
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-text-muted">Status</dt>
                <dd>
                  <span className={`text-[11px] uppercase font-semibold px-2 py-0.5 rounded ${
                    incident.status === "active"
                      ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]"
                      : incident.status === "resolved"
                        ? "bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]"
                        : "bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]"
                  }`}>
                    {incident.status}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Severity</dt>
                <dd>
                  <span
                    className="text-[11px] uppercase font-semibold px-2 py-0.5 rounded"
                    style={{ backgroundColor: sev.bg, color: sev.text, border: `1px solid ${sev.border}` }}
                  >
                    {incident.severity}
                  </span>
                </dd>
              </div>
              {incident.sourceRecord && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Source File</dt>
                    <dd className="font-mono text-text-primary">{incident.sourceRecord.sourceId}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Pipeline</dt>
                    <dd className="font-mono text-text-muted text-[12px]">{incident.sourceRecord.pipelineId}</dd>
                  </div>
                </>
              )}
              {incident.changeType && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Change Type</dt>
                  <dd>
                    <span
                      className="text-[11px] uppercase px-2 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: changeTypeChip[incident.changeType]?.bg,
                        color: changeTypeChip[incident.changeType]?.text,
                      }}
                    >
                      {incident.changeType}
                    </span>
                  </dd>
                </div>
              )}
              {incident.semanticDiffScore !== null && (
                <div className="flex justify-between items-center">
                  <dt className="text-text-muted">Semantic Diff</dt>
                  <dd className="flex items-center gap-2">
                    <div className="w-[50px] h-[6px] bg-[#F4F4F5] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(incident.semanticDiffScore ?? 0) * 100}%`,
                          backgroundColor: diffBarColor(incident.semanticDiffScore ?? 0),
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-mono">{(incident.semanticDiffScore ?? 0).toFixed(2)}</span>
                    <span className="text-[10px] text-text-muted">{diffLabel(incident.semanticDiffScore ?? 0)}</span>
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-text-muted">Embeddings Affected</dt>
                <dd className="text-text-primary font-medium">{incident.embeddingsAffected}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Blast Radius</dt>
                <dd className={`font-medium ${incident.blastRadius > 0 ? "text-[#EF4444]" : "text-text-muted"}`}>
                  {incident.blastRadius}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Alert Sent</dt>
                <dd className="text-text-secondary">
                  {incident.alertSent ? `Yes — ${incident.alertSentAt ? relativeTime(incident.alertSentAt) : ""}` : "No"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Created</dt>
                <dd className="text-text-secondary">{new Date(incident.createdAt).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Resolved</dt>
                <dd className="text-text-secondary">
                  {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Actions Card */}
          <div className="bg-white border border-[#E4E4E7] rounded-lg p-5">
            <h3 className="text-[13px] font-semibold text-text-primary mb-4">Actions</h3>

            {incident.status === "active" && (
              <div className="space-y-3">
                <button
                  onClick={() => doAction("acknowledge")}
                  className="w-full h-[36px] bg-white border border-[#E4E4E7] rounded-lg text-[13px] font-medium text-text-secondary hover:bg-surface-raised transition-colors"
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => doAction("resolve")}
                  className="w-full h-[36px] bg-white border border-[#E4E4E7] rounded-lg text-[13px] font-medium text-text-secondary hover:bg-surface-raised transition-colors"
                >
                  Resolve
                </button>
                <div>
                  <button
                    onClick={doReingest}
                    className="w-full h-[36px] bg-accent-primary hover:bg-accent-hover text-white rounded-lg text-[13px] font-medium transition-colors"
                  >
                    Re-ingest Source
                  </button>
                  {incident.sourceRecord && (
                    <div className="mt-2 bg-[#1E1E2E] rounded-lg p-3 flex items-center justify-between">
                      <code className="text-[12px] font-mono text-[#A6E3A1]">
                        sdk.ingest(&apos;{incident.sourceRecord.sourceId}&apos;)
                      </code>
                      <button onClick={copyCommand} className="text-[#6C7086] hover:text-white transition-colors ml-2">
                        <Copy size={14} />
                      </button>
                    </div>
                  )}
                  {copied && (
                    <p className="text-[11px] text-[#10B981] mt-1">Copied!</p>
                  )}
                </div>
              </div>
            )}

            {incident.status === "resolved" && (
              <div className="space-y-3">
                <p className="text-[13px] text-text-muted">
                  Resolved {incident.resolvedAt ? relativeTime(incident.resolvedAt) : ""} by {incident.resolvedBy || "system"}
                </p>
                <button
                  onClick={() => {/* re-open would require backend route */}}
                  className="w-full h-[36px] border border-[#FECACA] text-[#EF4444] rounded-lg text-[13px] font-medium hover:bg-[#FEF2F2] transition-colors"
                >
                  Re-open
                </button>
              </div>
            )}

            {incident.status === "acknowledged" && (
              <div className="space-y-3">
                <p className="text-[13px] text-text-muted">Acknowledged — investigation in progress</p>
                <button
                  onClick={() => doAction("resolve")}
                  className="w-full h-[36px] bg-accent-primary hover:bg-accent-hover text-white rounded-lg text-[13px] font-medium transition-colors"
                >
                  Mark as Resolved
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
