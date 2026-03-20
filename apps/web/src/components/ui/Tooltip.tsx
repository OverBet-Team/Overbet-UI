'use client';

import React from 'react';
import {
  useFloating,
  autoPlacement,
  FloatingPortal,
  useHover,
  useFocus,
  useInteractions,
  offset,
  shift,
} from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  /** Text content shown in the tooltip */
  content: React.ReactNode;
  /** The element that triggers the tooltip */
  children: React.ReactNode;
  /** Disable the tooltip */
  disabled?: boolean;
}

/**
 * Tooltip — hover to reveal a short label.
 * Built on @floating-ui/react with Motion animate-in.
 *
 * Usage:
 *   <Tooltip content="Exact: 1,234 chips">
 *     <ChipStack amount={1234} />
 *   </Tooltip>
 */
export function Tooltip({ content, children, disabled = false }: TooltipProps) {
  const [open, setOpen] = React.useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    middleware: [offset(6), autoPlacement({ allowedPlacements: ['top', 'bottom'] }), shift({ padding: 8 })],
  });

  const hover = useHover(context, { delay: { open: 150, close: 0 } });
  const focus = useFocus(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus]);

  if (disabled) return <>{children}</>;

  return (
    <>
      {/* Wrapper span provides the ref anchor without cloning the child */}
      <span ref={refs.setReference} className="contents" {...getReferenceProps()}>
        {children}
      </span>
      <FloatingPortal>
        <AnimatePresence>
          {open && (
            <motion.div
              ref={refs.setFloating}
              style={floatingStyles}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="z-[9999] px-2.5 py-1.5 rounded-lg bg-[--bg-elevated] border border-white/10 text-[--text-primary] text-xs font-body shadow-lg max-w-[200px] text-center pointer-events-none"
              {...getFloatingProps()}
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>
      </FloatingPortal>
    </>
  );
}
