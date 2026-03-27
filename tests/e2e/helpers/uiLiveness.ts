import { expect, Page } from "@playwright/test";

export interface UiStateSignature {
  phaseLabel: string;
  revealedBoardCount: number;
  activePlayerId: string;
  actionBarEnabled: boolean;
  errorBannerText: string;
  winnerVisible: boolean;
}

export const LIVENESS_THRESHOLDS = {
  timeoutToProgressMs: 20_000,
  boardRevealProgressMs: 20_000,
  pollIntervalMs: 500,
  maxIdenticalSignatures: 12,
  maxIdenticalErrors: 4,
} as const;

export async function readUiSignature(page: Page): Promise<UiStateSignature> {
  const phaseLabel = (await page.getByTestId("phase-label").textContent())?.trim() || "NONE";
  const boardSlots = await page.locator("[data-testid^='board-card-']").all();
  let revealedBoardCount = 0;
  for (const slot of boardSlots) {
    const revealed = await slot.getAttribute("data-revealed");
    if (revealed === "true") revealedBoardCount++;
  }
  const activePlayerId = (await page.getByTestId("active-player-id").textContent())?.trim() || "";

  const inactiveVisible = await page.getByTestId("action-bar-inactive").isVisible().catch(() => false);
  const actionBarVisible = await page.getByTestId("action-bar").isVisible().catch(() => false);
  const actionBarEnabled = actionBarVisible && !inactiveVisible;

  const errorBannerText = (await page.getByTestId("ui-error-banner").textContent().catch(() => ""))?.trim() || "";
  const winnerVisible = await page.getByTestId("winner-toast").isVisible().catch(() => false);

  return {
    phaseLabel,
    revealedBoardCount,
    activePlayerId,
    actionBarEnabled,
    errorBannerText,
    winnerVisible,
  };
}

export async function assertUiProgressesAfterTimeout(page: Page, previous: UiStateSignature) {
  const deadline = Date.now() + LIVENESS_THRESHOLDS.timeoutToProgressMs;
  let identical = 0;
  let last = previous;
  const errorCounts = new Map<string, number>();

  while (Date.now() < deadline) {
    await page.waitForTimeout(LIVENESS_THRESHOLDS.pollIntervalMs);
    const current = await readUiSignature(page);

    if (current.errorBannerText) {
      const count = (errorCounts.get(current.errorBannerText) || 0) + 1;
      errorCounts.set(current.errorBannerText, count);
      expect(count, `Repeated identical error banner: ${current.errorBannerText}`).toBeLessThanOrEqual(
        LIVENESS_THRESHOLDS.maxIdenticalErrors
      );
    }

    if (
      current.phaseLabel !== previous.phaseLabel ||
      current.revealedBoardCount > previous.revealedBoardCount ||
      current.activePlayerId !== previous.activePlayerId
    ) {
      return;
    }

    if (JSON.stringify(current) === JSON.stringify(last)) {
      identical++;
    } else {
      identical = 0;
      last = current;
    }
    expect(identical, "UI signature repeated too many times (stalled UI)").toBeLessThanOrEqual(
      LIVENESS_THRESHOLDS.maxIdenticalSignatures
    );
  }

  throw new Error(
    `UI did not progress within ${LIVENESS_THRESHOLDS.timeoutToProgressMs}ms after timeout. ` +
      `phase=${previous.phaseLabel} board=${previous.revealedBoardCount} active=${previous.activePlayerId}`
  );
}

export async function assertConvergence(pages: Page[], timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(pages.map((p) => readUiSignature(p)));
    const first = states[0];
    const allSame = states.every(
      (s) =>
        s.phaseLabel === first.phaseLabel &&
        s.revealedBoardCount === first.revealedBoardCount &&
        s.activePlayerId === first.activePlayerId
    );
    if (allSame) return states;
    await pages[0].waitForTimeout(400);
  }
  throw new Error("Cross-client convergence failed within bounded window.");
}

