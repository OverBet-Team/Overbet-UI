'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true, renders as a bottom sheet on portrait mobile; centered otherwise. */
  isPortraitMobile?: boolean;
  children: React.ReactNode;
}

/**
 * Shared modal chrome: Dialog.Root + Portal + AnimatePresence + responsive overlay and content wrapper.
 * - isPortraitMobile=false (default): centered dialog with scale animation
 * - isPortraitMobile=true: bottom sheet with slide-up animation
 *
 * Used by BuyInModal, SettingsModal, FairnessModal.
 * Each modal provides its own inner panel (pointer-events-auto div) as children.
 */
export function BaseModal({ isOpen, onClose, isPortraitMobile = false, children }: BaseModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </Dialog.Overlay>

              {/* Responsive content wrapper */}
              <Dialog.Content asChild>
                <motion.div
                  className={`fixed z-50 flex pointer-events-none ${
                    isPortraitMobile
                      ? 'inset-x-0 bottom-0 items-end'
                      : 'inset-0 items-center justify-center p-4'
                  }`}
                  initial={{ opacity: 0, scale: isPortraitMobile ? 1 : 0.95, y: isPortraitMobile ? 40 : 0 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: isPortraitMobile ? 1 : 0.95, y: isPortraitMobile ? 40 : 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {children}
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
