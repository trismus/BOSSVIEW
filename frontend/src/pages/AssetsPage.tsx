import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { PageHelpBanner } from '../components/PageHelpBanner';
import { apiFetch } from '../api/client';
import type { Asset, AssetVulnerability, AssetUserAssignment, PaginatedResponse } from '../types';

type AssetFormData = {
  name: string;
  type: string;
  status: string;
  criticality: string;
  lifecycle_stage: string;
  ip_address: string;
  os: string;
  source: string;
  external_id: string;
  // Location
  location_name: string;
  location_city: string;
  location_country: string;
  // Hardware
  hw_manufacturer: string;
  hw_model: string;
  hw_source_system: string;
  // Tags
  fqdn: string;
  support_l2: string;
  support_l3: string;
  environment: string;
  timezone: string;
  it_provider: string;
  hw_contact: string;
  business_service: string;
  company_name: string;
  company_code: string;
  // Application fields
  app_name: string;
  app_id: string;
  app_confidentiality: string;
  app_integrity: string;
  app_availability: string;
  app_pci_scope: string;
  app_internet_exposure: string;
  app_legal_criticality: string;
  app_contact_email: string;
  app_contact_phone: string;
};

const INITIAL_FORM: AssetFormData = {
  name: '',
  type: 'workstation',
  status: 'active',
  criticality: 'unclassified',
  lifecycle_stage: 'active',
  ip_address: '',
  os: '',
  source: '',
  external_id: '',
  location_name: '',
  location_city: '',
  location_country: '',
  hw_manufacturer: '',
  hw_model: '',
  hw_source_system: '',
  fqdn: '',
  support_l2: '',
  support_l3: '',
  environment: '',
  timezone: '',
  it_provider: '',
  hw_contact: '',
  business_service: '',
  company_name: '',
  company_code: '',
  app_name: '',
  app_id: '',
  app_confidentiality: '',
  app_integrity: '',
  app_availability: '',
  app_pci_scope: '',
  app_internet_exposure: '',
  app_legal_criticality: '',
  app_contact_email: '',
  app_contact_phone: '',
};

const ASSET_TYPES = [
  'workstation',
  'virtual_server',
  'physical_server',
  'network_device',
  'storage',
  'software',
  'license',
  'other',
];
const ASSET_STATUSES = ['active', 'inactive', 'maintenance', 'decommissioned'];
const CRITICALITIES = ['critical', 'high', 'medium', 'low', 'unclassified'];
const LIFECYCLE_STAGES = [
  'planning',
  'procurement',
  'deployment',
  'active',
  'maintenance',
  'decommissioned',
  'disposed',
];

function assetToForm(a: Asset): AssetFormData {
  const loc = (a.location as Record<string, string>) ?? {};
  const hw = (a.hardware_info as Record<string, string>) ?? {};
  const tags = (a.tags as Record<string, string>) ?? {};
  const cf = (a.custom_fields as Record<string, string>) ?? {};
  return {
    name: a.name,
    type: a.type,
    status: a.status,
    criticality: a.criticality,
    lifecycle_stage: a.lifecycle_stage,
    ip_address: a.ip_address ?? '',
    os: a.os ?? '',
    source: a.source ?? '',
    external_id: a.external_id ?? '',
    location_name: loc.name ?? '',
    location_city: loc.city ?? '',
    location_country: loc.country ?? '',
    hw_manufacturer: hw.manufacturer ?? '',
    hw_model: hw.model ?? '',
    hw_source_system: hw.source_system ?? '',
    fqdn: tags.fqdn ?? '',
    support_l2: tags.support_l2 ?? '',
    support_l3: tags.support_l3 ?? '',
    environment: tags.environment ?? '',
    timezone: tags.timezone ?? '',
    it_provider: tags.it_provider ?? '',
    hw_contact: tags.hw_contact ?? '',
    business_service: tags.business_service ?? '',
    company_name: tags.company_name ?? '',
    company_code: tags.company_code ?? '',
    app_name: cf.app_name ?? '',
    app_id: cf.app_id ?? '',
    app_confidentiality: cf.app_confidentiality ?? '',
    app_integrity: cf.app_integrity ?? '',
    app_availability: cf.app_availability ?? '',
    app_pci_scope: cf.app_pci_scope ?? '',
    app_internet_exposure: cf.app_internet_exposure ?? '',
    app_legal_criticality: cf.app_legal_criticality ?? '',
    app_contact_email: cf.app_contact_email ?? '',
    app_contact_phone: cf.app_contact_phone ?? '',
  };
}

function formToBody(f: AssetFormData) {
  return {
    name: f.name,
    type: f.type,
    status: f.status,
    criticality: f.criticality,
    lifecycle_stage: f.lifecycle_stage,
    ip_address: f.ip_address || null,
    os: f.os || null,
    source: f.source || null,
    external_id: f.external_id || null,
    location: {
      name: f.location_name || null,
      city: f.location_city || null,
      country: f.location_country || null,
    },
    hardware_info: {
      manufacturer: f.hw_manufacturer || null,
      model: f.hw_model || null,
      source_system: f.hw_source_system || null,
    },
    tags: {
      fqdn: f.fqdn || null,
      support_l2: f.support_l2 || null,
      support_l3: f.support_l3 || null,
      environment: f.environment || null,
      timezone: f.timezone || null,
      it_provider: f.it_provider || null,
      hw_contact: f.hw_contact || null,
      business_service: f.business_service || null,
      company_name: f.company_name || null,
      company_code: f.company_code || null,
    },
    custom_fields: {
      app_name: f.app_name || null,
      app_id: f.app_id || null,
      app_confidentiality: f.app_confidentiality || null,
      app_integrity: f.app_integrity || null,
      app_availability: f.app_availability || null,
      app_pci_scope: f.app_pci_scope || null,
      app_internet_exposure: f.app_internet_exposure || null,
      app_legal_criticality: f.app_legal_criticality || null,
      app_contact_email: f.app_contact_email || null,
      app_contact_phone: f.app_contact_phone || null,
    },
  };
}

export function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetFormData>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'general' | 'location' | 'tags' | 'application' | 'vulnerabilities' | 'users'
  >('general');
  const [assetVulns, setAssetVulns] = useState<AssetVulnerability[]>([]);
  const [isLoadingVulns, setIsLoadingVulns] = useState(false);
  const [assetUsers, setAssetUsers] = useState<AssetUserAssignment[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        sort: 'name',
        order: 'asc',
      });
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);
      const data = await apiFetch<PaginatedResponse<Asset>>(`/assets?${params}`);
      setAssets(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filterStatus, filterType]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const openCreateDialog = () => {
    setEditingAsset(null);
    setForm(INITIAL_FORM);
    setActiveTab('general');
    setAssetVulns([]);
    setAssetUsers([]);
    setShowDialog(true);
  };
  const openEditDialog = async (asset: Asset) => {
    setEditingAsset(asset);
    setForm(assetToForm(asset));
    setActiveTab('general');
    setShowDialog(true);
    // Fetch vulnerabilities for this asset
    setIsLoadingVulns(true);
    try {
      const detail = await apiFetch<{ data: Asset & { vulnerabilities: AssetVulnerability[] } }>(
        `/assets/${asset.id}`,
      );
      setAssetVulns(detail.data.vulnerabilities ?? []);
    } catch (err) {
      console.warn('Failed to load asset vulnerabilities:', err);
      setAssetVulns([]);
    } finally {
      setIsLoadingVulns(false);
    }
    // Fetch assigned users for this asset
    setIsLoadingUsers(true);
    try {
      const usersData = await apiFetch<{ data: AssetUserAssignment[] }>(
        `/assets/${asset.id}/users`,
      );
      setAssetUsers(usersData.data ?? []);
    } catch (err) {
      console.warn('Failed to load asset users:', err);
      setAssetUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const body = formToBody(form);
      if (editingAsset) {
        await apiFetch(`/assets/${editingAsset.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/assets', { method: 'POST', body: JSON.stringify(body) });
      }
      setShowDialog(false);
      fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!window.confirm(`Delete asset "${asset.name}"?`)) return;
    try {
      await apiFetch(`/assets/${asset.id}`, { method: 'DELETE' });
      fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-500/20 text-emerald-400',
      inactive: 'bg-slate-500/20 text-slate-400',
      maintenance: 'bg-amber-500/20 text-amber-400',
      decommissioned: 'bg-red-500/20 text-red-400',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-slate-500/20 text-slate-400'}`}
      >
        {status}
      </span>
    );
  };

  const criticalityBadge = (criticality: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-400',
      high: 'bg-orange-500/20 text-orange-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-green-500/20 text-green-400',
      unclassified: 'bg-slate-500/20 text-slate-400',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[criticality] ?? 'bg-slate-500/20 text-slate-400'}`}
      >
        {criticality}
      </span>
    );
  };

  const f = (key: keyof AssetFormData, value: string) => setForm({ ...form, [key]: value });

  const inputClass =
    'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const selectClass = inputClass;
  const labelClass = 'block text-xs font-medium text-slate-400 mb-1';

  const TextInput = ({
    label,
    field,
    placeholder,
    readOnly,
  }: {
    label: string;
    field: keyof AssetFormData;
    placeholder?: string;
    readOnly?: boolean;
  }) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type="text"
        value={form[field]}
        onChange={(e) => f(field, e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`${inputClass} ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
    </div>
  );

  const SelectInput = ({
    label,
    field,
    options,
  }: {
    label: string;
    field: keyof AssetFormData;
    options: string[];
  }) => (
    <div>
      <label className={labelClass}>{label}</label>
      <select
        value={form[field]}
        onChange={(e) => f(field, e.target.value)}
        className={selectClass}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHelpBanner
        pageKey="assets"
        title="Asset Management"
        description="Import assets via CSV or sync from KACE/JAMF connectors. Click any asset for details."
        learnMoreSection="assets"
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {ASSET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={openCreateDialog}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Asset
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}{' '}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 bg-slate-800/50">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">FQDN</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Criticality</th>
                <th className="text-left px-3 py-2 font-medium">IP Address</th>
                <th className="text-left px-3 py-2 font-medium">OS</th>
                <th className="text-left px-3 py-2 font-medium">Manufacturer</th>
                <th className="text-left px-3 py-2 font-medium">Data Center</th>
                <th className="text-left px-3 py-2 font-medium">Source</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />{' '}
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    No assets found
                  </td>
                </tr>
              ) : (
                assets.map((asset, i) => {
                  const tags = (asset.tags as Record<string, string>) ?? {};
                  const hw = (asset.hardware_info as Record<string, string>) ?? {};
                  const loc = (asset.location as Record<string, string>) ?? {};
                  return (
                    <tr
                      key={asset.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${i % 2 === 0 ? 'bg-slate-800/40' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium text-slate-200">{asset.name}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono">{tags.fqdn ?? '-'}</td>
                      <td className="px-3 py-2 text-slate-300 capitalize">
                        {asset.type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-3 py-2">{statusBadge(asset.status)}</td>
                      <td className="px-3 py-2">{criticalityBadge(asset.criticality)}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono">
                        {asset.ip_address ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-400 max-w-[150px] truncate">
                        {asset.os ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{hw.manufacturer ?? '-'}</td>
                      <td className="px-3 py-2 text-slate-400">{loc.name ?? '-'}</td>
                      <td className="px-3 py-2 text-slate-400">{asset.source ?? '-'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEditDialog(asset)}
                          className="text-blue-400 hover:text-blue-300 text-xs mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(asset)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              {total} asset{total !== 1 ? 's' : ''} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-slate-300"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog with Tabs */}
      {showDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onKeyDown={(e) => e.key === 'Escape' && setShowDialog(false)}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-200 mb-4">
                {editingAsset ? 'Edit Asset' : 'Create Asset'}
              </h2>

              {/* Tabs */}
              <div className="flex gap-1 mb-6 border-b border-slate-700 overflow-x-auto">
                {(
                  [
                    'general',
                    'location',
                    'tags',
                    'application',
                    ...(editingAsset ? ['vulnerabilities' as const, 'users' as const] : []),
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                  >
                    {tab === 'general'
                      ? 'General'
                      : tab === 'location'
                        ? 'Location & Hardware'
                        : tab === 'tags'
                          ? 'Tags & Support'
                          : tab === 'application'
                            ? 'Application'
                            : tab === 'vulnerabilities'
                              ? `Vulnerabilities (${assetVulns.length})`
                              : `Users (${assetUsers.length})`}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* General Tab */}
                {activeTab === 'general' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <TextInput label="Name *" field="name" placeholder="e.g. lidozrhv193" />
                      <TextInput
                        label="FQDN"
                        field="fqdn"
                        placeholder="e.g. lidozrhv193.lidozrh.ch"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <SelectInput label="Type" field="type" options={ASSET_TYPES} />
                      <SelectInput label="Status" field="status" options={ASSET_STATUSES} />
                      <SelectInput
                        label="Criticality"
                        field="criticality"
                        options={CRITICALITIES}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <SelectInput
                        label="Lifecycle Stage"
                        field="lifecycle_stage"
                        options={LIFECYCLE_STAGES}
                      />
                      <TextInput
                        label="IP Address"
                        field="ip_address"
                        placeholder="e.g. 10.237.89.133"
                      />
                    </div>
                    <TextInput
                      label="Operating System"
                      field="os"
                      placeholder="e.g. Microsoft Windows 11 Enterprise x64"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <TextInput label="Source" field="source" placeholder="e.g. quest-kace" />
                      <TextInput
                        label="External ID"
                        field="external_id"
                        placeholder="e.g. KACE-12345"
                      />
                    </div>
                  </>
                )}

                {/* Location & Hardware Tab */}
                {activeTab === 'location' && (
                  <>
                    <p className="text-xs text-slate-500 mb-2">Location</p>
                    <div className="grid grid-cols-3 gap-4">
                      <TextInput
                        label="Data Center"
                        field="location_name"
                        placeholder="e.g. LSYFN Atlas Edge (Nugolo)"
                      />
                      <TextInput label="City" field="location_city" placeholder="e.g. ZRH" />
                      <TextInput label="Country" field="location_country" placeholder="e.g. CH" />
                    </div>
                    <p className="text-xs text-slate-500 mb-2 mt-4">Hardware</p>
                    <div className="grid grid-cols-3 gap-4">
                      <TextInput
                        label="Manufacturer"
                        field="hw_manufacturer"
                        placeholder="e.g. Dell Inc."
                      />
                      <TextInput
                        label="Model"
                        field="hw_model"
                        placeholder="e.g. Precision T3610"
                      />
                      <TextInput
                        label="Source System"
                        field="hw_source_system"
                        placeholder="e.g. VMware Virtual Platform"
                      />
                    </div>
                  </>
                )}

                {/* Tags & Support Tab */}
                {activeTab === 'tags' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <TextInput
                        label="2nd Level Support"
                        field="support_l2"
                        placeholder="e.g. it_zrh@lhsystems.com"
                      />
                      <TextInput
                        label="3rd Level Support"
                        field="support_l3"
                        placeholder="e.g. team Product/ownership"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <TextInput label="Environment" field="environment" placeholder="e.g. Prod" />
                      <TextInput
                        label="Timezone"
                        field="timezone"
                        placeholder="e.g. Europe/Berlin"
                      />
                      <TextInput
                        label="Business Service"
                        field="business_service"
                        placeholder="e.g. Quest KACE"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <TextInput
                        label="IT Provider"
                        field="it_provider"
                        placeholder="e.g. LSYFN IT Infrastructure"
                      />
                      <TextInput
                        label="HW Contact"
                        field="hw_contact"
                        placeholder="e.g. it_zrh@lhsystems.com"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <TextInput
                        label="Company Name"
                        field="company_name"
                        placeholder="e.g. Lufthansa Systems FlightNav AG"
                      />
                      <TextInput
                        label="Company Code"
                        field="company_code"
                        placeholder="e.g. LSY FN"
                      />
                    </div>
                  </>
                )}

                {/* Application Tab */}
                {activeTab === 'application' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <TextInput
                        label="Application Name"
                        field="app_name"
                        placeholder="e.g. LSYFN Kairos Application"
                      />
                      <TextInput
                        label="Application ID"
                        field="app_id"
                        placeholder="e.g. APP-20390"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mb-2 mt-4">CIA Triad</p>
                    <div className="grid grid-cols-3 gap-4">
                      <TextInput label="Confidentiality" field="app_confidentiality" />
                      <TextInput label="Integrity" field="app_integrity" />
                      <TextInput label="Availability" field="app_availability" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <TextInput label="PCI Scope" field="app_pci_scope" />
                      <TextInput label="Internet Exposure" field="app_internet_exposure" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <TextInput label="Legal Criticality" field="app_legal_criticality" />
                      <TextInput label="Contact Email" field="app_contact_email" />
                    </div>
                    <TextInput label="Contact Phone" field="app_contact_phone" />
                  </>
                )}

                {/* Vulnerabilities Tab (read-only, only in edit mode) */}
                {activeTab === 'vulnerabilities' && editingAsset && (
                  <>
                    {isLoadingVulns ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="ml-2 text-sm text-slate-400">
                          Loading vulnerabilities...
                        </span>
                      </div>
                    ) : assetVulns.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-sm">
                        No vulnerabilities linked to this asset
                      </div>
                    ) : (
                      <>
                        {/* Summary bar */}
                        <div className="flex gap-4 mb-4">
                          <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg">
                            <span className="text-xs text-slate-400">Total</span>
                            <span className="text-sm font-semibold text-slate-200">
                              {assetVulns.length}
                            </span>
                          </div>
                          {assetVulns.filter((v) => v.severity === 'critical').length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                              <span className="text-xs text-red-400">Critical</span>
                              <span className="text-sm font-semibold text-red-400">
                                {assetVulns.filter((v) => v.severity === 'critical').length}
                              </span>
                            </div>
                          )}
                          {assetVulns.filter((v) => v.severity === 'high').length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                              <span className="text-xs text-orange-400">High</span>
                              <span className="text-sm font-semibold text-orange-400">
                                {assetVulns.filter((v) => v.severity === 'high').length}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Vulnerability table */}
                        <div className="border border-slate-700 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-700 text-slate-400 bg-slate-800/50">
                                <th className="text-left px-3 py-2 font-medium">Severity</th>
                                <th className="text-left px-3 py-2 font-medium">Title</th>
                                <th className="text-left px-3 py-2 font-medium">Status</th>
                                <th className="text-left px-3 py-2 font-medium">Category</th>
                                <th className="text-right px-3 py-2 font-medium">Hosts</th>
                                <th className="text-left px-3 py-2 font-medium">Remediation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assetVulns.map((vuln, i) => {
                                const sevColors: Record<string, string> = {
                                  critical: 'bg-red-500/20 text-red-400',
                                  high: 'bg-orange-500/20 text-orange-400',
                                  medium: 'bg-yellow-500/20 text-yellow-400',
                                  low: 'bg-green-500/20 text-green-400',
                                };
                                const statusColors: Record<string, string> = {
                                  open: 'bg-red-500/20 text-red-400',
                                  fixed: 'bg-emerald-500/20 text-emerald-400',
                                  ignored: 'bg-slate-500/20 text-slate-400',
                                  accepted: 'bg-amber-500/20 text-amber-400',
                                };
                                const isUrl =
                                  vuln.remediation &&
                                  (vuln.remediation.startsWith('http://') ||
                                    vuln.remediation.startsWith('https://'));
                                return (
                                  <tr
                                    key={vuln.id}
                                    className={`border-b border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-800/40' : ''}`}
                                  >
                                    <td className="px-3 py-2">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${sevColors[vuln.severity] ?? 'bg-slate-500/20 text-slate-400'}`}
                                      >
                                        {vuln.severity}
                                      </span>
                                    </td>
                                    <td
                                      className="px-3 py-2 text-slate-200 max-w-[250px] truncate"
                                      title={vuln.title}
                                    >
                                      {vuln.title}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[vuln.status] ?? 'bg-slate-500/20 text-slate-400'}`}
                                      >
                                        {vuln.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-slate-400">
                                      {vuln.category ?? '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-300 font-mono">
                                      {vuln.affected_hosts}
                                    </td>
                                    <td className="px-3 py-2">
                                      {isUrl ? (
                                        <a
                                          href={vuln.remediation!}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                                        >
                                          Link
                                          <svg
                                            className="w-3 h-3"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                            />
                                          </svg>
                                        </a>
                                      ) : (
                                        <span className="text-slate-500">
                                          {vuln.remediation ?? '-'}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Users Tab (read-only, only in edit mode) */}
                {activeTab === 'users' && editingAsset && (
                  <>
                    {isLoadingUsers ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="ml-2 text-sm text-slate-400">Loading users...</span>
                      </div>
                    ) : assetUsers.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-sm">
                        No users assigned to this asset
                      </div>
                    ) : (
                      <div className="border border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-700 text-slate-400 bg-slate-800/50">
                              <th className="text-left px-3 py-2 font-medium">Username</th>
                              <th className="text-left px-3 py-2 font-medium">Full Name</th>
                              <th className="text-left px-3 py-2 font-medium">Email</th>
                              <th className="text-left px-3 py-2 font-medium">Department</th>
                              <th className="text-left px-3 py-2 font-medium">Role</th>
                              <th className="text-left px-3 py-2 font-medium">Last Seen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assetUsers.map((u, i) => {
                              const roleColors: Record<string, string> = {
                                primary_user: 'bg-blue-500/20 text-blue-400',
                                last_user: 'bg-slate-500/20 text-slate-400',
                                owner: 'bg-purple-500/20 text-purple-400',
                                admin: 'bg-amber-500/20 text-amber-400',
                              };
                              return (
                                <tr
                                  key={`${u.username}-${u.assignment_type}`}
                                  className={`border-b border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-800/40' : ''}`}
                                >
                                  <td className="px-3 py-2 font-medium text-slate-200">
                                    {u.username}
                                  </td>
                                  <td className="px-3 py-2 text-slate-300">{u.full_name || '-'}</td>
                                  <td className="px-3 py-2 text-slate-400">{u.email || '-'}</td>
                                  <td className="px-3 py-2 text-slate-400">
                                    {u.department || '-'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[u.assignment_type] ?? 'bg-slate-500/20 text-slate-400'}`}
                                    >
                                      {u.assignment_type.replace(/_/g, ' ')}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-slate-500">
                                    {u.last_seen_at
                                      ? new Date(u.last_seen_at).toLocaleString('de-CH', {
                                          dateStyle: 'medium',
                                          timeStyle: 'short',
                                        })
                                      : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowDialog(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {isSaving ? 'Saving...' : editingAsset ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
