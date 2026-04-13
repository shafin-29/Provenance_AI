"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  CheckCircle, AlertTriangle, Lock, RefreshCw,
  ShieldCheck, ShieldAlert, Activity,
} from "lucide-react";
import type { ShieldEvent } from "../../../types/api";

/* ─── Helpers ─── */
function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const eventConfig: Record<string, {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  color: string;
  label: (sourceId: string) => string;
}> = {
  "shield.chunk.clean": {
    icon: CheckCircle,
    color: "#10B981",
    label: () => "Clean chunk passed through",
  },
  "shield.chunk.stale": {
    icon: AlertTriangle,
    color: "#F59E0B",
    label: (s) => `Stale chunk detected in ${s || "unknown"}`,
  },
  "shield.chunk.quarantined": {
    icon: Lock,
    color: "#EF4444",
    label: (s) => `Quarantined chunk blocked: ${s || "unknown"}`,
  },
  "shield.chunk.substituted": {
    icon: RefreshCw,
    color: "#7C3AED",
    label: (s) => `Stale chunk substituted: ${s || "unknown"}`,
  },
  "shield.response.protected": {
    icon: ShieldCheck,
    color: "#10B981",
    label: () => "Response protected — all chunks clean",
  },
  "shield.response.blocked": {
    icon: ShieldAlert,
    color: "#EF4444",
    label: () => "Response BLOCKED — stale threshold exceeded",
  },
};

const alertTypes = new Set([
  "shield.chunk.stale",
  "shield.chunk.quarantined",
  "shield.chunk.substituted",
  "shield.response.blocked",
]);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

type FilterType = "all" | "clean" | "stale" | "quarantined" | "blocked";

export default function PipelinePage() {
  const { getToken } = useAuth();
  const [events, setEvents] = useState<ShieldEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [pipelineFilter, setPipelineFilter] = useState("all");
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/shield/events/recent?limit=50`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data: ShieldEvent[] = await res.json();
        
        // Detect new events since last poll
        const currentIds = new Set(data.map((e) => e.id));
        const freshIds = new Set<string>();
        currentIds.forEach((id) => {
          if (!prevIdsRef.current.has(id)) freshIds.add(id);
        });
        
        if (prevIdsRef.current.size > 0 && freshIds.size > 0) {
          setNewEventIds(freshIds);
          setTimeout(() => setNewEventIds(new Set()), 1200);
        }
        
        prevIdsRef.current = currentIds;
        setEvents(data);
        
        if (data.length > 0) {
          setLastEventTime(new Date(data[0].createdAt));
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Is live? (last event within 60s)
  const isLive = lastEventTime && Date.now() - lastEventTime.getTime() < 60000;

  // Pipeline selector
  const pipelineIds = Array.from(new Set(events.map((e) => e.pipelineId).filter(Boolean)));

  // Filter events
  const filterMap: Record<FilterType, (e: ShieldEvent) => boolean> = {
    all: () => true,
    clean: (e) => e.eventType === "shield.chunk.clean" || e.eventType === "shield.response.protected",
    stale: (e) => e.eventType === "shield.chunk.stale",
    quarantined: (e) => e.eventType === "shield.chunk.quarantined" || e.eventType === "shield.chunk.substituted",
    blocked: (e) => e.eventType === "shield.response.blocked",
  };

  const filtered = events
    .filter(filterMap[filter])
    .filter((e) => pipelineFilter === "all" || e.pipelineId === pipelineFilter);

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "clean", label: "Clean" },
    { key: "stale", label: "Stale" },
    { key: "quarantined", label: "Quarantined" },
    { key: "blocked", label: "Blocked" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Live Pipeline</h1>
          <p className="text-[14px] text-text-muted mt-1">Real-time shield events from your RAG pipelines</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5">
            {isLive && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#10B981" }} />
            )}
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ backgroundColor: isLive ? "#10B981" : "#A1A1AA" }}
            />
          </div>
          <span className={`text-[13px] font-medium ${isLive ? "text-[#10B981]" : "text-text-muted"}`}>
            {isLive ? "Live" : "Idle"}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-surface-raised rounded-lg p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                filter === tab.key
                  ? "bg-white text-accent-primary shadow-sm border-b-2 border-accent-primary"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {pipelineIds.length > 1 && (
          <select
            value={pipelineFilter}
            onChange={(e) => setPipelineFilter(e.target.value)}
            className="text-[13px] border border-[#E4E4E7] rounded-lg px-3 py-1.5 bg-white text-text-primary"
          >
            <option value="all">All pipelines</option>
            {pipelineIds.map((pid) => (
              <option key={pid} value={pid}>{pid}</option>
            ))}
          </select>
        )}
      </div>

      {/* Event Feed */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[52px] rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Activity size={40} className="text-text-muted mb-3" />
          <h4 className="text-[14px] font-medium text-text-primary mb-1">No shield events yet</h4>
          <p className="text-[13px] text-text-muted max-w-sm mb-3">
            Events appear here in real time as your instrumented pipeline processes queries.
          </p>
          <Link
            href="/sdk"
            className="text-[13px] font-medium text-accent-primary hover:text-accent-hover transition-colors"
          >
            Get started →
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-[#F4F4F5]">
          {filtered.map((event) => {
            const config = eventConfig[event.eventType];
            const Icon = config?.icon || Activity;
            const color = config?.color || "#71717A";
            const label = config?.label(event.sourceId) || event.eventType;
            const isNew = newEventIds.has(event.id);
            const showLeftBorder = alertTypes.has(event.eventType);

            return (
              <div
                key={event.id}
                className="flex items-center gap-4 py-3 px-2 transition-all duration-500"
                style={{
                  borderLeft: showLeftBorder ? `2px solid ${color}` : undefined,
                  backgroundColor: isNew ? "rgba(124, 58, 237, 0.05)" : "transparent",
                }}
              >
                <Icon size={18} style={{ color }} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-text-primary">{label}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {event.sessionId && (
                      <span className="text-[11px] font-mono text-text-muted truncate max-w-[120px]">
                        {event.sessionId}
                      </span>
                    )}
                    {event.pipelineId && (
                      <span className="text-[11px] text-text-muted">{event.pipelineId}</span>
                    )}
                  </div>
                </div>
                <span className="text-[12px] text-text-muted whitespace-nowrap shrink-0">
                  {relativeTime(event.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
