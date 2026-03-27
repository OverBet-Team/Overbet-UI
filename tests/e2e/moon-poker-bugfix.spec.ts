import { expect, Page, test } from "@playwright/test";

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

async function getLabeledRowText(page: Page, label: string) {
  return page.evaluate((wantedLabel) => {
    const labels = Array.from(document.querySelectorAll("span"));
    const labelNode = labels.find((node) => node.textContent?.trim() === wantedLabel);
    return labelNode?.parentElement?.textContent?.replace(/\s+/g, " ").trim() ?? null;
  }, label);
}

async function requestSeat(page: Page, displayName: string, amount: number) {
  await expect(page.getByTestId("lobby-view")).toBeVisible();
  await page.locator("[data-testid^='seat-empty-']").first().click();
  await page.getByPlaceholder("Enter your name").fill(displayName);
  await page.locator('input[inputmode="numeric"]').fill(String(amount));
  await page.getByTestId("seat-request-submit-button").click();
}

async function approvePendingSeats(hostPage: Page, expectedApprovals: number) {
  await hostPage.getByTestId("host-seat-requests-toggle").click();
  const approvals = hostPage.locator("[data-testid^='approve-seat-']");
  await expect(approvals).toHaveCount(expectedApprovals);
  const ids: string[] = [];
  const handles = await approvals.all();
  for (const handle of handles) {
    const testId = await handle.getAttribute("data-testid");
    if (testId) ids.push(testId.replace("approve-seat-", ""));
  }
  for (const id of ids) {
    const button = hostPage.getByTestId(`approve-seat-${id}`);
    await expect(button).toBeVisible();
    await button.click();
    await expect(button).toHaveCount(0, { timeout: 10_000 });
  }
}

async function waitForActivePage(pages: Page[]) {
  for (let attempt = 0; attempt < 80; attempt++) {
    for (const page of pages) {
      const visible = await page.getByTestId("action-bar").isVisible().catch(() => false);
      if (visible) return page;
    }
    await pages[0].waitForTimeout(250);
  }
  throw new Error("Timed out waiting for an active action bar");
}

async function readPotIndicators(page: Page) {
  const totalPotText = (await page.getByTestId("total-pot-amount").textContent()) ?? "";
  const roundText = (await page.getByTestId("current-round-amount").textContent()) ?? "";
  const extractAmount = (text: string) => Number((text.match(/(\d[\d,]*)/g) ?? ["0"]).slice(-1)[0].replace(/,/g, ""));

  return {
    totalPot: extractAmount(totalPotText),
    roundAmount: extractAmount(roundText),
  };
}

async function expectPotIndicators(page: Page, totalPot: number, roundAmount: number) {
  const indicators = await readPotIndicators(page);
  expect(indicators.totalPot).toBe(totalPot);
  expect(indicators.roundAmount).toBe(roundAmount);
}

type LayoutRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

function rectsOverlap(a: LayoutRect, b: LayoutRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function readLobbyLayout(page: Page) {
  return page.evaluate(() => {
    const toRect = (element: Element) => {
      const rect = (element as HTMLElement).getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      };
    };

    const seats = Array.from(document.querySelectorAll("[data-testid^='seat-empty-']")).map(toRect);
    const communitySlots = Array.from(document.querySelectorAll("[data-testid^='community-slot-']")).map(toRect);
    const averageCenterX = seats.reduce((sum, seat) => sum + seat.centerX, 0) / seats.length;

    return {
      seats,
      communitySlots,
      count: seats.length,
      slotCount: communitySlots.length,
      averageCenterX,
      minLeft: Math.min(...seats.map((seat) => seat.left)),
      maxRight: Math.max(...seats.map((seat) => seat.right)),
      minTop: Math.min(...seats.map((seat) => seat.top)),
      maxBottom: Math.max(...seats.map((seat) => seat.bottom)),
      viewportCenterX: window.innerWidth / 2,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
}

test.describe("moon poker bugfixes", () => {
  test.setTimeout(240_000);

  test("buy-in, chip display, lobby layout, and pot indicators stay truthful in the real UI", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const joinerOneContext = await browser.newContext();
    const joinerTwoContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const joinerOnePage = await joinerOneContext.newPage();
    const joinerTwoPage = await joinerTwoContext.newPage();

    await hostPage.addInitScript(() => localStorage.setItem("overbet_user_id", "bugfix-host"));
    await joinerOnePage.addInitScript(() => localStorage.setItem("overbet_user_id", "bugfix-joiner-1"));
    await joinerTwoPage.addInitScript(() => localStorage.setItem("overbet_user_id", "bugfix-joiner-2"));

    const roomSlug = await createRoomAsHost(hostPage);

    const blindsRow = await getLabeledRowText(hostPage, "Blinds");
    expect(blindsRow).toContain("5");
    expect(blindsRow).toContain("10");

    const emptySeatLayout = await readLobbyLayout(hostPage);

    expect(emptySeatLayout.count).toBe(10);
    expect(emptySeatLayout.slotCount).toBe(5);
    expect(Math.abs(emptySeatLayout.averageCenterX - emptySeatLayout.viewportCenterX)).toBeLessThan(24);
    expect(emptySeatLayout.minLeft).toBeGreaterThan(0);
    expect(emptySeatLayout.maxRight).toBeLessThan(emptySeatLayout.viewportWidth);
    expect(emptySeatLayout.minTop).toBeGreaterThan(0);
    for (const seat of emptySeatLayout.seats) {
      for (const slot of emptySeatLayout.communitySlots) {
        expect(rectsOverlap(seat, slot)).toBe(false);
      }
    }

    await hostPage.locator("[data-testid^='seat-empty-']").first().click();
    await expect(hostPage.locator('input[inputmode="numeric"]')).toHaveValue("0");
    await expect(hostPage.locator("body")).toContainText("Unlimited");
    await expect(hostPage.locator("body")).not.toContainText("$");
    await hostPage.getByTestId("buyin-cancel-button").click();

    await joinerOnePage.goto(`/room/${roomSlug}`);
    await joinerTwoPage.goto(`/room/${roomSlug}`);
    await expect(joinerOnePage.getByTestId("lobby-view")).toBeVisible();
    await expect(joinerTwoPage.getByTestId("lobby-view")).toBeVisible();

    await requestSeat(joinerOnePage, "JoinerOne", 123456);
    await requestSeat(joinerTwoPage, "JoinerTwo", 234567);

    await approvePendingSeats(hostPage, 2);
    await expect(hostPage.locator("body")).toContainText("123,456");
    await expect(hostPage.locator("body")).toContainText("234,567");
    await expect(hostPage.locator("body")).not.toContainText("$");

    await expect(hostPage.getByTestId("host-start-game-button")).toBeEnabled({ timeout: 20_000 });
    await hostPage.getByTestId("host-start-game-button").click();

    await expect(joinerOnePage.getByTestId("in-game-view")).toBeVisible();
    await expect(joinerTwoPage.getByTestId("in-game-view")).toBeVisible();

    const players = [joinerOnePage, joinerTwoPage];

    let actingPage = await waitForActivePage(players);
    await actingPage.getByTestId("action-check-call").click();
    actingPage = await waitForActivePage(players);
    await actingPage.getByTestId("action-check-call").click();

    await expectPotIndicators(joinerOnePage, 20, 0);
    await expectPotIndicators(joinerTwoPage, 20, 0);

    actingPage = await waitForActivePage(players);
    await actingPage.getByTestId("action-raise").click();
    await expect(actingPage.getByTestId("raise-modal")).toBeVisible();
    await actingPage.getByRole("button", { name: /Raise to/i }).click();

    await expect(joinerOnePage.getByTestId("current-round-indicator")).toBeVisible();
    await expect(joinerTwoPage.getByTestId("current-round-indicator")).toBeVisible();

    actingPage = await waitForActivePage(players);
    await actingPage.getByTestId("action-check-call").click();

    let settledJoinerOne = await readPotIndicators(joinerOnePage);
    for (let attempt = 0; attempt < 20 && (settledJoinerOne.totalPot <= 20 || settledJoinerOne.roundAmount !== 0); attempt++) {
      await joinerOnePage.waitForTimeout(250);
      settledJoinerOne = await readPotIndicators(joinerOnePage);
    }

    expect(settledJoinerOne.totalPot).toBeGreaterThan(20);
    expect(settledJoinerOne.roundAmount).toBe(0);
    await expect(joinerOnePage.locator("body")).not.toContainText("$");
    await expect(joinerTwoPage.locator("body")).not.toContainText("$");

    await hostContext.close();
    await joinerOneContext.close();
    await joinerTwoContext.close();
  });

  test("portrait mobile lobby keeps seat markers evenly distributed and clear of board placeholders", async ({ browser }) => {
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await mobileContext.newPage();

    await page.addInitScript(() => localStorage.setItem("overbet_user_id", "bugfix-mobile-host"));
    await createRoomAsHost(page);

    const layout = await readLobbyLayout(page);

    expect(layout.count).toBe(10);
    expect(layout.slotCount).toBe(5);
    expect(Math.abs(layout.averageCenterX - layout.viewportCenterX)).toBeLessThan(16);
    expect(layout.minLeft).toBeGreaterThan(0);
    expect(layout.maxRight).toBeLessThan(layout.viewportWidth);
    expect(layout.minTop).toBeGreaterThan(0);
    expect(layout.maxBottom).toBeLessThan(layout.viewportHeight);

    for (let i = 0; i < layout.seats.length; i++) {
      for (let j = i + 1; j < layout.seats.length; j++) {
        expect(rectsOverlap(layout.seats[i], layout.seats[j])).toBe(false);
      }
      for (const slot of layout.communitySlots) {
        expect(rectsOverlap(layout.seats[i], slot)).toBe(false);
      }
    }

    await mobileContext.close();
  });
});
