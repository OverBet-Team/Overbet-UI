'use client';

import * as Dialog from '@radix-ui/react-dialog';
// Direct import to avoid barrel-file cost (bundle-barrel-imports rule)
import Settings from 'lucide-react/dist/esm/icons/settings';
import { BaseModal } from '@/components/ui/Modal';

interface RoomSettings {
  variant: string;
  smallBlind: number;
  bigBlind: number;
  autoStartDelay?: number;
  turnTimeout?: number;
  timeBank?: number;
}

interface SettingsModalProps {
  settingsDraft: RoomSettings;
  onSettingsChange: (next: RoomSettings) => void;
  onSave: () => void;
  onClose: () => void;
  isPortraitMobile: boolean;
}

// Keep the slider list centralized so the modal renders a single source of truth.
const SETTINGS_FIELDS = [
  { key: 'turnTimeout' as const, label: 'Turn Time', min: 10, max: 120, step: 5, unit: 's', color: 'var(--danger)' },
  { key: 'timeBank' as const, label: 'Time Bank', min: 0, max: 120, step: 5, unit: 's', color: 'var(--gold)' },
  {
    key: 'autoStartDelay' as const,
    label: 'Auto-Start Delay',
    min: 2,
    max: 30,
    step: 1,
    unit: 's',
    color: 'var(--accent)',
  },
] as const;

export function SettingsModal({
  settingsDraft,
  onSettingsChange,
  onSave,
  onClose,
  isPortraitMobile,
}: SettingsModalProps) {
  return (
    <BaseModal isOpen onClose={onClose} isPortraitMobile={isPortraitMobile}>
      <div
        className={`pointer-events-auto w-full font-body bg-[--surface-container-low] border border-white/10 shadow-2xl ${
          isPortraitMobile ? 'rounded-t-[18px] max-h-[82dvh] overflow-y-auto' : 'rounded-2xl max-w-[420px]'
        }`}
        style={{ padding: isPortraitMobile ? '18px 16px 22px' : '28px' }}
      >
        <button className="close-btn" onClick={onClose} aria-label="Close settings">✕</button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-1.5">
          <Settings size={18} color="var(--accent)" />
          <Dialog.Title className="text-white text-lg font-bold font-display m-0">Room Settings</Dialog.Title>
        </div>
        <Dialog.Description className="text-white/30 text-[11px] mb-6 italic m-0">
          Changes take effect on the next hand.
        </Dialog.Description>

        {/* Settings sliders */}
        <div className="flex flex-col gap-5">
          {SETTINGS_FIELDS.map(({ key, label, min, max, step, unit, color }) => {
            const value = settingsDraft[key] ?? 30;
            return (
              <div key={key}>
                <div className="flex justify-between mb-1.5">
                  <label className="text-white/70 text-[13px] font-semibold font-body">{label}</label>
                  <span className="font-mono font-bold text-[13px]" style={{ color }}>
                    {value}{unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(e) => onSettingsChange({ ...settingsDraft, [key]: Number(e.target.value) })}
                  className="w-full"
                  style={{ accentColor: color }}
                  aria-label={label}
                />
                <div className="flex justify-between mt-0.5">
                  <span className="text-white/20 text-[10px]">{min}{unit}</span>
                  <span className="text-white/20 text-[10px]">{max}{unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 mt-7">
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={onSave}>Save Settings</button>
        </div>
      </div>
    </BaseModal>
  );
}
