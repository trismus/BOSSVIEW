import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../Modal';
import { Button } from '../Button';
import { TextField, SelectField } from '../Input';

const meta = {
  title: 'UI/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'SKYNEX Modal with glassmorphism effect, focus trap, and animations.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Modal
export const Basic: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Modal</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Basic Modal">
          <p className="text-body-md text-on-surface-variant">
            This is a basic modal with a title and content.
          </p>
        </Modal>
      </>
    );
  },
};

// Confirmation Dialog
export const ConfirmationDialog: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>Delete Asset</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Confirm Deletion" size="sm">
          <ModalBody>
            <p className="text-body-md text-on-surface-variant">
              Are you sure you want to delete <strong className="text-on-surface">server-001.prod</strong>?
              This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)}>Delete</Button>
          </ModalFooter>
        </Modal>
      </>
    );
  },
};

// Form Modal
export const FormModal: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Create Asset</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Create New Asset" size="md">
          <div className="space-y-4">
            <TextField label="Asset Name" placeholder="web-server-01" required />
            <TextField label="IP Address" placeholder="192.168.1.100" />
            <SelectField
              label="Asset Type"
              placeholder="Select type"
              options={[
                { value: 'server', label: 'Server' },
                { value: 'switch', label: 'Network Switch' },
                { value: 'firewall', label: 'Firewall' },
              ]}
            />
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)}>Create Asset</Button>
          </ModalFooter>
        </Modal>
      </>
    );
  },
};

// Large Modal
export const LargeModal: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Large Modal</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Asset Details" size="xl">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-label-md text-on-surface-dim mb-1">Asset Name</h4>
                <p className="text-body-md text-on-surface font-mono">server-001.prod</p>
              </div>
              <div>
                <h4 className="text-label-md text-on-surface-dim mb-1">IP Address</h4>
                <p className="text-body-md text-on-surface font-mono">192.168.1.100</p>
              </div>
              <div>
                <h4 className="text-label-md text-on-surface-dim mb-1">Type</h4>
                <p className="text-body-md text-on-surface">Server</p>
              </div>
              <div>
                <h4 className="text-label-md text-on-surface-dim mb-1">Status</h4>
                <p className="text-body-md text-success">Online</p>
              </div>
            </div>
            <div>
              <h4 className="text-label-md text-on-surface-dim mb-2">Description</h4>
              <p className="text-body-md text-on-surface-variant">
                Primary web server for production environment. Running Ubuntu 22.04 LTS with Nginx and Node.js.
                Handles approximately 50,000 requests per day.
              </p>
            </div>
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
            <Button variant="secondary">Edit</Button>
            <Button>View Incidents</Button>
          </ModalFooter>
        </Modal>
      </>
    );
  },
};

// All Sizes
export const AllSizes: Story = {
  render: () => {
    const [openSize, setOpenSize] = useState<string | null>(null);
    const sizes = ['sm', 'md', 'lg', 'xl', 'full'] as const;
    return (
      <div className="flex gap-2">
        {sizes.map((size) => (
          <Button key={size} variant="secondary" size="sm" onClick={() => setOpenSize(size)}>
            {size.toUpperCase()}
          </Button>
        ))}
        {sizes.map((size) => (
          <Modal
            key={size}
            open={openSize === size}
            onClose={() => setOpenSize(null)}
            title={`${size.toUpperCase()} Modal`}
            size={size}
          >
            <p className="text-body-md text-on-surface-variant">
              This is a {size} sized modal.
            </p>
          </Modal>
        ))}
      </div>
    );
  },
};
