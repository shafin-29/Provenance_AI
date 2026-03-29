"use client";

import { useSidebar } from "../context/SidebarContext";
import { Header } from "./Header";

export function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <div 
      className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-in-out ${
        isCollapsed ? "ml-[64px]" : "ml-[220px]"
      }`}
    >
      <Header />
      <main className="flex-1 overflow-y-auto bg-background p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
