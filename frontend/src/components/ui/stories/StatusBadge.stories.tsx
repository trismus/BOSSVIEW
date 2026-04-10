import type { Meta, StoryObj } from '@storybook/react';
import { StatusBadge } from '../StatusBadge';

const meta = {
  title: 'UI/StatusBadge',
  component: StatusBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'SKYNEX Status Badge with glow effect. Acts as "warning lights" of the system.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['critical', 'warning', 'success', 'info'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
    pulse: {
      control: 'boolean',
      description: 'Enable pulsing animation (auto-enabled for critical)',
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// All Status Types
export const AllStatuses: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <StatusBadge status="critical">Critical</StatusBadge>
      <StatusBadge status="warning">Warning</StatusBadge>
      <StatusBadge status="success">Success</StatusBadge>
      <StatusBadge status="info">Info</StatusBadge>
    </div>
  ),
};

// Critical (with pulse)
export const Critical: Story = {
  args: {
    status: 'critical',
    children: 'CRITICAL',
    pulse: true,
  },
};

// Warning
export const Warning: Story = {
  args: {
    status: 'warning',
    children: 'WARNING',
  },
};

// Success
export const Success: Story = {
  args: {
    status: 'success',
    children: 'HEALTHY',
  },
};

// Info
export const Info: Story = {
  args: {
    status: 'info',
    children: 'INFO',
  },
};

// Sizes
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <StatusBadge status="success" size="sm">SM</StatusBadge>
      <StatusBadge status="success" size="md">MD</StatusBadge>
    </div>
  ),
};

// Real-world Examples
export const RealWorldExamples: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-on-surface">
        <StatusBadge status="success">ONLINE</StatusBadge>
        <span className="text-body-md">web-server-01.prod</span>
      </div>
      <div className="flex items-center gap-3 text-on-surface">
        <StatusBadge status="warning">DEGRADED</StatusBadge>
        <span className="text-body-md">db-cluster-02.prod</span>
      </div>
      <div className="flex items-center gap-3 text-on-surface">
        <StatusBadge status="critical" pulse>OFFLINE</StatusBadge>
        <span className="text-body-md">firewall-01.dmz</span>
      </div>
      <div className="flex items-center gap-3 text-on-surface">
        <StatusBadge status="info">MAINTENANCE</StatusBadge>
        <span className="text-body-md">backup-server-01.corp</span>
      </div>
    </div>
  ),
};
