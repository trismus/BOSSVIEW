import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';
import { KPICard } from '../components/KPICard';
import { useWebSocket } from '../hooks/useWebSocket';
import type { DashboardKPIs } from '../types';

export function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { on } = useWebSocket();

  const fetchKPIs = useCallback(async () => {
    try {
      const data = await apiFetch<{ data: DashboardKPIs }>('/dashboard/kpis');
      setKpis(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  // Auto-refresh when KPIs are updated via WebSocket
  useEffect(() => {
    const unsubscribe = on('kpi:updated', () => {
      fetchKPIs();
    });
    return unsubscribe;
  }, [on, fetchKPIs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
        {error}
      </div>
    );
  }

  if (!kpis) return null;

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Assets" value={kpis.total_assets} color="blue" />
        <KPICard
          title="Active"
          value={kpis.assets_by_status.active ?? 0}
          subtitle="Currently operational"
          color="green"
        />
        <KPICard
          title="Maintenance"
          value={kpis.assets_by_status.maintenance ?? 0}
          subtitle="Under maintenance"
          color="yellow"
        />
        <KPICard
          title="Changes (24h)"
          value={kpis.recent_changes}
          subtitle="Audit log entries"
          color="purple"
        />
      </div>

      {/* Vulnerability KPIs (if available) */}
      {kpis.vulns_total !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            title="Open Vulns"
            value={kpis.vulns_total}
            subtitle={`${kpis.vulns_high ?? 0} high severity`}
            color="purple"
          />
          <KPICard
            title="Critical Vulns"
            value={kpis.vulns_critical ?? 0}
            subtitle="Immediate attention required"
            color="red"
          />
          <KPICard
            title="Affected Hosts"
            value={kpis.affected_host_rate ?? '-'}
            subtitle="173 of 247 workstations"
            color="yellow"
          />
        </div>
      )}

      {/* Breakdown sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets by Type */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">Assets by Type</h3>
          <div className="space-y-3">
            {Object.entries(kpis.assets_by_type).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm text-slate-300 capitalize">
                    {type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((count / kpis.total_assets) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-400 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assets by Criticality */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">Assets by Criticality</h3>
          <div className="space-y-3">
            {Object.entries(kpis.assets_by_criticality).map(([criticality, count]) => {
              const colorMap: Record<string, string> = {
                critical: 'bg-red-500',
                high: 'bg-orange-500',
                medium: 'bg-yellow-500',
                low: 'bg-green-500',
                unclassified: 'bg-slate-500',
              };
              return (
                <div key={criticality} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${colorMap[criticality] ?? 'bg-slate-500'}`}
                    />
                    <span className="text-sm text-slate-300 capitalize">{criticality}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-700 rounded-full h-2">
                      <div
                        className={`${colorMap[criticality] ?? 'bg-slate-500'} h-2 rounded-full transition-all`}
                        style={{ width: `${Math.min((count / kpis.total_assets) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-400 w-8 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status overview */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Status Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(kpis.assets_by_status).map(([status, count]) => {
            const statusColors: Record<string, string> = {
              active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
              inactive: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
              maintenance: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
              decommissioned: 'text-red-400 bg-red-500/10 border-red-500/30',
            };
            return (
              <div
                key={status}
                className={`rounded-lg border p-4 text-center ${statusColors[status] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/30'}`}
              >
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm capitalize mt-1">{status}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
