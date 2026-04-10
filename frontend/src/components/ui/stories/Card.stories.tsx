import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardBody, CardFooter } from '../Card';
import { Button } from '../Button';

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'SKYNEX Card with tonal nesting depth support. No borders — hierarchy via background shifts.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'recessed'],
    },
    elevation: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default Card
export const Default: Story = {
  args: {
    children: (
      <div className="text-on-surface">
        <h3 className="text-title-md font-semibold mb-2">Card Title</h3>
        <p className="text-body-md text-on-surface-variant">Card content goes here.</p>
      </div>
    ),
  },
};

// Recessed Variant
export const Recessed: Story = {
  args: {
    variant: 'recessed',
    children: (
      <div className="text-on-surface">
        <h3 className="text-title-md font-semibold mb-2">Recessed Card</h3>
        <p className="text-body-md text-on-surface-variant">Used for input areas and recessed content.</p>
      </div>
    ),
  },
};

// With Elevation
export const WithElevation: Story = {
  args: {
    elevation: 'md',
    children: (
      <div className="text-on-surface">
        <h3 className="text-title-md font-semibold mb-2">Elevated Card</h3>
        <p className="text-body-md text-on-surface-variant">With medium shadow elevation.</p>
      </div>
    ),
  },
};

// With Sub-components
export const WithSubComponents: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <h3 className="text-title-md font-semibold text-on-surface">Card Header</h3>
      </CardHeader>
      <CardBody>
        <p className="text-body-md text-on-surface-variant">
          This card uses CardHeader, CardBody, and CardFooter sub-components for structured layout.
        </p>
      </CardBody>
      <CardFooter>
        <Button variant="secondary" size="sm">Cancel</Button>
        <Button size="sm">Save</Button>
      </CardFooter>
    </Card>
  ),
};

// Nested Cards (Nesting Depth)
export const NestedCards: Story = {
  render: () => (
    <Card className="w-96">
      <h3 className="text-title-md font-semibold text-on-surface mb-4">Level 1 - surface-container</h3>
      <Card className="mb-4">
        <h4 className="text-title-sm font-semibold text-on-surface mb-3">Level 2 - surface-container-low</h4>
        <Card>
          <h5 className="text-body-md font-semibold text-on-surface mb-2">Level 3 - surface</h5>
          <p className="text-body-sm text-on-surface-variant">Nested cards automatically use deeper surface levels.</p>
        </Card>
      </Card>
      <p className="text-body-sm text-on-surface-dim">Tonal partitioning creates hierarchy without borders.</p>
    </Card>
  ),
};
