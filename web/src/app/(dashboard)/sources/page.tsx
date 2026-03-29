"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { 
  Upload, Database, AlertTriangle, CheckCircle, Search, 
  Eye, RotateCw, Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { SourceRecord } from "@/types/api";

export default function SourcesPage() {
  const { getToken } = useAuth();
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Filter & Search
  const [filterState, setFilterState] = useState<"ALL" | "STALE">("ALL");
  const [searchKw, setSearchKw] = useState("");
  
  // Inline actions
  const [confirmReingestId, setConfirmReingestId] = useState<string | null>(null);
  const [isReingestingId, setIsReingestingId] = useState<string | null>(null);

  // Toast MVP
  const [showToast, setShowToast] = useState(false);

  const fetchSources = async () => {
    try {
      setIsLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/sources`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load generic records");
      setSources(await res.json());
    } catch (err: any) {
      setError(err.message || "Failed to load");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleUploadClick = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  const handleReingest = async (id: string) => {
    setIsReingestingId(id);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/sources/${id}/reingest`, { 
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // Optimistically update
        setSources(prev => prev.map(s => s.id === id ? { ...s, isStale: false } : s));
      }
    } catch {
      // Ignored for MVP
    } finally {
      setIsReingestingId(null);
      setConfirmReingestId(null);
    }
  };

  // Derive stats
  const totalRecords = sources.length;
  const staleRecords = sources.filter(s => s.isStale).length;
  const cleanRecords = totalRecords - staleRecords;

  // Filter & Search Logic
  const filtered = sources.filter(s => {
    if (filterState === "STALE" && !s.isStale) return false;
    if (searchKw.trim()) {
      const q = searchKw.toLowerCase();
      const matchSource = s.sourceId?.toLowerCase().includes(q);
      const matchPipe = s.pipelineId?.toLowerCase().includes(q);
      if (!matchSource && !matchPipe) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full w-full max-w-[1400px] mx-auto p-4 md:p-8 animate-in fade-in duration-300">
      
      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-surface-raised border border-border text-text-primary px-4 py-3 rounded-[8px] shadow-lg z-50 animate-in slide-in-from-bottom-5">
          <p className="text-[13px] font-medium">✨ Ingest Upload coming soon!</p>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[20px] font-medium text-text-primary">Source Records</h1>
          <p className="text-[13px] text-text-muted mt-1">All ingested source records and their lineage status</p>
        </div>
        <button 
          onClick={handleUploadClick}
          className="flex items-center gap-2 bg-accent-primary hover:bg-accent-hover text-white px-4 py-2 rounded-[6px] text-[13px] font-medium transition-colors"
        >
          <Upload size={16} /> Ingest New File
        </button>
      </div>

      {/* STAT BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-4 flex items-start gap-4 shadow-sm">
          <div className="w-[32px] h-[32px] rounded-[6px] bg-accent-primary/10 flex items-center justify-center shrink-0">
            <Database size={18} className="text-accent-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-[22px] font-semibold text-text-primary leading-tight">{isLoading ? "-" : totalRecords}</span>
            <span className="text-[12px] text-text-muted mt-0.5">Total Records</span>
          </div>
        </div>
        
        <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-4 flex items-start gap-4 shadow-sm">
          <div className={`w-[32px] h-[32px] rounded-[6px] flex items-center justify-center shrink-0 ${staleRecords > 0 ? 'bg-semantic-warning/10' : 'bg-text-muted/10'}`}>
            <AlertTriangle size={18} className={staleRecords > 0 ? 'text-semantic-warning' : 'text-text-muted'} />
          </div>
          <div className="flex flex-col">
            <span className={`text-[22px] font-semibold leading-tight ${staleRecords > 0 ? 'text-semantic-warning' : 'text-text-primary'}`}>
              {isLoading ? "-" : staleRecords}
            </span>
            <span className="text-[12px] text-text-muted mt-0.5">Stale Records</span>
          </div>
        </div>

        <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-4 flex items-start gap-4 shadow-sm">
          <div className="w-[32px] h-[32px] rounded-[6px] bg-semantic-success/10 flex items-center justify-center shrink-0">
            <CheckCircle size={18} className="text-semantic-success" />
          </div>
          <div className="flex flex-col">
            <span className="text-[22px] font-semibold text-text-primary leading-tight">{isLoading ? "-" : cleanRecords}</span>
            <span className="text-[12px] text-text-muted mt-0.5">Clean Records</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
        {/* Segmented Control */}
        <div className="flex p-0.5 border border-[#E4E4E7] bg-surface rounded-[6px] shrink-0 w-full sm:w-auto">
          <button 
            onClick={() => setFilterState("ALL")}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-[12px] font-medium rounded-[4px] transition-colors ${filterState === "ALL" ? "bg-accent-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilterState("STALE")}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-[12px] font-medium rounded-[4px] transition-colors ${filterState === "STALE" ? "bg-accent-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
          >
            Stale Only
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-[320px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input 
            type="text"
            placeholder="Search by filename or pipeline_Id..."
            value={searchKw}
            onChange={(e) => setSearchKw(e.target.value)}
            className="w-full h-[32px] pl-9 pr-3 bg-white border border-[#E4E4E7] rounded-[6px] text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 transition-all font-mono"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="w-full overflow-x-auto pb-24">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E4E4E7] bg-[#F9FAFB]">
              <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Source File</th>
              <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Content Hash</th>
              <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Last Version</th>
              <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Chunks</th>
              <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Status</th>
              <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[#F4F4F5]">
                  <td className="py-4 px-4"><div className="h-4 w-40 bg-surface-raised rounded animate-pulse" /></td>
                  <td className="py-4 px-4"><div className="h-4 w-24 bg-surface-raised rounded animate-pulse" /></td>
                  <td className="py-4 px-4"><div className="h-4 w-20 bg-surface-raised rounded animate-pulse" /></td>
                  <td className="py-4 px-4"><div className="h-4 w-10 bg-surface-raised rounded animate-pulse" /></td>
                  <td className="py-4 px-4"><div className="h-4 w-16 bg-surface-raised rounded animate-pulse" /></td>
                  <td className="py-4 px-4"><div className="h-4 w-10 bg-surface-raised rounded animate-pulse ml-auto" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[13px] text-text-muted">
                  No source records found matching your filters.
                </td>
              </tr>
            ) : (
              filtered.map((record) => (
                <tr key={record.id} className="h-[44px] border-b border-[#F4F4F5] hover:bg-[#F9FAFB] transition-colors duration-150 group">
                  <td className="py-2 px-4 max-w-[250px] truncate">
                    <div className="text-[13px] font-mono font-medium text-text-primary truncate" title={record.sourceId}>{record.sourceId}</div>
                    <div className="text-[11px] font-mono text-text-muted mt-0.5 truncate">{record.pipelineId || "No Pipeline"}</div>
                  </td>
                  <td className="py-2 px-4">
                    <span className="text-[12px] font-mono text-text-muted">{record.contentHash?.substring(0,12) || "—"}</span>
                  </td>
                  <td className="py-2 px-4 whitespace-nowrap">
                    <span className="text-[13px] text-text-secondary">
                      {record.versionTs || record.createdAt 
                        ? `${formatDistanceToNow(new Date(record.versionTs || record.createdAt))} ago` 
                        : "—"}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-[13px] text-text-secondary">
                    {record.embeddingCount ?? 0}
                  </td>
                  <td className="py-2 px-4">
                    {record.isStale ? (
                      <span className="bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] text-[10px] uppercase px-2 py-0.5 rounded-[4px] font-bold">
                        STALE
                      </span>
                    ) : (
                      <span className="bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7] text-[10px] uppercase px-2 py-0.5 rounded-[4px] font-bold">
                        CLEAN
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {confirmReingestId === record.id ? (
                      <div className="flex items-center justify-end gap-3 animate-in fade-in">
                        <span className="text-[12px] text-text-primary font-medium">Re-ingest?</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setConfirmReingestId(null)}
                            className="text-[12px] text-text-muted hover:text-text-primary transition-colors hover:underline"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => handleReingest(record.id)}
                            disabled={isReingestingId === record.id}
                            className="text-[11px] font-medium px-3 py-1 bg-accent-primary hover:bg-accent-hover text-white rounded-[4px] transition-colors min-w-[70px] flex justify-center items-center"
                          >
                            {isReingestingId === record.id ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {record.isStale && (
                           <button 
                             onClick={() => setConfirmReingestId(record.id)}
                             className="p-1.5 text-text-muted hover:text-accent-primary hover:bg-accent-primary/5 rounded-[6px] transition-all"
                             title="Trigger Re-ingest"
                           >
                              <RotateCw size={16} />
                           </button>
                        )}
                        <Link href={`/sources/${record.id}`}>
                          <button 
                            className="p-1.5 text-text-muted hover:text-accent-primary hover:bg-accent-primary/5 rounded-[6px] transition-all"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
