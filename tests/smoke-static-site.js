const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function buttonTags(source) {
  return source.match(/<button\b[^>]*>/g) || [];
}

const buttonIssues = [...buttonTags(index), ...buttonTags(app)].filter((tag) => {
  return !/(\bid=|\bdata-|disabled|aria-disabled)/.test(tag);
});

assert.equal(buttonIssues.length, 0, `Buttons missing an intentional action: ${buttonIssues.join(", ")}`);
assert.ok(index.includes("Centre-operated assessment system"));
assert.ok(index.includes("Question Bank / 題目庫"));
assert.ok(index.includes("?v=1.5.1"));
assert.ok(index.includes('<section id="printableReport" hidden>'));
assert.ok(index.includes('<section id="printRoot" class="print-root" aria-hidden="true"></section>'));
assert.ok(index.includes('id="reportModuleMount"'));
assert.ok(app.includes("mountPrintableReport();"));
assert.ok(app.includes('printableReport.hidden = moduleName !== "reports"'));
assert.ok(app.includes("resizeReportCharts();"));
assert.ok(app.includes("buildPrintableReportClone"));
assert.ok(app.includes("printActiveReport"));
assert.ok(app.includes("canvasToPrintImage"));
assert.ok(app.includes("data-question-action=\"preview\""));
assert.ok(app.includes("data-question-action=\"duplicate\""));
assert.ok(app.includes("data-question-action=\"add-to-test\""));
assert.ok(app.includes("data-question-action=\"view-results\""));
assert.ok(app.includes("data-builder-action=\"preview-test\""));
assert.ok(index.includes("Device guard only"));
assert.ok(index.includes("Prepare Test / 準備測驗"));
assert.ok(index.includes("Begin Test / 正式開始"));
assert.ok(index.includes("Add New Student / 新增學生"));
assert.ok(index.includes('id="addNewStudent"'));
assert.ok(index.includes("Public prototype only."));
assert.ok(index.includes("Topic Performance"));
assert.equal(index.includes("Strong / Weak Topic Map"), false);
assert.ok(app.includes("abilityReportCentreSystemV3"));
assert.ok(app.includes("isSessionFullyMarked"));
assert.ok(app.includes("DemoLocalAnswerProvider"));
assert.ok(app.includes("generateNextStudentId"));
assert.ok(app.includes("validateStudentInput"));
assert.ok(app.includes("groupPublishedTestsForStudent"));

console.log("PASS static smoke checks");
