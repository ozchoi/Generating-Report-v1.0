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
  assert.equal(payload.questions.some((question) => Object.prototype.hasOwnProperty.call(question, "topic")), false);
  assert.equal(payload.questions.some((question) => Object.prototype.hasOwnProperty.call(question, "difficulty")), false);
  assert.equal(payload.questions.some((question) => Object.prototype.hasOwnProperty.call(question, "title")), false);
  assert.equal(payload.questions.flatMap((question) => question.options).some((option) => Object.prototype.hasOwnProperty.call(option, "isCorrect")), false);
});

test("prepared session does not start a timer", () => {
  const state = core.createCentreSampleSystem();
  const session = core.createTestSession(state, "STU-001", "TEST-CHEM-TRIAL-001", new Date("2026-07-16T12:00:00Z"));
  assert.equal(session.status, "Prepared");
  assert.equal(session.startedAt, "");
  assert.equal(session.deadlineAt, "");
  assert.equal(core.recoverTimeRemaining(session, new Date("2026-07-16T12:10:00Z")), 0);
});

test("begin assessment sets startedAt and device deadline", () => {
  const state = core.createCentreSampleSystem();
  const session = core.createTestSession(state, "STU-001", "TEST-CHEM-TRIAL-001", new Date("2026-07-16T11:55:00Z"));
  core.beginPreparedSessionInState(state, session.id, new Date("2026-07-16T12:00:00Z"));
  assert.equal(session.status, "In progress");
  assert.equal(session.startedAt, "2026-07-16T12:00:00.000Z");
  assert.equal(session.deadlineAt, "2026-07-16T12:30:00.000Z");
  assert.equal(core.recoverTimeRemaining(session, new Date("2026-07-16T12:10:00Z")), 1200);
  assert.equal(core.recoverTimeRemaining(session, new Date("2026-07-16T12:31:00Z")), 0);
});

test("submitted test session produces one assessment progress point", () => {
  const state = core.createCentreSampleSystem();
  const session = core.createTestSession(state, "STU-001", "TEST-CHEM-TRIAL-001", new Date("2026-07-16T12:00:00Z"));
  core.beginPreparedSessionInState(state, session.id, new Date("2026-07-16T12:00:00Z"));
  state.studentResponses = state.studentResponses.map((response) => response.testSessionId === session.id ? { ...response, answer: "B" } : response);
  core.markSubmittedSession(state, session.id, new Date("2026-07-16T12:20:00Z"));
  state.studentResponses.filter((response) => response.testSessionId === session.id).forEach((response) => {
    response.markAwarded = response.maximumMark;
    response.markingMethod = "Staff reviewed";
  });
  session.status = "Marked";
  const evidence = core.buildCentreReportEvidence(state, session.id);
  assert.equal(evidence.assessmentHistory.filter((item) => item.assessmentId === session.id).length, 1);
});

test("report snapshot is saved from structured centre evidence", () => {
  const state = core.createCentreSampleSystem();
  const session = state.testSessions.find((item) => item.id === "SESSION-DEMO-001");
  const snapshot = core.buildReportSnapshotFromState(state, session.id, "Final");
  assert.equal(snapshot.studentId, "STU-001");
  assert.equal(snapshot.evidenceJson.latestSession.id, session.id);
  assert.ok(snapshot.generatedNarrative.includes("Baseline Report"));
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
  assert.ok(c10.correctAnswer.includes("2Cl^{-}"));
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
  assert.equal(migrated.version, 3);
  assert.equal(core.validateCentreState(migrated), true);
  assert.ok(migrated.testSessions[0].questionSnapshots.length > 0);
  assert.ok(Object.prototype.hasOwnProperty.call(migrated.testSessions[0], "deadlineAt"));
  assert.ok(Object.prototype.hasOwnProperty.call(migrated.studentResponses[0], "answerRevisionCount"));
  assert.ok(Object.prototype.hasOwnProperty.call(migrated.studentResponses[0], "primaryErrorCode"));
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

test("student selection is required when preparing a session", () => {
  const state = core.createCentreSampleSystem();
  assert.throws(() => core.createTestSession(state, null, "TEST-CHEM-TRIAL-001", new Date()), /valid student and test/);
});

test("student IDs use a readable sequential centre sequence", () => {
  assert.equal(core.generateNextStudentId([{ studentId: "STU-0001" }, { studentId: "STU-0012" }, { studentId: "LEGACY-9" }]), "STU-0013");
});

test("student ID generation remains unique when legacy IDs are present", () => {
  const students = [{ studentId: "STU-0001" }, { studentId: "STU-0002" }, { studentId: "STU-0099" }, { studentId: "OLD-100" }];
  const next = core.generateNextStudentId(students);
  assert.equal(next, "STU-0100");
  assert.equal(students.some((student) => student.studentId === next), false);
});

test("student validation requires name, school, level, and at least one subject", () => {
  const validation = core.validateStudentInput({ studentName: " ", school: "", schoolYear: "", subjects: [] });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.studentName);
  assert.ok(validation.errors.school);
  assert.ok(validation.errors.schoolYear);
  assert.ok(validation.errors.subjects);
});

test("student validation trims values and requires a custom Other subject", () => {
  const invalidOther = core.validateStudentInput({ studentName: " Alex Chan ", school: " Example School ", schoolYear: " Year 10 ", subjects: [], otherSelected: true, customSubject: " " });
  assert.equal(invalidOther.valid, false);
  const valid = core.validateStudentInput({ studentName: " Alex Chan ", chineseName: " 陳同學 ", school: " Example School ", schoolYear: " Year 10 ", subjects: [" Chemistry "], contactNumber: " 1234 " });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.values, {
    studentName: "Alex Chan",
    chineseName: "陳同學",
    school: "Example School",
    schoolYear: "Year 10",
    subjects: ["Chemistry"],
    contactNumber: "1234"
  });
});

test("duplicate student detection ignores case and repeated spaces", () => {
  const students = [{ studentId: "STU-0001", studentName: "Alex  Chan", school: "Example Secondary School", schoolYear: "Year 10" }];
  const match = core.findSimilarStudent(students, { studentName: " alex chan ", school: "example   secondary school", schoolYear: " year 10 " });
  assert.equal(match.studentId, "STU-0001");
  assert.equal(core.findSimilarStudent(students, { studentName: "Alex Chan", school: "Example Secondary School", schoolYear: "Year 10" }, "STU-0001"), null);
});

test("student migration derives subjects and timestamps from legacy programme data", () => {
  const oldState = core.createCentreSampleSystem();
  delete oldState.students[0].subjects;
  delete oldState.students[0].createdAt;
  delete oldState.students[0].updatedAt;
  oldState.students[0].programme = "IGCSE Chemistry";
  const migrated = core.migrateCentreState(oldState);
  assert.deepEqual(migrated.students[0].subjects, ["IGCSE Chemistry"]);
  assert.ok(migrated.students[0].createdAt);
  assert.ok(migrated.students[0].updatedAt);
  assert.equal(migrated.students[0].programme, "IGCSE Chemistry");
});

test("student search matches subjects, Chinese name, and student ID", () => {
  const student = {
    studentId: "STU-0042",
    studentName: "Alex Chan",
    chineseName: "陳同學",
    school: "Example School",
    schoolYear: "Year 10",
    subjects: ["Chemistry", "Mathematics"],
    contactNumber: "1234"
  };
  assert.equal(core.studentMatchesSearch(student, "mathematics"), true);
  assert.equal(core.studentMatchesSearch(student, "陳同學"), true);
  assert.equal(core.studentMatchesSearch(student, "stu-0042"), true);
  assert.equal(core.studentMatchesSearch(student, "biology"), false);
});

test("published tests matching student subjects are recommended first", () => {
  const templates = [
    { id: "MATH", status: "Published", subjectName: "Mathematics" },
    { id: "CHEM", status: "Published", subjectName: "Chemistry" },
    { id: "BIO", status: "Published", subjectName: "Biology" },
    { id: "DRAFT", status: "Draft", subjectName: "Chemistry" }
  ];
  const grouped = core.groupPublishedTestsForStudent(templates, { subjects: ["Chemistry"] });
  assert.deepEqual(grouped.recommended.map((template) => template.id), ["CHEM"]);
  assert.deepEqual(grouped.other.map((template) => template.id), ["MATH", "BIO"]);
});

test("written answer revisions are counted on commit, not per keystroke", () => {
  const response = { answer: "", lastCommittedAnswer: "", answerRevisionCount: 0 };
  response.answer = "First complete answer.";
  core.commitResponseRevision(response);
  assert.equal(response.answerRevisionCount, 0);
  response.answer = "First complete answer with a revised conclusion.";
  assert.equal(response.answerRevisionCount, 0);
  core.commitResponseRevision(response);
  assert.equal(response.answerRevisionCount, 1);
});

test("duplicate submission is blocked by session status", () => {
  const state = core.createCentreSampleSystem();
  const session = core.createTestSession(state, "STU-001", "TEST-CHEM-TRIAL-001", new Date("2026-07-16T12:00:00Z"));
  core.beginPreparedSessionInState(state, session.id, new Date("2026-07-16T12:01:00Z"));
  assert.equal(core.markSubmittedSession(state, session.id, new Date("2026-07-16T12:10:00Z")), true);
  const submittedAt = session.submittedAt;
  assert.equal(core.markSubmittedSession(state, session.id, new Date("2026-07-16T12:15:00Z")), false);
  assert.equal(session.submittedAt, submittedAt);
});

test("Needs marking sessions do not alter longitudinal report evidence", () => {
  const state = core.createCentreSampleSystem();
  const before = core.buildCentreReportEvidence(state, "SESSION-DEMO-001");
  const pending = core.createTestSession(state, "STU-001", "TEST-CHEM-TRIAL-001", new Date("2026-07-20T12:00:00Z"));
  core.beginPreparedSessionInState(state, pending.id, new Date("2026-07-20T12:01:00Z"));
  pending.status = "Needs marking";
  pending.submittedAt = "2026-07-20T12:20:00.000Z";
  const after = core.buildCentreReportEvidence(state, "SESSION-DEMO-001");
  assert.equal(after.overallProgress.assessments.length, before.overallProgress.assessments.length);
  assert.deepEqual(after.topicProfile.map((item) => [item.label, item.mastery]), before.topicProfile.map((item) => [item.label, item.mastery]));
  assert.deepEqual(after.difficultyProfile.map((item) => [item.label, item.mastery]), before.difficultyProfile.map((item) => [item.label, item.mastery]));
  assert.deepEqual(after.errorPatterns, before.errorPatterns);
  assert.ok(after.pendingMarkingSessions.some((item) => item.id === pending.id));
});

test("unmarked legacy responses are excluded instead of converted to zero", () => {
  const assessment = {
    assessmentId: "LEGACY-UNMARKED",
    studentId: "STU-001",
    studentName: "Demo Student",
    subject: "Chemistry",
    qualification: "IGCSE",
    assessmentName: "Unmarked import",
    assessmentDate: "2026-07-20",
    maximumMark: 2
  };
  const question = {
    assessmentId: assessment.assessmentId,
    questionId: "Q1",
    maximumMark: 2,
    topic: "Atomic structure",
    subtopic: "Isotopes",
    difficulty: "Medium",
    questionType: "Short answer",
    answerMode: "written"
  };
  const response = {
    assessmentId: assessment.assessmentId,
    studentId: assessment.studentId,
    questionId: question.questionId,
    studentAnswer: "Same protons, different neutrons",
    markAwarded: null,
    maximumMark: 2,
    markingMethod: "staff review required",
    errorCode: ""
  };
  const report = core.buildStudentReportEvidence([assessment], [question], [response], {
    studentName: assessment.studentName,
    subject: assessment.subject,
    reportDate: new Date("2026-07-21T00:00:00Z")
  });
  assert.equal(report.dataQuality.responseCount, 0);
  assert.equal(report.overallProgress.assessments.length, 0);
  assert.equal(report.topicProfile.length, 0);
});

test("fully marked sessions are included in longitudinal evidence", () => {
  const state = core.createCentreSampleSystem();
  const session = core.createTestSession(state, "STU-001", "TEST-CHEM-TRIAL-001", new Date("2026-07-20T12:00:00Z"));
  core.beginPreparedSessionInState(state, session.id, new Date("2026-07-20T12:01:00Z"));
  state.studentResponses.filter((response) => response.testSessionId === session.id).forEach((response) => {
    response.answer = "Reviewed attempt";
    response.markAwarded = response.maximumMark;
    response.markingMethod = "Staff reviewed";
  });
  session.status = "Marked";
  session.submittedAt = "2026-07-20T12:20:00.000Z";
  session.markedAt = "2026-07-20T12:30:00.000Z";
  assert.equal(core.isSessionFullyMarked(state, session), true);
  const report = core.buildCentreReportEvidence(state, session.id);
  assert.equal(report.overallProgress.assessments.length, 2);
});

test("primary error codes drive lost marks without secondary double counting", () => {
  const state = core.createCentreSampleSystem();
  const session = state.testSessions.find((item) => item.id === "SESSION-DEMO-001");
  const sessionResponses = state.studentResponses.filter((response) => response.testSessionId === session.id);
  sessionResponses.forEach((response) => {
    response.markAwarded = response.maximumMark;
    response.primaryErrorCode = "";
    response.secondaryErrorCodes = [];
    response.errorCodes = [];
  });
  sessionResponses[0].markAwarded = 0;
  sessionResponses[0].primaryErrorCode = "Knowledge gap";
  sessionResponses[0].secondaryErrorCodes = ["Unit error", "Question interpretation"];
  sessionResponses[0].errorCodes = ["Knowledge gap", "Unit error", "Question interpretation"];
  const report = core.buildCentreReportEvidence(state, session.id);
  assert.equal(report.errorPatterns.find((item) => item.errorCode === "Knowledge gap").lostMarks, 1);
  assert.equal(report.errorPatterns.some((item) => item.errorCode === "Unit error"), false);
  assert.deepEqual(report.responseDetails[0].secondaryErrorCodes, ["Unit error", "Question interpretation"]);
});

test("final report revisions preserve the original immutable version", () => {
  const state = core.createCentreSampleSystem();
  const original = state.reportSnapshots[0];
  const originalNarrative = original.editedNarrative;
  const revision = core.createRevisedReportSnapshot(state, original.id, new Date("2026-07-18T10:00:00Z"));
  assert.equal(original.status, "Final");
  assert.equal(original.editedNarrative, originalNarrative);
  assert.equal(revision.status, "Draft");
  assert.equal(revision.versionNumber, original.versionNumber + 1);
  assert.equal(revision.parentReportId, original.id);
  core.finaliseReportSnapshot(state, revision.id, "Revised narrative", new Date("2026-07-18T11:00:00Z"));
  assert.equal(revision.status, "Final");
  assert.equal(revision.finalisedAt, "2026-07-18T11:00:00.000Z");
  assert.equal(original.supersededByReportId, revision.id);
});

test("baseline report uses cautious headings and contains no trend or forecast claims", () => {
  const state = core.createCentreSampleSystem();
  const narrative = state.reportSnapshots[0].generatedNarrative;
  assert.ok(narrative.includes("Positive Indicators"));
  assert.ok(narrative.includes("Possible Priorities"));
  assert.ok(narrative.includes("This report is based on one diagnostic assessment"));
  assert.equal(/improving|declining|forecast|predicted grade|percentile/i.test(narrative), false);
});

test("scientific notation renderer escapes HTML before applying explicit notation", () => {
  const rendered = core.formatScientificText('<img src=x onerror=alert(1)> Cu^{2+} -> Cl_{2} <=>');
  assert.equal(rendered.includes("<img"), false);
  assert.ok(rendered.includes("&lt;img"));
  assert.ok(rendered.includes("Cu<sup>2+</sup>"));
  assert.ok(rendered.includes("Cl<sub>2</sub>"));
  assert.ok(rendered.includes("→"));
  assert.ok(rendered.includes("⇌"));
});

test("written autosave does not rebuild the active textarea", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const autosaveBlock = app.slice(app.indexOf("function scheduleResponseSave"), app.indexOf("function persistResponse"));
  assert.equal(autosaveBlock.includes("renderCurrentQuestion"), false);
  assert.equal(autosaveBlock.includes("renderTestMode"), false);
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
  assert.ok(html.includes("?v=1.5.1"));
  assert.ok(html.includes('<section id="printableReport" hidden>'));
  assert.ok(html.includes('<section id="printRoot" class="print-root" aria-hidden="true"></section>'));
  assert.ok(html.includes('id="reportModuleMount"'));
  assert.ok(app.includes("mountPrintableReport();"));
  assert.ok(app.includes('printableReport.hidden = moduleName !== "reports"'));
  assert.ok(app.includes("resizeReportCharts();"));
  assert.ok(app.includes("buildPrintableReportClone"));
  assert.ok(app.includes("printActiveReport"));
  assert.ok(app.includes("canvasToPrintImage"));
  assert.ok(html.includes("Prepare Test / 準備測驗"));
  assert.ok(html.includes("Begin Test / 正式開始"));
  assert.ok(html.includes("Public prototype only."));
});
