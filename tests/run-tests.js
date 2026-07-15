const assert = require("assert");
const core = require("../app.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function sampleEvidence() {
  const sample = core.createChemistrySample();
  return core.buildStudentReportEvidence(sample.assessments, sample.questions, sample.responses, {
    studentName: "Amelia Chan",
    subject: "Chemistry",
    reportDate: new Date("2026-10-15T00:00:00")
  });
}

test("automatic marking handles exact MCQ answers", () => {
  const marked = core.applyAutomaticMarking({
    assessment: { assessmentId: "A1" },
    question: { assessmentId: "A1", questionId: "Q1", questionType: "MCQ", maximumMark: 1, correctAnswer: "B", answerMode: "exact" },
    response: { assessmentId: "A1", questionId: "Q1", studentAnswer: " b ", markAwarded: null, markingMethod: "", errorCode: "" }
  });
  assert.equal(marked.markAwarded, 1);
  assert.equal(marked.markingMethod, "automatic");
});

test("automatic marking handles numeric tolerance and units", () => {
  assert.equal(core.markNumericAnswer({ correctAnswer: "9.8 m/s2", numericalTolerance: 0.2, requiredUnit: "m/s2" }, "9.7 m/s2"), true);
  assert.equal(core.markNumericAnswer({ correctAnswer: "9.8 m/s2", numericalTolerance: 0.2, requiredUnit: "m/s2" }, "9.7 N"), false);
});

test("assessment progress uses one total per assessment", () => {
  const evidence = sampleEvidence();
  assert.equal(evidence.overallProgress.assessments.length, 4);
  assert.equal(evidence.overallProgress.assessments[0].maximumMark, 48);
  assert.equal(evidence.dataQuality.questionCount, 36);
  assert.equal(evidence.dataQuality.blueprintRowCount, 144);
});

test("topic mastery is recency weighted and confidence uses assessments and marks", () => {
  const evidence = sampleEvidence();
  const topic = evidence.topicProfile.find((item) => item.label === "Stoichiometry");
  assert.ok(topic);
  assert.ok(topic.assessmentCount >= 4);
  assert.notEqual(topic.confidence, "Insufficient evidence");
  assert.ok(topic.mastery >= 0 && topic.mastery <= 100);
});

test("trend requires at least three assessment-level points", () => {
  assert.equal(core.calculateTrend([{ date: "2026-01-01", percentage: 60 }, { date: "2026-02-01", percentage: 70 }]).label, "Not enough history");
  assert.equal(core.calculateTrend([
    { date: "2026-01-01", percentage: 60 },
    { date: "2026-02-01", percentage: 65 },
    { date: "2026-03-01", percentage: 72 }
  ]).label, "Improving");
});

test("validation excludes impossible marks and reports unmatched responses", () => {
  const assessments = [{ assessmentId: "A1", maximumMark: 1 }];
  const questions = [{ assessmentId: "A1", questionId: "Q1", maximumMark: 1 }];
  const rawResponses = [{ studentId: "S1", assessmentId: "A2", questionId: "Q9" }];
  const joined = [{
    assessment: { assessmentId: "A1" },
    question: { assessmentId: "A1", questionId: "Q1", topic: "Atoms", difficulty: "Easy", questionType: "MCQ" },
    markAwarded: 2,
    maximumMark: 1
  }];
  const validation = core.validateData(assessments, questions, rawResponses, joined);
  assert.equal(validation.unmatchedResponses, 1);
  assert.equal(validation.validJoined.length, 0);
});

test("forecast is unavailable before four comparable assessments", () => {
  const forecast = core.buildForecastEvidence([
    { date: "2026-01-01", percentage: 60, maximumMark: 50 },
    { date: "2026-02-01", percentage: 65, maximumMark: 50 },
    { date: "2026-03-01", percentage: 70, maximumMark: 50 }
  ]);
  assert.equal(forecast.available, false);
});

test("forecast includes a sensible 1 SD range when allowed", () => {
  const forecast = core.buildForecastEvidence([
    { date: "2026-01-01", percentage: 60, maximumMark: 50 },
    { date: "2026-02-01", percentage: 64, maximumMark: 50 },
    { date: "2026-03-01", percentage: 70, maximumMark: 50 },
    { date: "2026-04-01", percentage: 73, maximumMark: 50 }
  ]);
  assert.equal(forecast.available, true);
  assert.ok(forecast.lowerPercentage < forecast.nextPercentage);
  assert.ok(forecast.upperPercentage > forecast.nextPercentage);
  assert.ok(forecast.residualSd >= 3);
});

test("grade and parent report avoid unsupported percentile claims", () => {
  const evidence = sampleEvidence();
  assert.equal(evidence.gradeEvidence.available, false);
  const report = core.buildStudentReportEvidence(
    evidence.overallProgress.assessments,
    [],
    [],
    { studentName: "Missing", subject: "Missing", reportDate: new Date("2026-10-15T00:00:00") }
  );
  assert.equal(report.gradeEvidence.available, false);
  assert.equal(JSON.stringify(evidence).toLowerCase().includes("percentile"), false);
});
