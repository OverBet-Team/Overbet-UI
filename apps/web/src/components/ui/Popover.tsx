'use client';

import React from 'react';
import {
  useFloating,
  FloatingPortal,
  useHover,
  useClick,
  useDismiss,
  useInteractions,
  offset,
  shift,
  flip,
} from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';

interface PopoverProps {
  /** Rich content shown in the popover panel */
  content: React.ReactNode;
  /** The element that triggers the popover */
  children: React.ReactNode;
  /** Trigger mode: hover or click. Defaults to hover. */
  trigger?: 'hover' | 'click';
  /** Disable the popover */
  disabled?: boolean;
}

/**
 * Popover — hover or click to reveal a rich panel.
 * Built on @floating-ui/react with Motion animate-in.
 *
 * Usage (player profile card):
 *   <Popover content={<PlayerCard player={p} />}>
 *     <AvatarCircle player={p} />
 *   </Popover>
 *
 * Usage (pot history):
 *   <Popover content={<PotHistory actions={lastActions} />} trigger="hover">
 *     <PotDisplay amount={totalPot} />
 *   </Popover>
 */
export function Popover({ content, children, trigger = 'hover', disabled = false }: PopoverProps) {
  const [open, setOpen] = React.useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    middleware: [
      offset(8),
      flip({ fallbackAxisSideDirection: 'start' }),
      shift({ padding: 8 }),
    ],
  });

  const hover = useHover(context, {
    enabled: trigger === 'hover',
    delay: { open: 200, close: 100 },
  });
  const click = useClick(context, { enabled: trigger === 'click' });
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, click, dismiss]);

  if (disabled) return <>{children}</>;

  return (
    <>
      {/* Wrapper span provides the ref anchor without cloning children */}
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
              className="z-[9998] bg-[--bg-surface] border border-white/10 rounded-xl shadow-2xl min-w-[160px] max-w-[280px] font-body overflow-hidden"
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
