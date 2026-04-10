import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { DataTable, DataTableColumn } from '../DataTable';
import { StatusBadge } from '../StatusBadge';

interface Asset {
  id: string;
  name: string;
  ip: string;
  type: string;
  status: 'online' | 'offline' | 'maintenance';
  lastSeen: string;
}

const sampleData: Asset[] = Array.from({ length: 50 }, (_, i) => ({
  id: `asset-${i + 1}`,
  name: `server-${String(i + 1).padStart(3, '0')}.prod`,
  ip: `192.168.${Math.floor(i / 255)}.${i % 255 + 1}`,
  type: ['Server', 'Switch', 'Firewall', 'Workstation'][i % 4],
  status: ['online', 'offline', 'maintenance'][i % 3] as Asset['status'],
  lastSeen: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString().split('T')[0],
}));

const columns: DataTableColumn<Asset>[] = [
  { id: 'name', header: 'Asset Name', accessor: 'name', sortable: true },
  { id: 'ip', header: 'IP Address', accessor: 'ip', sortable: true, width: 140 },
  { id: 'type', header: 'Type', accessor: 'type', sortable: true, width: 120 },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    sortable: true,
    width: 120,
    cell: (value) => {
      const statusMap = {
        online: 'success',
        offline: 'critical',
        maintenance: 'warning',
      } as const;
      return (
        <StatusBadge status={statusMap[value as Asset['status']]} size="sm">
          {(value as string).toUpperCase()}
        </StatusBadge>
      );
    },
  },
  { id: 'lastSeen', header: 'Last Seen', accessor: 'lastSeen', sortable: true, width: 120 },
];

const meta = {
  title: 'UI/DataTable',
  component: DataTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'SKYNEX DataTable with JetBrains Mono, sorting, and selection. Heart of the CMDB.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Table
export const Basic: Story = {
  args: {
    columns,
    rows: sampleData.slice(0, 10),
  },
};

// With Sorting
export const WithSorting: Story = {
  render: () => {
    const [sortState, setSortState] = useState({ columnId: 'name', direction: 'asc' as const });
    return (
      <DataTable
        columns={columns}
        rows={sampleData.slice(0, 20)}
        sortState={sortState}
        onSortChange={setSortState}
      />
    );
  },
};

// With Selection
export const WithSelection: Story = {
  render: () => {
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
    return (
      <div>
        <p className="text-body-sm text-on-surface-dim mb-4">
          Selected: {selectedIds.size} items
        </p>
        <DataTable
          columns={columns}
          rows={sampleData.slice(0, 15)}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </div>
    );
  },
};

// Loading State
export const Loading: Story = {
  args: {
    columns,
    rows: [],
    loading: true,
  },
};

// Empty State
export const Empty: Story = {
  args: {
    columns,
    rows: [],
    emptyMessage: 'No assets found matching your criteria',
  },
};

// Full Featured (200 rows)
export const FullFeatured: Story = {
  render: () => {
    const [sortState, setSortState] = useState({ columnId: '', direction: null as const });
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

    // Generate 200 rows
    const manyRows: Asset[] = Array.from({ length: 200 }, (_, i) => ({
      id: `asset-${i + 1}`,
      name: `server-${String(i + 1).padStart(3, '0')}.${['prod', 'dev', 'staging'][i % 3]}`,
      ip: `10.${Math.floor(i / 256)}.${i % 256}.${(i * 7) % 256}`,
      type: ['Server', 'Switch', 'Firewall', 'Workstation', 'VM'][i % 5],
      status: ['online', 'offline', 'maintenance'][i % 3] as Asset['status'],
      lastSeen: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString().split('T')[0],
    }));

    return (
      <div className="h-[500px]">
        <p className="text-body-sm text-on-surface-dim mb-2">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : '200 assets'} | Shift+click for range select
        </p>
        <DataTable
          columns={columns}
          rows={manyRows}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          sortState={sortState}
          onSortChange={setSortState}
          stickyHeader
          className="h-[450px]"
        />
      </div>
    );
  },
};

// Row Click
export const RowClick: Story = {
  render: () => (
    <DataTable
      columns={columns}
      rows={sampleData.slice(0, 10)}
      onRowClick={(row) => alert(`Clicked: ${row.name}`)}
    />
  ),
};
