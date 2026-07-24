const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is required for the student workflow test.");
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

async function fillStudentForm(page, { school = "Example Secondary School", subjects = ["Chemistry"] } = {}) {
  await page.locator("#studentName").fill("Alex Chan");
  await page.locator("#studentChineseName").fill("陳同學");
  await page.locator("#studentSchool").fill(school);
  await page.locator("#studentSchoolYear").fill("Year 10");
  await page.locator("#studentContactNumber").fill("1234 5678");
  for (const subject of subjects) {
    const checkbox = page.locator(`input[name="subjects"][value="${subject}"]`);
    if (!(await checkbox.isChecked())) await checkbox.check();
  }
}

async function openAddStudent(page) {
  await page.click("#addNewStudent");
  await page.waitForFunction(() => document.querySelector("#staffDrawer")?.hidden === false);
  assert.equal(await page.locator("#studentName").evaluate((input) => document.activeElement === input), true);
}

async function runStudentWorkflow(browser, baseUrl, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.click('[data-module="startTest"]');
  await page.waitForFunction(() => document.querySelector("#module-startTest")?.hidden === false);
  const addButton = await page.locator("#addNewStudent").boundingBox();
  assert.ok(addButton && addButton.height >= 44);

  await openAddStudent(page);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#staffDrawer")?.hidden === true);
  await openAddStudent(page);
  await page.click('#studentForm button[type="submit"]');
  assert.equal(await page.locator("#studentFormErrors").isVisible(), true);
  assert.ok((await page.textContent("#studentNameError")).includes("required"));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("abilityReportCentreSystemV3")).students.length), 1);

  await fillStudentForm(page);
  const formBox = await page.locator("#studentForm").boundingBox();
  assert.ok(formBox && formBox.x >= 0 && formBox.x + formBox.width <= viewport.width);
  await page.click('#studentForm button[type="submit"]');
  await page.waitForFunction(() => document.querySelector("#staffDrawer")?.hidden === true);
  const studentState = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("abilityReportCentreSystemV3"));
    return { students: state.students, selected: selectedCentreStudentId };
  });
  assert.equal(studentState.students.length, 2);
  const alex = studentState.students.find((student) => student.studentName === "Alex Chan");
  assert.ok(alex);
  assert.equal(alex.studentId, "STU-0002");
  assert.deepEqual(alex.subjects, ["Chemistry"]);
  assert.equal(studentState.selected, alex.studentId);
  assert.ok((await page.textContent("#studentSearchResults")).includes("Alex Chan 陳同學"));
  assert.ok((await page.textContent("#startTestSummary")).includes("Alex Chan"));
  assert.ok((await page.textContent("#testTemplateList")).includes("Recommended for this student"));

  await openAddStudent(page);
  await fillStudentForm(page);
  await page.click('#studentForm button[type="submit"]');
  await page.waitForFunction(() => document.querySelector("#staffDrawerTitle")?.textContent.includes("similar student"));
  await page.click("#useExistingStudent");
  await page.waitForFunction(() => document.querySelector("#staffDrawer")?.hidden === true);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("abilityReportCentreSystemV3")).students.length), 2);

  await page.click(`[data-student-action="edit"][data-student-id="${alex.studentId}"]`);
  await page.locator("#studentSchool").fill("Updated Example Secondary School");
  await page.locator('input[name="subjects"][value="Mathematics"]').check();
  await page.click('#studentForm button[type="submit"]');
  await page.waitForFunction(() => document.querySelector("#staffDrawer")?.hidden === true);
  const edited = await page.evaluate((studentId) => JSON.parse(localStorage.getItem("abilityReportCentreSystemV3")).students.find((student) => student.studentId === studentId), alex.studentId);
  assert.equal(edited.school, "Updated Example Secondary School");
  assert.deepEqual([...edited.subjects].sort(), ["Chemistry", "Mathematics"]);
  assert.ok((await page.textContent("#studentSearchResults")).includes("Updated Example Secondary School"));
  assert.ok((await page.textContent("#startTestSummary")).includes("Alex Chan"));
  assert.deepEqual(errors, []);
  await context.close();
}

(async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  try {
    await runStudentWorkflow(browser, baseUrl, { width: 1440, height: 950 });
    await runStudentWorkflow(browser, baseUrl, { width: 1180, height: 820 });
    await runStudentWorkflow(browser, baseUrl, { width: 768, height: 1024 });
    console.log("PASS student creation, duplicate handling, and edit workflow on desktop and iPad viewports");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})();
