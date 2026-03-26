import { CSSProperties } from 'react';

/**
 * Common styling constants for RoomClient
 * Extracted to reduce inline style repetition and improve maintainability
 */

// Common padding patterns
export const PADDING = {
  badge: '2px 8px',
  compact: '3px 10px', 
  standard: '6px 10px',
  medium: '6px 12px',
  large: '8px 14px',
  button: '9px 18px',
  panel: '12px 16px',
  section: '14px 18px',
} as const;

// Common border radius values
export const RADIUS = {
  pill: 999,
  circle: '50%',
  small: 6,
  medium: 8,
  large: 10,
  card: 12,
  panel: 16,
  modal: 20,
  sheet: (isMobile: boolean) => isMobile ? '1.5rem 1.5rem 0 0' : 20,
} as const;

// Common container styles
export const CONTAINERS = {
  pill: {
    borderRadius: RADIUS.pill,
    padding: PADDING.badge,
  },
  badge: {
    borderRadius: RADIUS.small,
    padding: PADDING.compact,
  },
  button: {
    borderRadius: RADIUS.medium,
    padding: PADDING.standard,
  },
  panel: {
    borderRadius: RADIUS.panel,
    padding: PADDING.panel,
  },
} as const satisfies Record<string, CSSProperties>;

// Animation durations
export const ANIMATION = {
  fast: '0.15s',
  normal: '0.2s',
  slow: '0.3s',
} as const;

// Common color patterns (using CSS custom properties from design system)
export const COLORS = {
  glassBg: 'rgba(25, 25, 28, 0.4)',  // glass-panel background
  overlayBg: 'rgba(14, 14, 16, 0.98)',  // modal backdrop (near bg-base)
  gradientTop: 'rgba(19, 19, 21, 0.88)',  // surface-container-low
  gradientBottom: 'rgba(19, 19, 21, 0.2)',  // surface-container-low faded
  accent: 'var(--tertiary)',  // Primary accent color (cyan)
  gold: 'var(--gold)',  // Gold accent for highlights
  danger: 'var(--danger)',  // Error/danger state
  success: 'var(--success)',  // Success state
} as const;