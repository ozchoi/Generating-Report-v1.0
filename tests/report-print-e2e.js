const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is required for the v1.5.2 report print test.");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const outputDir = path.join(root, "test-output");
const renderedDir = path.join(outputDir, "rendered-pages-v1.5.2");
const pdfPath = path.join(outputDir, "student-performance-report-v1.5.2.pdf");
const bundledRoot = path.join(process.env.HOME || "", ".cache/codex-runtimes/codex-primary-runtime/dependencies");
const pythonExecutable = process.env.PYTHON || (fs.existsSync(path.join(bundledRoot, "python/bin/python3")) ? path.join(bundledRoot, "python/bin/python3") : "python3");
const pdftoppmExecutable = process.env.PDFTOPPM || (fs.existsSync(path.join(bundledRoot, "bin/override/pdftoppm")) ? path.join(bundledRoot, "bin/override/pdftoppm") : "pdftoppm");
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

function extractPdfPages(pdfFile) {
  const script = `
import json, pdfplumber, sys
with pdfplumber.open(sys.argv[1]) as pdf:
    print(json.dumps([page.extract_text() or "" for page in pdf.pages]))
`;
  const result = childProcess.spawnSync(pythonExecutable, ["-c", script, pdfFile], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw result.error || new Error(result.stderr || "PDF text extraction failed");
  }
  return JSON.parse(result.stdout);
}

function renderPdfPages(pdfFile) {
  fs.rmSync(renderedDir, { recursive: true, force: true });
  fs.mkdirSync(renderedDir, { recursive: true });
  const prefix = path.join(renderedDir, "page");
  const result = childProcess.spawnSync(pdftoppmExecutable, ["-png", "-r", "130", pdfFile, prefix], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw result.error || new Error(result.stderr || "PDF rendering failed");
  }
  return fs.readdirSync(renderedDir).filter((file) => file.endsWith(".png")).sort().map((file) => path.join(renderedDir, file));
}

function countOccurrences(source, needle) {
  return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
}

function pageIncludes(source, needle) {
  const normalise = (value) => value.toLowerCase().replace(/\s+/g, " ").trim();
  return normalise(source).includes(normalise(needle));
}

function pageContainsTopic(source, topic) {
  const normalisedSource = source.toLowerCase();
  return topic.toLowerCase().split(/\s+/).every((word) => normalisedSource.includes(word));
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

  const printState = await page.evaluate(() => {
    const snapshot = centreState.reportSnapshots.find((report) => report.id === activeReportSnapshotId);
    return {
      reportId: activeReportSnapshotId,
      printRootReportId: document.querySelector("#printRoot")?.dataset.reportId,
      printRootStudentId: document.querySelector("#printRoot")?.dataset.studentId,
      printRootSubject: document.querySelector("#printRoot")?.dataset.subject,
      snapshotStudentId: snapshot.studentId,
      snapshotSubject: snapshot.subjectName,
      evidenceStudentId: snapshot.evidenceJson.student.id,
      evidenceSubject: snapshot.evidenceJson.subject.name,
      assessmentCount: snapshot.evidenceJson.dataQuality.assessmentCount,
      progressPoints: snapshot.evidenceJson.overallProgress.assessments.length,
      latestMark: `${snapshot.evidenceJson.latestAssessment.markAwarded}/${snapshot.evidenceJson.latestAssessment.maximumMark}`,
      topicNames: snapshot.evidenceJson.topicProfile.map((topic) => topic.label),
      narrative: snapshot.editedNarrative || snapshot.generatedNarrative
    };
  });
  assert.equal(printState.printRootReportId, printState.reportId);
  assert.equal(printState.printRootStudentId, printState.snapshotStudentId);
  assert.equal(printState.printRootSubject, printState.snapshotSubject);
  assert.equal(printState.evidenceStudentId, printState.snapshotStudentId);
  assert.equal(printState.evidenceSubject, printState.snapshotSubject);
  assert.equal(printState.assessmentCount, printState.progressPoints);

  const printText = await page.textContent("#printRoot");
  assert.ok(printText.includes("Student Performance Report"));
  assert.ok(printText.includes("Demo Student A"));
  assert.ok(printText.includes("Chemistry"));
  assert.ok(printText.includes(printState.latestMark));
  assert.equal(printText.includes("Siu Ming"), false);
  assert.equal(await page.locator("#printRoot .report-print-narrative").count(), 1);
  assert.equal(await page.locator("#printRoot .print-sheet").count(), 5);
  assert.equal(await page.locator("#printRoot .print-topic-table tbody tr").count(), 12);
  assert.ok(await page.locator("#printRoot img.print-chart-image").count() >= 3);

  await page.emulateMedia({ media: "print" });
  const printBox = await page.locator("#printRoot").boundingBox();
  assert.ok(printBox && printBox.width > 500 && printBox.height > 500);
  assert.equal(await page.locator(".app-shell").boundingBox(), null);

  fs.mkdirSync(outputDir, { recursive: true });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" }
  });
  const pdfSize = fs.statSync(pdfPath).size;
  assert.ok(pdfSize > 20 * 1024, `Expected printed PDF to be larger than 20 KB; got ${pdfSize}`);
  const pages = extractPdfPages(pdfPath);
  const allText = pages.join("\n");
  assert.equal(pages.length, 5);

  assert.ok(pageIncludes(pages[0], "Student Performance Report"));
  assert.ok(pageIncludes(pages[0], "Latest Assessment"));
  assert.ok(pageIncludes(pages[0], "Assessment Progress"));
  assert.ok(pageIncludes(pages[0], "By Topic"));
  assert.ok(pageIncludes(pages[0], "By Question Type"));

  assert.ok(pageIncludes(pages[1], "Assessment Score Overview"));
  assert.ok(pageIncludes(pages[1], "Performance by Question Difficulty"));

  assert.ok(pageIncludes(pages[2], "Topic Performance and Learning Priorities"));
  printState.topicNames.forEach((topic) => {
    assert.ok(pageContainsTopic(pages[2], topic), `Expected topic on page 3: ${topic}`);
  });

  assert.ok(pageIncludes(pages[3], "Evidence Coverage"));
  assert.ok(pageIncludes(pages[3], "Mark-Loss Patterns"));
  assert.ok(pageIncludes(pages[3], "Topic Performance Across Assessments"));

  assert.ok(pageIncludes(pages[4], "Student Performance Summary"));
  assert.ok(pageIncludes(pages[4], "Page generated from the centre assessment prototype."));
  assert.equal(countOccurrences(allText, "Student Performance Summary"), 1);
  assert.equal(countOccurrences(allText, printState.narrative.split("\n").find(Boolean)), 1);
  assert.equal(allText.includes("Siu Ming"), false);
  assert.ok(allText.includes(printState.latestMark));

  const renderedPages = renderPdfPages(pdfPath);
  assert.equal(renderedPages.length, 5);

  await page.emulateMedia({ media: "screen" });
  await page.click("#exportPdf");
  await page.waitForFunction(() => window.__printCount >= 2);
  assert.equal(await page.evaluate(() => document.querySelector("#printRoot")?.dataset.reportId === activeReportSnapshotId), true);

  await page.evaluate(() => {
    cleanupPrintedReport();
    window.Chart = function BrokenPrintChart() {
      throw new Error("Deliberately broken temporary chart render");
    };
  });
  await preparePrintRoot(page);
  const fallbackText = await page.textContent("#printRoot");
  assert.ok(fallbackText.includes("Chart unavailable. The table evidence below remains available."));
  assert.ok(fallbackText.includes("Demo Student A"));

  assert.deepEqual(errors, []);
  await context.close();
  return { pdfSize, pageCount: pages.length, renderedPages };
}

(async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  try {
    const { pdfSize, pageCount, renderedPages } = await runReportPrintFlow(browser, baseUrl);
    console.log(`PASS v1.5.2 report print layout (${pageCount} pages, ${pdfSize} bytes)`);
    console.log(`Rendered pages: ${renderedPages.join(", ")}`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})();
