"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, ArrowRight, AlertTriangle, FileText, 
  GitCompare, Layers, Loader2, RotateCw, Activity
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { SourceRecord, LLMResponse, Embedding } from "@/types/api";

export default function SourceDetailPage({ params }: { params: Promise<{ source_id: string }> }) {
  const { getToken } = useAuth();
  const unwrappedParams = use(params);
  const router = useRouter();
  const [record, setRecord] = useState<SourceRecord | null>(null);
  const [responses, setResponses] = useState<LLMResponse[]>([]);
  const [impact, setImpact] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [confirmReingest, setConfirmReingest] = useState(false);
  const [isReingesting, setIsReingesting] = useState(false);

  const fetchSourceData = async () => {
    try {
      setIsLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      
      const [recRes, respRes, impRes] = await Promise.all([
        fetch(`${baseUrl}/api/sources/${unwrappedParams.source_id}`, { headers }),
        fetch(`${baseUrl}/api/sources/${unwrappedParams.source_id}/responses`, { headers }),
        fetch(`${baseUrl}/api/sources/${unwrappedParams.source_id}/impact`, { headers })
      ]);
      
      if (!recRes.ok) throw new Error("Source record not found");
      
      setRecord(await recRes.json());
      setResponses(await respRes.json());
      setImpact(await impRes.json());
      
    } catch (err: any) {
      setError(err.message || "Failed to load source data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSourceData();
  }, [unwrappedParams.source_id]);

  const handleReingest = async () => {
    setIsReingesting(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/sources/${unwrappedParams.source_id}/reingest`, { 
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // Refresh data to clear stale states instantly
        await fetchSourceData();
      }
    } catch {
      // ignored for MVP
    } finally {
      setIsReingesting(false);
      setConfirmReingest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="animate-spin text-text-muted w-8 h-8" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="p-8 text-center text-semantic-danger font-medium mt-10">
        <AlertTriangle className="mx-auto mb-2" size={32} />
        {error}
      </div>
    );
  }

  const isStale = record.isStale;

  return (
    <div className="flex flex-col h-full w-full max-w-[1400px] mx-auto p-4 md:p-8 animate-in fade-in duration-300 pb-24 overflow-y-auto">
      
      {/* Back Nav */}
      <Link href="/sources" className="inline-flex items-center text-[13px] text-text-muted hover:text-accent-primary transition-colors w-fit mb-6">
        <ArrowLeft size={14} className="mr-1" /> Source Records
      </Link>

      {/* Title Block */}
      <div className="mb-8">
        <h1 className="text-[18px] font-medium font-mono text-text-primary mb-2 break-all">
          {record.sourceId}
        </h1>
        <div className="flex items-center gap-3">
           <span className="text-[13px] font-mono text-text-muted">
             {record.pipelineId || "No Pipeline"}
           </span>
           {isStale ? (
             <span className="bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] text-[10px] uppercase px-2 py-0.5 rounded-[4px] font-bold">STALE</span>
           ) : (
             <span className="bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7] text-[10px] uppercase px-2 py-0.5 rounded-[4px] font-bold">CLEAN</span>
           )}
        </div>
      </div>

      {/* 60/40 Split Layout */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        
        {/* LEFT COLUMN (60%) */}
        <div className="flex-[3] flex flex-col gap-6">
          
          {/* Metadata Card */}
          <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-6 shadow-sm">
            <h2 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2">
               <FileText size={16} className="text-text-muted" /> Source Metadata
            </h2>
            <dl className="grid grid-cols-[120px_1fr] md:grid-cols-[140px_1fr] gap-y-3 text-[13px]">
              <dt className="text-text-muted font-medium">File Path</dt>
              <dd className="font-mono text-text-secondary truncate" title={record.sourceId}>{record.sourceId}</dd>
              
              <dt className="text-text-muted font-medium">Content Hash</dt>
              <dd className="font-mono text-text-secondary truncate scrollable-x">{record.contentHash}</dd>
              
              <dt className="text-text-muted font-medium">Pipeline ID</dt>
              <dd className="font-mono text-text-secondary">{record.pipelineId || "—"}</dd>
              
              <dt className="text-text-muted font-medium">Ingested At</dt>
              <dd className="text-text-secondary">{record.createdAt ? format(new Date(record.createdAt), "MMM d, yyyy HH:mm:ss") : "—"}</dd>
              
              <dt className="text-text-muted font-medium">Last Modified</dt>
              <dd className="text-text-secondary">{record.versionTs ? format(new Date(record.versionTs), "MMM d, yyyy HH:mm:ss") : "—"}</dd>
              
              <dt className="text-text-muted font-medium">Status</dt>
              <dd>
                {isStale ? (
                  <span className="inline-block bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] text-[10px] uppercase px-2 py-0.5 rounded-[4px] font-bold">STALE</span>
                ) : (
                  <span className="inline-block bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7] text-[10px] uppercase px-2 py-0.5 rounded-[4px] font-bold">CLEAN</span>
                )}
              </dd>
            </dl>

            {isStale && (
              <div className="mt-6 bg-[#FEF3C7] border-l-[3px] border-[#F59E0B] p-3 pl-4 rounded-r-[6px]">
                <p className="text-[13px] text-[#92400E] mb-3 leading-relaxed">
                  This source record has been modified since its embeddings were last ingested. Re-ingesting will clear all stale flags.
                </p>
                {confirmReingest ? (
                  <div className="flex items-center gap-3 animate-in fade-in">
                    <span className="text-[12px] text-[#92400E] font-bold">Re-ingest?</span>
                    <button 
                      onClick={() => handleReingest()}
                      disabled={isReingesting}
                      className="text-[11px] font-medium px-4 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-[4px] transition-colors min-w-[70px] flex justify-center items-center"
                    >
                      {isReingesting ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
                    </button>
                    <button 
                      onClick={() => setConfirmReingest(false)}
                      className="text-[12px] text-[#B45309] hover:text-[#92400E] transition-colors hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmReingest(true)}
                    className="flex items-center gap-1.5 text-[12px] font-medium px-4 py-1.5 bg-[#FCD34D] hover:bg-[#FBBF24] text-[#92400E] border border-[#F59E0B]/30 rounded-[4px] transition-colors"
                  >
                    <RotateCw size={14} /> Trigger Re-ingest
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content Preview Card */}
          <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-6 shadow-sm flex flex-col">
            <div className="mb-4">
               <h2 className="text-[14px] font-semibold text-text-primary flex items-center gap-2">
                 <FileText size={16} className="text-text-muted" /> Content Preview
               </h2>
               <p className="text-[12px] text-text-muted mt-1">First 200 characters captured at ingestion time</p>
            </div>
            
            <div className={`flex-1 bg-[#F9FAFB] border border-[#E4E4E7] rounded-[6px] p-4 font-mono text-[13px] leading-[1.6] ${!record.contentPreview ? 'text-text-muted flex items-center justify-center p-8' : 'text-text-secondary whitespace-pre-wrap'}`}>
              {record.contentPreview ? record.contentPreview : "No content preview captured. Re-ingest this file to capture a preview."}
            </div>
            
            <p className="text-[11px] text-text-muted mt-3">
              Content preview is captured at ingestion time and reflects the state of the file when it was first processed.
            </p>
          </div>

          {/* Affected Responses Card */}
          <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-6 shadow-sm">
            <h2 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2">
               <Activity size={16} className="text-text-muted" /> LLM Responses Using This Source
            </h2>
            
            <div className="flex flex-col">
              {responses.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-text-muted">
                  No LLM responses have used this source record yet
                </div>
              ) : (
                <>
                  {responses.slice(0, 10).map((resp, i) => (
                    <div 
                      key={resp.id} 
                      onClick={() => resp.sessionId && router.push(`/trace?session=${encodeURIComponent(resp.sessionId)}`)}
                      className="group flex items-center justify-between p-3 -mx-3 border-b border-[#F4F4F5] last:border-0 hover:bg-[#F9FAFB] rounded-[6px] cursor-pointer transition-colors"
                    >
                      <div className="flex flex-col gap-1.5 mr-4 overflow-hidden">
                        <p className="text-[13px] text-text-primary truncate">{resp.responseText}</p>
                        <div className="flex items-center text-[11px] text-text-muted">
                          <span className="font-mono">{resp.sessionId?.slice(-10) ?? "..."}</span>
                          <span className="mx-1.5">&middot;</span>
                          <span>{resp.respondedAt ? `${formatDistanceToNow(new Date(resp.respondedAt))} ago` : "—"}</span>
                          <span className="mx-1.5">&middot;</span>
                          <span>{resp.modelVersion}</span>
                        </div>
                      </div>
                      <button className="shrink-0 p-1.5 text-text-muted group-hover:text-accent-primary bg-white border border-[#E4E4E7] rounded-full transition-colors">
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ))}
                  {responses.length > 10 && (
                     <div className="pt-4 text-center">
                        <Link href={`/trace`} className="text-[12px] text-accent-primary hover:text-accent-hover font-medium hover:underline">
                           View {responses.length - 10} more responses &rarr;
                        </Link>
                     </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (40%) */}
        <div className="flex-[2] flex flex-col gap-6">
          
          {/* Impact Summary Card */}
          <div className="bg-white border border-[#E4E4E7] rounded-[8px] shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 pb-3">
               <h2 className="text-[14px] font-semibold text-text-primary flex items-center gap-2">
                 <Activity size={16} className="text-text-muted" /> Impact Summary
               </h2>
            </div>
            
            <div className="grid grid-cols-2 border-t border-[#E4E4E7]">
               <div className="p-4 py-5 border-r border-b border-[#E4E4E7] flex flex-col">
                  <span className="text-[20px] font-semibold text-text-primary leading-none mb-1">{impact?.totalChunks || 0}</span>
                  <span className="text-[11px] text-text-muted">Total Chunks</span>
               </div>
               <div className="p-4 py-5 border-b border-[#E4E4E7] flex flex-col">
                  <span className={`text-[20px] font-semibold leading-none mb-1 ${(impact?.staleChunks || 0) > 0 ? "text-semantic-warning" : "text-text-primary"}`}>
                    {impact?.staleChunks || 0}
                  </span>
                  <span className="text-[11px] text-text-muted">Stale Chunks</span>
               </div>
               <div className="p-4 py-5 border-r border-[#E4E4E7] flex flex-col">
                  <span className="text-[20px] font-semibold text-text-primary leading-none mb-1">{impact?.totalRetrievalEvents || 0}</span>
                  <span className="text-[11px] text-text-muted">Retrieval Events</span>
               </div>
               <div className="p-4 py-5 flex flex-col">
                  <span className="text-[20px] font-semibold text-text-primary leading-none mb-1">{impact?.totalLLMResponses || 0}</span>
                  <span className="text-[11px] text-text-muted">LLM Responses</span>
               </div>
            </div>

            <div className="bg-[#F9FAFB] border-t border-[#E4E4E7] p-3 px-5 text-[12px] text-text-muted font-medium">
               First retrieved: {impact?.firstRetrieved ? format(new Date(impact.firstRetrieved), "MMM d, yyyy") : "Not yet retrieved"}
            </div>
          </div>

          {/* Transformation Steps Card */}
          <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-6 shadow-sm">
            <h2 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2">
               <GitCompare size={16} className="text-text-muted" /> Transformation Steps
            </h2>
            
            <div className="flex flex-col">
              {(!record.transformationSteps || record.transformationSteps.length === 0) ? (
                <div className="py-6 text-center text-[12px] text-text-muted">
                  No transformation steps recorded
                </div>
              ) : (
                record.transformationSteps.map((step: any, idx: number) => (
                  <div key={step.id} className="flex flex-col py-3 border-b border-[#F4F4F5] last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-medium text-text-primary">{step.operatorName}</span>
                      <span className="text-[11px] text-text-muted">{formatDistanceToNow(new Date(step.appliedAt))} ago</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted bg-[#F9FAFB] p-2 rounded-[4px] border border-[#E4E4E7]">
                      <span className="truncate flex-1" title={step.inputHash}>{step.inputHash.slice(0,8)}...</span>
                      <ArrowRight size={10} className="text-[#A1A1AA] shrink-0" />
                      <span className="truncate flex-1" title={step.outputHash}>{step.outputHash.slice(0,8)}...</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Embeddings Card */}
          <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-text-primary flex items-center gap-2">
                 <Layers size={16} className="text-text-muted" /> Embeddings
              </h2>
              <p className="text-[12px] text-text-muted mt-1">
                {record.embeddings?.length || 0} chunks &middot; {(record.embeddings || []).filter((e:any)=>e.isStale).length} stale
              </p>
            </div>
            
            <div className="flex flex-col">
              {(!record.embeddings || record.embeddings.length === 0) ? (
                <div className="py-6 text-center text-[12px] text-text-muted">
                  No embeddings recorded for this source
                </div>
              ) : (
                <>
                  {record.embeddings.slice(0, 8).map((emb: any, idx: number) => (
                    <div key={emb.id} className="flex items-center justify-between py-2 border-b border-[#F4F4F5] last:border-0">
                      <div className="flex flex-col min-w-0 pr-4">
                        <span className="text-[12px] font-medium text-text-primary">Chunk {emb.chunkIndex}</span>
                        <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                          <span className="font-mono truncate max-w-[100px]" title={emb.vectorDbId}>{emb.vectorDbId}</span>
                          <span>&middot;</span>
                          <span className="truncate">{emb.embeddingModel}</span>
                        </div>
                      </div>
                      <div className={`w-[6px] h-[6px] rounded-full shrink-0 ${emb.isStale ? "bg-semantic-warning" : "bg-semantic-success"}`} 
                           title={emb.isStale ? "Stale" : "Clean"} 
                      />
                    </div>
                  ))}
                  {record.embeddings.length > 8 && (
                    <div className="pt-3 text-center">
                      <button className="text-[12px] text-text-secondary hover:text-text-primary font-medium hover:underline transition-colors">
                        Show all {record.embeddings.length} embeddings
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
