"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  AlertTriangle, Download, Link as LinkIcon, Loader2, Database
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import type { RetrievalEvent, PromptContext, LLMResponse, Embedding } from "@/types/api";

function formatRelativeTime(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

function getNodeColors(type: string, isStale: boolean) {
  if (isStale) 
    return { bg: "bg-semantic-danger-bg", border: "border-semantic-danger/30", text: "text-semantic-danger" };
  const d: Record<string, any> = {
    RES: { bg: "bg-[#3B82F615]", border: "border-[#3B82F630]", text: "text-[#3B82F6]" },
    CTX: { bg: "bg-[#8B5CF615]", border: "border-[#8B5CF630]", text: "text-[#8B5CF6]" },
    RTR: { bg: "bg-[#06B6D415]", border: "border-[#06B6D430]", text: "text-[#06B6D4]" },
    EMB: { bg: "bg-[#F59E0B15]", border: "border-[#F59E0B30]", text: "text-[#F59E0B]" },
    SRC: { bg: "bg-[#10B98115]", border: "border-[#10B98130]", text: "text-[#10B981]" }
  };
  return d[type] || d["RES"];
}

function TracePageContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [sessionIdInput, setSessionIdInput] = useState("");
  const [activeSessionId, setActiveSessionId] = useState("");
  const [traceData, setTraceData] = useState<any>(null);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);
  const [traceError, setTraceError] = useState("");
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [reingestingSourceId, setReingestingSourceId] = useState<string | null>(null);

  const currentSessionParam = searchParams.get("session");

  useEffect(() => {
    if (currentSessionParam) {
      sessionStorage.setItem("savedTraceId", currentSessionParam);
      setSessionIdInput(currentSessionParam);
      setActiveSessionId(currentSessionParam);
      fetchTrace(currentSessionParam);
    } else {
      const saved = sessionStorage.getItem("savedTraceId");
      if (saved) {
        router.replace(`/trace?session=${encodeURIComponent(saved)}`);
      }
    }
  }, [currentSessionParam, router]);

  const fetchTrace = async (session: string) => {
    setIsLoadingTrace(true);
    setTraceError("");
    setTraceData(null);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/trace/${encodeURIComponent(session)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error("No trace found for session ID");
        throw new Error("Unable to connect to ProvenanceAI API. Check that the backend is running.");
      }
      setTraceData(await res.json());
    } catch (err: any) {
      setTraceError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoadingTrace(false);
    }
  };

  const handleTraceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = sessionIdInput.trim();
    if (!cleanId) return;
    if (cleanId !== currentSessionParam) {
      router.push(`/trace?session=${encodeURIComponent(cleanId)}`);
    } else {
      fetchTrace(cleanId);
    }
  };

  const handleExportTrace = async () => {
    if (!activeSessionId) return;
    setIsExporting(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/traces/${encodeURIComponent(activeSessionId)}/export`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trace_${activeSessionId}.json`;
      a.click();
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    } catch {
      // Silent fail — export is non-critical
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleReingest = async (sourceId: string) => {
    setReingestingSourceId(sourceId);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/sources/${encodeURIComponent(sourceId)}/reingest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTrace(activeSessionId);
      }
    } catch {
      // Optional error toast
    } finally {
      setTimeout(() => setReingestingSourceId(null), 3000);
    }
  };

  let llmResponse, promptContext, retrievalEvent, embeddings: any[] = [], sourceRecords: any[] = [];
  let sourcesHaveStale = false;
  
  if (traceData) {
    retrievalEvent = traceData;
    promptContext = traceData.promptContexts?.[0];
    llmResponse = promptContext?.llmResponses?.[0];
    embeddings = traceData.embeddings?.map((e: any) => e.embedding) || [];
    
    const sourceMap = new Map();
    embeddings.forEach((emb: any) => {
      if (emb.parentSourceRecord && !sourceMap.has(emb.parentSourceRecord.id)) {
        sourceMap.set(emb.parentSourceRecord.id, emb.parentSourceRecord);
      }
      if (emb.parentSourceRecord?.isStale) sourcesHaveStale = true;
    });
    sourceRecords = Array.from(sourceMap.values());
  }

  return (
    <div className="flex justify-center h-full w-full animate-in fade-in duration-150 overflow-y-auto pb-24 px-4 xl:px-0">
      <div className="flex flex-col w-full max-w-5xl">
        <PageHeader 
          title="Trace Explorer" 
          subtitle="Paste a session ID to trace an LLM response back to its source data, embeddings, and context assembly parameters." 
        />

        <form onSubmit={handleTraceSubmit} className="flex h-10 w-full max-w-md mx-auto shrink-0 bg-surface border border-border shadow-sm rounded-[8px] focus-within:border-accent-primary focus-within:ring-2 focus-within:ring-accent-primary/20 transition-all mb-6 mt-6">
          <div className="flex items-center px-3 text-accent-primary font-mono text-[12px] font-bold select-none">&gt;</div>
          <input 
            className="flex-1 bg-transparent border-none outline-none text-[13px] font-mono text-text-primary placeholder:text-text-muted"
            placeholder="Enter session ID to trace..."
            value={sessionIdInput}
            onChange={e => setSessionIdInput(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={isLoadingTrace || !sessionIdInput.trim()}
            className="flex items-center justify-center shrink-0 w-[100px] h-full bg-accent-primary hover:bg-accent-hover text-white text-[13px] font-medium border-l border-accent-hover rounded-r-[8px] transition-colors disabled:opacity-50"
          >
            {isLoadingTrace ? <Loader2 size={16} className="animate-spin" /> : "Trace"}
          </button>
        </form>

        {isLoadingTrace && !traceData ? (
          <div className="flex flex-col gap-0 w-full animate-pulse">
            <div className="h-10 bg-surface-raised rounded-[8px] mb-8" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 mb-4">
                <div className="w-8 h-8 rounded-[6px] bg-surface-raised shrink-0" />
                <div className="flex flex-col gap-2 w-full mt-1">
                  <div className="h-4 w-32 bg-surface-raised rounded" />
                  <div className="h-3 w-64 bg-surface-raised rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : traceError ? (
          <div className="w-full flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle size={32} className="text-semantic-danger mb-4" />
            <h3 className="text-[14px] font-medium text-text-primary mb-2">{traceError.includes("No trace found") ? "No trace found for session ID" : "Error Locating Trace"}</h3>
            <span className="font-mono text-[12px] text-text-muted bg-surface-raised px-2 py-0.5 rounded border border-border-subtle mb-4">
              {activeSessionId}
            </span>
            <p className="text-[13px] text-text-muted max-w-sm">Check that the SDK has successfully instrumented this session, or verify your query structure.</p>
          </div>
        ) : traceData ? (
          <div className="flex flex-col animate-in fade-in duration-300">
            {/* Session Header Bar */}
            <div className="flex items-center justify-between flex-wrap gap-4 bg-surface border border-border rounded-[8px] px-4 py-3 mb-8">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="font-mono text-text-muted font-medium">{activeSessionId}</span>
                <span className="text-border mx-1">&middot;</span>
                <span className="text-text-muted">Responded {formatRelativeTime(llmResponse?.respondedAt || retrievalEvent.retrievedAt)}</span>
                <span className="text-border mx-1">&middot;</span>
                <span className="text-text-muted">{llmResponse?.modelVersion || "Unknown Model"}</span>
                <span className="text-border mx-1">&middot;</span>
                <span className="text-text-muted">{embeddings.length} sources retrieved</span>
                <span className="text-border mx-1">&middot;</span>
                <span className={`font-medium flex items-center gap-1.5 ${sourcesHaveStale ? "text-semantic-warning" : "text-semantic-success"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sourcesHaveStale ? "bg-semantic-warning" : "bg-semantic-success"}`} />
                  {sourcesHaveStale ? "1 or more stale sources detected" : "All sources current"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleExportTrace} disabled={isExporting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-surface-raised hover:bg-border-subtle border border-border text-[12px] font-medium text-text-secondary transition-colors disabled:opacity-50 w-[100px] justify-center">
                  {isExporting ? <Loader2 size={13} className="animate-spin"/> : <Download size={13} />}
                  {exportSuccess ? "Exported!" : "Export JSON"}
                </button>
                <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-surface-raised hover:bg-border-subtle border border-border text-[12px] font-medium text-text-secondary transition-colors w-[85px] justify-center">
                  <LinkIcon size={13} /> {shareSuccess ? "Copied!" : "Share"}
                </button>
              </div>
            </div>

            {/* Lineage Tree */}
            <div className="flex flex-col ml-2">
              
              {llmResponse && (
                <div className="flex items-stretch group">
                  <div className="flex flex-col items-center mr-4 relative shrink-0 w-8">
                    {(() => { const c = getNodeColors("RES", false); return (
                      <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center border ${c.bg} ${c.border} z-10`}>
                        <span className={`text-[10px] font-bold ${c.text}`}>RES</span>
                      </div>
                    );})()}
                    <div className="w-[1px] h-6 bg-border" />
                  </div>
                  <div className="pb-6 flex-1 min-w-0">
                    <div className="flex items-center justify-between pointer-events-none mb-1">
                      <span className="text-[13px] font-medium text-text-primary">LLM Response Generation</span>
                    </div>
                    <div className="flex items-center text-[10px] uppercase text-text-muted tracking-[0.06em] font-medium mb-3 whitespace-nowrap overflow-x-auto no-scrollbar">
                      <span>MODEL</span><span className="text-[11px] font-mono text-text-secondary normal-case ml-2">{llmResponse.modelVersion}</span>
                      <span className="text-border mx-2">&middot;</span>
                      <span>RESPONDED</span><span className="text-[11px] font-mono text-text-secondary normal-case ml-2">{formatRelativeTime(llmResponse.respondedAt)}</span>
                    </div>
                    <div className="bg-surface border border-border rounded-[6px] p-3 text-[13px] text-text-secondary max-h-[140px] overflow-y-auto w-full break-words">
                      {llmResponse.responseText}
                    </div>
                  </div>
                </div>
              )}

              {promptContext && (
                <div className="flex items-stretch group">
                  <div className="flex flex-col items-center mr-4 relative shrink-0 w-8">
                    {(() => { const c = getNodeColors("CTX", false); return (
                      <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center border ${c.bg} ${c.border} z-10`}>
                        <span className={`text-[10px] font-bold ${c.text}`}>CTX</span>
                      </div>
                    );})()}
                    <div className="w-[1px] h-6 bg-border" />
                  </div>
                  <div className="pb-6 flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-medium text-text-primary">Prompt Assembly</span>
                    </div>
                    <div className="flex flex-wrap items-center text-[10px] uppercase text-text-muted tracking-[0.06em] font-medium mt-2">
                       <span>FORMAT</span><span className="text-[11px] font-mono text-text-secondary normal-case ml-2">{promptContext.contextFormat}</span>
                       <span className="text-border mx-2">&middot;</span>
                       <span>TEMPLATE</span><span className="text-[11px] font-mono text-text-secondary normal-case truncate max-w-[200px] ml-2">{promptContext.templateId}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-stretch group">
                <div className="flex flex-col items-center mr-4 relative shrink-0 w-8">
                  {(() => { const c = getNodeColors("RTR", false); return (
                    <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center border ${c.bg} ${c.border} z-10`}>
                      <span className={`text-[10px] font-bold ${c.text}`}>RTR</span>
                    </div>
                  );})()}
                  {embeddings.length > 0 && <div className="w-[1px] h-6 bg-border" />}
                </div>
                <div className="pb-6 flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium text-text-primary">Vector Retrieval Event</span>
                  </div>
                  <div className="flex flex-wrap items-center text-[10px] uppercase text-text-muted tracking-[0.06em] font-medium mt-2">
                     <span>PIPELINE</span><span className="text-[11px] font-mono text-text-secondary normal-case ml-2">{retrievalEvent.pipelineId}</span>
                     <span className="text-border mx-2">&middot;</span>
                     <span>RETRIEVED</span><span className="text-[11px] font-mono text-text-secondary normal-case ml-2">{formatRelativeTime(retrievalEvent.retrievedAt)}</span>
                  </div>
                </div>
              </div>

              {embeddings.map((emb, idx) => {
                const isLast = idx === embeddings.length - 1;
                const isStale = emb.isStale || emb.parentSourceRecord?.isStale;
                
                return (
                  <div key={idx} className="flex flex-col">
                    <div className="flex items-stretch group">
                      <div className="flex flex-col items-center mr-4 relative shrink-0 w-8">
                        {(() => { const c = getNodeColors("EMB", isStale); return (
                          <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center border ${c.bg} ${c.border} z-10`}>
                            <span className={`text-[10px] font-bold ${c.text}`}>EMB</span>
                          </div>
                        );})()}
                        <div className={`w-[1px] h-6 ${isStale ? "bg-semantic-danger/40" : "bg-border"}`} />
                      </div>
                      <div className={`pb-6 flex-1 min-w-0 border-l-[2px] border-transparent pl-4 -ml-[18px] ${isStale ? "border-semantic-danger" : ""}`}>
                        <div className="flex items-center justify-between mb-1 pl-1">
                          <span className={`text-[13px] font-medium ${isStale ? "text-semantic-danger" : "text-text-primary"}`}>Chunk Embedding</span>
                          {isStale && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-semantic-danger opacity-80" />
                              <span className="text-[10px] uppercase font-bold text-semantic-danger bg-semantic-danger-bg border border-semantic-danger/30 px-2 py-0.5 rounded-[4px] tracking-wide">
                                STALE
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center text-[10px] uppercase text-text-muted tracking-[0.06em] font-medium mt-2 pl-1">
                           <span>MODEL</span><span className="text-[11px] font-mono text-text-secondary normal-case ml-2">{emb.embeddingModel}</span>
                           <span className="text-border mx-2">&middot;</span>
                           <span>VECTOR ID</span><span className="text-[11px] font-mono text-text-secondary normal-case ml-2 truncate max-w-[150px]">{emb.vectorId}</span>
                           <span className="text-border mx-2">&middot;</span>
                           <span>SIMILARITY</span><span className="text-[11px] font-mono text-text-secondary normal-case ml-2">{emb.similarityScore?.toFixed(4) || "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    {emb.parentSourceRecord && (
                      <div className="flex items-stretch group">
                        <div className="flex flex-col items-center mr-4 relative shrink-0 w-8">
                          {(() => { const c = getNodeColors("SRC", isStale); return (
                            <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center border ${c.bg} ${c.border} z-10`}>
                              <span className={`text-[10px] font-bold ${c.text}`}>SRC</span>
                            </div>
                          );})()}
                          {!isLast && <div className="w-[1px] h-6 bg-border" />}
                        </div>
                        <div className={`pb-8 flex-1 min-w-0 border-l-[2px] border-transparent pl-4 -ml-[18px] ${isStale ? "border-semantic-danger" : ""}`}>
                          <div className="flex items-center justify-between mb-1 pl-1">
                            <span className={`text-[13px] font-medium ${isStale ? "text-semantic-danger" : "text-text-primary"}`}>Source Record</span>
                            {isStale && (
                              <button 
                                onClick={() => handleReingest(emb.parentSourceRecord.id)}
                                disabled={reingestingSourceId === emb.parentSourceRecord.id}
                                className="ml-auto text-[11px] font-medium px-3 py-1 bg-semantic-danger text-white border border-semantic-danger rounded-[6px] hover:opacity-90 disabled:opacity-50 transition-opacity"
                              >
                                {reingestingSourceId === emb.parentSourceRecord.id ? "Triggering..." : "Trigger Re-ingest"}
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center text-[10px] uppercase text-text-muted tracking-[0.06em] font-medium mt-2 pl-1">
                             <span>SOURCE ID</span><span className="text-[11px] font-mono text-text-secondary normal-case ml-2 truncate max-w-[150px]">{emb.parentSourceRecord.sourceId}</span>
                             <span className="text-border mx-2">&middot;</span>
                             <span>HASH</span><span className="text-[11px] font-mono text-text-secondary normal-case xl:truncate xl:max-w-[70px] ml-2" title={emb.parentSourceRecord.contentHash}>{emb.parentSourceRecord.contentHash}</span>
                             <span className="text-border mx-2">&middot;</span>
                             <span>INGESTED</span><span className="text-[11px] font-mono text-text-secondary normal-case ml-2">{new Date(emb.parentSourceRecord.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-70">
            <Database size={40} className="text-text-muted mb-4" />
            <h3 className="text-[16px] font-medium text-text-primary mb-1">Awaiting Trace ID</h3>
            <p className="text-[13px] text-text-muted max-w-sm">Enter a session ID generated by the DataDog-style trace interceptor above.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TracePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[14px] text-text-muted"><Loader2 className="animate-spin inline mr-2"/> Loading Explorer...</div>}>
      <TracePageContent />
    </Suspense>
  );
}
