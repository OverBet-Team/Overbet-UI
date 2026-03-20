"use client";

import { Settings } from "lucide-react";

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
  { key: "turnTimeout" as const, label: "Turn Time", min: 10, max: 120, step: 5, unit: "s", color: "#f87171" },
  { key: "timeBank" as const, label: "Time Bank", min: 0, max: 120, step: 5, unit: "s", color: "#fb923c" },
  { key: "autoStartDelay" as const, label: "Auto-Start Delay", min: 2, max: 30, step: 1, unit: "s", color: "#a78bfa" },
] as const;

export function SettingsModal({ settingsDraft, onSettingsChange, onSave, onClose, isPortraitMobile }: SettingsModalProps) {
  return (
    <div
      className={`modal-backdrop${isPortraitMobile ? " modal-backdrop--bottom" : ""}`}
    >
      <div
        className={`panel${isPortraitMobile ? " panel--sheet" : ""}`}
        style={{
          maxWidth: isPortraitMobile ? "100%" : 420,
          padding: isPortraitMobile ? "18px 16px 22px" : 28,
        }}
      >
        <button className="close-btn" onClick={onClose} aria-label="Close settings">✕</button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Settings size={18} color="rgba(167,139,250,0.8)" />
          <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }}>Room Settings</h2>
        </div>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginBottom: 24, fontStyle: "italic" }}>
          Changes take effect on the next hand.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {SETTINGS_FIELDS.map(({ key, label, min, max, step, unit, color }) => {
            const value = settingsDraft[key] ?? 30;
            return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>{label}</label>
                  <span style={{ color, fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>
                    {value}{unit}
                  </span>
                </div>
                <input
                  type="range" min={min} max={max} step={step}
                  value={value}
                  onChange={(e) => onSettingsChange({ ...settingsDraft, [key]: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: color }}
                  aria-label={label}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>{min}{unit}</span>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>{max}{unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={onSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
