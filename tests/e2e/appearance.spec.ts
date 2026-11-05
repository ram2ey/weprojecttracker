import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("explicit dark appearance respects reduced transparency and increased contrast", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
  });
  await expect(page.locator(".site-header")).toHaveCSS(
    "background-color",
    "rgb(32, 40, 35)",
  );
  await expect(page.locator(".site-header")).toHaveCSS(
    "backdrop-filter",
    "none",
  );
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-contrast", value: "more" }],
  });
  await expect(page.locator(".project-card").first()).toHaveCSS(
    "border-top-color",
    "rgb(237, 243, 239)",
  );
});

test("appearance follows the system and persists an explicit choice across public and staff pages", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await page.goto("/preview/console");
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue(
    "light",
  );
  await page.getByLabel("Appearance", { exact: true }).selectOption("system");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  expect(errors).toEqual([]);
});

test("mobile filters retain URL state, trap focus, close with Escape and restore focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects?category=Health&view=map");
  const trigger = page.getByRole("button", {
    name: "Filter projects",
    exact: true,
  });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Filter projects" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Category", { exact: true })).toHaveValue(
    "Health",
  );
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog")),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await sheet.getByLabel("Search projects", { exact: true }).fill("community");
  await sheet.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/q=community/);
  await expect(page).toHaveURL(/view=map/);
  await expect(page).toHaveURL(/category=Health/);
});

test("sheet drag can reverse and resizing restores page scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects");
  await page
    .getByRole("button", { name: "Filter projects", exact: true })
    .click();
  const sheet = page.getByRole("dialog", { name: "Filter projects" });
  const handle = sheet.locator(".sheet-handle");
  const box = await handle.boundingBox();
  if (!box) throw new Error("Missing drag handle");
  await page.mouse.move(box.x + box.width / 2, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 100, { steps: 8 });
  await page.mouse.move(box.x + box.width / 2, box.y + 15, { steps: 8 });
  await page.mouse.up();
  await expect(sheet).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.getByLabel("Category", { exact: true })).toBeVisible();
});

test("mobile navigation and staff drawer work with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Reports", exact: true })
    .click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await page.goto("/preview/console");
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Review queue" })
    .click();
  await expect(page).toHaveURL(/view=review/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("public and staff screens remain accessible in both appearances", async ({
  page,
}) => {
  for (const theme of ["light", "dark"] as const) {
    for (const route of [
      "/",
      "/projects",
      "/staff/login",
      "/preview/console",
    ]) {
      await page.goto(route);
      await page.getByLabel("Appearance", { exact: true }).selectOption(theme);
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .map((animation) => animation.finished.catch(() => undefined)),
        );
      });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(results.violations, `${theme} ${route}`).toEqual([]);
    }
  }
});
