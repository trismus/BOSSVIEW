import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SKYNEX Input Field System
// Issue #81: Recessed inputs with ghost border and focus glow
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Shared Types & Styles
// ─────────────────────────────────────────────────────────────────────────────

interface BaseFieldProps {
  /** Label text displayed above the input */
  label?: string;
  /** Helper text or error message below the input */
  helperText?: string;
  /** Marks the field as having an error */
  error?: boolean;
}

const baseInputClasses = [
  // Recessed appearance
  'w-full bg-surface-container-lowest',
  'text-on-surface placeholder:text-on-surface-dim',
  // Border & radius
  'border border-ghost rounded-skx-sm',
  // Padding
  'px-4 py-3',
  // Focus state
  'focus:outline-none focus:border-primary/50 focus:shadow-[inset_0_0_12px_rgba(0,241,254,0.15)]',
  // Transition
  'transition-all duration-150',
].join(' ');

const errorInputClasses = 'border-error/50 focus:border-error/50 focus:shadow-[inset_0_0_12px_rgba(255,113,108,0.15)]';

// ─────────────────────────────────────────────────────────────────────────────
// Label Component
// ─────────────────────────────────────────────────────────────────────────────

interface LabelProps {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}

function Label({ htmlFor, children, required }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className="block mb-2 text-label-md font-medium text-on-surface-variant">
      {children}
      {required && <span className="ml-1 text-error">*</span>}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HelperText Component
// ─────────────────────────────────────────────────────────────────────────────

interface HelperTextProps {
  children: ReactNode;
  error?: boolean;
  id?: string;
}

function HelperText({ children, error, id }: HelperTextProps) {
  return (
    <p id={id} className={`mt-2 text-body-sm ${error ? 'text-error' : 'text-on-surface-dim'}`}>
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TextField
// ─────────────────────────────────────────────────────────────────────────────

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>, BaseFieldProps {
  /** Input type (text, email, password, etc.) */
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, helperText, error, type = 'text', className = '', id: propId, required, ...props }, ref) => {
    const generatedId = useId();
    const id = propId ?? generatedId;
    const helperId = helperText ? `${id}-helper` : undefined;

    return (
      <div className="w-full">
        {label && <Label htmlFor={id} required={required}>{label}</Label>}
        <input
          ref={ref}
          type={type}
          id={id}
          required={required}
          aria-describedby={helperId}
          aria-invalid={error}
          className={[baseInputClasses, error && errorInputClasses, className].filter(Boolean).join(' ')}
          {...props}
        />
        {helperText && <HelperText id={helperId} error={error}>{helperText}</HelperText>}
      </div>
    );
  }
);

TextField.displayName = 'TextField';

// ─────────────────────────────────────────────────────────────────────────────
// NumberField (uses JetBrains Mono)
// ─────────────────────────────────────────────────────────────────────────────

export interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>, BaseFieldProps {}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ label, helperText, error, className = '', id: propId, required, ...props }, ref) => {
    const generatedId = useId();
    const id = propId ?? generatedId;
    const helperId = helperText ? `${id}-helper` : undefined;

    return (
      <div className="w-full">
        {label && <Label htmlFor={id} required={required}>{label}</Label>}
        <input
          ref={ref}
          type="number"
          id={id}
          required={required}
          aria-describedby={helperId}
          aria-invalid={error}
          className={[
            baseInputClasses,
            'font-mono tabular-nums', // JetBrains Mono for numbers
            error && errorInputClasses,
            className,
          ].filter(Boolean).join(' ')}
          {...props}
        />
        {helperText && <HelperText id={helperId} error={error}>{helperText}</HelperText>}
      </div>
    );
  }
);

NumberField.displayName = 'NumberField';

// ─────────────────────────────────────────────────────────────────────────────
// SelectField
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'>, BaseFieldProps {
  /** Options for the select dropdown */
  options: SelectOption[];
  /** Placeholder option text (empty value) */
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, helperText, error, options, placeholder, className = '', id: propId, required, ...props }, ref) => {
    const generatedId = useId();
    const id = propId ?? generatedId;
    const helperId = helperText ? `${id}-helper` : undefined;

    return (
      <div className="w-full">
        {label && <Label htmlFor={id} required={required}>{label}</Label>}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            required={required}
            aria-describedby={helperId}
            aria-invalid={error}
            className={[
              baseInputClasses,
              'appearance-none cursor-pointer pr-10',
              error && errorInputClasses,
              className,
            ].filter(Boolean).join(' ')}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Chevron icon */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="w-5 h-5 text-on-surface-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {helperText && <HelperText id={helperId} error={error}>{helperText}</HelperText>}
      </div>
    );
  }
);

SelectField.displayName = 'SelectField';

// ─────────────────────────────────────────────────────────────────────────────
// Toggle Switch
// ─────────────────────────────────────────────────────────────────────────────

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'size'> {
  /** Label text displayed next to the toggle */
  label?: string;
  /** Size of the toggle */
  size?: 'sm' | 'md';
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, size = 'md', className = '', id: propId, checked, disabled, ...props }, ref) => {
    const generatedId = useId();
    const id = propId ?? generatedId;

    const sizeClasses = {
      sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
      md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
    };
    const sizes = sizeClasses[size];

    return (
      <label
        htmlFor={id}
        className={[
          'inline-flex items-center gap-3 cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        ].filter(Boolean).join(' ')}
      >
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            role="switch"
            id={id}
            checked={checked}
            disabled={disabled}
            aria-checked={checked}
            className="sr-only peer"
            {...props}
          />
          {/* Track */}
          <div
            className={[
              sizes.track,
              'rounded-full transition-colors duration-200',
              'bg-surface-container-lowest border border-ghost',
              'peer-checked:bg-primary/20 peer-checked:border-primary/40',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface',
            ].join(' ')}
          />
          {/* Thumb */}
          <div
            className={[
              sizes.thumb,
              'absolute top-0.5 left-0.5 rounded-full transition-all duration-200',
              'bg-on-surface-dim',
              'peer-checked:bg-primary',
              `peer-checked:${sizes.translate}`,
            ].join(' ')}
          />
        </div>
        {label && <span className="text-body-md text-on-surface">{label}</span>}
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';
