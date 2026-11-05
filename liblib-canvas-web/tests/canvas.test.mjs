import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 4175;
const url = `http://127.0.0.1:${port}`;
const png = {
  name: "pixel.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/RZkAAAAASUVORK5CYII=",
    "base64",
  ),
};

async function serverReady() {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Server did not start");
}

test("canvas: projects, uploads, queue, results and persistence", async () => {
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  let browser;
  try {
    await serverReady();
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await page.locator(".node").first().waitFor();
    assert.equal(await page.locator(".node").count(), 4);
    await page.click("#new-project");
    assert.equal(await page.locator(".node").count(), 0);
    await page.click("#add-node");
    await page.getByText("Thêm văn bản").click();
    await page.locator(".node.text .node-card").dblclick();
    await page.fill("#edit-title", "Ghi chú kiểm tra");
    await page.fill("#edit-text", "Nội dung đã lưu");
    await page.click("#edit-save");
    assert.match(
      await page.locator(".node.text").textContent(),
      /Nội dung đã lưu/,
    );
    await page.click("#add-node");
    await page.getByText("Nút hình ảnh", { exact: false }).last().click();
    assert.equal(await page.locator(".node.empty").count(), 1);
    await page.locator(".node.empty [data-empty-action=upload]").click();
    await page.locator("#file-input").setInputFiles(png);
    await page.waitForFunction(() => document.querySelectorAll(".node.empty").length === 0);
    assert.equal(await page.locator(".node").count(), 2);
    if (await page.locator("#composer-reopen").isVisible())
      await page.click("#composer-reopen");
    await page.fill("#prompt-input", "Một bông hoa đỏ");
    await page.click("#submit-prompt");
    assert.equal(await page.locator("#queue-count").textContent(), "1");
    await page.locator("[data-attach]").first().click();
    await page.locator("#file-input").setInputFiles(png);
    await page.waitForFunction(
      () => document.querySelector("#queue-count")?.textContent === "0",
    );
    assert.equal(await page.locator(".node.image").count(), 2);
    await page.waitForTimeout(400);
    await page.reload();
    await page.locator(".node").first().waitFor();
    assert.equal(await page.locator(".node").count(), 4);
    assert.equal(await page.locator("#queue-count").textContent(), "0");
    assert.match(
      await page.locator(".node.text").textContent(),
      /Nội dung đã lưu/,
    );
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    await browser?.close();
    server.kill();
  }
});

test("responsive shell does not overflow viewport", async () => {
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  let browser;
  try {
    await serverReady();
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    for (const width of [1440, 768, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(url);
      await page.locator(".node").first().waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `overflow at ${width}`,
      );
      assert.equal(await page.locator(".bottom-dock").isVisible(), true);
      await page.close();
    }
  } finally {
    await browser?.close();
    server.kill();
  }
});
