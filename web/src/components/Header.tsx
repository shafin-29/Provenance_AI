"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

const pageTitles: Record<string, string> = {
  "/shield": "Shield Status",
  "/trace": "Trace Explorer",
  "/sources": "Source Records",
  "/alerts": "Staleness Alerts",
  "/sdk": "SDK Setup",
  "/pipelines": "Pipelines",
  "/settings": "Settings",
  "/incidents": "Incidents",
  "/quarantine": "Quarantine",
  "/pipeline": "Live Pipeline",
};

export function Header() {
  const pathname = usePathname();
  const [isApiConnected, setIsApiConnected] = useState(true);

  // Exact match for / or grab root path for the rest
  const currentPath = pathname === "/" ? "/" : "/" + pathname.split("/")[1];
  const title = pageTitles[currentPath] || "Overview";

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${baseUrl}/health`);
        setIsApiConnected(res.ok);
      } catch {
        setIsApiConnected(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-background px-6 sticky top-0 z-20">
      <div className="flex items-center text-[13px]">
        <Link href="/" className="text-text-muted font-medium hover:text-text-primary transition-colors">
          ProvenanceAI
        </Link>
        <span className="text-text-secondary mx-2">/</span>
        <span className="text-text-primary font-medium">{title}</span>
      </div>
      
      <div className="flex items-center h-full">
        {/* API Status Indicator */}
        <div className="flex items-center gap-2 mr-4 group" title={isApiConnected ? "API Connected" : "API Disconnected"}>
          <div className="relative flex h-1.5 w-1.5">
            {isApiConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-semantic-success opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isApiConnected ? "bg-semantic-success" : "bg-semantic-danger"}`}></span>
          </div>
          <span className={`text-[12px] font-medium select-none ${isApiConnected ? "text-text-muted" : "text-semantic-danger"}`}>
            {isApiConnected ? "API Connected" : "API Disconnected"}
          </span>
        </div>

        {/* Divider */}
        <div className="w-[1px] h-4 bg-border mr-4" />

        {/* Avatar */}
        <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
      </div>
    </header>
  );
}
