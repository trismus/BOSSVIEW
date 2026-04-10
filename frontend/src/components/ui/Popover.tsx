import {
  useState,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';

// ─────────────────────────────────────────────────────────────────────────────
// SKYNEX Popover Component
// Issue #82: Glassmorphism popover with positioning
// ─────────────────────────────────────────────────────────────────────────────

type PopoverPosition = 'top' | 'bottom' | 'left' | 'right';
type PopoverAlign = 'start' | 'center' | 'end';

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Popover Root
// ─────────────────────────────────────────────────────────────────────────────

export interface PopoverProps {
  children: ReactNode;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

export function Popover({ children, open: controlledOpen, onOpenChange }: PopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef: triggerRef as React.RefObject<HTMLElement> }}>
      {children}
    </PopoverContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Popover Trigger
// ─────────────────────────────────────────────────────────────────────────────

export interface PopoverTriggerProps {
  children: ReactNode;
  /** Render as child element instead of button */
  asChild?: boolean;
}

export function PopoverTrigger({ children, asChild }: PopoverTriggerProps) {
  const context = useContext(PopoverContext);
  if (!context) throw new Error('PopoverTrigger must be used within Popover');

  const { open, setOpen, triggerRef } = context;

  const handleClick = () => setOpen(!open);

  if (asChild) {
    // Clone the child and attach ref and onClick
    return children;
  }

  return (
    <button
      ref={triggerRef as React.RefObject<HTMLButtonElement>}
      type="button"
      onClick={handleClick}
      aria-expanded={open}
      aria-haspopup="dialog"
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Popover Content
// ─────────────────────────────────────────────────────────────────────────────

export interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Position relative to trigger */
  position?: PopoverPosition;
  /** Alignment along the position axis */
  align?: PopoverAlign;
  /** Offset from trigger (px) */
  offset?: number;
}

export function PopoverContent({
  children,
  position = 'bottom',
  align = 'center',
  offset = 8,
  className = '',
  ...props
}: PopoverContentProps) {
  const context = useContext(PopoverContext);
  if (!context) throw new Error('PopoverContent must be used within Popover');

  const { open, setOpen, triggerRef } = context;
  const contentRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // ─── Calculate position ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();

    let top = 0;
    let left = 0;

    // Position
    switch (position) {
      case 'top':
        top = rect.top - offset;
        left = rect.left + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - offset;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + offset;
        break;
    }

    // Adjust for scroll
    top += window.scrollY;
    left += window.scrollX;

    setCoords({ top, left });
  }, [open, position, offset, triggerRef]);

  // ─── Click outside to close ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  // Transform origin based on position
  const transformOrigin: Record<PopoverPosition, string> = {
    top: 'bottom center',
    bottom: 'top center',
    left: 'right center',
    right: 'left center',
  };

  const content = (
    <div
      ref={contentRef}
      role="dialog"
      aria-modal="false"
      style={{
        position: 'absolute',
        top: coords.top,
        left: coords.left,
        transform: getTransform(position, align),
        transformOrigin: transformOrigin[position],
      }}
      className={[
        // Glass effect
        'z-50 min-w-[200px]',
        'bg-surface-container/90 backdrop-blur-glass',
        // Elevation & radius
        'shadow-elevation-md rounded-skx-md',
        // Border
        'border border-ghost',
        // Padding
        'p-4',
        // Animation
        'animate-popover-enter',
        // Custom
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );

  return createPortal(content, document.body);
}

// Helper to calculate transform based on position and alignment
function getTransform(position: PopoverPosition, align: PopoverAlign): string {
  const alignOffset: Record<PopoverAlign, string> = {
    start: '0%',
    center: '-50%',
    end: '-100%',
  };

  switch (position) {
    case 'top':
      return `translate(${alignOffset[align]}, -100%)`;
    case 'bottom':
      return `translate(${alignOffset[align]}, 0)`;
    case 'left':
      return `translate(-100%, ${alignOffset[align]})`;
    case 'right':
      return `translate(0, ${alignOffset[align]})`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Popover Close Button
// ─────────────────────────────────────────────────────────────────────────────

export interface PopoverCloseProps {
  children: ReactNode;
}

export function PopoverClose({ children }: PopoverCloseProps) {
  const context = useContext(PopoverContext);
  if (!context) throw new Error('PopoverClose must be used within Popover');

  const handleClick = () => context.setOpen(false);

  return (
    <span onClick={handleClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleClick()}>
      {children}
    </span>
  );
}
