import { describe, it, expect } from 'vitest';
import { formatChipAmount } from '../src/components/poker/ChipAmount';

describe('formatChipAmount', () => {
  it('formats zero correctly', () => {
    expect(formatChipAmount(0)).toBe('0');
  });

  it('formats small numbers without commas', () => {
    expect(formatChipAmount(500)).toBe('500');
    expect(formatChipAmount(999)).toBe('999');
  });

  it('formats numbers with thousands separator', () => {
    expect(formatChipAmount(1000)).toBe('1,000');
    expect(formatChipAmount(15000)).toBe('15,000');
    expect(formatChipAmount(999999)).toBe('999,999');
  });

  it('formats large numbers in the millions', () => {
    expect(formatChipAmount(1000000)).toBe('1,000,000');
    expect(formatChipAmount(12345678)).toBe('12,345,678');
  });

  it('formats negative numbers correctly', () => {
    expect(formatChipAmount(-1000)).toBe('-1,000');
    expect(formatChipAmount(-500)).toBe('-500');
  });
});
