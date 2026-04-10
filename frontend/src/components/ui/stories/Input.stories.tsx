import type { Meta, StoryObj } from '@storybook/react';
import { TextField, NumberField, SelectField, Toggle } from '../Input';

// TextField Stories
const textFieldMeta = {
  title: 'UI/Input/TextField',
  component: TextField,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'SKYNEX TextField with recessed style and focus glow.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TextField>;

export default textFieldMeta;
type TextFieldStory = StoryObj<typeof textFieldMeta>;

export const Default: TextFieldStory = {
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
    type: 'email',
  },
};

export const WithHelperText: TextFieldStory = {
  args: {
    label: 'Username',
    placeholder: 'Enter username',
    helperText: 'Must be at least 3 characters',
  },
};

export const ErrorState: TextFieldStory = {
  args: {
    label: 'Password',
    type: 'password',
    value: '123',
    error: true,
    helperText: 'Password must be at least 8 characters',
  },
};

export const Required: TextFieldStory = {
  args: {
    label: 'Full Name',
    placeholder: 'John Doe',
    required: true,
  },
};

export const Disabled: TextFieldStory = {
  args: {
    label: 'Disabled Field',
    value: 'Cannot edit',
    disabled: true,
  },
};

// All Input Types Together
export const AllInputTypes: TextFieldStory = {
  render: () => (
    <div className="flex flex-col gap-6 w-80">
      <TextField
        label="Text Input"
        placeholder="Enter text"
      />
      <NumberField
        label="Number Input"
        placeholder="0"
        helperText="Uses JetBrains Mono font"
      />
      <SelectField
        label="Select Input"
        placeholder="Choose an option"
        options={[
          { value: 'server', label: 'Server' },
          { value: 'switch', label: 'Switch' },
          { value: 'firewall', label: 'Firewall' },
          { value: 'workstation', label: 'Workstation' },
        ]}
      />
      <Toggle label="Enable notifications" />
    </div>
  ),
};

// Form Example
export const FormExample: TextFieldStory = {
  render: () => (
    <div className="flex flex-col gap-6 w-96 p-6 bg-surface-container rounded-skx-md">
      <h3 className="text-title-md font-semibold text-on-surface">Create Asset</h3>
      <TextField
        label="Asset Name"
        placeholder="web-server-01"
        required
      />
      <TextField
        label="IP Address"
        placeholder="192.168.1.100"
      />
      <SelectField
        label="Asset Type"
        placeholder="Select type"
        required
        options={[
          { value: 'server', label: 'Server' },
          { value: 'switch', label: 'Network Switch' },
          { value: 'firewall', label: 'Firewall' },
          { value: 'workstation', label: 'Workstation' },
          { value: 'vm', label: 'Virtual Machine' },
        ]}
      />
      <SelectField
        label="Criticality"
        placeholder="Select criticality"
        options={[
          { value: 'critical', label: 'Critical' },
          { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' },
          { value: 'low', label: 'Low' },
        ]}
      />
      <Toggle label="Active" defaultChecked />
    </div>
  ),
};
