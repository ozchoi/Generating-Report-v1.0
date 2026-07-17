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
assert.ok(index.includes("?v=1.4.2"));
assert.ok(index.includes('<section id="printableReport" hidden>'));
assert.ok(index.includes('id="reportModuleMount"'));
assert.ok(app.includes("mountPrintableReport();"));
assert.ok(app.includes('printableReport.hidden = moduleName !== "reports"'));
assert.ok(app.includes("resizeReportCharts();"));
assert.ok(app.includes("data-question-action=\"preview\""));
assert.ok(app.includes("data-question-action=\"duplicate\""));
assert.ok(app.includes("data-question-action=\"add-to-test\""));
assert.ok(app.includes("data-question-action=\"view-results\""));
assert.ok(app.includes("data-builder-action=\"preview-test\""));
assert.ok(index.includes("Device guard only"));

console.log("PASS static smoke checks");
