export type KpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'warn' | 'bad';
};

const toneClasses = {
  default: 'border-slate-200',
  warn: 'border-amber-300 bg-amber-50',
  bad: 'border-red-300 bg-red-50',
} as const;

export function KpiCard({ label, value, hint, tone = 'default' }: KpiCardProps) {
  return (
    <div className={`rounded-lg border bg-white p-4 ${toneClasses[tone]}`}>
      <p className="text-xs tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
