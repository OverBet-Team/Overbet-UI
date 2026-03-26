// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ActionBar } from '../src/components/poker/action-bar';

describe('ActionBar', () => {
  it('renders inactive state when not active', () => {
    const onAction = vi.fn();
    render(
      <ActionBar
        isActive={false}
        stack={1000}
        currentBet={0}
        playerBet={0}
        minRaise={10}
        onAction={onAction}
      />,
    );

    expect(screen.getByTestId('action-bar-inactive')).toBeDefined();
  });

  it('emits fold action from Fold pill', () => {
    const onAction = vi.fn();
    render(
      <ActionBar
        isActive
        stack={1000}
        currentBet={100}
        playerBet={0}
        minRaise={50}
        pot={200}
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByTestId('action-fold'));
    expect(onAction).toHaveBeenCalledWith('FOLD');
  });

  it('shows call amount and emits call action when toCall > 0', () => {
    const onAction = vi.fn();
    render(
      <ActionBar
        isActive
        stack={1000}
        currentBet={100}
        playerBet={25}
        minRaise={50}
        pot={300}
        onAction={onAction}
      />,
    );

    const callButton = screen.getByTestId('action-check-call');
    expect(callButton).toBeDefined();
    fireEvent.click(callButton);
    expect(onAction).toHaveBeenCalledWith('CALL');
  });
});
