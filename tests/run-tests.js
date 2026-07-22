const assert = require("assert");
const fs = require("fs");
const path = require("path");
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
    studentName: "Demo Student A",
    subject: "Chemistry",
    reportDate: new Date("2026-10-15T00:00:00")
  });
}

function topicRow({ difficulty, markAwarded, maximumMark, errorCode = "", assessmentId = "A1", topic = "Stoichiometry" }) {
  return {
    assessment: { assessmentId, assessmentDate: assessmentId === "A1" ? "2026-01-01" : assessmentId === "A2" ? "2026-02-01" : "2026-03-01" },
    question: { topic, difficulty, questionType: "Structured calculation" },
    markAwarded,
    maximumMark,
    errorCode
  };
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
  assert.equal(evidence.overallProgress.assessments.length, 1);
  assert.equal(evidence.overallProgress.assessments[0].maximumMark, 48);
  assert.equal(evidence.dataQuality.questionCount, 36);
  assert.equal(evidence.dataQuality.blueprintRowCount, 36);
});

test("baseline topic confidence uses initial evidence", () => {
  const evidence = sampleEvidence();
  const topic = evidence.topicProfile.find((item) => item.label === "Stoichiometry");
  assert.ok(topic);
  assert.equal(topic.assessmentCount, 1);
  assert.equal(topic.confidence, "Initial evidence");
  assert.ok(topic.mastery >= 0 && topic.mastery <= 100);
});

test("ordinary topic mastery is mark weighted with different maximum marks", () => {
  const rows = [
    topicRow({ difficulty: "Easy", markAwarded: 1, maximumMark: 1 }),
    topicRow({ difficulty: "Hard", markAwarded: 0, maximumMark: 3 })
  ];
  const mastery = core.calculateTopicMastery(rows);
  assert.equal(mastery.marksAwarded, 1);
  assert.equal(mastery.marksAvailable, 4);
  assert.equal(mastery.mastery, 25);
});

test("worked example returns 50% ordinary and about 44% adjusted", () => {
  const rows = [
    topicRow({ difficulty: "Easy", markAwarded: 1, maximumMark: 1 }),
    topicRow({ difficulty: "Medium", markAwarded: 1, maximumMark: 1 }),
    topicRow({ difficulty: "Hard", markAwarded: 0, maximumMark: 2, errorCode: "Calculation method" })
  ];
  assert.equal(core.calculateTopicMastery(rows).mastery, 50);
  assert.ok(Math.abs(core.calculateChallengeAdjustedTopicScore(rows) - 44) < 1);
  assert.equal(core.calculateDifficultyBreakdown(rows).Easy.accuracy, 100);
  assert.equal(core.generateTopicInsight(core.buildTopicProfile(rows, new Date("2026-01-01"))[0]).headline, "Basic knowledge is stronger than higher-level application");
});

test("missing difficulty data is not fabricated", () => {
  const breakdown = core.calculateDifficultyBreakdown([topicRow({ difficulty: "Easy", markAwarded: 1, maximumMark: 1 })]);
  assert.equal(breakdown.Medium.accuracy, null);
  assert.equal(breakdown.Medium.marksAvailable, 0);
});

test("multiple-assessment confidence increases when evidence accumulates", () => {
  assert.equal(core.getTopicConfidence({ assessmentCount: 1, marksAvailable: 12, questionCount: 9 }), "Initial evidence");
  assert.equal(core.getTopicConfidence({ assessmentCount: 4, marksAvailable: 20, questionCount: 9 }), "Reliable evidence");
  assert.equal(core.getTopicConfidence({ assessmentCount: 6, marksAvailable: 30, questionCount: 15 }), "Strong evidence");
});

test("core knowledge gap and hard-higher insight rules are deterministic", () => {
  const weakRows = [
    topicRow({ difficulty: "Easy", markAwarded: 0, maximumMark: 2 }),
    topicRow({ difficulty: "Medium", markAwarded: 0, maximumMark: 2 })
  ];
  assert.equal(core.generateTopicInsight(core.buildTopicProfile(weakRows, new Date("2026-01-01"))[0]).headline, "Core concepts may require reteaching");
  const inconsistentRows = [
    topicRow({ difficulty: "Easy", markAwarded: 0, maximumMark: 2 }),
    topicRow({ difficulty: "Hard", markAwarded: 2, maximumMark: 2 })
  ];
  assert.equal(core.generateTopicInsight(core.buildTopicProfile(inconsistentRows, new Date("2026-01-01"))[0]).headline, "Understanding may be stronger than routine accuracy");
});

test("unanswered questions stay as zero-mark no-attempt evidence", () => {
  const marked = core.applyAutomaticMarking({
    assessment: { assessmentId: "A1" },
    question: { assessmentId: "A1", questionId: "Q1", questionType: "MCQ", maximumMark: 1, correctAnswer: "B", answerMode: "exact" },
    response: { assessmentId: "A1", questionId: "Q1", studentAnswer: "", markAwarded: null, markingMethod: "", errorCode: "" }
  });
  assert.equal(marked.markAwarded, 0);
  assert.equal(marked.errorCode, "No attempt");
});

test("error-code aggregation counts lost marks by topic", () => {
  const errors = core.aggregateTopicErrors([
    topicRow({ difficulty: "Hard", markAwarded: 0, maximumMark: 2, errorCode: "Calculation method" }),
    topicRow({ difficulty: "Medium", markAwarded: 1, maximumMark: 2, errorCode: "Calculation method" })
  ]);
  assert.equal(errors[0].errorCode, "Calculation method");
  assert.equal(errors[0].lostMarks, 3);
  assert.equal(errors[0].questionCount, 2);
});

test("no topic score is generated where no marks are available", () => {
  const profile = core.buildTopicProfile([topicRow({ difficulty: "Easy", markAwarded: 0, maximumMark: 0 })], new Date("2026-01-01"));
  assert.equal(profile.length, 0);
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

test("true-false marking normalises accepted values", () => {
  const question = { questionType: "TrueFalse", correctAnswer: "True", maximumMark: 1 };
  assert.equal(core.normaliseTrueFalse("T"), true);
  assert.equal(core.normaliseTrueFalse("false"), false);
  assert.equal(core.markTrueFalse(question, "TRUE").markAwarded, 1);
  assert.equal(core.markTrueFalse(question, "F").markAwarded, 0);
});

test("MCQ marking attaches distractor error code", () => {
  const question = {
    questionType: "MCQ",
    maximumMark: 1,
    options: [
      { label: "A", isCorrect: false, errorCode: "Misconception" },
      { label: "B", isCorrect: true }
    ]
  };
  const result = core.markMcq(question, "A");
  assert.equal(result.markAwarded, 0);
  assert.equal(result.errorCodes[0], "Misconception");
});

test("student response upsert prevents duplicate question responses", () => {
  const first = { id: "R1", testSessionId: "S1", questionId: "Q1", answer: "A" };
  const second = { id: "R2", testSessionId: "S1", questionId: "Q1", answer: "B" };
  const rows = core.upsertStudentResponse(core.upsertStudentResponse([], first), second);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "R1");
  assert.equal(rows[0].answer, "B");
});

test("Chemistry centre sample totals 36 questions and 48 marks", () => {
  const state = core.createCentreSampleSystem();
  const summary = core.templateSummary(state, "TEST-CHEM-TRIAL-001");
  assert.equal(summary.questionCount, 36);
  assert.equal(summary.maximumMark, 48);
  assert.equal(summary.topicCount, 12);
});

test("test mode payload excludes correct answers and mark schemes", () => {
  const state = core.createCentreSampleSystem();
  const session = core.createTestSession(state, "STU-001", "TEST-CHEM-TRIAL-001", new Date("2026-07-16T12:00:00Z"));
  const payload = core.buildTestModePayload(state, session.id);
  assert.equal(payload.questions.length, 36);
  assert.equal(payload.questions.some((question) => Object.prototype.hasOwnProperty.call(question, "correctAnswer")), false);
  assert.equal(payload.questions.some((question) => Object.prototype.hasOwnProperty.call(question, "markingPoints")), false);
  assert.equal(payload.questions.flatMap((question) => question.options).some((option) => Object.prototype.hasOwnProperty.call(option, "isCorrect")), false);
});

test("timer recovery uses stored server deadline", () => {
  const state = core.createCentreSampleSystem();
  const session = core.createTestSession(state, "STU-001", "TEST-CHEM-TRIAL-001", new Date("2026-07-16T12:00:00Z"));
  assert.equal(core.recoverTimeRemaining(session, new Date("2026-07-16T12:10:00Z")), 1200);
  assert.equal(core.recoverTimeRemaining(session, new Date("2026-07-16T12:31:00Z")), 0);
});

test("submitted test session produces one assessment progress point", () => {
  const state = core.createCentreSampleSystem();
  const session = core.createTestSession(state, "STU-001", "TEST-CHEM-TRIAL-001", new Date("2026-07-16T12:00:00Z"));
  state.studentResponses = state.studentResponses.map((response) => response.testSessionId === session.id ? { ...response, answer: "B" } : response);
  core.markSubmittedSession(state, session.id, new Date("2026-07-16T12:20:00Z"));
  const evidence = core.buildCentreReportEvidence(state, session.id);
  assert.equal(evidence.assessmentHistory.filter((item) => item.assessmentId === session.id).length, 1);
});

test("report snapshot is saved from structured centre evidence", () => {
  const state = core.createCentreSampleSystem();
  const session = state.testSessions.find((item) => item.id === "SESSION-DEMO-001");
  const snapshot = core.buildReportSnapshotFromState(state, session.id, "Final");
  assert.equal(snapshot.studentId, "STU-001");
  assert.equal(snapshot.evidenceJson.latestSession.id, session.id);
  assert.ok(snapshot.generatedNarrative.includes("Parent Report"));
});

test("real Chemistry fixture contains actual option text and 48 marks", () => {
  const rows = core.chemistryTrialQuestions();
  assert.equal(rows.length, 36);
  assert.equal(rows.reduce((total, question) => total + question.maximumMark, 0), 48);
  const a1 = rows.find((question) => question.questionId === "A1");
  assert.ok(a1.questionContent.prompt.includes("particles in a gas"));
  assert.ok(a1.options.some((option) => option.content.includes("far apart and move randomly")));
  assert.equal(a1.options.every((option) => option.content === option.label), false);
});

test("Section C classifications and marking points are question-specific", () => {
  const rows = core.chemistryTrialQuestions();
  const c1 = rows.find((question) => question.questionId === "C1");
  const c5 = rows.find((question) => question.questionId === "C5");
  const c10 = rows.find((question) => question.questionId === "C10");
  assert.equal(c5.centreQuestionType, "StructuredCalculation");
  assert.equal(c5.requiredUnit, "g");
  assert.equal(c10.centreQuestionType, "ChemicalEquation");
  assert.ok(c10.correctAnswer.includes("2Cl-"));
  assert.ok(c1.markingPoints[0].acceptedConcepts.includes("same number of protons"));
  assert.equal(JSON.stringify(rows).includes("Correct chemistry idea for"), false);
});

test("written suggestions use actual marking points and remain staff-reviewed", () => {
  const state = core.createCentreSampleSystem();
  const c1 = state.questions.find((question) => question.id === "C1");
  const suggestion = core.suggestWrittenResponse(c1, "same number of protons");
  assert.equal(suggestion.suggestedMark, 1);
  assert.equal(suggestion.requiresStaffReview, true);
  assert.equal(core.markObjectiveResponse(c1, "same number of protons").requiresStaffReview, true);
});

test("session question snapshots freeze historical content", () => {
  const state = core.createCentreSampleSystem();
  const session = core.createTestSession(state, "STU-001", "TEST-CHEM-TRIAL-001", new Date("2026-07-16T12:00:00Z"));
  const originalPrompt = core.buildTestModePayload(state, session.id).questions[0].questionContent.prompt;
  state.questions.find((question) => question.id === "A1").questionContent.prompt = "Edited prompt after session start";
  const frozenPrompt = core.buildTestModePayload(state, session.id).questions[0].questionContent.prompt;
  assert.equal(frozenPrompt, originalPrompt);
});

test("storage migration upgrades v1 shape and adds question snapshots", () => {
  const oldState = core.createCentreSampleSystem();
  oldState.version = 1;
  delete oldState.testSessions[0].questionSnapshots;
  const migrated = core.migrateCentreState(oldState);
  assert.equal(migrated.version, 2);
  assert.equal(core.validateCentreState(migrated), true);
  assert.ok(migrated.testSessions[0].questionSnapshots.length > 0);
});

test("publishing validation blocks each critical missing item", () => {
  const state = core.createCentreSampleSystem();
  const draft = { ...state.testTemplates[0], id: "TEST-BAD", status: "Draft" };
  state.testTemplates.push(draft);
  state.testSections.push({ id: "SECTION-BAD", testTemplateId: draft.id, title: "Empty", instructions: "", order: 1, questionRefs: [] });
  let validation = core.validateTestTemplate(state, draft.id);
  assert.ok(validation.critical.includes("One or more sections are empty"));
  const badQuestion = { ...state.questions[0], id: "BAD-MCQ", options: state.questions[0].options.map((option) => ({ ...option, isCorrect: false })) };
  state.questions.push(badQuestion);
  state.testSections[0].questionRefs.push({ questionId: badQuestion.id, questionVersion: badQuestion.version, order: 1 });
  validation = core.validateTestTemplate(state, state.testSections[0].testTemplateId);
  assert.ok(validation.critical.includes("One or more MCQ questions have no correct option"));
});

test("test mode payload keeps C5 and C10 input types without mark schemes", () => {
  const state = core.createCentreSampleSystem();
  const session = core.createTestSession(state, "STU-001", "TEST-CHEM-TRIAL-001", new Date("2026-07-16T12:00:00Z"));
  const payload = core.buildTestModePayload(state, session.id);
  assert.equal(payload.questions.find((question) => question.id === "C5").questionType, "StructuredCalculation");
  assert.equal(payload.questions.find((question) => question.id === "C10").questionType, "ChemicalEquation");
  assert.equal(payload.questions.some((question) => question.markingPoints), false);
});

test("static source exposes repaired controls and optional dependency fallbacks", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(app.includes('data-question-action="preview"'));
  assert.ok(app.includes('data-builder-action="preview-test"'));
  assert.ok(app.includes("initCentreSystemSafely"));
  assert.ok(app.includes("typeof Chart"));
  assert.ok(app.includes("typeof XLSX"));
  assert.ok(html.includes("Centre-operated assessment system"));
  assert.ok(html.includes("Question Bank / 題目庫"));
  assert.ok(html.includes("?v=1.4.3"));
  assert.ok(html.includes('<section id="printableReport" hidden>'));
  assert.ok(html.includes('id="reportModuleMount"'));
  assert.ok(app.includes("mountPrintableReport();"));
  assert.ok(app.includes('printableReport.hidden = moduleName !== "reports"'));
  assert.ok(app.includes("resizeReportCharts();"));
});
