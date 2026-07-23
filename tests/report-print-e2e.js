const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is required for the v1.5.1 report print test.");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const outputDir = path.join(root, "test-output");
const pdfPath = path.join(outputDir, "report.pdf");
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
      response.end(JSON.stringify({ version: "1.5.1", sha: "test", deployedAt: "test" }));
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
      this.ctx.lineTo(this.canvas.width * 0.35, this.canvas.height * 0.5);
      this.ctx.lineTo(this.canvas.width * 0.7, this.canvas.height * 0.25);
      this.ctx.lineTo(this.canvas.width - 36, 58);
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

async function openReportsWithoutSelection(page) {
  await page.click('[data-module="reports"]');
  await page.waitForFunction(() => document.querySelector("#module-reports")?.hidden === false);
  assert.equal(await page.$eval("#printReportInline", (button) => button.disabled), true);
  assert.equal(await page.$eval("#exportPdf", (button) => button.disabled), true);
  assert.ok((await page.textContent("#selectedReportMeta")).includes("Select a report before printing."));
}

async function openFirstReport(page) {
  await page.click("#reportSnapshotList [data-report-id]");
  await page.waitForFunction(() => document.querySelector("#printableReport")?.hidden === false);
  assert.equal(await page.$eval("#printReportInline", (button) => button.disabled), false);
  assert.equal(await page.$eval("#exportPdf", (button) => button.disabled), false);
}

async function preparePrintRoot(page, selector = "#printReportInline") {
  await page.evaluate(() => {
    window.__printCount = window.__printCount || 0;
    window.print = () => {
      window.__printCount += 1;
    };
  });
  await page.click(selector);
  await page.waitForFunction(() => document.querySelector("#printRoot")?.children.length > 0);
}

async function runReportPrintFlow(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  await context.addInitScript(() => localStorage.clear());
  await context.addInitScript(installChartStub);
  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  await openReportsWithoutSelection(page);
  await openFirstReport(page);
  await preparePrintRoot(page);

  const printText = await page.textContent("#printRoot");
  assert.ok(printText.includes("Student Performance Report"));
  assert.ok(printText.includes("Demo Student A"));
  assert.ok(printText.includes("Chemistry"));
  assert.ok(printText.includes("34/48"));
  assert.ok(printText.includes("Demo Student A — Chemistry Baseline Report"));
  assert.ok(printText.includes("Topic Performance and Learning Priorities"));
  assert.ok(await page.locator("#printRoot table").count() >= 1);

  const images = await page.$$eval("#printRoot img.print-chart-image", (items) => items.map((image) => image.src));
  assert.ok(images.some((src) => src.startsWith("data:image/png") && src.length > 1000));

  await page.emulateMedia({ media: "print" });
  const printBox = await page.locator("#printRoot").boundingBox();
  assert.ok(printBox && printBox.width > 500 && printBox.height > 500);
  assert.equal(await page.locator(".app-shell").boundingBox(), null);
  assert.ok(await page.locator("#printRoot").getByText("Student Performance Report").isVisible());

  fs.mkdirSync(outputDir, { recursive: true });
  await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
  const pdfSize = fs.statSync(pdfPath).size;
  assert.ok(pdfSize > 20 * 1024, `Expected printed PDF to be larger than 20 KB; got ${pdfSize}`);
  await page.emulateMedia({ media: "screen" });

  await page.click("#exportPdf");
  await page.waitForFunction(() => window.__printCount >= 2);
  assert.ok((await page.textContent("#printRoot")).includes("Student Performance Report"));

  await page.evaluate(() => {
    cleanupPrintedReport();
    const trend = document.querySelector("#trendChart");
    if (trend) {
      trend.width = 0;
      trend.height = 0;
      trend.toDataURL = () => {
        throw new Error("Deliberately broken chart for print test");
      };
    }
    window.Chart = function BrokenPrintChart() {
      throw new Error("Deliberately broken temporary chart render");
    };
  });
  await preparePrintRoot(page);
  const fallbackText = await page.textContent("#printRoot");
  assert.ok(fallbackText.includes("Chart unavailable. The table evidence below remains available."));
  assert.ok(fallbackText.includes("Demo Student A — Chemistry Baseline Report"));

  assert.deepEqual(errors, []);
  await context.close();
  return pdfSize;
}

(async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  try {
    const pdfSize = await runReportPrintFlow(browser, baseUrl);
    console.log(`PASS v1.5.1 report print and PDF workflow (${pdfSize} bytes)`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})();
