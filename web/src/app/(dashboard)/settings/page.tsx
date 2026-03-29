import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full py-24 animate-in fade-in duration-300">
      <div className="bg-surface border border-border shadow-sm p-8 rounded-[12px] flex flex-col items-center max-w-sm text-center">
        <div className="w-12 h-12 bg-surface-raised rounded-full flex items-center justify-center mb-4 border border-border">
          <Settings size={24} className="text-text-secondary" />
        </div>
        <h2 className="text-[16px] font-medium text-text-primary mb-2">Settings</h2>
        <h3 className="text-[14px] font-medium text-text-secondary mb-2">Coming Soon</h3>
        <p className="text-[13px] text-text-muted leading-relaxed">
          Global application configurations and user preference settings will arrive in a future update.
        </p>
      </div>
    </div>
  );
}
