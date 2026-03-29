import { Workflow } from "lucide-react";

export default function PipelinesPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full py-24 animate-in fade-in duration-300">
      <div className="bg-surface border border-border shadow-sm p-8 rounded-[12px] flex flex-col items-center max-w-sm text-center">
        <div className="w-12 h-12 bg-accent-bg rounded-full flex items-center justify-center mb-4 border border-accent-border">
          <Workflow size={24} className="text-accent-primary" />
        </div>
        <h2 className="text-[16px] font-medium text-text-primary mb-2">Pipelines</h2>
        <h3 className="text-[14px] font-medium text-text-secondary mb-2">Coming Soon</h3>
        <p className="text-[13px] text-text-muted leading-relaxed">
          Pipeline run history and multi-pipeline management will be available in a future release.
        </p>
      </div>
    </div>
  );
}
