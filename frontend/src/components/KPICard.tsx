interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const colorMap = {
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  green: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  yellow: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  red: 'bg-red-500/10 border-red-500/30 text-red-400',
  purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
};

export function KPICard({ title, value, subtitle, color = 'blue' }: KPICardProps) {
  return (
    <div className={`rounded-lg border p-6 ${colorMap[color]}`}>
      <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}
