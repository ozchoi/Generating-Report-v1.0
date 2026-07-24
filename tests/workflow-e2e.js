const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is required for the v1.5.2 workflow test.");
  console.error("Set NODE_PATH to the bundled runtime node_modules or install Playwright before running this test.");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".md": "text/markdown"
};

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
      response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
      response.end(content);
    });
  });
}

function collectErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

function clearLocalStorageOnce() {
  if (sessionStorage.getItem("__workflowE2eInitialised")) return;
  localStorage.clear();
  sessionStorage.setItem("__workflowE2eInitialised", "true");
}

function installChartStub() {
  if (window.Chart) return;
  window.Chart = class {
    constructor(target, config) {
      this.canvas = target?.canvas || target;
      this.ctx = this.canvas?.getContext?.("2d") || null;
      this.config = { type: config.type };
      this.data = config.data || {};
      this.options = config.options || {};
      this._destroyed = false;
      this.draw();
    }

    draw() {
      if (!this.canvas || !this.ctx || this._destroyed) return;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.max(640, Math.round(rect.width || this.canvas.width || 640));
      this.canvas.height = Math.max(320, Math.round(rect.height || this.canvas.height || 360));
      this.ctx.fillStyle = "#ffffff";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.strokeStyle = "#2563eb";
      this.ctx.lineWidth = 6;
      this.ctx.beginPath();
      this.ctx.moveTo(32, this.canvas.height - 42);
      this.ctx.lineTo(this.canvas.width * 0.45, this.canvas.height * 0.42);
      this.ctx.lineTo(this.canvas.width - 36, 44);
      this.ctx.stroke();
      this.ctx.fillStyle = "#17202a";
      this.ctx.font = "24px sans-serif";
      this.ctx.fillText(this.data.datasets?.[0]?.label || "Report chart", 32, 42);
    }

    resize() {
      this.draw();
    }

    update() {
      this.draw();
    }

    destroy() {
      this._destroyed = true;
    }
  };
}

async function prepareAssessment(page) {
  await page.click('[data-module="startTest"]');
  await page.waitForFunction(() => document.querySelector("#module-startTest")?.hidden === false);
  assert.equal(await page.$eval("#startSelectedTest", (button) => button.disabled), true);
  await page.click('[data-student-id="STU-001"]');
  await page.click("#startSelectedTest");
  await page.waitForFunction(() => document.querySelector("#sessionGate")?.hidden === false);
  const prepared = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("abilityReportCentreSystemV3"));
    return state.testSessions.find((session) => session.status === "Prepared");
  });
  assert.ok(prepared);
  assert.equal(prepared.startedAt, "");
  assert.equal(prepared.deadlineAt, "");
  return prepared.id;
}

async function holdReturnToDashboard(page) {
  const box = await page.locator("#returnToDashboard").boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3250);
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector("#testMode")?.hidden === true);
}

async function runCompleteFlow(browser, baseUrl, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(clearLocalStorageOnce);
  await context.addInitScript(installChartStub);
  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const sessionId = await prepareAssessment(page);
  assert.ok((await page.textContent("#sessionGateBody")).includes("30 minutes"));
  await page.click("#beginPreparedTest");
  await page.waitForFunction(() => document.querySelector(".test-mode-shell")?.hidden === false);
  const running = await page.evaluate((id) => {
    const state = JSON.parse(localStorage.getItem("abilityReportCentreSystemV3"));
    return state.testSessions.find((session) => session.id === id);
  }, sessionId);
  assert.equal(running.status, "In progress");
  assert.ok(running.startedAt);
  assert.ok(running.deadlineAt);

  await page.click('#testAnswerArea [data-answer="B"]');
  await page.click('#testQuestionNav [data-question-index="12"]');
  await page.click('#testAnswerArea [data-answer="True"]');
  await page.click('#testQuestionNav [data-question-index="24"]');
  const written = page.locator('#testAnswerArea [data-answer-field="text"]');
  await written.fill("Isotopes have the same number of protons");
  await page.waitForTimeout(950);
  assert.equal(await written.evaluate((element) => document.activeElement === element), true);
  await written.press("End");
  await written.type(" and a different number of neutrons.");
  await page.waitForTimeout(950);
  assert.equal(await written.inputValue(), "Isotopes have the same number of protons and a different number of neutrons.");
  assert.equal(await written.evaluate((element) => document.activeElement === element), true);
  await page.click("#flagQuestion");
  const progress = await page.textContent("#testProgressSummary");
  assert.ok(progress.includes("3 of 36 answered"));
  assert.ok(progress.includes("1 flagged"));

  await page.click("#submitTest");
  await page.waitForFunction(() => document.querySelector("#submitReviewDialog")?.hidden === false);
  assert.equal(await page.locator(".review-question-section").count(), 2);
  assert.equal(await page.locator('.review-question-section:first-of-type [data-review-jump]').count(), 33);
  assert.ok((await page.textContent("#submitReviewDialog")).includes("responses will be locked"));
  await page.click('[data-submit-review-action="confirm"]');
  await page.waitForFunction(() => document.querySelector("#completionScreen")?.hidden === false);
  await holdReturnToDashboard(page);

  await page.click('[data-module="marking"]');
  await page.waitForFunction(() => document.querySelector("#module-marking")?.hidden === false);
  assert.ok((await page.textContent("#markingPanel")).includes("Rule-based marking suggestion"));
  assert.ok((await page.textContent("#markingPanel")).includes("Same number of protons"));
  for (let index = 0; index < 12; index += 1) {
    const responseId = await page.evaluate((id) => {
      const state = JSON.parse(localStorage.getItem("abilityReportCentreSystemV3"));
      return state.studentResponses.find((response) => response.testSessionId === id && !Number.isFinite(response.markAwarded))?.id || "";
    }, sessionId);
    if (!responseId) break;
    await page.click(`[data-response-id="${responseId}"] [data-marking-action="approve"]`);
    await page.waitForTimeout(40);
  }
  const markedStatus = await page.evaluate((id) => {
    const state = JSON.parse(localStorage.getItem("abilityReportCentreSystemV3"));
    return state.testSessions.find((session) => session.id === id).status;
  }, sessionId);
  assert.equal(markedStatus, "Marked");

  await page.click('[data-marking-action="filter"][data-marking-filter="Marked"]');
  await page.waitForSelector('[data-marking-action="generate-report"]:not([disabled])');
  await page.click('[data-marking-action="generate-report"]');
  await page.waitForFunction(() => document.querySelector("#module-reports")?.hidden === false);
  await page.waitForFunction(() => document.querySelector("#printableReport")?.hidden === false);
  const textarea = page.locator("#reportText");
  const generated = await textarea.inputValue();
  await textarea.fill(`${generated}\n\nTutor note: reviewed with the student.`);
  await page.click("#saveReportDraft");
  await page.click("#finaliseReport");
  assert.equal(await textarea.getAttribute("readonly"), "");
  assert.equal(await page.locator("#createReportRevision").isVisible(), true);
  const finalId = await page.evaluate(() => activeReportSnapshotId);
  const finalNarrative = await textarea.inputValue();
  await page.click("#createReportRevision");
  assert.equal(await textarea.getAttribute("readonly"), null);
  const versions = await page.evaluate((originalId) => {
    const state = JSON.parse(localStorage.getItem("abilityReportCentreSystemV3"));
    const original = state.reportSnapshots.find((report) => report.id === originalId);
    const revision = state.reportSnapshots.find((report) => report.parentReportId === originalId && report.status === "Draft");
    return { original, revision };
  }, finalId);
  assert.equal(versions.original.status, "Final");
  assert.equal(versions.original.editedNarrative, finalNarrative);
  assert.ok(versions.revision);

  await page.evaluate(() => {
    window.__printCount = 0;
    window.print = () => {
      window.__printCount += 1;
    };
  });
  await page.click("#printReportInline");
  await page.waitForFunction(() => document.querySelector("#printRoot")?.children.length > 0);
  assert.equal(await page.evaluate(() => window.__printCount), 1);
  assert.ok((await page.textContent("#printRoot")).includes("Student Performance Report"));
  assert.equal(await page.locator("#printRoot .report-actions").count(), 0);
  assert.ok(await page.locator("#printRoot img.print-chart-image").count() >= 1);
  await page.emulateMedia({ media: "print" });
  const printBox = await page.locator("#printRoot").boundingBox();
  assert.ok(printBox && printBox.width > 500 && printBox.height > 500);
  assert.equal(await page.locator(".app-shell").boundingBox(), null);
  await page.emulateMedia({ media: "screen" });

  assert.deepEqual(errors, []);
  await context.close();
}

async function runRecoveryFlow(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await context.addInitScript(clearLocalStorageOnce);
  await context.addInitScript(installChartStub);
  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const sessionId = await prepareAssessment(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#sessionGate")?.hidden === false);
  assert.equal((await page.textContent("#sessionGateEyebrow")).trim(), "Assessment ready");
  await page.click("#beginPreparedTest");
  await page.click('#testAnswerArea [data-answer="B"]');
  const deadlineBefore = await page.evaluate((id) => {
    const state = JSON.parse(localStorage.getItem("abilityReportCentreSystemV3"));
    return state.testSessions.find((session) => session.id === id).deadlineAt;
  }, sessionId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#sessionGate")?.hidden === false);
  assert.equal((await page.textContent("#sessionGateEyebrow")).trim(), "Assessment in progress");
  await page.click("#resumeActiveTest");
  assert.equal(await page.locator('#testAnswerArea [data-answer="B"]').getAttribute("class").then((value) => value.includes("selected")), true);
  const deadlineAfter = await page.evaluate((id) => {
    const state = JSON.parse(localStorage.getItem("abilityReportCentreSystemV3"));
    return state.testSessions.find((session) => session.id === id).deadlineAt;
  }, sessionId);
  assert.equal(deadlineAfter, deadlineBefore);
  assert.deepEqual(errors, []);
  await context.close();
}

async function runPortraitLayout(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await context.addInitScript(clearLocalStorageOnce);
  await context.addInitScript(installChartStub);
  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.click('[data-module="startTest"]');
  await page.click('[data-student-id="STU-001"]');
  const buttonBox = await page.locator("#startSelectedTest").boundingBox();
  assert.ok(buttonBox && buttonBox.height >= 48 && buttonBox.width <= 768);
  assert.deepEqual(errors, []);
  await context.close();
}

(async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  try {
    await runCompleteFlow(browser, baseUrl, { width: 1440, height: 950 });
    await runCompleteFlow(browser, baseUrl, { width: 1180, height: 820 });
    await runCompleteFlow(browser, baseUrl, { width: 768, height: 1024 });
    await runRecoveryFlow(browser, baseUrl);
    await runPortraitLayout(browser, baseUrl);
    console.log("PASS v1.5.2 desktop and iPad assessment workflows");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})();
