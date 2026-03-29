interface PageHeaderProps {
  title: string;
  subtitle: string;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8 flex flex-col gap-1">
      <h1 className="text-[20px] font-semibold text-text-primary">{title}</h1>
      <p className="text-[13px] font-normal text-text-secondary">{subtitle}</p>
    </div>
  );
}
