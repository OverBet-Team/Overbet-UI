import React from "react";

export function formatChipAmount(amount: number) {
  return amount.toLocaleString();
}

export function ChipIcon({
  size = 12,
  color = "rgba(255,255,255,0.55)",
  style,
}: {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, ...style }}>
      <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.5" />
      <circle cx="10" cy="10" r="5" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="10" cy="10" r="2" fill={color} />
    </svg>
  );
}

export function ChipAmount({
  amount,
  prefix,
  suffix,
  iconSize = 12,
  iconColor,
  gap = 4,
  style,
  amountStyle,
}: {
  amount: number | string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  iconSize?: number;
  iconColor?: string;
  gap?: number;
  style?: React.CSSProperties;
  amountStyle?: React.CSSProperties;
}) {
  const amountText = typeof amount === "number" ? formatChipAmount(amount) : amount;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {prefix}
      <ChipIcon size={iconSize} color={iconColor} />
      <span style={amountStyle}>{amountText}</span>
      {suffix}
    </span>
  );
}
