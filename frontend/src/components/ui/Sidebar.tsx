import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SKYNEX Sidebar Navigation
// Issue #86: Sidebar with active-state glow and keyboard navigation
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Context for managing sidebar state
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarContextValue {
  activeItem: string | null;
  setActiveItem: (id: string) => void;
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar Root
// ─────────────────────────────────────────────────────────────────────────────

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  /** Currently active item ID (controlled) */
  activeItem?: string;
  /** Callback when active item changes */
  onActiveItemChange?: (id: string) => void;
  children: ReactNode;
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  ({ activeItem: controlledActiveItem, onActiveItemChange, children, className = '', ...props }, ref) => {
    const [internalActiveItem, setInternalActiveItem] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    const activeItem = controlledActiveItem ?? internalActiveItem;

    const setActiveItem = useCallback(
      (id: string) => {
        if (onActiveItemChange) {
          onActiveItemChange(id);
        } else {
          setInternalActiveItem(id);
        }
      },
      [onActiveItemChange]
    );

    const toggleSection = useCallback((id: string) => {
      setExpandedSections((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }, []);

    return (
      <SidebarContext.Provider value={{ activeItem, setActiveItem, expandedSections, toggleSection }}>
        <nav
          ref={ref}
          aria-label="Main navigation"
          className={`flex flex-col h-full ${className}`}
          {...props}
        >
          {children}
        </nav>
      </SidebarContext.Provider>
    );
  }
);

Sidebar.displayName = 'Sidebar';

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar Section (collapsible group)
// ─────────────────────────────────────────────────────────────────────────────

export interface SidebarSectionProps {
  /** Section identifier */
  id: string;
  /** Section title (optional, renders as collapsible header if provided) */
  title?: string;
  /** Default expanded state */
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function SidebarSection({ id, title, defaultExpanded = true, children }: SidebarSectionProps) {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('SidebarSection must be used within Sidebar');

  const { expandedSections, toggleSection } = context;
  const _isExpanded = expandedSections.has(id) || (defaultExpanded && !expandedSections.has(`_collapsed_${id}`));
  void _isExpanded; // Used for debugging

  // Handle initial collapsed state
  const handleToggle = () => {
    if (defaultExpanded && !expandedSections.has(id) && !expandedSections.has(`_collapsed_${id}`)) {
      // First toggle from default expanded state
      toggleSection(`_collapsed_${id}`);
    } else {
      toggleSection(id);
    }
  };

  const actuallyExpanded = defaultExpanded
    ? !expandedSections.has(`_collapsed_${id}`)
    : expandedSections.has(id);

  if (!title) {
    // No title = simple group wrapper
    return <div className="space-y-1">{children}</div>;
  }

  return (
    <div className="mb-2">
      {/* Section header */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-label-md text-on-surface-dim uppercase tracking-wider hover:text-on-surface-variant transition-colors"
        aria-expanded={actuallyExpanded}
      >
        <span>{title}</span>
        <ChevronIcon expanded={actuallyExpanded} />
      </button>

      {/* Collapsible content */}
      <div
        className={[
          'overflow-hidden transition-all duration-200 ease-out',
          actuallyExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        ].join(' ')}
      >
        <div className="space-y-1 pt-1">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar Item
// ─────────────────────────────────────────────────────────────────────────────

export interface SidebarItemProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Unique item identifier */
  id: string;
  /** Icon component (20x20px recommended) */
  icon?: ReactNode;
  /** Item label */
  children: ReactNode;
  /** Click handler (in addition to setting active state) */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
}

export const SidebarItem = forwardRef<HTMLButtonElement, SidebarItemProps>(
  ({ id, icon, children, onClick, disabled, className = '', ...props }, ref) => {
    const context = useContext(SidebarContext);
    if (!context) throw new Error('SidebarItem must be used within Sidebar');

    const { activeItem, setActiveItem } = context;
    const isActive = activeItem === id;

    const handleClick = useCallback(() => {
      if (!disabled) {
        setActiveItem(id);
        onClick?.();
      }
    }, [id, disabled, setActiveItem, onClick]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      },
      [handleClick]
    );

    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={[
          // Base styles
          'relative w-full flex items-center gap-3 px-3 py-2.5',
          'text-title-sm font-semibold text-left',
          'rounded-skx-md transition-all duration-150',
          // States
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && !isActive && 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container',
          // Active state
          isActive && 'text-primary bg-surface-container-high',
          // Custom
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-current={isActive ? 'page' : undefined}
        {...props}
      >
        {/* Active indicator: left 2px stripe with glow */}
        {isActive && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-full shadow-glow-primary"
            aria-hidden="true"
          />
        )}

        {/* Icon */}
        {icon && (
          <span className="flex-shrink-0 w-5 h-5" aria-hidden="true">
            {icon}
          </span>
        )}

        {/* Label */}
        <span className="flex-1 truncate">{children}</span>
      </button>
    );
  }
);

SidebarItem.displayName = 'SidebarItem';

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar Divider
// ─────────────────────────────────────────────────────────────────────────────

export function SidebarDivider() {
  return <hr className="my-3 border-ghost" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard Navigation Hook (for use with Sidebar)
// ─────────────────────────────────────────────────────────────────────────────

export function useSidebarKeyboardNavigation(_itemIds: string[]) {
  const containerRef = useRef<HTMLElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!containerRef.current) return;

      const items = Array.from(
        containerRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])')
      );
      const currentIndex = items.findIndex((item) => item === document.activeElement);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < items.length - 1) {
            items[currentIndex + 1]?.focus();
          } else {
            items[0]?.focus();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            items[currentIndex - 1]?.focus();
          } else {
            items[items.length - 1]?.focus();
          }
          break;
        case 'Home':
          e.preventDefault();
          items[0]?.focus();
          break;
        case 'End':
          e.preventDefault();
          items[items.length - 1]?.focus();
          break;
      }
    },
    []
  );

  return { containerRef, handleKeyDown };
}
