// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BuyInModal } from "../src/components/poker/BuyInModal";

describe("BuyInModal", () => {
  it("starts at zero and shows an unlimited max when no cap is provided", () => {
    render(
      <BuyInModal
        isOpen
        onClose={() => {}}
        onSubmit={() => {}}
        minAmount={0}
        seatIndex={2}
        isGuest={false}
      />,
    );

    expect(screen.getByDisplayValue("0")).toBeDefined();
    expect(document.body.textContent).toContain("Min");
    expect(document.body.textContent).toContain("Unlimited");
    expect(document.body.textContent).not.toContain("$");

    const submitButton = screen.getByTestId("seat-request-submit-button") as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
  });

  it("accepts large amounts when buy-in is uncapped", () => {
    const onSubmit = vi.fn();

    render(
      <BuyInModal
        isOpen
        onClose={() => {}}
        onSubmit={onSubmit}
        minAmount={0}
        seatIndex={4}
        isGuest={false}
      />,
    );

    const amountInput = screen.getByDisplayValue("0") as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "999999" } });
    fireEvent.click(screen.getByTestId("seat-request-submit-button"));

    expect(onSubmit).toHaveBeenCalledWith(999999, "");
  });
});
