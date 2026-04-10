import { useState, useEffect, useCallback, type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SKYNEX AppShell Component
// Issue #76: Global layout structure with tonal partitioning
// ─────────────────────────────────────────────────────────────────────────────

export interface AppShellProps {
  /** Sidebar content (navigation, user info) */
  sidebar: ReactNode;
  /** Topbar content (page title, actions) */
  topbar: ReactNode;
  /** Main page content */
  children: ReactNode;
}

/** Breakpoint for sidebar collapse (px) */
const COLLAPSE_BREAKPOINT = 1024;

/**
 * SKYNEX AppShell
 *
 * Global layout structure using Tonal Partitioning:
 * - Sidebar: 240px fixed, `surface-container-low`
 * - Topbar: 56px fixed, `surface-container`
 * - Content: `surface`, scroll container with padding
 *
 * Responsive behavior:
 * - Below 1024px: sidebar collapses to overlay drawer
 * - Overlay has glassmorphism backdrop
 */
export function AppShell({ sidebar, topbar, children }: AppShellProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ─── Responsive detection ─────────────────────────────────────────────────
  useEffect(() => {
    const checkWidth = () => {
      const mobile = window.innerWidth < COLLAPSE_BREAKPOINT;
      setIsMobile(mobile);
      // Auto-close sidebar when switching to desktop
      if (!mobile) setSidebarOpen(false);
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // ─── Keyboard: Escape closes sidebar ──────────────────────────────────────
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [sidebarOpen]);

  // ─── Lock body scroll when drawer is open ─────────────────────────────────
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [sidebarOpen]);

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="min-h-screen bg-surface flex">
      {/* ─── Desktop Sidebar (fixed) ─────────────────────────────────────── */}
      {!isMobile && (
        <aside
          className="w-60 flex-shrink-0 bg-surface-container-low flex flex-col"
          aria-label="Main navigation"
        >
          {sidebar}
        </aside>
      )}

      {/* ─── Mobile Drawer Overlay ───────────────────────────────────────── */}
      {isMobile && sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-surface/80 backdrop-blur-sm"
            onClick={closeSidebar}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside
            className="fixed inset-y-0 left-0 z-50 w-60 bg-surface-container-low flex flex-col animate-slide-in-right"
            aria-label="Main navigation"
            role="dialog"
            aria-modal="true"
          >
            {sidebar}
          </aside>
        </>
      )}

      {/* ─── Main Area (topbar + content) ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 flex-shrink-0 bg-surface-container flex items-center px-6">
          {/* Mobile menu button */}
          {isMobile && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="mr-4 p-2 -ml-2 text-on-surface-variant hover:text-on-surface rounded-skx-md hover:bg-surface-container-high transition-colors"
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={sidebarOpen}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}
          {topbar}
        </header>

        {/* Content */}
        <main className="flex-1 bg-surface overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
