import type { Meta, StoryObj } from '@storybook/react';
import { KPIWidget } from '../KPIWidget';

const meta = {
  title: 'UI/KPIWidget',
  component: KPIWidget,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'SKYNEX KPI Widget with sparkline and delta indicator. Central dashboard element.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['success', 'warning', 'error', 'info'],
    },
  },
} satisfies Meta<typeof KPIWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic KPI
export const Basic: Story = {
  args: {
    label: 'Total Assets',
    value: '2,847',
  },
};

// With Delta
export const WithDelta: Story = {
  args: {
    label: 'Active Incidents',
    value: '12',
    delta: -3,
  },
};

// With Sparkline
export const WithSparkline: Story = {
  args: {
    label: 'Availability',
    value: '99.97',
    unit: '%',
    delta: 0.02,
    sparklineData: [99.2, 99.5, 99.8, 99.6, 99.9, 99.95, 99.97],
  },
};

// With Status
export const WithStatus: Story = {
  args: {
    label: 'System Health',
    value: 'HEALTHY',
    status: 'success',
    showStatusDot: true,
  },
};

// Critical Status
export const CriticalStatus: Story = {
  args: {
    label: 'Critical Alerts',
    value: '5',
    delta: 2,
    status: 'error',
    showStatusDot: true,
  },
};

// Dashboard Grid (6 KPIs)
export const DashboardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 w-[800px]">
      <KPIWidget
        label="Total Assets"
        value="2,847"
        delta={47}
        sparklineData={[2700, 2750, 2780, 2810, 2830, 2847]}
      />
      <KPIWidget
        label="Availability"
        value="99.97"
        unit="%"
        delta={0.02}
        status="success"
        showStatusDot
        sparklineData={[99.2, 99.5, 99.8, 99.6, 99.9, 99.95, 99.97]}
      />
      <KPIWidget
        label="Open Incidents"
        value="12"
        delta={-3}
        status="warning"
        showStatusDot
      />
      <KPIWidget
        label="MTTR"
        value="2.4"
        unit="hrs"
        delta={-0.3}
        status="success"
        sparklineData={[3.2, 2.9, 2.8, 2.6, 2.5, 2.4]}
      />
      <KPIWidget
        label="Pending Changes"
        value="8"
        delta={2}
        status="info"
      />
      <KPIWidget
        label="Vulnerabilities"
        value="23"
        delta={5}
        status="error"
        showStatusDot
        sparklineData={[15, 18, 20, 19, 21, 23]}
      />
    </div>
  ),
};

// Clickable
export const Clickable: Story = {
  args: {
    label: 'Click for Details',
    value: '156',
    onClick: () => alert('KPI clicked - navigate to details'),
    sparklineData: [120, 135, 145, 150, 156],
  },
};
