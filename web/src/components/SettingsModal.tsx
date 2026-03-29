"use client";

import { useState, useEffect } from "react";
import { Mail, CheckCircle, AlertTriangle, Send, X } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { getToken } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState("");
  const [testEmailErr, setTestEmailErr] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const token = await getToken();
        const res = await fetch(`${baseUrl}/api/alerts/settings`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          setSettings(await res.json());
        } else {
          setSettings({ fetchError: `API Error: ${res.status} ${res.statusText}` });
        }
      } catch (err: any) {
        setSettings({ fetchError: "API Unreachable (Is the backend running?)" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [isOpen]);

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    setTestEmailMsg("");
    setTestEmailErr("");
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/alerts/test-email`, { 
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.sent) throw new Error(data.error || "Failed to send test email");
      setTestEmailMsg("Test email sent!");
      setTimeout(() => setTestEmailMsg(""), 3000);
    } catch (err: any) {
      setTestEmailErr(err.message || "An unexpected error occurred");
      setTimeout(() => setTestEmailErr(""), 4000);
    } finally {
      setIsTestingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-border w-full max-w-[480px] rounded-[10px] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-raised">
          <h2 className="text-[15px] font-semibold text-text-primary">Global Settings</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-[6px] text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          <h3 className="text-[13px] font-medium text-text-primary mb-3">Alert Notifications</h3>
          
          {isLoading ? (
            <div className="h-[48px] w-full bg-surface-raised rounded-[8px] animate-pulse" />
          ) : settings?.fetchError ? (
            <div className="text-[13px] text-semantic-danger font-medium p-4 border border-semantic-danger/30 bg-semantic-danger-bg rounded-[8px]">
              {settings.fetchError}
            </div>
          ) : settings ? (
            <div className="flex flex-col gap-4 p-4 border border-border rounded-[8px] bg-background">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-text-muted" />
                  <span className="text-[13px] text-text-primary font-medium">Email Configuration:</span>
                </div>
                {settings.emailConfigured ? (
                  <span className="text-[12px] text-semantic-success font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded bg-semantic-success-bg border border-semantic-success/30">
                    <CheckCircle size={12}/> Active
                  </span>
                ) : (
                  <span className="text-[12px] text-semantic-danger font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded bg-semantic-danger-bg border border-semantic-danger/30">
                    <AlertTriangle size={12}/> Not Configured
                  </span>
                )}
              </div>
              
              <div className="border-t border-border-subtle pt-3 text-[13px]">
                <div className="flex justify-between mb-2">
                  <span className="text-text-muted">Recipient Address:</span>
                  <span className="text-text-primary font-mono">{settings.alertEmailTo || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Staleness Scan Interval:</span>
                  <span className="text-text-primary">{settings.checkIntervalHours} Hours</span>
                </div>
              </div>

              <div className="flex items-center justify-start gap-4 border-t border-border-subtle pt-4 mt-1">
                <button 
                  onClick={handleTestEmail}
                  disabled={isTestingEmail || !settings.emailConfigured}
                  className="h-8 px-4 bg-surface-raised border border-border hover:border-border-subtle hover:text-text-primary hover:bg-surface text-text-secondary text-[12px] font-medium rounded-[6px] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isTestingEmail ? <div className="h-3 w-3 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin" /> : <Send size={12} />}
                  Send Test Email
                </button>
                <div className="flex flex-col justify-center h-8">
                  {testEmailMsg && <span className="text-[12px] text-semantic-success font-medium">{testEmailMsg}</span>}
                  {testEmailErr && <span className="text-[12px] text-semantic-danger font-medium">{testEmailErr}</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-text-muted italic">Failed to load settings.</div>
          )}
        </div>
      </div>
    </div>
  );
}
