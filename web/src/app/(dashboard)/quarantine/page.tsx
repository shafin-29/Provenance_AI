"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  Lock, ShieldCheck, RotateCw, Trash2, Plus,
} from "lucide-react";
import type { QuarantineEntry } from "../../../types/api";

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function QuarantinePage() {
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<QuarantineEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSourceId, setNewSourceId] = useState("");
  const [newReason, setNewReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
  const [fadingOut, setFadingOut] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/quarantine`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setEntries(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const reingestAndRelease = async (sourceId: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const token = await getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    // Find the source record ID first — need to release quarantine
    await fetch(`${baseUrl}/api/quarantine/${sourceId}`, {
      method: "DELETE",
      headers,
    });

    setFadingOut(sourceId);
    setTimeout(() => {
      setFadingOut(null);
      fetchData();
    }, 500);
    showToast("Released from quarantine — source marked for re-ingestion");
  };

  const releaseOnly = async (sourceId: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const token = await getToken();
    await fetch(`${baseUrl}/api/quarantine/${sourceId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setConfirmRelease(null);
    setFadingOut(sourceId);
    setTimeout(() => {
      setFadingOut(null);
      fetchData();
    }, 500);
    showToast("Released from quarantine");
  };

  const releaseAll = async () => {
    if (!entries) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const token = await getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    await Promise.allSettled(
      entries.map((e) =>
        fetch(`${baseUrl}/api/quarantine/${e.sourceId}`, { method: "DELETE", headers })
      )
    );
    fetchData();
    showToast("All quarantined sources released");
  };

  const addQuarantine = async () => {
    if (!newSourceId.trim()) return;
    setSubmitting(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/quarantine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sourceId: newSourceId.trim(),
          reason: newReason.trim() || "Manual quarantine",
        }),
      });
      if (res.ok) {
        setNewSourceId("");
        setNewReason("");
        fetchData();
        showToast("Source quarantined successfully");
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to quarantine source");
      }
    } catch {
      showToast("Failed to quarantine source");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#1E1E2E] text-white text-[13px] px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Quarantine</h1>
          <p className="text-[14px] text-text-muted mt-1">Source records blocked from being retrieved</p>
        </div>
        {entries && entries.length > 0 && (
          <button
            onClick={releaseAll}
            className="h-[34px] px-4 text-[13px] font-medium border border-[#FECACA] text-[#EF4444] rounded-lg bg-white hover:bg-[#FEF2F2] transition-colors"
          >
            Release All
          </button>
        )}
      </div>

      {/* Explanation Banner */}
      <div
        className="rounded-lg p-4 flex items-start gap-3"
        style={{ backgroundColor: "#FFF5F5", border: "1px solid #FECACA" }}
      >
        <Lock size={16} className="text-[#7F1D1D] shrink-0 mt-0.5" />
        <p className="text-[13px] text-[#7F1D1D] leading-relaxed">
          Quarantined sources are blocked at the Shield layer. They cannot be retrieved by your RAG
          pipeline until released or re-ingested. Release only after re-ingesting fresh content.
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[56px] rounded-lg" />
          ))}
        </div>
      ) : !entries || entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldCheck size={40} className="text-[#10B981] mb-3" />
          <h4 className="text-[14px] font-medium text-text-primary mb-1">Nothing in quarantine</h4>
          <p className="text-[13px] text-text-muted max-w-sm">
            Quarantined sources appear here automatically when the Remediation Engine detects
            critical changes, or when you manually quarantine a source below.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#E4E4E7]">
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Source File</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Reason</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">By</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Quarantined At</th>
                <th className="py-2 px-3 text-[11px] font-semibold uppercase text-text-muted tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.sourceId}
                  className={`border-b border-[#F4F4F5] transition-all duration-500 ${
                    fadingOut === entry.sourceId ? "opacity-0 h-0" : "opacity-100"
                  }`}
                >
                  <td className="py-3 px-3">
                    <span className="text-[13px] font-mono font-medium text-text-primary">
                      {entry.sourceId}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[13px] text-text-secondary">{entry.reason}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[11px] uppercase font-semibold px-2 py-0.5 rounded ${
                        entry.quarantinedBy === "automatic" || entry.quarantinedBy === "remediation_engine"
                          ? "bg-accent-bg text-accent-primary"
                          : "bg-surface-raised text-text-muted"
                      }`}
                    >
                      {entry.quarantinedBy === "remediation_engine" ? "automatic" : entry.quarantinedBy}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-[12px] text-text-secondary">{relativeTime(entry.quarantinedAt)}</div>
                    <div className="text-[11px] text-text-muted">
                      {new Date(entry.quarantinedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => reingestAndRelease(entry.sourceId)}
                        className="h-[30px] px-3 text-[12px] font-medium bg-accent-primary hover:bg-accent-hover text-white rounded-lg transition-colors flex items-center gap-1"
                      >
                        <RotateCw size={12} /> Re-ingest & Release
                      </button>
                      {confirmRelease === entry.sourceId ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-[#EF4444]">Stale data may reach LLM.</span>
                          <button
                            onClick={() => releaseOnly(entry.sourceId)}
                            className="text-[11px] font-medium text-[#EF4444] underline"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmRelease(null)}
                            className="text-[11px] text-text-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRelease(entry.sourceId)}
                          className="h-[30px] px-3 text-[12px] font-medium border border-[#FECACA] text-[#EF4444] rounded-lg hover:bg-[#FEF2F2] transition-colors"
                        >
                          Release Only
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Quarantine Section */}
      <div className="border-t border-[#E4E4E7] pt-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted mb-1">
          Manually Quarantine a Source
        </h3>
        <p className="text-[13px] text-text-muted mb-4">
          Instantly block a source from being retrieved. Use for emergency situations.
        </p>

        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-[12px] text-text-muted block mb-1">Source ID (filename)</label>
            <input
              type="text"
              value={newSourceId}
              onChange={(e) => setNewSourceId(e.target.value)}
              placeholder="e.g. policy_document.pdf"
              className="h-[36px] px-3 border border-[#E4E4E7] rounded-lg text-[13px] bg-white w-[240px] focus:outline-none focus:border-accent-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-[12px] text-text-muted block mb-1">Reason (optional)</label>
            <input
              type="text"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Manual: flagged by engineer"
              className="h-[36px] px-3 border border-[#E4E4E7] rounded-lg text-[13px] bg-white w-[240px] focus:outline-none focus:border-accent-primary transition-colors"
            />
          </div>
          <button
            onClick={addQuarantine}
            disabled={submitting || !newSourceId.trim()}
            className="h-[36px] px-4 bg-accent-primary hover:bg-accent-hover text-white text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <Plus size={14} /> Quarantine
          </button>
        </div>
      </div>
    </div>
  );
}
