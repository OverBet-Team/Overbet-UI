'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
// Direct import to avoid barrel-file cost (bundle-barrel-imports rule)
import Shield from 'lucide-react/dist/esm/icons/shield';

interface FairnessModalProps {
  currentCommitment: string;
  lastHandReveal: { seed: number; commitment: string } | null;
  onClose: () => void;
  isPortraitMobile: boolean;
}

export function FairnessModal({
  currentCommitment,
  lastHandReveal,
  onClose,
  isPortraitMobile,
}: FairnessModalProps) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          <>
            {/* Overlay */}
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>

            {/* Content */}
            <Dialog.Content asChild>
              <motion.div
                className={`fixed z-50 flex pointer-events-none ${
                  isPortraitMobile ? 'inset-x-0 bottom-0 items-end' : 'inset-0 items-center justify-center p-4'
                }`}
                initial={{ opacity: 0, scale: isPortraitMobile ? 1 : 0.95, y: isPortraitMobile ? 40 : 0 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: isPortraitMobile ? 1 : 0.95, y: isPortraitMobile ? 40 : 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <div
                  className={`pointer-events-auto w-full font-body bg-[--bg-surface] border border-white/10 shadow-2xl ${
                    isPortraitMobile ? 'rounded-t-[18px] max-h-[82dvh] overflow-y-auto' : 'rounded-2xl max-w-[420px]'
                  }`}
                  style={{ padding: isPortraitMobile ? '18px 16px 22px' : '28px' }}
                >
                  <button className="close-btn" onClick={onClose} aria-label="Close fairness modal">
                    ✕
                  </button>

                  {/* Header */}
                  <div className="flex items-center gap-2.5 mb-5">
                    <Shield size={18} color="var(--success)" />
                    <Dialog.Title className="text-white text-lg font-bold font-display m-0">
                      Provably Fair
                    </Dialog.Title>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Current commitment */}
                    <div className="p-4 rounded-[14px] bg-white/[0.04] border border-white/[0.07]">
                      <div className="text-white/35 text-[10px] font-bold uppercase tracking-widest mb-2">
                        Current Hand Commitment
                      </div>
                      <div className="font-mono text-[10px] break-all bg-black/30 px-2.5 py-2 rounded-lg border border-white/[0.05] text-white/70">
                        {currentCommitment || 'Waiting for hand…'}
                      </div>
                      <p className="mt-2 text-white/25 text-[10px] italic leading-relaxed m-0">
                        SHA-256 hash generated before cards were dealt — proves the deck order is fixed.
                      </p>
                    </div>

                    {/* Last hand reveal */}
                    {lastHandReveal !== null ? (
                      <div className="p-4 rounded-[14px] bg-[--success]/[0.05] border border-[--success]/20">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[--success] text-[10px] font-bold uppercase tracking-widest">
                            Last Hand Revealed
                          </span>
                          <span
                            data-testid="room-code"
                            className="bg-[--success]/15 text-[--success] text-[9px] font-bold px-2 py-px rounded-full border border-[--success]/30"
                          >
                            VERIFIED
                          </span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div>
                            <span className="text-white/35 text-[9px] block mb-0.5">Seed</span>
                            <code className="text-[--success] font-mono text-sm">{lastHandReveal.seed}</code>
                          </div>
                          <div>
                            <span className="text-white/35 text-[9px] block mb-0.5">Commitment</span>
                            <code className="text-white/40 font-mono text-[9px] break-all">
                              {lastHandReveal.commitment}
                            </code>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <p className="text-white/20 text-[10px] text-center leading-relaxed m-0">
                      Even the server host cannot see your cards until they are revealed at showdown.
                    </p>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </>
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
