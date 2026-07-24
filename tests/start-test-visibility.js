const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is required for the rendered Start Test visibility test.");
  console.error("Set NODE_PATH to the bundled runtime node_modules or install Playwright before running this test.");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const RETURN_GUARD_DURATION_MS = 3000;
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json"
};

function isTransparent(value) {
  if (!value || value === "transparent") return true;
  const alpha = value.match(/rgba?\(([^)]+)\)/)?.[1].split(",").map((part) => Number(part.trim()))[3];
  return alpha === 0;
}

function isWhite(value) {
  const parts = value.match(/rgba?\(([^)]+)\)/)?.[1].split(",").map((part) => Number(part.trim()));
  if (!parts || parts.length < 3) return false;
  const alpha = parts.length >= 4 ? parts[3] : 1;
  return parts[0] >= 250 && parts[1] >= 250 && parts[2] >= 250 && alpha > 0.95;
}

function createServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const relativePath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1);

    if (relativePath === "deployment.json") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ version: "1.5.2", sha: "test", deployedAt: "test" }));
      return;
    }

    if (relativePath === "favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    const filePath = path.normalize(path.join(root, relativePath));

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
      });
      response.end(content);
    });
  });
}

(async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addInitScript(() => window.localStorage.clear());
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.click('[data-module="startTest"]');
    await page.waitForFunction(() => document.querySelector("#module-startTest")?.hidden === false);
    await page.waitForSelector("#startSelectedTest");

    assert.equal(await page.$eval("#startSelectedTest", (button) => button.disabled), true);
    await page.click('[data-student-id="STU-001"]');
    const summaryText = await page.textContent("#startTestSummary");
    assert.ok(summaryText.includes("Demo Student A"), `Expected Demo Student A after explicit selection, got: ${summaryText}`);
    assert.ok(summaryText.includes("IGCSE Chemistry Trial Test (Mixed Difficulty)"), `Expected Chemistry test to be selected, got: ${summaryText}`);

    const state = await page.$eval("#startSelectedTest", (button) => {
      const style = window.getComputedStyle(button);
      const box = button.getBoundingClientRect();
      return {
        exists: Boolean(button),
        hidden: button.hidden,
        disabled: button.disabled,
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        height: box.height,
        backgroundColor: style.backgroundColor,
        color: style.color,
        text: button.textContent.trim()
      };
    });

    assert.equal(state.exists, true);
    assert.equal(state.hidden, false);
    assert.equal(state.disabled, false);
    assert.notEqual(state.display, "none");
    assert.equal(state.visibility, "visible");
    assert.ok(state.opacity > 0, `Expected opacity > 0, got ${state.opacity}`);
    assert.ok(state.height >= 48, `Expected height at least 48px, got ${state.height}`);
    assert.equal(isTransparent(state.backgroundColor), false, `Expected non-transparent background, got ${state.backgroundColor}`);
    assert.equal(isWhite(state.color) && isWhite(state.backgroundColor), false, `Foreground and background are both white: ${state.color} / ${state.backgroundColor}`);
    assert.ok(state.text.includes("Prepare Test"), `Unexpected button text: ${state.text}`);

    await page.evaluate(() => {
      window.__prepareSelectedTestCallCount = 0;
      const original = prepareSelectedTest;
      prepareSelectedTest = function patchedPrepareSelectedTest(...args) {
        window.__prepareSelectedTestCallCount += 1;
        return original.apply(this, args);
      };
    });

    await page.click("#startSelectedTest");
    await page.waitForFunction(() => window.__prepareSelectedTestCallCount === 1);
    await page.waitForFunction(() => document.querySelector("#testMode")?.hidden === false);
    await page.waitForFunction(() => document.querySelector("#sessionGate")?.hidden === false);
    assert.equal(await page.$eval("#testTimer", (timer) => timer.textContent), "--:--");
    await page.click("#beginPreparedTest");
    await page.waitForFunction(() => document.querySelector(".test-mode-shell")?.hidden === false);

    await page.evaluate(() => finaliseActiveTestSubmission(false));
    await page.waitForFunction(() => document.querySelector("#completionScreen")?.hidden === false);

    await page.click("#returnToDashboard");
    await page.waitForFunction(() => document.querySelector("#completionGuardStatus")?.textContent.includes("Please hold"));
    assert.equal(await page.$eval("#testMode", (testMode) => testMode.hidden), false);

    const returnButtonBox = await page.locator("#returnToDashboard").boundingBox();
    assert.ok(returnButtonBox, "Expected return button to have a rendered bounding box");
    await page.mouse.move(returnButtonBox.x + returnButtonBox.width / 2, returnButtonBox.y + returnButtonBox.height / 2);
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector("#completionGuardStatus")?.textContent.includes("Keep holding"));
    await page.waitForTimeout(RETURN_GUARD_DURATION_MS + 250);
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector("#testMode")?.hidden === true);
    await page.waitForFunction(() => document.querySelector("#module-dashboard")?.hidden === false);
    assert.deepEqual(consoleErrors, []);
    console.log("PASS explicit preparation, student begin, submission completion, and guarded dashboard return");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})();
