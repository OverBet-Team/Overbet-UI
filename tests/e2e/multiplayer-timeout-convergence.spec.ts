import { test, expect, BrowserContext, Page } from "@playwright/test";
import { assertConvergence, assertUiProgressesAfterTimeout, readUiSignature } from "./helpers/uiLiveness";

async function createRoomAsHost(page: Page): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}/);
  await expect(page.getByTestId("lobby-view")).toBeVisible();
  const url = new URL(page.url());
  const slug = url.pathname.split("/").pop();
  if (!slug) throw new Error("Missing room slug");
  return slug;
}

async function requestSeat(page: Page, displayName: string) {
  await expect(page.getByTestId("lobby-view")).toBeVisible();
  await page.locator("[data-testid^='seat-empty-']").first().click();
  await page.getByPlaceholder("Enter your name").fill(displayName);
  await page.getByRole("button", { name: "Request Seat" }).click();
}

async function approvePendingSeats(hostPage: Page, expectedApprovals: number) {
  await hostPage.getByTestId("host-seat-requests-toggle").click();
  const approvals = hostPage.locator("[data-testid^='approve-seat-']");
  await expect(approvals).toHaveCount(expectedApprovals);
  const ids: string[] = [];
  const handles = await approvals.all();
  for (const h of handles) {
    const testId = await h.getAttribute("data-testid");
    if (testId) ids.push(testId.replace("approve-seat-", ""));
  }
  for (let i = 0; i < ids.length; i++) {
    const button = hostPage.getByTestId(`approve-seat-${ids[i]}`);
    await expect(button).toBeVisible();
    await button.click();
    await expect(button).toHaveCount(0, { timeout: 10_000 });
  }
}

function collectPageErrors(page: Page) {
  const messages: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      messages.push(msg.text());
    }
  });
  page.on("pageerror", (err) => messages.push(err.message));
  page.on("dialog", async (dialog) => {
    messages.push(`dialog:${dialog.message()}`);
    await dialog.dismiss();
  });
  return messages;
}

test.describe("multiplayer timeout convergence", () => {
  test.setTimeout(240_000);

  test("host + joiners converge after timeout without stale preflop loop", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const joinerOneContext = await browser.newContext();
    const joinerTwoContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const joinerOnePage = await joinerOneContext.newPage();
    const joinerTwoPage = await joinerTwoContext.newPage();

    await hostPage.addInitScript(() => localStorage.setItem("overbet_user_id", "e2e-host"));
    await joinerOnePage.addInitScript(() => localStorage.setItem("overbet_user_id", "e2e-joiner-1"));
    await joinerTwoPage.addInitScript(() => localStorage.setItem("overbet_user_id", "e2e-joiner-2"));

    const hostErrors = collectPageErrors(hostPage);
    const joinerOneErrors = collectPageErrors(joinerOnePage);
    const joinerTwoErrors = collectPageErrors(joinerTwoPage);

    const roomSlug = await createRoomAsHost(hostPage);

    await joinerOnePage.goto(`/room/${roomSlug}`);
    await joinerTwoPage.goto(`/room/${roomSlug}`);
    await expect(joinerOnePage.getByTestId("lobby-view")).toBeVisible();
    await expect(joinerTwoPage.getByTestId("lobby-view")).toBeVisible();

    // Keep host unseated in lobby; validate host approval + start path.
    await requestSeat(joinerOnePage, "JoinerOne");
    await requestSeat(joinerTwoPage, "JoinerTwo");
    await approvePendingSeats(hostPage, 2);

    await expect(hostPage.getByTestId("host-start-game-button")).toBeEnabled({ timeout: 20_000 });
    await hostPage.getByTestId("host-start-game-button").click();

    await expect(joinerOnePage.getByTestId("in-game-view")).toBeVisible();
    await expect(joinerTwoPage.getByTestId("in-game-view")).toBeVisible();

    const startState = await readUiSignature(joinerOnePage);

    // Allow one timeout cycle (base + timebank) and then assert liveness progression.
    await joinerOnePage.waitForTimeout(65_000);
    await assertUiProgressesAfterTimeout(joinerOnePage, startState);

    const converged = await assertConvergence([joinerOnePage, joinerTwoPage], 20_000);
    expect(converged[0].phaseLabel).toBe(converged[1].phaseLabel);
    expect(converged[0].revealedBoardCount).toBe(converged[1].revealedBoardCount);
    expect(converged[0].activePlayerId).toBe(converged[1].activePlayerId);

    const allErrors = [...hostErrors, ...joinerOneErrors, ...joinerTwoErrors].join("\n");
    const dealFlopErrorCount = (allErrors.match(/Insufficient deck for DEAL_FLOP/g) || []).length;
    const repeatedActionLoopCount = (allErrors.match(/ERR_PLAYER_ACTION/g) || []).length;
    expect(dealFlopErrorCount, "Repeated deck exhaustion should not appear in normal room flow").toBeLessThanOrEqual(0);
    expect(repeatedActionLoopCount, "Repeated player-action error loop detected").toBeLessThan(3);

    await hostContext.close();
    await joinerOneContext.close();
    await joinerTwoContext.close();
  });
});

