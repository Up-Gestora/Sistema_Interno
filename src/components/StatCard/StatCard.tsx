import './StatCard.css';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <h4 className="stat-title">{title}</h4>
        {icon && <div className="stat-icon">{icon}</div>}
      </div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
      {trend && (
        <div className={`stat-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </div>
      )}
    </div>
  );
}

