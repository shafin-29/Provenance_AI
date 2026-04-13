"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ShieldCheck, AlertOctagon, Lock, Activity,
  Database, Terminal, Bell, GitBranch,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useUser, UserButton, useAuth } from "@clerk/nextjs";
import { useSidebar } from "../context/SidebarContext";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badgeKey?: "incidents" | "quarantine";
  legacyLabel?: string;
}

interface NavSection {
  label: string;
  collapsible?: boolean;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "",
    items: [
      { href: "/shield", label: "Shield Status", icon: ShieldCheck },
    ],
  },
  {
    label: "INCIDENTS",
    items: [
      { href: "/incidents", label: "Incidents", icon: AlertOctagon, badgeKey: "incidents" },
      { href: "/quarantine", label: "Quarantine", icon: Lock, badgeKey: "quarantine" },
    ],
  },
  {
    label: "PIPELINE",
    items: [
      { href: "/pipeline", label: "Live Pipeline", icon: Activity },
      { href: "/sources", label: "Sources", icon: Database },
    ],
  },
  {
    label: "SETUP",
    items: [
      { href: "/sdk", label: "SDK Setup", icon: Terminal },
      { href: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "DEBUG",
    collapsible: true,
    items: [
      { href: "/trace", label: "Trace Explorer", icon: GitBranch, legacyLabel: "Legacy" },
    ],
  },
];

export function Sidebar() {
  const { getToken } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  // Badge counts
  const [incidentCount, setIncidentCount] = useState(0);
  const [quarantineCount, setQuarantineCount] = useState(0);

  // Determine active label from pathname
  useEffect(() => {
    const matchingItems = sections
      .flatMap((s) => s.items)
      .filter(
        (i) =>
          pathname === i.href ||
          (i.href !== "/" && pathname.startsWith(i.href))
      );

    const isCurrentStillValid = matchingItems.some(
      (i) => i.label === activeLabel
    );

    if (!isCurrentStillValid && matchingItems.length > 0) {
      setActiveLabel(matchingItems[0].label);
    } else if (matchingItems.length === 0) {
      setActiveLabel(null);
    }
  }, [pathname, activeLabel]);

  // Fetch badge counts every 60s
  const fetchBadges = useCallback(async () => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const token = await getToken();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [incRes, quarRes] = await Promise.allSettled([
        fetch(`${baseUrl}/api/incidents/stats`, { headers }),
        fetch(`${baseUrl}/api/quarantine`, { headers }),
      ]);

      if (incRes.status === "fulfilled" && incRes.value.ok) {
        const data = await incRes.value.json();
        setIncidentCount(data.activeIncidents ?? 0);
      }
      if (quarRes.status === "fulfilled" && quarRes.value.ok) {
        const data = await quarRes.value.json();
        setQuarantineCount(Array.isArray(data) ? data.length : 0);
      }
    } catch {
      // silently ignore badge fetch failures
    }
  }, [getToken]);

  useEffect(() => {
    fetchBadges();
    const interval = setInterval(fetchBadges, 60000);
    return () => clearInterval(interval);
  }, [fetchBadges]);

  const getBadgeCount = (key?: "incidents" | "quarantine") => {
    if (key === "incidents") return incidentCount;
    if (key === "quarantine") return quarantineCount;
    return 0;
  };

  const getBadgeColor = (key?: "incidents" | "quarantine") => {
    if (key === "incidents") return "bg-[#EF4444]";
    if (key === "quarantine") return "bg-[#F59E0B]";
    return "bg-[#EF4444]";
  };

  return (
    <>
      <div
        className={`flex flex-col border-r border-border-subtle bg-background shrink-0 fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-[64px]" : "w-[220px]"
        }`}
      >
        {/* Top section - Logo & Toggle */}
        <div className="flex items-center justify-between p-4 h-[64px] border-b border-border-subtle overflow-hidden">
          <Link
            href="/"
            className="flex items-center gap-2.5 outline-none group shrink-0"
          >
            <div
              className={`relative transition-all duration-300 ${
                isCollapsed ? "w-8 h-8" : "w-7 h-7"
              }`}
            >
              <Image
                src="/pro_logo.png"
                alt="ProvenanceAI Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-[15px] text-text-primary tracking-tight animate-in fade-in slide-in-from-left-2 duration-300">
                ProvenanceAI
              </span>
            )}
          </Link>

          <button
            onClick={toggleSidebar}
            className={`absolute right-[-12px] top-6 w-6 h-6 bg-surface border border-border rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:border-border-subtle shadow-sm z-50 transition-transform ${
              isCollapsed ? "translate-x-[6px]" : ""
            }`}
          >
            {isCollapsed ? (
              <ChevronRight size={12} />
            ) : (
              <ChevronLeft size={12} />
            )}
          </button>
        </div>

        {/* Navigation sections */}
        <nav className="flex flex-col flex-1 overflow-y-auto py-6 no-scrollbar">
          {sections.map((section, idx) => {
            const isDebug = section.collapsible;
            const isOpen = !isDebug || debugOpen;

            return (
              <div key={idx} className={idx > 0 ? "mt-6" : ""}>
                {section.label && !isCollapsed && (
                  <div className="flex items-center justify-between px-6 mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted select-none animate-in fade-in duration-300">
                      {section.label}
                    </div>
                    {isDebug && (
                      <button
                        onClick={() => setDebugOpen(!debugOpen)}
                        className="text-text-muted hover:text-text-primary transition-colors"
                      >
                        {debugOpen ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )}
                      </button>
                    )}
                  </div>
                )}

                {isOpen && (
                  <div
                    className={`flex flex-col gap-[4px] ${
                      isCollapsed ? "px-2" : "px-3"
                    }`}
                  >
                    {section.items.map((item) => {
                      const isActive = activeLabel === item.label;
                      const Icon = item.icon;
                      const badgeVal = getBadgeCount(item.badgeKey);
                      const badgeColor = getBadgeColor(item.badgeKey);

                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={() => setActiveLabel(item.label)}
                          title={isCollapsed ? item.label : ""}
                          className={`flex items-center rounded-lg h-9 transition-all duration-200 relative group ${
                            isActive
                              ? "bg-accent-primary/10 text-accent-primary"
                              : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                          } ${
                            isCollapsed
                              ? "justify-center px-0 mx-0"
                              : "px-3 mx-0 gap-3"
                          }`}
                        >
                          {isActive && (
                            <div className="absolute left-[-12px] top-2 bottom-2 w-[3px] bg-accent-primary rounded-r-full" />
                          )}

                          <Icon
                            size={isCollapsed ? 18 : 16}
                            className={`shrink-0 transition-colors ${
                              isActive
                                ? "text-accent-primary"
                                : "text-text-muted group-hover:text-text-primary"
                            }`}
                          />

                          {!isCollapsed && (
                            <span className="text-[13.5px] font-medium truncate animate-in fade-in slide-in-from-left-1 duration-200">
                              {item.label}
                            </span>
                          )}

                          {/* Legacy label */}
                          {!isCollapsed && item.legacyLabel && (
                            <span className="text-[10px] text-text-muted bg-surface-raised px-1.5 py-0.5 rounded ml-auto">
                              {item.legacyLabel}
                            </span>
                          )}

                          {/* Badge — fixed width container to prevent layout shift */}
                          {item.badgeKey && (
                            <span
                              className={`absolute ${
                                isCollapsed ? "top-1 right-1" : "right-3"
                              } h-4 min-w-[16px] flex items-center justify-center px-1 rounded-full border-2 border-background text-white text-[9px] font-bold transition-opacity ${
                                badgeVal > 0
                                  ? `${badgeColor} opacity-100`
                                  : "opacity-0"
                              }`}
                            >
                              {badgeVal > 0 ? badgeVal : ""}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom section (pinned) */}
        <div
          className={`p-3 border-t border-border-subtle bg-background/50 backdrop-blur-sm mt-auto transition-all ${
            isCollapsed ? "px-2" : "px-4"
          }`}
        >
          <div className="flex flex-col gap-1">
            {isLoaded && user && (
              <div
                className={`flex items-center transition-all ${
                  isCollapsed
                    ? "justify-center py-2 px-0"
                    : "gap-3 py-3 px-2 mb-2 bg-surface-raised/50 rounded-xl border border-border/50"
                }`}
              >
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: isCollapsed ? "w-8 h-8" : "w-9 h-9",
                    },
                  }}
                />
                {!isCollapsed && (
                  <div className="flex flex-col overflow-hidden animate-in fade-in duration-300">
                    <span className="text-[12.5px] font-semibold text-text-primary truncate">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="text-[11px] text-text-muted truncate">
                      {user.primaryEmailAddress?.emailAddress}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
