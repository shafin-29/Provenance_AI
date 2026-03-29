"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Copy, CheckCircle, ExternalLink, RefreshCw, AlertTriangle, Terminal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApiKey, DashboardStats } from "@/types/api";

// Utility for copy
const CodeBlock = ({ content }: { content: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative bg-[#1E1E2E] text-[#CDD6F4] font-mono text-[13px] rounded-[8px] p-4 mt-2">
      <button onClick={handleCopy} className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded transition-colors text-white">
        {copied ? <CheckCircle size={14} className="text-semantic-success" /> : <Copy size={14} className="text-[#A6ADC8]" />}
      </button>
      <pre className="overflow-x-auto whitespace-pre-wrap">{content}</pre>
    </div>
  );
};

export default function SdkSetupPage() {
  const { isLoaded, userId, getToken } = useAuth();
  const router = useRouter();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const [activeStep, setActiveStep] = useState(1);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newPipelineId, setNewPipelineId] = useState("");
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState(false);
  const [activeTab, setActiveTab] = useState<"pinecone" | "chroma">("pinecone");
  const [totalTraces, setTotalTraces] = useState(0);
  const [manualSessionId, setManualSessionId] = useState("");
  const [manualError, setManualError] = useState("");
  
  // Replace YOUR_KEY_HERE dynamically with the first active key if no reveal
  const previewOrRevealKey = revealKey || (keys.length > 0 ? keys.find(k => k.isActive)?.keyPreview || "YOUR_KEY_HERE" : "YOUR_KEY_HERE");

  useEffect(() => {
    const saved = localStorage.getItem("provenance_sdk_steps");
    if (saved) {
      setActiveStep(parseInt(saved, 10));
    }
  }, []);

  const setStep = (step: number) => {
    setActiveStep(step);
    localStorage.setItem("provenance_sdk_steps", step.toString());
  };

  const fetchKeys = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/keys`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setKeys(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (activeStep >= 2) fetchKeys();
  }, [activeStep]);

  useEffect(() => {
    let interval: any;
    if (activeStep === 3 && totalTraces === 0) {
      const checkStats = async () => {
        try {
          const token = await getToken();
          const res = await fetch(`${baseUrl}/api/dashboard/stats`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.totalResponsesTraced > 0) {
              setTotalTraces(data.totalResponsesTraced);
            }
          }
        } catch {}
      };
      checkStats();
      interval = setInterval(checkStats, 30000);
    }
    return () => clearInterval(interval);
  }, [activeStep, totalTraces]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName || !newPipelineId) return;
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/keys`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ name: newKeyName, pipelineId: newPipelineId })
      });
      if (res.ok) {
        const data = await res.json();
        setRevealKey(data.key);
        setNewKeyName("");
        setNewPipelineId("");
        setSavedKey(false);
        fetchKeys();
      }
    } catch {}
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this key? Active pipelines using it will fail.")) return;
    try {
      const token = await getToken();
      await fetch(`${baseUrl}/api/keys/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchKeys();
    } catch {}
  };

  const handleCheckTrace = async () => {
    if (!manualSessionId) return;
    setManualError("");
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/trace/${manualSessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setTotalTraces(1); // Set directly to success
      } else {
        setManualError("No trace found for this session ID");
      }
    } catch {
      setManualError("Error checking trace");
    }
  };

  if (!isLoaded) return null;
  if (!userId) return null;

  return (
    <div className="flex flex-col h-full w-full animate-in fade-in duration-150 pb-12">
      <div className="flex items-center justify-between pb-6 border-b border-border-subtle mb-6">
        <div>
          <h1 className="text-[20px] font-medium text-text-primary tracking-tight">SDK Setup</h1>
          <p className="text-[13px] text-text-muted mt-1">Instrument your LangChain pipeline in 3 steps</p>
        </div>
        <a href="#" className="flex items-center gap-1.5 text-[13px] font-medium text-accent-primary hover:underline group">
          View SDK docs <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </a>
      </div>

      {/* Step Tracker */}
      <div className="flex items-center justify-center mb-10 w-full max-w-2xl mx-auto px-4">
        {[1, 2, 3].map((step, idx) => (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              {step < activeStep || (step === 3 && totalTraces > 0) ? (
                <div className="w-6 h-6 rounded-full bg-semantic-success text-white flex items-center justify-center shrink-0">
                  <CheckCircle size={14} />
                </div>
              ) : step === activeStep ? (
                <div className="w-6 h-6 rounded-full bg-accent-primary text-white flex items-center justify-center shrink-0 text-[12px] font-medium">
                  {step}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-surface-raised text-text-muted flex items-center justify-center shrink-0 text-[12px] font-medium">
                  {step}
                </div>
              )}
              <span className={`text-[13px] select-none ${
                step < activeStep || (step === 3 && totalTraces > 0) ? "text-text-muted font-medium" : 
                step === activeStep ? "font-bold text-text-primary" : "text-text-muted"
              }`}>
                {step === 1 ? "Install" : step === 2 ? "Instrument" : "Verify"}
              </span>
            </div>
            {idx < 2 && (
              <div className={`h-[2px] flex-1 mx-4 rounded-full ${step < activeStep ? "bg-accent-primary" : "bg-border-subtle"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
        {/* Step 1 */}
        <div className={`bg-surface border border-border rounded-[12px] p-6 transition-opacity ${activeStep >= 1 ? "opacity-100" : "opacity-50"}`}>
          <h2 className="text-[15px] font-medium text-text-primary mb-4">1. Install the SDK</h2>
          <CodeBlock content="pip install provenance-ai" />
          <p className="text-[13px] text-text-muted mt-3">
            Requires Python 3.8+ · LangChain 0.1+ · Pinecone or Chroma vector database
          </p>
          {activeStep === 1 && (
            <button onClick={() => setStep(2)} className="mt-6 flex items-center gap-2 bg-surface-raised border border-border hover:bg-surface-raised-hover text-text-primary text-[13px] font-medium px-4 py-2 rounded-md transition-colors">
              Mark as done →
            </button>
          )}
        </div>

        {/* Step 2 */}
        {(activeStep >= 2) && (
          <div className="bg-surface border border-border rounded-[12px] p-6">
            <h2 className="text-[15px] font-medium text-text-primary mb-6">2. Get Your API Key & Instrument Your Pipeline</h2>
            
            <div className="mb-8">
              <h3 className="text-[14px] font-medium text-text-primary">Your API Keys</h3>
              <p className="text-[13px] text-text-muted mb-4">Keep your API key secret — treat it like a password.</p>
              
              <div className="flex flex-col gap-2 mb-6">
                {keys.map((k) => (
                  <div key={k.id} className={`flex items-center p-3 bg-surface-raised border rounded-[8px] ${k.isActive ? "border-border" : "border-border-subtle opacity-50"}`}>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-text-primary">{k.name}</span>
                        <span className="inline-flex items-center justify-center bg-accent-bg text-accent-primary rounded-full px-2 py-[2px] text-[10px] font-medium">
                          {k.pipelineId}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[12px] font-mono text-text-muted">{k.keyPreview}</span>
                        <span className="text-[11px] text-text-muted">
                          {k.lastUsedAt ? `Last used: ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
                        </span>
                      </div>
                    </div>
                    {k.isActive && (
                      <button onClick={() => handleRevoke(k.id)} className="ml-auto text-[12px] font-medium text-semantic-danger hover:underline">
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!revealKey && (
                <form onSubmit={handleCreateKey} className="flex items-end gap-3 p-4 bg-surface-raised border border-border rounded-[8px]">
                  <div className="flex flex-col flex-1 gap-1.5">
                    <label className="text-[12px] font-medium text-text-secondary">Key name</label>
                    <input required value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g. my-rag-pipeline-prod" className="h-9 px-3 border border-border rounded-md text-[13px] bg-background focus:outline-accent-primary" />
                  </div>
                  <div className="flex flex-col flex-1 gap-1.5">
                    <label className="text-[12px] font-medium text-text-secondary">Pipeline ID</label>
                    <input required value={newPipelineId} onChange={e => setNewPipelineId(e.target.value)} placeholder="e.g. insurance-rag-v1" className="h-9 px-3 border border-border rounded-md text-[13px] bg-background focus:outline-accent-primary" />
                  </div>
                  <button type="submit" className="h-9 px-4 bg-accent-primary hover:bg-accent-primary-hover text-white text-[13px] font-medium rounded-md transition-colors">
                    Generate Key
                  </button>
                </form>
              )}

              {revealKey && (
                <div className="p-4 bg-[#FFFBEB] border border-[#FCD34D] rounded-[8px]">
                  <div className="flex items-center gap-2 text-[#92400E] mb-3">
                    <AlertTriangle size={16} />
                    <span className="text-[13px] font-medium">Copy this key now — it won't be shown again</span>
                  </div>
                  <CodeBlock content={revealKey!} />
                  <div className="flex items-center justify-between mt-4">
                    <label className="flex items-center gap-2 text-[13px] font-medium text-[#92400E] cursor-pointer">
                      <input type="checkbox" checked={savedKey} onChange={e => setSavedKey(e.target.checked)} className="rounded border-[#FCD34D] text-[#92400E] focus:ring-[#92400E]" />
                      I've saved this key securely
                    </label>
                    <button 
                      disabled={!savedKey} 
                      onClick={() => setRevealKey(null)}
                      className="px-4 py-2 bg-[#92400E] hover:bg-[#78350F] text-white disabled:opacity-50 text-[13px] font-medium rounded-md transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-[14px] font-medium text-text-primary mb-3">Instrument Your Pipeline</h3>
              <div className="flex items-center gap-6 border-b border-border-subtle mb-4">
                <button onClick={() => setActiveTab("pinecone")} className={`pb-2 text-[13px] font-medium border-b-2 transition-colors ${activeTab === "pinecone" ? "border-accent-primary text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}>
                  Pinecone
                </button>
                <button onClick={() => setActiveTab("chroma")} className={`pb-2 text-[13px] font-medium border-b-2 transition-colors ${activeTab === "chroma" ? "border-accent-primary text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}>
                  Chroma
                </button>
              </div>

              {activeTab === "pinecone" ? (
                <CodeBlock content={`from provenance_ai import ProvenanceAIClient\nfrom langchain_pinecone import PineconeVectorStore\n\nsdk = ProvenanceAIClient(\n    api_url="https://your-backend.railway.app",\n    api_key="${previewOrRevealKey}",\n    pipeline_id="your-pipeline-id"\n)\n\n# Ingest your documents\ndocs = sdk.ingest("path/to/document.pdf")\nvectorstore = PineconeVectorStore(index_name="your-index")\nvectorstore.add_documents([doc for doc, _ in docs])\n\n# Wrap your retriever\nretriever = sdk.get_retriever(\n    vectorstore.as_retriever(),\n    session_id="unique-session-id"\n)`} />
              ) : (
                <CodeBlock content={`from provenance_ai import ProvenanceAIClient\nfrom langchain_chroma import Chroma\n\nsdk = ProvenanceAIClient(\n    api_url="http://localhost:8000",\n    api_key="${previewOrRevealKey}",\n    pipeline_id="your-pipeline-id"\n)\n\n# Ingest your documents\ndocs = sdk.ingest("path/to/document.pdf")\nvectorstore = Chroma(collection_name="your-collection")\nvectorstore.add_documents([doc for doc, _ in docs])\n\n# Wrap your retriever\nretriever = sdk.get_retriever(\n    vectorstore.as_retriever(),\n    session_id="unique-session-id"\n)`} />
              )}
            </div>

            {activeStep === 2 && (
               <button onClick={() => setStep(3)} className="mt-6 flex items-center gap-2 bg-surface-raised border border-border hover:bg-surface-raised-hover text-text-primary text-[13px] font-medium px-4 py-2 rounded-md transition-colors">
                 Mark as done →
               </button>
            )}
          </div>
        )}

        {/* Step 3 */}
        {(activeStep >= 3) && (
          <div className="bg-surface border border-border rounded-[12px] p-6 text-center shadow-sm">
            <h2 className="text-[15px] font-medium text-text-primary mb-6 text-left">3. Verify Your Integration</h2>
            
            {totalTraces > 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <CheckCircle size={40} className="text-[#10B981] mb-4" />
                <h3 className="text-[18px] font-semibold text-text-primary mb-1">Integration verified!</h3>
                <p className="text-[13px] text-text-muted mb-6">{totalTraces} traces received from your pipeline</p>
                <Link href="/trace" className="px-5 py-2.5 bg-accent-primary hover:bg-accent-primary-hover text-white text-[14px] font-medium rounded-md transition-colors shadow-sm">
                  View your traces →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                {/* CSS Pulsing Ring Animation */}
                <div className="relative flex items-center justify-center w-12 h-12 mb-6">
                  <div className="absolute w-full h-full rounded-full border-2 border-accent-primary border-t-transparent animate-spin"></div>
                  <div className="absolute w-8 h-8 rounded-full bg-accent-bg animate-pulse"></div>
                  <Terminal size={16} className="text-accent-primary relative z-10" />
                </div>
                <h3 className="text-[14px] font-medium text-text-secondary mb-2">Waiting for your first trace...</h3>
                <p className="text-[13px] text-text-muted mb-8 max-w-sm">Run your instrumented pipeline, then check back here</p>
                
                <div className="flex flex-col items-center w-full max-w-md bg-background border border-border p-4 rounded-lg">
                  <p className="text-[12px] font-medium text-text-secondary mb-3 w-full text-left">Already ran your pipeline? Enter your session ID:</p>
                  <div className="flex items-center gap-2 w-full">
                    <input 
                      value={manualSessionId} 
                      onChange={e => setManualSessionId(e.target.value)} 
                      placeholder="sess_..." 
                      className="flex-1 h-9 px-3 border border-border rounded-md text-[13px] font-mono bg-surface focus:outline-accent-primary" 
                    />
                    <button onClick={handleCheckTrace} className="h-9 px-4 bg-surface-raised border border-border hover:bg-surface-raised-hover text-text-primary text-[13px] font-medium rounded-md transition-colors">
                      Check
                    </button>
                    <button onClick={() => setActiveStep(3)} className="w-9 h-9 flex items-center justify-center bg-surface-raised border border-border hover:bg-surface-raised-hover text-text-muted rounded-md transition-colors" title="Refresh">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  {manualError && (
                    <p className="text-[12px] text-semantic-danger mt-2 w-full text-left font-medium">{manualError}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Environment Variables Reference */}
      <div className="mt-12 max-w-3xl mx-auto w-full">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted mb-3 select-none">ENVIRONMENT VARIABLES</h3>
        <CodeBlock content={`PROVENANCE_AI_API_URL=https://your-backend.railway.app\nPROVENANCE_AI_API_KEY=${previewOrRevealKey}`} />
      </div>
    </div>
  );
}
