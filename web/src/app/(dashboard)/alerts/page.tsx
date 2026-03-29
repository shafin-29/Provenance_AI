"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Play, Mail, AlertTriangle, CheckCircle,
  Eye, RotateCw, Loader2, ChevronRight
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { StalenessAlert, AlertSummary } from "@/types/api";

export default function AlertsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  
  const [alerts, setAlerts] = useState<StalenessAlert[]>([]);
  const [history, setHistory] = useState<StalenessAlert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Interactions
  const [filter, setFilter] = useState<"All" | "Critical" | "Danger" | "Warning">("All");
  const [sortOption, setSortOption] = useState("days_desc");
  
  const [confirmReingestId, setConfirmReingestId] = useState<string | null>(null);
  const [isReingestingId, setIsReingestingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  
  // Custom Toasts
  const [checkResult, setCheckResult] = useState<{ checked: number, stale: number } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  
  // Manual Sim controls
  const [simSourceId, setSimSourceId] = useState("");
  const [simResult, setSimResult] = useState("");

  const fetchAlertsData = async () => {
    try {
      setIsLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      
      const [alRes, sumRes, histRes] = await Promise.all([
        fetch(`${baseUrl}/api/alerts`, { headers }),
        fetch(`${baseUrl}/api/alerts/summary`, { headers }),
        fetch(`${baseUrl}/api/alerts/history`, { headers })
      ]);
      
      setAlerts(alRes.ok ? await alRes.json() : []);
      setSummary(sumRes.ok ? await sumRes.json() : null);
      setHistory(histRes.ok ? await histRes.json() : []);
    } catch {
      // Error is handled via empty states
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsData();
  }, []);

  const handleRunCheck = async () => {
    setIsChecking(true);
    setCheckResult(null);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/alerts/run-check`, { 
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCheckResult(data);
        setTimeout(() => setCheckResult(null), 8000);
        if (data.stale > 0) fetchAlertsData(); // refresh
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/alerts/${id}/resolve`, { 
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // Optimitic remove fadeout
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== id));
          fetchAlertsData();
        }, 300);
      }
    } finally {
      setResolvingId(null);
    }
  };

  const handleReingest = async (sourceId: string, alertId: string) => {
    setIsReingestingId(alertId);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/sources/${sourceId}/reingest`, { 
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== alertId));
          fetchAlertsData();
        }, 500);
      }
    } finally {
      setIsReingestingId(null);
      setConfirmReingestId(null);
    }
  };

  const handleSimStale = async () => {
     if (!simSourceId) return;
     // Frontend Mock logic block representing mark logic (no hard active route requested)
     setSimResult(`Marked stale. 0 embeddings updated. (Simulation)`);
     setTimeout(() => setSimResult(""), 4000);
  };

  // -------------------------------------------------------------
  // Data processing: Filtering & Sorting
  let filteredAlerts = alerts.filter(a => {
    if (filter === "All") return true;
    return a.severity?.toLowerCase() === filter.toLowerCase();
  });

  filteredAlerts.sort((a, b) => {
    if (sortOption === "days_desc") return (b.daysStale || 0) - (a.daysStale || 0);
    if (sortOption === "sessions_desc") return (b.affectedSessionCount || 0) - (a.affectedSessionCount || 0);
    if (sortOption === "name_asc") {
      const nameA = a.sourceRecord?.sourceId || "";
      const nameB = b.sourceRecord?.sourceId || "";
      return nameA.localeCompare(nameB);
    }
    return 0;
  });

  return (
    <div className="flex flex-col h-full w-full max-w-[1400px] mx-auto p-4 md:p-8 animate-in fade-in duration-300 overflow-y-auto pb-24 relative">
      
      {/* Absolute Run Check Toast Bar */}
      {checkResult && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300 w-full max-w-lg rounded-[8px] border p-3 flex items-center justify-between shadow-md ${checkResult.stale === 0 ? 'bg-[#F0FDF4] border-[#10B981] text-[#065F46]' : 'bg-[#FFFBEB] border-[#F59E0B] text-[#92400E]'}`}>
           <p className="text-[13px] font-medium pl-2">
             Staleness check complete — {checkResult.checked} records checked, {checkResult.stale} marked stale.
           </p>
           <button onClick={() => setCheckResult(null)} className="text-[12px] font-bold hover:underline px-2 opacity-80 hover:opacity-100">
             Dismiss
           </button>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-medium text-text-primary">Staleness Alerts</h1>
          <p className="text-[13px] text-text-muted mt-1">Source records that have changed since their embeddings were last ingested</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {}}
            className="flex items-center gap-2 bg-white border border-[#E4E4E7] text-text-primary hover:bg-[#F9FAFB] px-4 py-2 rounded-[6px] text-[13px] font-medium transition-colors"
          >
            <Mail size={16} className="text-text-muted" /> Send Test Email
          </button>
          <button 
            onClick={handleRunCheck}
            disabled={isChecking}
            className="flex items-center gap-2 bg-white border border-[#E4E4E7] text-text-primary hover:bg-[#F9FAFB] px-4 py-2 rounded-[6px] text-[13px] font-medium transition-colors min-w-[140px] justify-center"
          >
            {isChecking ? <Loader2 size={16} className="animate-spin text-text-muted" /> : <Play size={16} className="text-text-muted" />} 
            {isChecking ? "Checking..." : "Run Check Now"}
          </button>
        </div>
      </div>

      {/* SEVERITY SUMMARY BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Total Stale */}
        <div className={`bg-white border rounded-[8px] p-4 flex flex-col justify-between shadow-sm transition-colors ${(summary?.totalStale || 0) > 0 ? 'border-[#F59E0B]/40' : 'border-[#E4E4E7]'}`}>
          <div className="flex flex-col">
            <span className={`text-[22px] font-semibold leading-tight ${(summary?.totalStale || 0) > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
              {isLoading ? "-" : (summary?.totalStale || 0)}
            </span>
            <span className="text-[12px] text-text-muted mt-0.5">Stale Records</span>
          </div>
          {(summary?.totalStale || 0) === 0 && !isLoading && (
             <p className="text-[11px] text-[#10B981] font-medium mt-2">All Clear</p>
          )}
        </div>
        
        {/* Critical */}
        <div className={`bg-white border rounded-[8px] p-4 flex flex-col justify-between shadow-sm transition-colors ${(summary?.criticalCount || 0) > 0 ? 'border-[#EF4444]/40 bg-[#FEF2F2]' : 'border-[#E4E4E7]'}`}>
          <div className="flex flex-col">
            <span className={`text-[22px] font-semibold leading-tight ${(summary?.criticalCount || 0) > 0 ? 'text-[#EF4444]' : 'text-text-muted'}`}>
              {isLoading ? "-" : (summary?.criticalCount || 0)}
            </span>
            <span className="text-[12px] text-text-muted mt-0.5">Critical (31+ days)</span>
          </div>
        </div>
        
        {/* Danger */}
        <div className={`bg-white border rounded-[8px] p-4 flex flex-col justify-between shadow-sm transition-colors ${(summary?.dangerCount || 0) > 0 ? 'border-[#F97316]/40 bg-[#FFF7ED]' : 'border-[#E4E4E7]'}`}>
          <div className="flex flex-col">
            <span className={`text-[22px] font-semibold leading-tight ${(summary?.dangerCount || 0) > 0 ? 'text-[#F97316]' : 'text-text-muted'}`}>
              {isLoading ? "-" : (summary?.dangerCount || 0)}
            </span>
            <span className="text-[12px] text-text-muted mt-0.5">Danger (8-30 days)</span>
          </div>
        </div>

        {/* Warning */}
        <div className={`bg-white border rounded-[8px] p-4 flex flex-col justify-between shadow-sm transition-colors ${(summary?.warningCount || 0) > 0 ? 'border-[#F59E0B]/40 bg-[#FFFBEB]' : 'border-[#E4E4E7]'}`}>
          <div className="flex flex-col">
            <span className={`text-[22px] font-semibold leading-tight ${(summary?.warningCount || 0) > 0 ? 'text-[#F59E0B]' : 'text-text-muted'}`}>
              {isLoading ? "-" : (summary?.warningCount || 0)}
            </span>
            <span className="text-[12px] text-text-muted mt-0.5">Warning (0-7 days)</span>
          </div>
        </div>

      </div>

      {/* SETTINGS BANNER */}
      <div className="bg-[#F9FAFB] border border-[#E4E4E7] rounded-[8px] px-4 py-2.5 h-[44px] flex items-center justify-between mb-8 shadow-sm text-[13px]">
        <div className="flex items-center gap-3">
          <Mail size={14} className="text-text-muted" />
          <span className="text-text-secondary">Alerts sending to: alerts@provenance.ai</span>
          <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
        </div>
      </div>

      {/* FILTER & SORT BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        
        {/* Severity Tabs */}
        <div className="flex items-center border-b border-[#E4E4E7] w-full sm:w-auto">
          {["All", "Critical", "Danger", "Warning"].map((tab) => (
             <button 
               key={tab}
               onClick={() => setFilter(tab as any)}
               className={`px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-[1px] ${filter === tab ? 'text-text-primary border-accent-primary' : 'text-text-muted border-transparent hover:text-text-secondary'}`}
             >
               {tab}
             </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <select 
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          className="h-[32px] px-3 bg-white border border-[#E4E4E7] rounded-[6px] text-[13px] text-text-secondary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 cursor-pointer"
        >
          <option value="days_desc">Sort by: Days Stale &darr;</option>
          <option value="sessions_desc">Sort by: Affected Sessions &darr;</option>
          <option value="name_asc">Sort by: Source Name A-Z</option>
        </select>
      </div>

      {/* ACTIVE ALERTS TABLE */}
      <div className="w-full overflow-x-auto pb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E4E4E7] bg-[#F9FAFB]">
              <th className="py-3 px-4 pl-5 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Source File</th>
              <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Severity</th>
              <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Days Stale</th>
              <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Last Ingested</th>
              <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Impact</th>
              <th className="py-3 px-4 pr-5 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-[#F4F4F5]">
                  <td className="py-4 px-5"><div className="h-4 w-40 bg-surface-raised rounded animate-pulse" /></td>
                  <td className="py-4 px-4"><div className="h-4 w-16 bg-surface-raised rounded animate-pulse" /></td>
                  <td className="py-4 px-4"><div className="h-4 w-12 bg-surface-raised rounded animate-pulse" /></td>
                  <td className="py-4 px-4"><div className="h-4 w-24 bg-surface-raised rounded animate-pulse" /></td>
                  <td className="py-4 px-4"><div className="h-4 w-32 bg-surface-raised rounded animate-pulse" /></td>
                  <td className="py-4 px-5"><div className="h-4 w-16 bg-surface-raised rounded animate-pulse ml-auto" /></td>
                </tr>
              ))
            ) : filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center">
                   <div className="flex flex-col items-center justify-center">
                     <CheckCircle size={40} className="text-[#10B981] mb-4" />
                     <h3 className="text-[16px] font-medium text-text-primary mb-1">No active staleness alerts</h3>
                     <p className="text-[13px] text-text-muted max-w-md mx-auto mb-2">
                       All source records are current. The staleness detection job will notify you when any source files are modified.
                     </p>
                     <p className="text-[12px] text-text-muted">
                       Last checked: {format(new Date(), "MMM d, yyyy HH:mm")}
                     </p>
                   </div>
                </td>
              </tr>
            ) : (
              filteredAlerts.map(alert => {
                const src = alert.sourceRecord;
                const sev = alert.severity || "warning";
                
                // Colors per semantic
                let badgeClass = "";
                let leftBorderClass = "";
                let numColorClass = "";
                
                if (sev === "critical") {
                  badgeClass = "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]";
                  leftBorderClass = "border-l-2 border-l-[#EF4444]";
                  numColorClass = "text-[#EF4444]";
                } else if (sev === "danger") {
                  badgeClass = "bg-[#FFF7ED] text-[#9A3412] border border-[#FED7AA]";
                  leftBorderClass = "border-l-2 border-l-[#F97316]";
                  numColorClass = "text-[#F97316]";
                } else {
                   // Warning
                  badgeClass = "bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]";
                  leftBorderClass = "border-l-2 border-l-[#F59E0B]";
                  numColorClass = "text-[#F59E0B]";
                }

                const resolving = resolvingId === alert.id;

                return (
                  <tr key={alert.id} className={`h-[52px] border-b border-[#F4F4F5] hover:bg-[#FAFAFA] transition-all duration-300 group ${leftBorderClass} ${resolving ? 'opacity-30 translate-x-2' : ''}`}>
                    <td className="py-3 px-4 pl-[18px]">
                      <div className="text-[13px] font-mono font-medium text-text-primary truncate max-w-[200px]" title={src?.sourceId}>{src?.sourceId || "Unknown"}</div>
                      <div className="text-[11px] font-mono text-text-muted mt-0.5 truncate">{src?.pipelineId || "—"}</div>
                    </td>
                    
                    <td className="py-3 px-4">
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded-[4px] font-bold ${badgeClass}`}>
                        {sev}
                      </span>
                    </td>
                    
                    <td className="py-3 px-4">
                      <div className={`text-[13px] font-semibold leading-tight ${numColorClass}`}>{alert.daysStale || 0}</div>
                      <div className="text-[11px] text-text-muted mt-0.5">since {src?.versionTs ? format(new Date(src.versionTs), "MMM d") : "—"}</div>
                    </td>
                    
                    <td className="py-3 px-4">
                      <div className="text-[13px] text-text-secondary">{alert.lastIngestedAt ? format(new Date(alert.lastIngestedAt), "MMM d, yyyy") : "—"}</div>
                      <div className="text-[11px] text-text-muted mt-0.5">{alert.lastIngestedAt ? `${formatDistanceToNow(new Date(alert.lastIngestedAt))} ago` : ""}</div>
                    </td>
                    
                    <td className="py-3 px-4">
                      <div className="text-[13px] text-text-secondary">{alert.embeddingsMarked || 0} stale embeddings</div>
                      <div className={`text-[12px] mt-0.5 ${(alert.affectedSessionCount || 0) > 0 ? 'text-[#EF4444] font-medium' : 'text-text-muted'}`}>
                        {alert.affectedSessionCount || 0} sessions affected
                      </div>
                    </td>
                    
                    <td className="py-3 px-4 pr-5 text-right w-[200px]">
                      {confirmReingestId === alert.id ? (
                        <div className="flex items-center justify-end gap-3 animate-in fade-in">
                          <span className="text-[12px] text-text-primary font-medium">Re-ingest?</span>
                          <div className="flex items-center gap-2">
                             <button 
                               onClick={() => handleReingest(src?.id ?? "", alert.id)}
                               disabled={isReingestingId === alert.id}
                               className="text-[11px] font-medium px-3 py-1 bg-accent-primary hover:bg-accent-hover text-white rounded-[4px] min-w-[65px] flex justify-center items-center transition-colors"
                             >
                               {isReingestingId === alert.id ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
                             </button>
                             <button 
                               onClick={() => setConfirmReingestId(null)}
                               className="text-[12px] text-text-muted hover:text-text-primary transition-colors hover:underline"
                             >
                               Cancel
                             </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <Link href={`/sources/${src?.id}`}>
                            <button className="p-1.5 text-text-muted hover:text-accent-primary hover:bg-accent-primary/5 rounded-[6px] transition-all" title="View Source Details">
                               <Eye size={16} />
                            </button>
                          </Link>
                          <button 
                            onClick={() => setConfirmReingestId(alert.id)}
                            className="p-1.5 text-text-muted hover:text-accent-primary hover:bg-accent-primary/5 rounded-[6px] transition-all" 
                            title="Trigger Re-ingest"
                          >
                             <RotateCw size={16} />
                          </button>
                          <button 
                            onClick={() => handleResolve(alert.id)}
                            className="p-1.5 text-text-muted hover:text-[#10B981] hover:bg-[#10B981]/5 rounded-[6px] transition-all" 
                            title="Resolve manually"
                          >
                             <CheckCircle size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ALERT HISTORY SECTION */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">ALERT HISTORY</h2>
          <div className="h-[1px] flex-1 bg-[#E4E4E7]" />
        </div>
        <p className="text-[13px] text-text-muted mb-4">All past staleness detection events including resolved alerts</p>
        
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#F9FAFB]">
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Source File</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Detected</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Embeddings Marked</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Hash Change</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Status</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Resolved At</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && !isLoading ? (
                <tr>
                   <td colSpan={6} className="py-8 text-center text-[12px] text-text-muted">No staleness events recorded yet</td>
                </tr>
              ) : (
                history.map(hist => (
                  <tr key={hist.id} className="h-[40px] border-b border-[#F4F4F5]">
                    <td className="py-2 px-4 text-[12px] font-mono text-text-primary">{hist.sourceRecord?.sourceId || "Unknown"}</td>
                    <td className="py-2 px-4">
                      <div className="text-[12px] text-text-secondary">{format(new Date(hist.detectedAt), "MMM d, yy HH:mm")}</div>
                      <div className="text-[11px] text-text-muted">{formatDistanceToNow(new Date(hist.detectedAt))} ago</div>
                    </td>
                    <td className="py-2 px-4 text-[12px] text-text-secondary">{hist.embeddingsMarked || 0}</td>
                    <td className="py-2 px-4 flex items-center gap-1.5 text-[11px] font-mono text-text-muted h-full py-3">
                      <span className="truncate max-w-[60px]" title={hist.previousHash}>{hist.previousHash?.slice(0,8) || "—"}</span>
                      <ChevronRight size={10} className="text-[#A1A1AA]" />
                      <span className="truncate max-w-[60px]" title={hist.currentHash}>{hist.currentHash?.slice(0,8) || "—"}</span>
                    </td>
                    <td className="py-2 px-4">
                      {hist.resolvedAt ? (
                        <span className="bg-[#D1FAE5] text-[#065F46] px-2 py-0.5 rounded-[4px] text-[10px] uppercase font-bold border border-[#6EE7B7]">Resolved</span>
                      ) : (
                        <span className="bg-[#FFFBEB] text-[#92400E] px-2 py-0.5 rounded-[4px] text-[10px] uppercase font-bold border border-[#FDE68A]">Active</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-[12px] text-text-secondary">
                      {hist.resolvedAt ? format(new Date(hist.resolvedAt), "MMM d, yy HH:mm") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MANUAL CONTROLS SECTION */}
      <div className="mt-12 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">MANUAL CONTROLS</h2>
          <div className="h-[1px] flex-1 bg-[#E4E4E7]" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Simulate Stale */}
           <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-5 shadow-sm">
              <h3 className="text-[14px] font-medium text-text-primary mb-1">Mark Source Record as Stale</h3>
              <p className="text-[12px] text-text-muted mb-4">Simulates what the background staleness detection job does automatically</p>
              
              <div className="flex items-center gap-2">
                 <input 
                   type="text" 
                   value={simSourceId}
                   onChange={e => setSimSourceId(e.target.value)}
                   placeholder="Enter Source Record ID (e.g. cuid...)" 
                   className="flex-1 h-[32px] px-3 border border-[#E4E4E7] rounded-[6px] text-[13px] font-mono focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]/20 text-text-primary"
                 />
                 <button onClick={handleSimStale} className="bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA] shrink-0 h-[32px] px-4 text-[12px] font-medium rounded-[6px] transition-colors">
                   Mark as Stale
                 </button>
              </div>
              {simResult && <p className="text-[12px] text-[#D97706] mt-3 font-medium animate-in fade-in">{simResult}</p>}
           </div>

           {/* Run Job */}
           <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-5 shadow-sm">
              <h3 className="text-[14px] font-medium text-text-primary mb-1">Run Staleness Check Now</h3>
              <p className="text-[12px] text-text-muted mb-4">Immediately runs the file hash comparison job for all source records</p>
              
              <button 
                 onClick={handleRunCheck}
                 disabled={isChecking}
                 className="w-full flex items-center justify-center gap-2 h-[32px] bg-white border border-[#E4E4E7] hover:bg-[#F9FAFB] text-text-primary text-[13px] font-medium rounded-[6px] transition-colors"
              >
                 {isChecking ? <Loader2 size={14} className="animate-spin text-text-muted" /> : <Play size={14} className="text-text-muted" />} 
                 {isChecking ? "Checking..." : "Run Check Now"}
              </button>
           </div>
        </div>
      </div>

    </div>
  );
}
