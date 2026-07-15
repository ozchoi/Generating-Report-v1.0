const QUESTION_TYPES = [
  "MCQ",
  "True / False",
  "Definition / recall",
  "Short explanation",
  "Structured calculation",
  "Long application",
  "Practical knowledge",
  "Experimental planning",
  "Data interpretation",
  "Graph interpretation",
  "Problem solving"
];

const ERROR_CODES = [
  "",
  "Knowledge gap",
  "Misconception",
  "Calculation method",
  "Arithmetic error",
  "Unit error",
  "Significant figures",
  "Question interpretation",
  "Command word",
  "Practical method",
  "Data interpretation",
  "Incomplete explanation",
  "Careless error",
  "No attempt"
];

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Exam-style", "Challenge"];
const DIFFICULTY_WEIGHTS = {
  Easy: 1,
  Medium: 1.2,
  Hard: 1.4,
  "Exam-style": 1.4,
  Challenge: 1.5
};
const REPORT_DATE = new Date("2026-10-15T00:00:00");
const CENTRE_STORAGE_KEY = "abilityReportCentreSystemV1";

let assessments = [];
let questions = [];
let responses = [];
let legacyRows = [];
let evidence = null;
let radarMode = "topic";
let trendChart;
let radarChart;
let curveChart;
let printTopicRadarChart;
let printQuestionRadarChart;
let centreState = null;
let selectedCentreStudentId = null;
let selectedTestTemplateId = null;
let activeSessionId = null;
let activeQuestionIndex = 0;
let activeTestPayload = null;
let testTimerInterval = null;
const responseSaveTimers = new Map();

const hasDom = typeof document !== "undefined";
const elements = hasDom ? {
  assessmentFile: document.querySelector("#assessmentFile"),
  blueprintFile: document.querySelector("#blueprintFile"),
  responsesFile: document.querySelector("#responsesFile"),
  assessmentFileStatus: document.querySelector("#assessmentFileStatus"),
  blueprintFileStatus: document.querySelector("#blueprintFileStatus"),
  responsesFileStatus: document.querySelector("#responsesFileStatus"),
  studentSelect: document.querySelector("#studentSelect"),
  subjectSelect: document.querySelector("#subjectSelect"),
  qualificationSelect: document.querySelector("#qualificationSelect"),
  reportText: document.querySelector("#reportText")
} : {};

if (hasDom) {
  document.querySelector("#loadSample").addEventListener("click", () => {
    loadSampleData();
    renderSelectors();
    render();
  });
  document.querySelector("#downloadTemplate").addEventListener("click", downloadTemplates);
  document.querySelector("#printReport").addEventListener("click", () => window.print());
  document.querySelector("#exportReport").addEventListener("click", exportReport);
  elements.studentSelect.addEventListener("change", () => {
    renderSubjectOptions();
    render();
  });
  elements.subjectSelect.addEventListener("change", render);
  elements.qualificationSelect.addEventListener("change", render);
  document.querySelectorAll("#radarModeControls button").forEach((button) => {
    button.addEventListener("click", () => {
      radarMode = button.dataset.mode;
      renderRadarOnly();
    });
  });
  elements.assessmentFile.addEventListener("change", (event) => handleDataFile(event, "assessments"));
  elements.blueprintFile.addEventListener("change", (event) => handleDataFile(event, "questions"));
  elements.responsesFile.addEventListener("change", (event) => handleDataFile(event, "responses"));

  loadSampleData();
  renderSelectors();
  render();
  initCentreSystem();
}

function loadSampleData() {
  const sample = createChemistrySample();
  assessments = sample.assessments;
  questions = sample.questions;
  responses = sample.responses;
  legacyRows = [];
  elements.assessmentFileStatus.textContent = "Sample: 1 Chemistry baseline assessment loaded";
  elements.blueprintFileStatus.textContent = "Sample: 36-question blueprint loaded";
  elements.responsesFileStatus.textContent = "Sample: 36 student responses loaded";
}

function initCentreSystem() {
  centreState = loadCentreState() || createCentreSampleSystem();
  selectedCentreStudentId = centreState.students[0]?.studentId ?? null;
  selectedTestTemplateId = centreState.testTemplates.find((item) => item.status === "Published")?.id ?? centreState.testTemplates[0]?.id ?? null;
  bindCentreEvents();
  renderCentreSystem();
}

function bindCentreEvents() {
  document.querySelectorAll("[data-module]").forEach((button) => {
    button.addEventListener("click", () => showCentreModule(button.dataset.module));
  });
  document.querySelectorAll("[data-jump-module]").forEach((button) => {
    button.addEventListener("click", () => showCentreModule(button.dataset.jumpModule));
  });
  document.querySelector("#studentSearchInput")?.addEventListener("input", renderStartTestModule);
  document.querySelector("#questionSearchInput")?.addEventListener("input", renderQuestionBank);
  document.querySelector("#questionDifficultyFilter")?.addEventListener("change", renderQuestionBank);
  document.querySelector("#questionTypeFilter")?.addEventListener("change", renderQuestionBank);
  document.querySelector("#studentSearchResults")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-student-id]");
    if (!item) return;
    selectedCentreStudentId = item.dataset.studentId;
    renderStartTestModule();
  });
  document.querySelector("#testTemplateList")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-template-id]");
    if (!item) return;
    selectedTestTemplateId = item.dataset.templateId;
    renderStartTestModule();
  });
  document.querySelector("#startSelectedTest")?.addEventListener("click", () => {
    if (!selectedCentreStudentId || !selectedTestTemplateId) return;
    const session = createTestSession(centreState, selectedCentreStudentId, selectedTestTemplateId, new Date());
    persistCentreState();
    renderCentreSystem();
    openTestMode(session.id);
  });
  document.querySelector("#recentSessionsTable")?.addEventListener("click", handleSessionAction);
  document.querySelector("#allSessionsTable")?.addEventListener("click", handleSessionAction);
  document.querySelector("#sessionRecoveryPanel")?.addEventListener("click", handleSessionAction);
  document.querySelector("#markingPanel")?.addEventListener("click", handleMarkingAction);
  document.querySelector("#markingPanel")?.addEventListener("input", handleMarkInput);
  document.querySelector("#reportSnapshotList")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-report-id]");
    if (!item) return;
    const snapshot = centreState.reportSnapshots.find((report) => report.id === item.dataset.reportId);
    if (snapshot) renderEvidenceSnapshot(snapshot.evidenceJson, snapshot.editedNarrative || snapshot.generatedNarrative);
  });
  document.querySelector("#prevQuestion")?.addEventListener("click", () => moveTestQuestion(-1));
  document.querySelector("#nextQuestion")?.addEventListener("click", () => moveTestQuestion(1));
  document.querySelector("#flagQuestion")?.addEventListener("click", toggleCurrentQuestionFlag);
  document.querySelector("#submitTest")?.addEventListener("click", () => submitActiveTest(false));
  document.querySelector("#returnToDashboard")?.addEventListener("click", () => closeTestMode("dashboard"));
}

function loadCentreState() {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(CENTRE_STORAGE_KEY));
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function persistCentreState() {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CENTRE_STORAGE_KEY, JSON.stringify(centreState));
  }
}

function createCentreSampleSystem() {
  const sample = createChemistrySample();
  const now = "2026-07-16T10:30:00.000Z";
  const students = [{
    studentId: "STU-001",
    studentName: "Amelia Chan",
    chineseName: "陳雅麗",
    contactNumber: "9123 4567",
    school: "Harbour College",
    schoolYear: "Year 10",
    programme: "IGCSE Chemistry"
  }];
  const questionBank = sample.questions.map((question) => createCentreQuestion(question, now));
  const testTemplate = {
    id: "TEST-CHEM-TRIAL-001",
    name: "IGCSE Chemistry Trial Test (Mixed Difficulty)",
    description: "36-question baseline diagnostic test for IGCSE Chemistry.",
    subjectName: "Chemistry",
    qualification: "IGCSE",
    examBoard: "Cambridge",
    syllabusCode: "0620",
    testType: "Baseline diagnostic",
    instructions: "Answer all questions. Use the flag button if you want to return to a question.",
    timeLimitMinutes: 30,
    status: "Published",
    createdAt: now,
    updatedAt: now
  };
  const testSections = ["A", "B", "C"].map((section, index) => ({
    id: `SECTION-${section}`,
    testTemplateId: testTemplate.id,
    title: section === "A" ? "Section A — Multiple Choice" : section === "B" ? "Section B — True / False" : "Section C — Short Answer",
    instructions: section === "C" ? "Write concise scientific answers. Staff will review these responses." : "Select the best answer.",
    order: index + 1,
    questionRefs: questionBank
      .filter((question) => question.section === section)
      .map((question, order) => ({ questionId: question.id, questionVersion: question.version, order: order + 1 }))
  }));
  const demoSession = {
    id: "SESSION-DEMO-001",
    studentId: "STU-001",
    testTemplateId: testTemplate.id,
    testName: testTemplate.name,
    subjectName: testTemplate.subjectName,
    status: "Report generated",
    startedAt: "2026-07-16T10:30:00.000Z",
    submittedAt: "2026-07-16T10:54:00.000Z",
    markedAt: "2026-07-16T11:08:00.000Z",
    reportGeneratedAt: "2026-07-16T11:12:00.000Z",
    timeLimitMinutes: 30,
    serverDeadline: "2026-07-16T11:00:00.000Z",
    timeUsedSeconds: 1440,
    createdAt: "2026-07-16T10:30:00.000Z",
    updatedAt: "2026-07-16T11:12:00.000Z"
  };
  const studentResponses = sample.responses.map((response) => {
    const question = questionBank.find((item) => item.id === response.questionId);
    return {
      id: `RESP-${demoSession.id}-${response.questionId}`,
      testSessionId: demoSession.id,
      studentId: demoSession.studentId,
      questionId: response.questionId,
      questionVersion: 1,
      answer: answerFromSample(response, question),
      firstViewedAt: demoSession.startedAt,
      lastSavedAt: demoSession.submittedAt,
      timeSpentSeconds: 35,
      answerChangeCount: response.markAwarded === question.maximumMark ? 1 : 2,
      flagged: false,
      markAwarded: response.markAwarded,
      maximumMark: response.maximumMark,
      markingMethod: questionRequiresStaffReview(question) ? "Staff reviewed" : "Automatic",
      markingConfidence: questionRequiresStaffReview(question) ? 0.95 : 1,
      errorCodes: response.errorCode ? [normaliseCentreErrorCode(response.errorCode)] : [],
      feedback: response.tutorFeedback || "",
      internalNote: "",
      markedAt: demoSession.markedAt,
      createdAt: demoSession.startedAt,
      updatedAt: demoSession.markedAt
    };
  });
  const state = {
    version: 1,
    students,
    questions: questionBank,
    testTemplates: [testTemplate],
    testSections,
    testSessions: [demoSession],
    studentResponses,
    reportSnapshots: []
  };
  updateSessionScore(state, demoSession.id);
  state.reportSnapshots.push(buildReportSnapshotFromState(state, demoSession.id, "Final"));
  return state;
}

function createCentreQuestion(question, timestamp) {
  const questionType = question.questionType === "MCQ" ? "MCQ" : question.questionType === "True / False" ? "TrueFalse" : "ShortAnswer";
  const prompt = questionType === "ShortAnswer"
    ? `${question.topic}: explain ${question.subtopic.toLowerCase()}.`
    : `${question.topic}: ${question.subtopic}.`;
  return {
    id: question.questionId,
    section: question.section,
    subjectName: "Chemistry",
    qualification: "IGCSE",
    examBoard: "Cambridge",
    syllabusCode: "0620",
    topic: question.topic,
    subtopic: question.subtopic,
    difficulty: normaliseDifficulty(question.difficulty),
    questionType,
    title: `${question.section}${question.questionNumber} ${question.topic}`,
    questionContent: { prompt },
    maximumMark: question.maximumMark,
    options: questionType === "MCQ" ? ["A", "B", "C", "D"].map((label) => ({
      id: `${question.questionId}-${label}`,
      label,
      content: `${label}`,
      isCorrect: normaliseAnswer(label) === normaliseAnswer(question.correctAnswer),
      errorCode: normaliseAnswer(label) === normaliseAnswer(question.correctAnswer) ? "" : "Misconception"
    })) : questionType === "TrueFalse" ? ["True", "False"].map((label) => ({
      id: `${question.questionId}-${label}`,
      label,
      content: label,
      isCorrect: normaliseTrueFalse(label) === normaliseTrueFalse(question.correctAnswer),
      errorCode: normaliseTrueFalse(label) === normaliseTrueFalse(question.correctAnswer) ? "" : "Question interpretation"
    })) : [],
    correctAnswer: question.correctAnswer,
    acceptedAnswers: question.correctAnswer ? [question.correctAnswer] : [],
    markingPoints: questionType === "ShortAnswer" ? [
      { id: `${question.questionId}-MP1`, description: `Correct chemistry idea for ${question.subtopic}`, markValue: 1, acceptedConcepts: [question.topic, question.subtopic] },
      { id: `${question.questionId}-MP2`, description: "Linked explanation using scientific wording", markValue: 1, acceptedConcepts: ["because", "therefore", "particles", "ions", "energy"] }
    ] : [],
    numericalTolerance: question.numericalTolerance,
    requiredUnit: question.requiredUnit,
    distractorErrors: {},
    assessmentObjective: null,
    coreOrSupplement: "Both",
    source: "Centre-created IGCSE Chemistry trial sample",
    copyrightNote: "Internal teaching sample.",
    status: "Published",
    usageCount: 1,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function renderCentreSystem() {
  renderDashboardModule();
  renderStartTestModule();
  renderQuestionFilters();
  renderQuestionBank();
  renderTestBuilder();
  renderSessionsModule();
  renderMarkingModule();
  renderReportsModule();
}

function showCentreModule(moduleName) {
  document.querySelectorAll("[id^='module-']").forEach((panel) => {
    panel.hidden = panel.id !== `module-${moduleName}`;
  });
  document.querySelectorAll("[data-module]").forEach((button) => {
    button.classList.toggle("active", button.dataset.module === moduleName);
  });
  if (moduleName === "marking") renderMarkingModule();
  if (moduleName === "reports") renderReportsModule();
}

function renderDashboardModule() {
  const recovery = getUnfinishedSession(centreState);
  const recoveryPanel = document.querySelector("#sessionRecoveryPanel");
  recoveryPanel.innerHTML = recovery ? `
    <div class="panel-heading">
      <div>
        <h2>Unfinished test session detected</h2>
        <p>${escapeHtml(studentById(recovery.studentId).studentName)} — ${escapeHtml(recovery.testName)}. Time remaining: ${formatRemaining(recoverTimeRemaining(recovery, new Date()))}</p>
      </div>
      <div class="topbar-actions">
        <button type="button" data-session-action="resume" data-session-id="${recovery.id}">Resume Test</button>
        <button type="button" data-session-action="cancel" data-session-id="${recovery.id}">Cancel Session</button>
      </div>
    </div>` : "";
  document.querySelector("#recentSessionsTable").innerHTML = sessionsTable(centreState.testSessions.slice(0, 6));
}

function renderStartTestModule() {
  const query = text(document.querySelector("#studentSearchInput")?.value).toLowerCase();
  const students = centreState.students.filter((student) => {
    const haystack = [student.studentId, student.studentName, student.chineseName, student.contactNumber, student.school, student.schoolYear, student.programme].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });
  document.querySelector("#studentSearchResults").innerHTML = students.map((student) => `
    <button type="button" class="selection-item ${student.studentId === selectedCentreStudentId ? "selected" : ""}" data-student-id="${student.studentId}">
      <strong>${escapeHtml(student.studentName)} ${escapeHtml(student.chineseName)}</strong>
      <p>${escapeHtml(student.school)} · ${escapeHtml(student.schoolYear)} · ${escapeHtml(student.programme)}</p>
      <p>${escapeHtml(student.studentId)} · ${escapeHtml(student.contactNumber)}</p>
    </button>`).join("");
  const templates = centreState.testTemplates.filter((template) => template.status === "Published");
  document.querySelector("#testTemplateList").innerHTML = templates.map((template) => {
    const summary = templateSummary(centreState, template.id);
    return `<button type="button" class="selection-item ${template.id === selectedTestTemplateId ? "selected" : ""}" data-template-id="${template.id}">
      <strong>${escapeHtml(template.name)}</strong>
      <p>${escapeHtml(template.subjectName)} · ${escapeHtml(template.testType)} · ${summary.questionCount} questions · ${summary.maximumMark} marks · ${template.timeLimitMinutes} minutes</p>
      <p>Last used: ${escapeHtml(lastUsedLabel(template.id))}</p>
    </button>`;
  }).join("");
  const student = selectedCentreStudentId ? studentById(selectedCentreStudentId) : null;
  const template = selectedTestTemplateId ? templateById(selectedTestTemplateId) : null;
  const summary = template ? templateSummary(centreState, template.id) : null;
  document.querySelector("#startTestSummary").innerHTML = student && template ? `
    <div class="boundary-summary">
      <div><span>Student</span><strong>${escapeHtml(student.studentName)}</strong></div>
      <div><span>Test</span><strong>${escapeHtml(template.name)}</strong></div>
      <div><span>Subject</span><strong>${escapeHtml(template.subjectName)}</strong></div>
      <div><span>Questions</span><strong>${summary.questionCount}</strong></div>
      <div><span>Maximum marks</span><strong>${summary.maximumMark}</strong></div>
      <div><span>Time limit</span><strong>${template.timeLimitMinutes} min</strong></div>
    </div>` : "<p>Select one student and one published test.</p>";
}

function renderQuestionFilters() {
  document.querySelector("#questionDifficultyFilter").innerHTML = `<option value="">All difficulties</option>${DIFFICULTIES.map((item) => `<option value="${item}">${item}</option>`).join("")}`;
  const types = ["MCQ", "TrueFalse", "ShortAnswer", "StructuredCalculation", "Numerical", "ChemicalEquation", "DataInterpretation", "GraphInterpretation", "PracticalPlanning", "LongApplication"];
  document.querySelector("#questionTypeFilter").innerHTML = `<option value="">All question types</option>${types.map((item) => `<option value="${item}">${item}</option>`).join("")}`;
}

function renderQuestionBank() {
  const query = text(document.querySelector("#questionSearchInput")?.value).toLowerCase();
  const difficulty = document.querySelector("#questionDifficultyFilter")?.value || "";
  const questionType = document.querySelector("#questionTypeFilter")?.value || "";
  const questionsToShow = centreState.questions.filter((question) => {
    const haystack = [question.title, question.topic, question.subtopic, question.questionType, question.questionContent.prompt].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (!difficulty || question.difficulty === difficulty) && (!questionType || question.questionType === questionType);
  });
  document.querySelector("#questionBankList").innerHTML = questionsToShow.map((question) => `
    <article class="question-card">
      <h3>${escapeHtml(question.title)}</h3>
      <p>${escapeHtml(question.questionContent.prompt)}</p>
      <div class="question-meta">
        <span class="meta-badge">${escapeHtml(question.topic)}</span>
        <span class="meta-badge">${escapeHtml(question.subtopic)}</span>
        <span class="meta-badge">${escapeHtml(question.difficulty)}</span>
        <span class="meta-badge">${escapeHtml(question.questionType)}</span>
        <span class="meta-badge">${question.maximumMark} mark${question.maximumMark === 1 ? "" : "s"}</span>
        <span class="meta-badge">${escapeHtml(question.status)}</span>
        <span class="meta-badge">Used ${question.usageCount}</span>
      </div>
      <div class="session-badges">
        <button type="button">Preview</button>
        <button type="button">Duplicate</button>
        <button type="button">Add to Test</button>
        <button type="button">View Results</button>
      </div>
    </article>`).join("");
}

function renderTestBuilder() {
  const template = templateById(selectedTestTemplateId) || centreState.testTemplates[0];
  const summary = templateSummary(centreState, template.id);
  const validation = validateTestTemplate(centreState, template.id);
  document.querySelector("#testBuilderPanel").innerHTML = `
    <article class="builder-card">
      <h3>${escapeHtml(template.name)}</h3>
      <p>${escapeHtml(template.description)}</p>
      <div class="boundary-summary">
        <div><span>Total questions</span><strong>${summary.questionCount}</strong></div>
        <div><span>Total marks</span><strong>${summary.maximumMark}</strong></div>
        <div><span>Time limit</span><strong>${template.timeLimitMinutes} min</strong></div>
      </div>
      <p class="boundary-target">${escapeHtml(summary.topicCount)} topics covered. Status: ${escapeHtml(template.status)}.</p>
    </article>
    <article class="builder-card">
      <h3>Blueprint summary</h3>
      <div class="table-wrap"><table class="difficulty-table">
        <thead><tr><th>Difficulty</th><th>Marks</th></tr></thead>
        <tbody>${DIFFICULTIES.map((difficulty) => `<tr><td>${difficulty}</td><td>${summary.difficultyMarks[difficulty] || 0}</td></tr>`).join("")}</tbody>
      </table></div>
    </article>
    <article class="builder-card">
      <h3>Validation</h3>
      ${validation.critical.length ? `<p><strong>Cannot publish:</strong> ${escapeHtml(validation.critical.join("; "))}</p>` : "<p>No critical errors. This test can be published.</p>"}
      ${validation.warnings.length ? `<p><strong>Warnings:</strong> ${escapeHtml(validation.warnings.join("; "))}</p>` : "<p>No warnings.</p>"}
      <button type="button">Preview test</button>
    </article>`;
}

function renderSessionsModule() {
  document.querySelector("#allSessionsTable").innerHTML = sessionsTable(centreState.testSessions);
}

function renderReportsModule() {
  document.querySelector("#reportSnapshotList").innerHTML = centreState.reportSnapshots.map((snapshot) => {
    const student = studentById(snapshot.studentId);
    return `<button type="button" class="selection-item" data-report-id="${snapshot.id}">
      <strong>${escapeHtml(student.studentName)} — ${escapeHtml(snapshot.subjectName)}</strong>
      <p>${escapeHtml(snapshot.status)} · ${formatDate(snapshot.createdAt)} · ${escapeHtml(snapshot.testSessionId || "Longitudinal report")}</p>
      <p>${escapeHtml(snapshot.generatedNarrative.split("\n").find(Boolean) || "Student report snapshot")}</p>
    </button>`;
  }).join("") || "<p>No report snapshots yet.</p>";
}

function sessionsTable(sessions) {
  return `
    <thead><tr><th>Student</th><th>Test</th><th>Date</th><th>Score</th><th>Status</th><th>Report</th></tr></thead>
    <tbody>${sessions.map((session) => {
      const student = studentById(session.studentId);
      const score = session.maximumMark ? `${round1(session.rawMark || 0)}/${session.maximumMark} (${Math.round(session.percentage || 0)}%)` : "—";
      return `<tr><td><strong>${escapeHtml(student.studentName)}</strong><br><span class="muted-line">${escapeHtml(student.school)}</span></td><td>${escapeHtml(session.testName)}</td><td>${escapeHtml(shortDate(session.submittedAt || session.startedAt || session.createdAt))}</td><td>${score}</td><td><span class="status-pill ${sessionStatusClass(session.status)}">${escapeHtml(session.status)}</span></td><td>${sessionActions(session)}</td></tr>`;
    }).join("")}</tbody>`;
}

function sessionActions(session) {
  if (session.status === "In progress") return `<button type="button" data-session-action="resume" data-session-id="${session.id}">Resume</button>`;
  if (session.status === "Needs marking") return `<button type="button" data-session-action="mark" data-session-id="${session.id}">Review Written Answers</button>`;
  if (session.status === "Marked") return `<button type="button" data-session-action="report" data-session-id="${session.id}">Generate Report</button>`;
  if (session.status === "Report generated") return `<button type="button" data-session-action="view-report" data-session-id="${session.id}">Open Report</button>`;
  return "—";
}

function handleSessionAction(event) {
  const button = event.target.closest("[data-session-action]");
  if (!button) return;
  const sessionId = button.dataset.sessionId;
  const action = button.dataset.sessionAction;
  if (action === "resume") openTestMode(sessionId);
  if (action === "cancel") cancelSession(sessionId);
  if (action === "mark") {
    activeSessionId = sessionId;
    showCentreModule("marking");
    renderMarkingModule();
  }
  if (action === "report") generateReportForSession(sessionId);
  if (action === "view-report") {
    const snapshot = centreState.reportSnapshots.find((item) => item.testSessionId === sessionId);
    if (snapshot) renderEvidenceSnapshot(snapshot.evidenceJson, snapshot.editedNarrative || snapshot.generatedNarrative);
  }
}

function createTestSession(state, studentId, testTemplateId, now) {
  const template = state.testTemplates.find((item) => item.id === testTemplateId);
  const startedAt = now.toISOString();
  const session = {
    id: makeId("SESSION"),
    studentId,
    testTemplateId,
    testName: template.name,
    subjectName: template.subjectName,
    status: "In progress",
    startedAt,
    submittedAt: "",
    markedAt: "",
    reportGeneratedAt: "",
    timeLimitMinutes: template.timeLimitMinutes,
    serverDeadline: new Date(now.getTime() + template.timeLimitMinutes * 60000).toISOString(),
    timeUsedSeconds: 0,
    createdAt: startedAt,
    updatedAt: startedAt
  };
  state.testSessions.unshift(session);
  const questionsForTemplate = getTemplateQuestions(state, testTemplateId);
  for (const question of questionsForTemplate) {
    state.studentResponses = upsertStudentResponse(state.studentResponses, {
      id: makeId("RESP"),
      testSessionId: session.id,
      studentId,
      questionId: question.id,
      questionVersion: question.version,
      answer: emptyAnswerForQuestion(question),
      firstViewedAt: "",
      lastSavedAt: "",
      timeSpentSeconds: 0,
      answerChangeCount: 0,
      flagged: false,
      markAwarded: null,
      maximumMark: question.maximumMark,
      markingMethod: "",
      markingConfidence: 0,
      errorCodes: [],
      feedback: "",
      internalNote: "",
      markedAt: "",
      createdAt: startedAt,
      updatedAt: startedAt
    });
  }
  return session;
}

function openTestMode(sessionId) {
  const session = sessionById(sessionId);
  if (!session || session.status !== "In progress") return;
  activeSessionId = sessionId;
  activeQuestionIndex = 0;
  activeTestPayload = buildTestModePayload(centreState, sessionId);
  document.querySelector("#completionScreen").hidden = true;
  document.querySelector(".test-mode-shell").hidden = false;
  document.querySelector("#testMode").hidden = false;
  renderTestMode();
  startTestTimer();
}

function closeTestMode(moduleName = "dashboard") {
  document.querySelector("#testMode").hidden = true;
  document.querySelector(".test-mode-shell").hidden = false;
  document.querySelector("#completionScreen").hidden = true;
  clearInterval(testTimerInterval);
  activeTestPayload = null;
  renderCentreSystem();
  showCentreModule(moduleName);
}

function renderTestMode() {
  if (!activeTestPayload) return;
  const session = sessionById(activeSessionId);
  const student = studentById(session.studentId);
  document.querySelector("#testModeStudent").textContent = student.studentName.split(" ")[0];
  document.querySelector("#testModeTitle").textContent = activeTestPayload.testName;
  renderQuestionNavigation();
  renderCurrentQuestion();
  updateTestTimer();
}

function renderQuestionNavigation() {
  const responsesForSession = responsesBySession(activeSessionId);
  document.querySelector("#testQuestionNav").innerHTML = activeTestPayload.questions.map((question, index) => {
    const response = responsesForSession.find((item) => item.questionId === question.id);
    return `<button type="button" class="${index === activeQuestionIndex ? "active" : ""} ${isAnswered(response?.answer) ? "answered" : ""} ${response?.flagged ? "flagged" : ""}" data-question-index="${index}">${index + 1}</button>`;
  }).join("");
  document.querySelector("#testQuestionNav").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      saveActiveResponseNow();
      activeQuestionIndex = Number(button.dataset.questionIndex);
      renderTestMode();
    });
  });
  const answered = responsesForSession.filter((response) => isAnswered(response.answer)).length;
  document.querySelector("#testProgressBar").style.width = `${(answered / activeTestPayload.questions.length) * 100}%`;
}

function renderCurrentQuestion() {
  const question = activeTestPayload.questions[activeQuestionIndex];
  const response = responseFor(activeSessionId, question.id);
  document.querySelector("#testQuestionContent").innerHTML = `
    <span class="step-label">${escapeHtml(question.sectionTitle)} · Question ${activeQuestionIndex + 1} of ${activeTestPayload.questions.length}</span>
    <h2>${escapeHtml(question.title)}</h2>
    <p>${escapeHtml(question.questionContent.prompt)}</p>
    <p class="muted-line">${question.maximumMark} mark${question.maximumMark === 1 ? "" : "s"}</p>`;
  document.querySelector("#testAnswerArea").innerHTML = answerInputMarkup(question, response);
  bindAnswerInputs(question);
}

function answerInputMarkup(question, response) {
  if (question.questionType === "MCQ") {
    return question.options.map((option) => `<button type="button" class="answer-card ${response.answer === option.label ? "selected" : ""}" data-answer="${escapeHtml(option.label)}"><strong>${escapeHtml(option.label)}</strong> ${escapeHtml(option.content)}</button>`).join("");
  }
  if (question.questionType === "TrueFalse") {
    return `<div class="tf-grid"><button type="button" class="tf-button answer-card ${normaliseTrueFalse(response.answer) === true ? "selected" : ""}" data-answer="True">True</button><button type="button" class="tf-button answer-card ${normaliseTrueFalse(response.answer) === false ? "selected" : ""}" data-answer="False">False</button></div>`;
  }
  if (question.questionType === "Numerical" || question.questionType === "StructuredCalculation") {
    const answer = typeof response.answer === "object" && response.answer ? response.answer : {};
    return `<label>Working<textarea data-answer-field="working" rows="5">${escapeHtml(answer.working || "")}</textarea></label><label>Final answer<input data-answer-field="finalAnswer" value="${escapeHtml(answer.finalAnswer || "")}" /></label><label>Unit<input data-answer-field="unit" value="${escapeHtml(answer.unit || "")}" /></label>`;
  }
  return `<label>Answer<textarea data-answer-field="text" rows="8">${escapeHtml(typeof response.answer === "string" ? response.answer : "")}</textarea></label>`;
}

function bindAnswerInputs(question) {
  document.querySelectorAll("#testAnswerArea [data-answer]").forEach((button) => {
    button.addEventListener("click", () => updateActiveAnswer(button.dataset.answer));
  });
  document.querySelectorAll("#testAnswerArea [data-answer-field]").forEach((input) => {
    input.addEventListener("input", () => {
      const current = responseFor(activeSessionId, question.id).answer;
      const next = typeof current === "object" && current ? { ...current } : {};
      next[input.dataset.answerField] = input.value;
      updateActiveAnswer(question.questionType === "ShortAnswer" ? next.text || "" : next);
    });
  });
}

function updateActiveAnswer(answer) {
  const question = activeTestPayload.questions[activeQuestionIndex];
  const response = responseFor(activeSessionId, question.id);
  response.answer = answer;
  response.answerChangeCount += 1;
  response.lastSavedAt = new Date().toISOString();
  response.updatedAt = response.lastSavedAt;
  document.querySelector("#autosaveStatus").textContent = "Saving / 儲存中";
  persistCentreState();
  clearTimeout(responseSaveTimers.get(response.id));
  responseSaveTimers.set(response.id, setTimeout(() => {
    persistCentreState();
    document.querySelector("#autosaveStatus").textContent = "Saved / 已儲存";
    renderQuestionNavigation();
    renderCurrentQuestion();
  }, 800));
}

function saveActiveResponseNow() {
  if (!activeTestPayload) return;
  persistCentreState();
  document.querySelector("#autosaveStatus").textContent = "Saved / 已儲存";
}

function moveTestQuestion(delta) {
  saveActiveResponseNow();
  activeQuestionIndex = clamp(activeQuestionIndex + delta, 0, activeTestPayload.questions.length - 1);
  renderTestMode();
}

function toggleCurrentQuestionFlag() {
  const question = activeTestPayload.questions[activeQuestionIndex];
  const response = responseFor(activeSessionId, question.id);
  response.flagged = !response.flagged;
  response.updatedAt = new Date().toISOString();
  persistCentreState();
  renderTestMode();
}

function startTestTimer() {
  clearInterval(testTimerInterval);
  testTimerInterval = setInterval(updateTestTimer, 1000);
}

function updateTestTimer() {
  const session = sessionById(activeSessionId);
  if (!session) return;
  const remaining = recoverTimeRemaining(session, new Date());
  document.querySelector("#testTimer").textContent = formatRemaining(remaining);
  if (remaining <= 0 && session.status === "In progress") submitActiveTest(true);
}

function submitActiveTest(autoSubmitted) {
  const session = sessionById(activeSessionId);
  if (!session || session.status !== "In progress") return;
  saveActiveResponseNow();
  const responsesForSession = responsesBySession(session.id);
  const unanswered = responsesForSession.filter((response) => !isAnswered(response.answer)).length;
  const flagged = responsesForSession.filter((response) => response.flagged).length;
  if (!autoSubmitted && !window.confirm(`Answered: ${responsesForSession.length - unanswered}\nUnanswered: ${unanswered}\nFlagged: ${flagged}\n\nSubmit this test?`)) return;
  markSubmittedSession(centreState, session.id, new Date(), autoSubmitted);
  persistCentreState();
  clearInterval(testTimerInterval);
  document.querySelector(".test-mode-shell").hidden = true;
  document.querySelector("#completionScreen").hidden = false;
  renderCentreSystem();
}

function cancelSession(sessionId) {
  if (!window.confirm("Cancel this session? Responses will be retained for audit but the test will be locked.")) return;
  const session = sessionById(sessionId);
  session.status = "Cancelled";
  session.updatedAt = new Date().toISOString();
  persistCentreState();
  renderCentreSystem();
}

function markSubmittedSession(state, sessionId, now, autoSubmitted = false) {
  const session = state.testSessions.find((item) => item.id === sessionId);
  const submittedAt = now.toISOString();
  const questionsForSession = getSessionQuestions(state, sessionId);
  const responsesForSession = state.studentResponses.filter((item) => item.testSessionId === sessionId);
  for (const response of responsesForSession) {
    const question = questionsForSession.find((item) => item.id === response.questionId);
    if (!isAnswered(response.answer)) {
      response.answer = emptyAnswerForQuestion(question);
      response.errorCodes = ["No attempt"];
    }
    if (questionRequiresStaffReview(question)) {
      const suggestion = suggestWrittenResponse(question, response.answer);
      response.suggestedMark = suggestion.suggestedMark;
      response.markingSuggestion = suggestion;
      response.markingMethod = "Suggested";
      response.markingConfidence = suggestion.confidence;
      response.markAwarded = null;
    } else {
      const marked = markObjectiveResponse(question, response.answer);
      response.markAwarded = marked.markAwarded;
      response.errorCodes = marked.errorCodes;
      response.markingMethod = "Automatic";
      response.markingConfidence = marked.confidence;
      response.markedAt = submittedAt;
    }
    response.lastSavedAt = submittedAt;
    response.updatedAt = submittedAt;
  }
  session.submittedAt = submittedAt;
  session.timeUsedSeconds = Math.max(0, Math.round((new Date(submittedAt) - new Date(session.startedAt)) / 1000));
  session.status = responsesForSession.some((response) => response.markAwarded === null || response.markAwarded === undefined) ? "Needs marking" : "Marked";
  if (autoSubmitted) session.internalNote = "Auto-submitted when timer expired.";
  updateSessionScore(state, sessionId);
}

function recoverTimeRemaining(session, now) {
  return Math.max(0, Math.round((new Date(session.serverDeadline) - now) / 1000));
}

function renderMarkingModule() {
  const session = activeSessionId ? sessionById(activeSessionId) : centreState.testSessions.find((item) => item.status === "Needs marking") || centreState.testSessions.find((item) => item.status === "Marked") || centreState.testSessions[0];
  activeSessionId = session?.id ?? null;
  const panel = document.querySelector("#markingPanel");
  if (!session) {
    panel.innerHTML = "<p>No test sessions available.</p>";
    return;
  }
  const student = studentById(session.studentId);
  const writtenResponses = responsesBySession(session.id).filter((response) => questionRequiresStaffReview(questionById(response.questionId)));
  const reviewed = writtenResponses.filter((response) => response.markingMethod === "Staff reviewed" || response.markingMethod === "Manual override").length;
  const unreviewed = writtenResponses.length - reviewed;
  panel.innerHTML = `
    <article class="marking-card">
      <h3>${escapeHtml(student.studentName)} — ${escapeHtml(session.testName)}</h3>
      <p>Submitted: ${escapeHtml(session.submittedAt ? formatDate(session.submittedAt) : "Not submitted")} · Objective marking: ${objectiveResponsesComplete(session.id) ? "Complete" : "Pending"} · Written marking: ${reviewed}/${writtenResponses.length} reviewed</p>
      <p>Provisional score: ${round1(session.rawMark || 0)}/${session.maximumMark || templateSummary(centreState, session.testTemplateId).maximumMark}</p>
      <div class="session-badges">
        <button type="button" data-marking-action="finish" data-session-id="${session.id}">Finish Marking</button>
        <button type="button" data-marking-action="generate-report" data-session-id="${session.id}" ${unreviewed ? "disabled" : ""}>Generate Report / 生成報告</button>
      </div>
    </article>
    ${writtenResponses.map((response, index) => markingCard(session, response, index, writtenResponses.length)).join("") || "<p>No written responses require staff review.</p>"}`;
}

function markingCard(session, response, index, total) {
  const question = questionById(response.questionId);
  const suggestion = response.markingSuggestion || suggestWrittenResponse(question, response.answer);
  return `<article class="marking-card" data-response-id="${response.id}">
    <span class="step-label">${index + 1} of ${total} written responses</span>
    <h3>${escapeHtml(question.title)}</h3>
    <p><strong>Question:</strong> ${escapeHtml(question.questionContent.prompt)}</p>
    <p><strong>Mark scheme:</strong> ${escapeHtml(question.markingPoints.map((point) => `${point.description} (${point.markValue})`).join("; "))}</p>
    <p><strong>Student answer:</strong> ${escapeHtml(displayAnswer(response.answer) || "No attempt")}</p>
    <p><strong>Suggested mark:</strong> ${suggestion.suggestedMark}/${suggestion.maximumMark} · Confidence ${(suggestion.confidence * 100).toFixed(0)}%</p>
    <label>Final mark<input type="number" min="0" max="${question.maximumMark}" step="0.5" data-mark-input="${response.id}" value="${response.markAwarded ?? suggestion.suggestedMark ?? 0}" /></label>
    <label>Feedback<textarea rows="3" data-feedback-input="${response.id}">${escapeHtml(response.feedback || "")}</textarea></label>
    <div class="session-badges">
      <button type="button" data-marking-action="approve" data-response-id="${response.id}">Approve Suggestion</button>
      <button type="button" data-marking-action="save" data-response-id="${response.id}">Save and Next</button>
    </div>
  </article>`;
}

function handleMarkInput(event) {
  const markInput = event.target.closest("[data-mark-input]");
  const feedbackInput = event.target.closest("[data-feedback-input]");
  if (!markInput && !feedbackInput) return;
  const responseId = markInput?.dataset.markInput || feedbackInput?.dataset.feedbackInput;
  const response = centreState.studentResponses.find((item) => item.id === responseId);
  if (!response) return;
  if (markInput) response.pendingMark = clamp(number(markInput.value) ?? 0, 0, response.maximumMark);
  if (feedbackInput) response.feedback = feedbackInput.value;
}

function handleMarkingAction(event) {
  const button = event.target.closest("[data-marking-action]");
  if (!button) return;
  const action = button.dataset.markingAction;
  if (action === "approve") approveWrittenResponse(button.dataset.responseId);
  if (action === "save") saveWrittenResponse(button.dataset.responseId);
  if (action === "finish") finishMarking(button.dataset.sessionId);
  if (action === "generate-report") generateReportForSession(button.dataset.sessionId);
}

function approveWrittenResponse(responseId) {
  const response = centreState.studentResponses.find((item) => item.id === responseId);
  const question = questionById(response.questionId);
  const suggestion = response.markingSuggestion || suggestWrittenResponse(question, response.answer);
  response.markAwarded = suggestion.suggestedMark;
  response.errorCodes = suggestion.suggestedErrorCodes;
  response.markingMethod = "Staff reviewed";
  response.markingConfidence = suggestion.confidence;
  response.markedAt = new Date().toISOString();
  response.updatedAt = response.markedAt;
  finishMarkingIfComplete(response.testSessionId);
  persistCentreState();
  renderMarkingModule();
}

function saveWrittenResponse(responseId) {
  const response = centreState.studentResponses.find((item) => item.id === responseId);
  response.markAwarded = clamp(response.pendingMark ?? response.markAwarded ?? 0, 0, response.maximumMark);
  response.markingMethod = "Staff reviewed";
  response.markingConfidence = 1;
  response.markedAt = new Date().toISOString();
  response.updatedAt = response.markedAt;
  if (!response.errorCodes?.length && response.markAwarded < response.maximumMark) response.errorCodes = ["Incomplete explanation"];
  finishMarkingIfComplete(response.testSessionId);
  persistCentreState();
  renderMarkingModule();
}

function finishMarking(sessionId) {
  finishMarkingIfComplete(sessionId, true);
  persistCentreState();
  renderCentreSystem();
}

function finishMarkingIfComplete(sessionId, force = false) {
  const session = sessionById(sessionId);
  const missing = responsesBySession(sessionId).filter((response) => response.markAwarded === null || response.markAwarded === undefined);
  if (missing.length && !force) return;
  session.status = missing.length ? "Needs marking" : "Marked";
  session.markedAt = missing.length ? session.markedAt : new Date().toISOString();
  session.updatedAt = new Date().toISOString();
  updateSessionScore(centreState, sessionId);
}

function generateReportForSession(sessionId) {
  const unmarked = responsesBySession(sessionId).filter((response) => response.markAwarded === null || response.markAwarded === undefined);
  if (unmarked.length) {
    alert("Complete written marking before generating the report.");
    return;
  }
  const snapshot = buildReportSnapshotFromState(centreState, sessionId, "Draft");
  const existingIndex = centreState.reportSnapshots.findIndex((item) => item.testSessionId === sessionId);
  if (existingIndex >= 0) centreState.reportSnapshots[existingIndex] = snapshot;
  else centreState.reportSnapshots.unshift(snapshot);
  const session = sessionById(sessionId);
  session.status = "Report generated";
  session.reportGeneratedAt = snapshot.createdAt;
  session.updatedAt = snapshot.createdAt;
  persistCentreState();
  renderCentreSystem();
  renderEvidenceSnapshot(snapshot.evidenceJson, snapshot.generatedNarrative);
  showCentreModule("reports");
}

function buildReportSnapshotFromState(state, sessionId, status = "Draft") {
  const session = state.testSessions.find((item) => item.id === sessionId);
  const evidenceObject = buildCentreReportEvidence(state, sessionId);
  const narrative = generateParentReport(evidenceObject);
  const now = new Date().toISOString();
  return {
    id: makeId("REPORT"),
    studentId: session.studentId,
    subjectName: session.subjectName,
    testSessionId: session.id,
    reportingPeriodStart: evidenceObject.reportingPeriod.start,
    reportingPeriodEnd: evidenceObject.reportingPeriod.end,
    evidenceJson: evidenceObject,
    generatedNarrative: narrative,
    editedNarrative: "",
    status,
    createdAt: now,
    updatedAt: now
  };
}

function buildCentreReportEvidence(state, sessionId) {
  const latestSession = state.testSessions.find((item) => item.id === sessionId);
  const student = state.students.find((item) => item.studentId === latestSession.studentId);
  const sessions = state.testSessions
    .filter((session) => session.studentId === latestSession.studentId && session.subjectName === latestSession.subjectName && ["Submitted", "Needs marking", "Marked", "Report generated"].includes(session.status))
    .sort((a, b) => new Date(a.submittedAt || a.startedAt) - new Date(b.submittedAt || b.startedAt));
  const inputs = centreSessionsToReportInputs(state, student, sessions);
  const report = buildStudentReportEvidence(inputs.assessments, inputs.questions, inputs.responses, {
    studentName: student.studentName,
    subject: latestSession.subjectName,
    reportDate: new Date(latestSession.submittedAt || latestSession.startedAt)
  });
  report.assessmentHistory = report.overallProgress.assessments;
  report.latestSession = latestSession;
  report.dataQuality.reportSource = "Centre test session records";
  return report;
}

function centreSessionsToReportInputs(state, student, sessions) {
  const assessmentsOut = [];
  const questionsOut = [];
  const responsesOut = [];
  for (const session of sessions) {
    const template = state.testTemplates.find((item) => item.id === session.testTemplateId);
    const sessionQuestions = getSessionQuestions(state, session.id);
    assessmentsOut.push({
      assessmentId: session.id,
      studentId: student.studentId,
      studentName: student.studentName,
      qualification: template.qualification,
      examBoard: template.examBoard,
      syllabusCode: template.syllabusCode,
      subject: session.subjectName,
      assessmentName: session.testName,
      assessmentDate: toIsoDate(session.submittedAt || session.startedAt),
      assessmentType: template.testType,
      maximumMark: templateSummary(state, template.id).maximumMark,
      durationMinutes: template.timeLimitMinutes
    });
    for (const question of sessionQuestions) {
      questionsOut.push({
        assessmentId: session.id,
        questionId: question.id,
        section: question.section,
        questionNumber: question.id,
        maximumMark: question.maximumMark,
        correctAnswer: question.correctAnswer,
        topic: question.topic,
        subtopic: question.subtopic,
        difficulty: question.difficulty,
        questionType: reportQuestionType(question.questionType),
        assessmentObjective: question.assessmentObjective,
        answerMode: question.questionType === "Numerical" ? "numeric" : questionRequiresStaffReview(question) ? "tutor-marked" : "exact",
        numericalTolerance: question.numericalTolerance,
        requiredUnit: question.requiredUnit,
        coreOrSupplement: question.coreOrSupplement
      });
    }
    for (const response of state.studentResponses.filter((item) => item.testSessionId === session.id)) {
      responsesOut.push({
        assessmentId: session.id,
        studentId: student.studentId,
        questionId: response.questionId,
        studentAnswer: displayAnswer(response.answer),
        markAwarded: response.markAwarded ?? 0,
        maximumMark: response.maximumMark,
        markingMethod: response.markingMethod,
        errorCode: response.errorCodes?.[0] || "",
        tutorFeedback: response.feedback
      });
    }
  }
  return { assessments: assessmentsOut, questions: questionsOut, responses: responsesOut };
}

function renderEvidenceSnapshot(report, narrative) {
  evidence = report;
  document.querySelector("#pageTitle").textContent = `${report.student.name} - ${report.subject.name} Report`;
  renderSummary(report);
  renderProgressChart(report);
  renderRadar(report.topicProfile, "Topic Mastery");
  renderPrintRadars(report);
  renderGradeEvidence(report);
  renderTopicMap(report);
  renderHeatmap(report);
  renderDifficultyPanel(report);
  renderErrorPatterns(report);
  renderDataQuality(report);
  elements.reportText.value = narrative || generateParentReport(report);
}

function markObjectiveResponse(question, answer) {
  if (question.questionType === "MCQ") return markMcq(question, answer);
  if (question.questionType === "TrueFalse") return markTrueFalse(question, answer);
  if (question.questionType === "Numerical" || question.questionType === "StructuredCalculation") return markNumerical(question, answer);
  return { markAwarded: null, confidence: 0, errorCodes: [], requiresStaffReview: true };
}

function markMcq(question, studentAnswer) {
  const correct = question.options.find((option) => option.isCorrect);
  const selected = question.options.find((option) => normaliseAnswer(option.label) === normaliseAnswer(studentAnswer));
  if (!studentAnswer) return { markAwarded: 0, confidence: 1, errorCodes: ["No attempt"], requiresStaffReview: false };
  return {
    markAwarded: selected && correct && normaliseAnswer(selected.label) === normaliseAnswer(correct.label) ? question.maximumMark : 0,
    confidence: 1,
    errorCodes: selected?.isCorrect ? [] : [selected?.errorCode || "Misconception"],
    requiresStaffReview: false
  };
}

function markTrueFalse(question, studentAnswer) {
  const correct = normaliseTrueFalse(question.correctAnswer);
  const submitted = normaliseTrueFalse(studentAnswer);
  if (submitted === null) return { markAwarded: 0, confidence: 1, errorCodes: ["No attempt"], requiresStaffReview: false };
  return {
    markAwarded: submitted === correct ? question.maximumMark : 0,
    confidence: 1,
    errorCodes: submitted === correct ? [] : ["Question interpretation"],
    requiresStaffReview: false
  };
}

function markNumerical(question, answer) {
  const finalAnswer = typeof answer === "object" && answer ? `${answer.finalAnswer ?? ""} ${answer.unit ?? ""}` : answer;
  if (!text(finalAnswer)) return { markAwarded: 0, confidence: 1, errorCodes: ["No attempt"], requiresStaffReview: false };
  const valueCorrect = markNumericAnswer(question, finalAnswer);
  const parsed = parseNumberAndUnit(finalAnswer);
  const correct = parseNumberAndUnit(question.correctAnswer);
  const valueOnlyCorrect = parsed.value !== null && correct.value !== null && Math.abs(parsed.value - correct.value) <= (question.numericalTolerance ?? 0);
  if (valueCorrect) return { markAwarded: question.maximumMark, confidence: 1, errorCodes: [], requiresStaffReview: false };
  if (valueOnlyCorrect) return { markAwarded: Math.max(0, question.maximumMark - 1), confidence: 0.95, errorCodes: ["Unit error"], requiresStaffReview: false };
  return { markAwarded: 0, confidence: 0.95, errorCodes: ["Incorrect calculation method"], requiresStaffReview: false };
}

function suggestWrittenResponse(question, answer) {
  const answerText = displayAnswer(answer).toLowerCase();
  const markingPoints = question.markingPoints.map((point) => {
    const matched = point.acceptedConcepts?.some((concept) => answerText.includes(String(concept).toLowerCase()));
    return {
      id: point.id,
      status: matched ? "Met" : answerText ? "Uncertain" : "Not met",
      evidenceText: matched ? point.acceptedConcepts.find((concept) => answerText.includes(String(concept).toLowerCase())) : ""
    };
  });
  const suggestedMark = clamp(sum(markingPoints.map((point, index) => point.status === "Met" ? question.markingPoints[index].markValue : 0)), 0, question.maximumMark);
  const uncertain = markingPoints.some((point) => point.status === "Uncertain");
  const confidence = !answerText ? 1 : uncertain ? 0.62 : 0.9;
  return {
    suggestedMark,
    maximumMark: question.maximumMark,
    confidence,
    markingPoints,
    suggestedErrorCodes: !answerText ? ["No attempt"] : suggestedMark < question.maximumMark ? ["Incomplete explanation"] : [],
    requiresStaffReview: confidence < 0.85 || uncertain
  };
}

function normaliseTrueFalse(value) {
  const source = normaliseAnswer(value);
  if (["true", "t", "yes", "1"].includes(source)) return true;
  if (["false", "f", "no", "0"].includes(source)) return false;
  return null;
}

function upsertStudentResponse(existingResponses, response) {
  const index = existingResponses.findIndex((item) => item.testSessionId === response.testSessionId && item.questionId === response.questionId);
  if (index >= 0) {
    const next = [...existingResponses];
    next[index] = { ...next[index], ...response, id: next[index].id };
    return next;
  }
  return [...existingResponses, response];
}

function buildTestModePayload(state, sessionId) {
  const session = state.testSessions.find((item) => item.id === sessionId);
  const student = state.students.find((item) => item.studentId === session.studentId);
  const template = state.testTemplates.find((item) => item.id === session.testTemplateId);
  const sections = state.testSections.filter((item) => item.testTemplateId === template.id).sort((a, b) => a.order - b.order);
  const questionsForTest = sections.flatMap((section) => section.questionRefs.sort((a, b) => a.order - b.order).map((ref) => {
    const question = state.questions.find((item) => item.id === ref.questionId && item.version === ref.questionVersion);
    return {
      id: question.id,
      sectionTitle: section.title,
      section: question.section,
      title: question.title,
      questionContent: question.questionContent,
      questionType: question.questionType,
      maximumMark: ref.markOverride ?? question.maximumMark,
      options: question.options?.map((option) => ({ id: option.id, label: option.label, content: option.content })) || []
    };
  }));
  return {
    sessionId,
    student: { studentId: student.studentId, displayName: student.studentName.split(" ")[0] },
    testName: template.name,
    instructions: template.instructions,
    serverDeadline: session.serverDeadline,
    questions: questionsForTest
  };
}

function getTemplateQuestions(state, testTemplateId) {
  return state.testSections
    .filter((section) => section.testTemplateId === testTemplateId)
    .sort((a, b) => a.order - b.order)
    .flatMap((section) => section.questionRefs.sort((a, b) => a.order - b.order).map((ref) => state.questions.find((question) => question.id === ref.questionId && question.version === ref.questionVersion)).filter(Boolean));
}

function getSessionQuestions(state, sessionId) {
  const session = state.testSessions.find((item) => item.id === sessionId);
  return session ? getTemplateQuestions(state, session.testTemplateId) : [];
}

function templateSummary(state, templateId) {
  const questionsForTemplate = getTemplateQuestions(state, templateId);
  const difficultyMarks = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, sum(questionsForTemplate.filter((question) => question.difficulty === difficulty).map((question) => question.maximumMark))]));
  const questionTypeMarks = Object.fromEntries([...new Set(questionsForTemplate.map((question) => question.questionType))].map((type) => [type, sum(questionsForTemplate.filter((question) => question.questionType === type).map((question) => question.maximumMark))]));
  return {
    questionCount: questionsForTemplate.length,
    maximumMark: sum(questionsForTemplate.map((question) => question.maximumMark)),
    topicCount: unique(questionsForTemplate.map((question) => question.topic)).length,
    difficultyMarks,
    questionTypeMarks
  };
}

function validateTestTemplate(state, templateId) {
  const sections = state.testSections.filter((section) => section.testTemplateId === templateId);
  const questionsForTemplate = getTemplateQuestions(state, templateId);
  const critical = [];
  const warnings = [];
  if (!sections.length) critical.push("No sections have been added");
  if (sections.some((section) => !section.questionRefs.length)) critical.push("One or more sections are empty");
  if (questionsForTemplate.some((question) => !question.topic)) warnings.push("Some questions are missing topic");
  if (questionsForTemplate.some((question) => !question.difficulty)) critical.push("Some questions are missing difficulty");
  if (questionsForTemplate.some((question) => question.maximumMark <= 0)) critical.push("Some questions have invalid maximum marks");
  if (new Set(questionsForTemplate.map((question) => question.id)).size !== questionsForTemplate.length) critical.push("Duplicate questions are present");
  if (questionsForTemplate.some((question) => !questionRequiresStaffReview(question) && !question.correctAnswer && !question.options?.some((option) => option.isCorrect))) critical.push("Objective questions need a correct answer");
  return { critical, warnings };
}

function updateSessionScore(state, sessionId) {
  const session = state.testSessions.find((item) => item.id === sessionId);
  const responsesForSession = state.studentResponses.filter((item) => item.testSessionId === sessionId);
  const markedResponses = responsesForSession.filter((item) => item.markAwarded !== null && item.markAwarded !== undefined);
  const maximumMark = sum(responsesForSession.map((item) => item.maximumMark));
  const rawMark = sum(markedResponses.map((item) => item.markAwarded));
  const answered = responsesForSession.filter((item) => isAnswered(item.answer)).length;
  session.rawMark = round1(rawMark);
  session.maximumMark = maximumMark;
  session.percentage = maximumMark ? (rawMark / maximumMark) * 100 : 0;
  session.answeredQuestions = answered;
  session.totalQuestions = responsesForSession.length;
  session.completionRate = responsesForSession.length ? (answered / responsesForSession.length) * 100 : 0;
  session.updatedAt = new Date().toISOString();
}

function answerFromSample(response, question) {
  if (question.questionType === "ShortAnswer") return response.studentAnswer === "Tutor marked response" ? `${question.topic} ${question.subtopic} because particles and ions explain the observation.` : response.studentAnswer;
  return response.studentAnswer;
}

function emptyAnswerForQuestion(question) {
  return question.questionType === "Numerical" || question.questionType === "StructuredCalculation" ? { working: "", finalAnswer: "", unit: "" } : "";
}

function isAnswered(answer) {
  if (answer === null || answer === undefined) return false;
  if (typeof answer === "object") return Object.values(answer).some((value) => text(value));
  return Boolean(text(answer));
}

function questionRequiresStaffReview(question) {
  return ["ShortAnswer", "LongApplication", "PracticalPlanning", "ChemicalEquation", "DataInterpretation", "GraphInterpretation"].includes(question.questionType);
}

function objectiveResponsesComplete(sessionId) {
  return responsesBySession(sessionId)
    .filter((response) => !questionRequiresStaffReview(questionById(response.questionId)))
    .every((response) => response.markingMethod === "Automatic");
}

function reportQuestionType(type) {
  return {
    MCQ: "MCQ",
    TrueFalse: "True / False",
    ShortAnswer: "Short explanation",
    StructuredCalculation: "Structured calculation",
    Numerical: "Structured calculation",
    ChemicalEquation: "Structured calculation",
    DataInterpretation: "Data interpretation",
    GraphInterpretation: "Graph interpretation",
    PracticalPlanning: "Experimental planning",
    LongApplication: "Long application"
  }[type] || "Problem solving";
}

function displayAnswer(answer) {
  if (answer === null || answer === undefined) return "";
  if (typeof answer === "object") return Object.entries(answer).filter(([, value]) => text(value)).map(([key, value]) => `${key}: ${value}`).join("; ");
  return String(answer);
}

function normaliseCentreErrorCode(value) {
  return {
    "Calculation method": "Incorrect calculation method",
    "Careless error": "Other"
  }[value] || value || "";
}

function responsesBySession(sessionId) {
  return centreState.studentResponses.filter((item) => item.testSessionId === sessionId);
}

function responseFor(sessionId, questionId) {
  return centreState.studentResponses.find((item) => item.testSessionId === sessionId && item.questionId === questionId);
}

function studentById(studentId) {
  return centreState.students.find((item) => item.studentId === studentId) || { studentName: "Unknown student", school: "" };
}

function templateById(templateId) {
  return centreState.testTemplates.find((item) => item.id === templateId);
}

function sessionById(sessionId) {
  return centreState.testSessions.find((item) => item.id === sessionId);
}

function questionById(questionId) {
  return centreState.questions.find((item) => item.id === questionId);
}

function getUnfinishedSession(state) {
  return state.testSessions.find((session) => session.status === "In progress" && recoverTimeRemaining(session, new Date()) > 0);
}

function lastUsedLabel(templateId) {
  const session = centreState.testSessions.find((item) => item.testTemplateId === templateId && item.startedAt);
  return session ? shortDate(session.startedAt) : "Never";
}

function sessionStatusClass(status) {
  if (status === "Report generated" || status === "Marked") return "status-strong";
  if (status === "Needs marking" || status === "Submitted") return "status-watch";
  if (status === "Cancelled") return "status-priority";
  return "status-good";
}

function formatRemaining(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function handleDataFile(event, target) {
  const file = event.target.files[0];
  if (!file) return;
  const rows = await readTabularFile(file);
  const lowerName = file.name.toLowerCase();

  if (target === "assessments") {
    const detected = detectLegacyRows(rows);
    if (detected.length) {
      legacyRows = detected;
      const converted = convertLegacyRows(detected);
      assessments = converted.assessments;
      questions = converted.questions;
      responses = converted.responses;
      elements.assessmentFileStatus.textContent = `Legacy summary-only import: ${file.name}`;
    } else {
      assessments = rows.map(normaliseAssessment).filter(Boolean);
      elements.assessmentFileStatus.textContent = `Loaded ${assessments.length} assessments from ${file.name}`;
    }
  }
  if (target === "questions") {
    questions = rows.map(normaliseQuestion).filter(Boolean);
    elements.blueprintFileStatus.textContent = `Loaded ${questions.length} blueprint questions from ${file.name}`;
  }
  if (target === "responses") {
    responses = rows.map(normaliseResponse).filter(Boolean);
    elements.responsesFileStatus.textContent = `Loaded ${responses.length} responses from ${file.name}`;
  }

  if (!lowerName.endsWith(".csv") && typeof XLSX === "undefined") {
    alert("XLSX parser did not load. Please try CSV or reload while online.");
  }
  renderSelectors();
  render();
}

async function readTabularFile(file) {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCsv(await file.text());
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header.trim(), cells[index] ?? ""]));
  });
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function renderSelectors() {
  const students = unique(assessments.map((item) => item.studentName));
  elements.studentSelect.innerHTML = students.map(optionMarkup).join("");
  renderSubjectOptions();
}

function renderSubjectOptions() {
  const studentName = elements.studentSelect.value || assessments[0]?.studentName;
  const subjects = unique(assessments.filter((item) => item.studentName === studentName).map((item) => item.subject));
  elements.subjectSelect.innerHTML = subjects.map(optionMarkup).join("");
}

function render() {
  const studentName = elements.studentSelect.value;
  const subject = elements.subjectSelect.value;
  if (!studentName || !subject) return;

  evidence = buildStudentReportEvidence(assessments, questions, responses, { studentName, subject, reportDate: REPORT_DATE });
  elements.qualificationSelect.value = evidence.subject.qualification || "IGCSE";
  document.querySelector("#pageTitle").textContent = `${evidence.student.name} - ${evidence.subject.name} Report`;

  renderSummary(evidence);
  renderProgressChart(evidence);
  renderRadar(evidence.topicProfile, "Topic Mastery");
  renderPrintRadars(evidence);
  renderGradeEvidence(evidence);
  renderTopicMap(evidence);
  renderHeatmap(evidence);
  renderDifficultyPanel(evidence);
  renderErrorPatterns(evidence);
  renderDataQuality(evidence);
  elements.reportText.value = generateParentReport(evidence);
}

function renderRadarOnly() {
  if (!evidence) return;
  const profile = radarMode === "question"
    ? evidence.questionTypeProfile
    : radarMode === "challenge"
      ? evidence.challengeAdjustedTopicProfile
      : evidence.topicProfile;
  const label = radarMode === "question" ? "Question Type" : radarMode === "challenge" ? "Challenge-adjusted" : "Topic Mastery";
  renderRadar(profile, label);
}

function renderSummary(report) {
  const latest = report.latestAssessment;
  document.querySelector("#latestScore").textContent = latest ? `${Math.round(latest.percentage)}%` : "--";
  document.querySelector("#latestMeta").textContent = latest
    ? `${latest.markAwarded}/${latest.maximumMark} on ${formatDate(latest.date)} - ${latest.attemptedQuestions}/${latest.totalQuestions} attempted`
    : "No assessment data";
  const change = report.overallProgress.latestChange;
  document.querySelector("#weeklyChange").textContent = change === null ? "--" : `${change >= 0 ? "+" : ""}${Math.round(change)} pts`;
  document.querySelector("#estimatedGrade").textContent = report.gradeEvidence.message;
  document.querySelector("#gradeMeta").textContent = "Safeguarded grade evidence";
  document.querySelector("#focusArea").textContent = report.priorities[0]?.label ?? "Monitor evidence";
}

function renderProgressChart(report) {
  const labels = report.overallProgress.assessments.map((item) => formatDate(item.date));
  const scores = report.overallProgress.assessments.map((item) => Math.round(item.percentage));
  const forecast = report.forecastEvidence;
  const datasets = [
    {
      label: "Assessment score",
      data: scores,
      borderColor: "#2563eb",
      backgroundColor: "#2563eb",
      tension: 0.32,
      pointRadius: 4,
      borderWidth: 3
    }
  ];

  if (forecast.available) {
    labels.push("Projection");
    datasets[0].data.push(null);
    datasets.push({
      label: "Projection lower range",
      data: [...Array(scores.length - 1).fill(null), scores.at(-1), forecast.lowerPercentage],
      borderColor: "rgba(192, 95, 24, 0)",
      backgroundColor: "rgba(192, 95, 24, 0)",
      pointRadius: 0,
      borderWidth: 0
    });
    datasets.push({
      label: "Projection range (1 SD)",
      data: [...Array(scores.length - 1).fill(null), scores.at(-1), forecast.upperPercentage],
      borderColor: "rgba(192, 95, 24, 0)",
      backgroundColor: "rgba(192, 95, 24, 0.14)",
      fill: "-1",
      pointRadius: 0,
      borderWidth: 0
    });
    datasets.push({
      label: "Internal learning projection",
      data: [...Array(scores.length - 1).fill(null), scores.at(-1), forecast.nextPercentage],
      borderColor: "#c05f18",
      backgroundColor: "#c05f18",
      borderDash: [5, 5],
      tension: 0.32,
      pointRadius: 3,
      borderWidth: 2
    });
  }

  trendChart?.destroy();
  trendChart = new Chart(document.querySelector("#trendChart"), {
    type: "line",
    data: { labels, datasets },
    options: chartOptions({ y: { min: 0, max: 100, title: "Assessment score %" }, x: { title: "Assessment date" } })
  });
}

function renderRadar(profile, modeLabel) {
  document.querySelector("#radarHeading").textContent = `Ability Radar: ${modeLabel}`;
  document.querySelector("#radarDescription").textContent = modeLabel === "Topic Mastery"
    ? "Ordinary mark-weighted topic mastery. This is the main parent-facing score."
    : modeLabel === "Challenge-adjusted"
      ? "This view gives slightly greater influence to harder questions and should be interpreted alongside ordinary topic mastery and evidence volume."
      : "Evidence-weighted performance by question format.";
  document.querySelectorAll("#radarModeControls button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === radarMode);
  });

  radarChart?.destroy();
  radarChart = createRadarChart(document.querySelector("#radarChart"), profile, modeLabel);
  const weakest = profile.find((item) => item.status === "Priority" || item.status === "Possible priority" || item.status === "Developing") ?? profile[0];
  document.querySelector("#topicDetail").innerHTML = weakest
    ? `<span>${modeLabel} Focus</span><strong>${escapeHtml(weakest.label)} - ${Math.round(weakest.mastery)}%</strong><p>Mastery: ${Math.round(weakest.rawMastery ?? weakest.mastery)}%. Challenge-adjusted: ${Math.round(weakest.challengeAdjustedScore ?? weakest.mastery)}%. Evidence: ${escapeHtml(weakest.marksAwarded)}/${escapeHtml(weakest.marksAvailable)} marks, ${plural(weakest.questionCount, "question")}, ${plural(weakest.assessmentCount, "assessment")}. Confidence: ${escapeHtml(weakest.confidence)}.</p>`
    : "";
}

function renderPrintRadars(report) {
  printTopicRadarChart?.destroy();
  printQuestionRadarChart?.destroy();
  printTopicRadarChart = createRadarChart(document.querySelector("#printTopicRadarChart"), report.topicProfile, "Topic ability");
  printQuestionRadarChart = createRadarChart(document.querySelector("#printQuestionRadarChart"), report.questionTypeProfile, "Question-type ability");
}

function createRadarChart(canvas, profile, label) {
  if (!canvas) return null;
  return new Chart(canvas, {
    type: "radar",
    data: {
      labels: profile.map((item) => item.label),
      topicProfile: profile,
      datasets: [
        {
          label,
          data: profile.map((item) => Math.round(item.mastery ?? 0)),
          backgroundColor: "rgba(37, 99, 235, 0.18)",
          borderColor: "#2563eb",
          pointBackgroundColor: "#2563eb",
          borderWidth: 2
        }
      ]
    },
    options: radarChartOptions()
  });
}

function renderGradeEvidence(report) {
  const container = document.querySelector("#boundaryDistance");
  document.querySelector("#curveDescription").textContent = report.gradeEvidence.message;
  curveChart?.destroy();
  const latest = report.latestAssessment;
  curveChart = new Chart(document.querySelector("#curveChart"), {
    type: "bar",
    data: {
      labels: report.overallProgress.assessments.map((item) => formatDate(item.date)),
      datasets: [{ label: "Assessment %", data: report.overallProgress.assessments.map((item) => Math.round(item.percentage)), backgroundColor: "#1f78a8" }]
    },
    options: chartOptions({ y: { min: 0, max: 100, title: "Score %" }, x: { title: "Assessment date" } })
  });
  container.innerHTML = latest
    ? `<div class="boundary-summary"><div><span>Latest mark</span><strong>${latest.markAwarded}/${latest.maximumMark}</strong></div><div><span>Completion</span><strong>${Math.round(latest.completionRate)}%</strong></div><div><span>Grade</span><strong>${escapeHtml(report.gradeEvidence.message)}</strong></div></div><p class="boundary-target">${escapeHtml(report.forecastEvidence.message)}</p>`
    : "";
  document.querySelector("#performanceAnnotations").innerHTML = report.strengths.slice(0, 1).concat(report.priorities.slice(0, 1)).map((item) =>
    `<div class="annotation-card"><span>${item.type}</span><strong>${escapeHtml(item.label)}</strong><p>${Math.round(item.mastery)}%, ${escapeHtml(item.confidence)}.</p></div>`
  ).join("");
}

function renderTopicMap(report) {
  document.querySelector("#topicMapTable").innerHTML = profileTable(report.topicProfile);
}

function renderHeatmap(report) {
  const assessmentsForHeatmap = report.overallProgress.assessments;
  document.querySelector("#heatmapTable").innerHTML = `
    <thead><tr><th>Topic</th>${assessmentsForHeatmap.map((item) => `<th>${escapeHtml(shortDate(item.date))}</th>`).join("")}<th>Current</th></tr></thead>
    <tbody>
      ${report.topicProfile.map((topic) => `<tr><td><strong>${escapeHtml(topic.label)}</strong></td>${assessmentsForHeatmap.map((assessment) => {
        const value = topic.assessmentScores.find((item) => item.assessmentId === assessment.assessmentId);
        return value ? `<td class="heat-cell ${heatClass(value.percentage)}">${Math.round(value.percentage)}%</td>` : `<td title="This topic was not assessed in this assessment.">—</td>`;
      }).join("")}<td><span class="status-pill ${statusClass(topic.status)}">${escapeHtml(topic.status)}</span></td></tr>`).join("")}
    </tbody>`;
}

function renderDifficultyPanel(report) {
  document.querySelector("#difficultyPanel").innerHTML = `
    <div class="table-wrap"><table class="difficulty-table">
      <thead><tr><th>Difficulty</th><th>Accuracy</th><th>Marks</th><th>Questions</th><th>Assessments</th></tr></thead>
      <tbody>${report.difficultyProfile.map((item) => `<tr><td><strong>${escapeHtml(item.label)}</strong></td><td>${Math.round(item.mastery)}%</td><td>${item.marksAwarded}/${item.marksAvailable}</td><td>${item.questionCount}</td><td>${item.assessmentCount}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="difficulty-note"><span>Interpretation</span><p>${escapeHtml(report.difficultyInsight)}</p></div>`;
}

function renderErrorPatterns(report) {
  document.querySelector("#errorPatternPanel").innerHTML = `
    <div class="table-wrap"><table class="difficulty-table">
      <thead><tr><th>Error pattern</th><th>Marks lost</th><th>Recommendation</th></tr></thead>
      <tbody>${report.errorPatterns.map((item) => `<tr><td><strong>${escapeHtml(item.errorCode)}</strong></td><td>${item.lostMarks}</td><td>${escapeHtml(item.recommendation)}</td></tr>`).join("") || `<tr><td colspan="3">No repeated error pattern has enough evidence yet.</td></tr>`}</tbody>
    </table></div>`;
}

function renderDataQuality(report) {
  document.querySelector("#dataQualityPanel").innerHTML = `
    <div class="boundary-summary">
      <div><span>Assessments</span><strong>${report.dataQuality.assessmentCount}</strong></div>
      <div><span>Questions</span><strong>${report.dataQuality.questionCount}</strong></div>
      <div><span>Evidence marks</span><strong>${report.dataQuality.totalEvidenceMarks}</strong></div>
      <div><span>Date range</span><strong>${escapeHtml(report.reportingPeriod.label)}</strong></div>
      <div><span>Missing answers</span><strong>${report.dataQuality.missingResponses}</strong></div>
      <div><span>Overall confidence</span><strong>${escapeHtml(report.dataQuality.overallConfidence)}</strong></div>
    </div>
    <p class="boundary-target">${escapeHtml(report.dataQuality.validationSummary)}</p>`;
}

function profileTable(profile) {
  return `
    <thead><tr><th>Topic</th><th>Mastery</th><th>Challenge-adjusted</th><th>Easy</th><th>Medium</th><th>Hard</th><th>Evidence</th><th>Confidence</th><th>Status</th><th>Insight</th></tr></thead>
    <tbody>${profile.map((item) => `<tr title="${escapeHtml(`${item.insight.explanation} ${item.insight.recommendation} ${item.insight.evidenceNote}`)}"><td><strong>${escapeHtml(item.label)}</strong></td><td>${Math.round(item.mastery)}%</td><td>${Math.round(item.challengeAdjustedScore)}%</td><td>${difficultyCell(item, "Easy")}</td><td>${difficultyCell(item, "Medium")}</td><td>${difficultyCell(item, "Hard")}</td><td>${item.marksAwarded}/${item.marksAvailable} marks<br><span class="muted-line">${plural(item.questionCount, "question")}, ${plural(item.assessmentCount, "assessment")}</span></td><td><span class="confidence-pill ${confidenceClass(item.confidence)}">${escapeHtml(item.confidence)}</span></td><td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.insight.headline)}<br><span class="muted-line">${escapeHtml(item.insight.evidenceNote)}</span></td></tr>`).join("")}</tbody>`;
}

function difficultyCell(item, difficulty) {
  const value = item.difficultyBreakdown[difficulty];
  return value?.accuracy === null ? "—" : `${Math.round(value.accuracy)}%`;
}

function buildStudentReportEvidence(allAssessments, allQuestions, allResponses, options) {
  const selectedAssessments = allAssessments
    .filter((item) => item.studentName === options.studentName && item.subject === options.subject)
    .sort((a, b) => new Date(a.assessmentDate) - new Date(b.assessmentDate));
  const assessmentIds = new Set(selectedAssessments.map((item) => item.assessmentId));
  const selectedQuestions = allQuestions.filter((item) => assessmentIds.has(item.assessmentId));
  const joined = joinQuestionEvidence(selectedAssessments, selectedQuestions, allResponses);
  const validation = validateData(selectedAssessments, selectedQuestions, joined.rawResponses, joined.joined);
  const validResponses = validation.validJoined;
  const topicProfile = buildTopicProfile(validResponses, options.reportDate);
  const profiles = {
    topicProfile,
    challengeAdjustedTopicProfile: topicProfile.map((item) => ({ ...item, mastery: item.challengeAdjustedScore })),
    subtopicProfile: buildProfile(validResponses, "subtopic", options.reportDate),
    questionTypeProfile: buildProfile(validResponses, "questionType", options.reportDate),
    difficultyProfile: buildProfile(validResponses, "difficulty", options.reportDate),
    errorProfile: buildErrorPatterns(validResponses)
  };
  const progress = buildAssessmentProgress(selectedAssessments, validResponses);
  const latest = progress.at(-1) ?? null;
  const overallConfidence = getTopicConfidence({
    assessmentCount: selectedAssessments.length,
    marksAvailable: validResponses.reduce((sum, item) => sum + item.maximumMark, 0),
    questionCount: validResponses.length
  });
  const strengths = profiles.topicProfile
    .filter((item) => item.status === "Strong" || item.status === "Secure" || item.status === "Positive indication")
    .slice(0, 3)
    .map((item) => ({ ...item, type: item.confidence === "Initial evidence" ? "Initial Strength" : "Strength" }));
  const priorities = profiles.topicProfile
    .filter((item) => item.status === "Priority" || item.status === "Possible priority" || item.status === "Developing")
    .slice(0, 3)
    .map((item) => ({ ...item, type: item.confidence === "Initial evidence" ? "Possible Priority" : "Priority" }));

  return {
    student: { id: selectedAssessments[0]?.studentId ?? "", name: options.studentName },
    subject: {
      qualification: selectedAssessments[0]?.qualification ?? "",
      examBoard: selectedAssessments[0]?.examBoard ?? "",
      syllabusCode: selectedAssessments[0]?.syllabusCode ?? "",
      name: options.subject
    },
    reportingPeriod: periodFor(selectedAssessments),
    dataQuality: {
      assessmentCount: selectedAssessments.length,
      questionCount: unique(selectedQuestions.map((item) => item.questionId)).length,
      blueprintRowCount: selectedQuestions.length,
      responseCount: validResponses.length,
      totalEvidenceMarks: validResponses.reduce((sum, item) => sum + item.maximumMark, 0),
      missingResponses: joined.missingResponses,
      unmatchedResponses: validation.unmatchedResponses,
      duplicateResponses: validation.duplicateResponses,
      overallConfidence,
      validationSummary: `${unique(selectedQuestions.map((item) => item.questionId)).length} question IDs across ${selectedQuestions.length} blueprint rows; ${validResponses.length} responses matched; ${validation.unmatchedResponses} unmatched responses; ${validation.duplicateResponses} duplicate responses; ${validation.maximumMarkConfirmed} maximum marks confirmed.`
    },
    latestAssessment: latest,
    overallProgress: {
      assessments: progress,
      latestChange: progress.length >= 2 ? progress.at(-1).percentage - progress.at(-2).percentage : null
    },
    ...profiles,
    errorPatterns: profiles.errorProfile,
    strengths,
    priorities,
    recommendations: buildRecommendations(profiles.errorProfile, priorities),
    gradeEvidence: buildGradeEvidence(selectedAssessments),
    forecastEvidence: buildForecastEvidence(progress),
    difficultyInsight: difficultyInsight(profiles.difficultyProfile)
  };
}

function joinQuestionEvidence(selectedAssessments, selectedQuestions, allResponses) {
  const assessmentMap = new Map(selectedAssessments.map((item) => [item.assessmentId, item]));
  const questionMap = new Map(selectedQuestions.map((item) => [`${item.assessmentId}::${item.questionId}`, item]));
  const selectedStudentIds = new Set(selectedAssessments.map((item) => item.studentId));
  const rawResponses = allResponses.filter((item) => selectedStudentIds.has(item.studentId));
  const responseMap = new Map(rawResponses.map((item) => [`${item.assessmentId}::${item.questionId}`, item]));
  const joined = [];
  let missingResponses = 0;

  for (const question of selectedQuestions) {
    const assessment = assessmentMap.get(question.assessmentId);
    if (!assessment) continue;
    const response = responseMap.get(`${question.assessmentId}::${question.questionId}`);
    const filledResponse = response ?? {
      assessmentId: question.assessmentId,
      studentId: assessment.studentId,
      questionId: question.questionId,
      studentAnswer: "",
      markAwarded: 0,
      maximumMark: question.maximumMark,
      markingMethod: "missing",
      errorCode: "No attempt",
      tutorFeedback: ""
    };
    if (!response) missingResponses += 1;
    joined.push(applyAutomaticMarking({ assessment, question, response: filledResponse }));
  }
  return { joined, rawResponses, missingResponses };
}

function applyAutomaticMarking(item) {
  const { question, response } = item;
  let markAwarded = response.markAwarded === null || response.markAwarded === undefined || response.markAwarded === ""
    ? null
    : Number(response.markAwarded);
  let markingMethod = response.markingMethod || "tutor";
  if ((markAwarded === null || Number.isNaN(markAwarded)) && ["MCQ", "True / False"].includes(question.questionType)) {
    markAwarded = normaliseAnswer(response.studentAnswer) === normaliseAnswer(question.correctAnswer) ? question.maximumMark : 0;
    markingMethod = "automatic";
  }
  if ((markAwarded === null || Number.isNaN(markAwarded)) && question.answerMode === "numeric") {
    markAwarded = markNumericAnswer(question, response.studentAnswer) ? question.maximumMark : 0;
    markingMethod = "automatic";
  }
  if (markAwarded === null || Number.isNaN(markAwarded)) markAwarded = 0;
  const noAttempt = !response.studentAnswer && markAwarded === 0;
  return {
    ...item,
    markAwarded,
    maximumMark: question.maximumMark,
    markingMethod,
    errorCode: response.errorCode || (noAttempt ? "No attempt" : markAwarded === question.maximumMark ? "" : "Knowledge gap"),
    tutorFeedback: response.tutorFeedback || ""
  };
}

function validateData(selectedAssessments, selectedQuestions, rawResponses, joined) {
  const questionKeys = new Set(selectedQuestions.map((item) => `${item.assessmentId}::${item.questionId}`));
  const seen = new Set();
  let duplicateResponses = 0;
  let unmatchedResponses = 0;
  const validJoined = [];
  for (const response of rawResponses) {
    const key = `${response.assessmentId}::${response.questionId}`;
    if (!questionKeys.has(key)) unmatchedResponses += 1;
    const duplicateKey = `${response.studentId}::${key}`;
    if (seen.has(duplicateKey)) duplicateResponses += 1;
    seen.add(duplicateKey);
  }
  const maxByAssessment = new Map();
  for (const question of selectedQuestions) {
    maxByAssessment.set(question.assessmentId, (maxByAssessment.get(question.assessmentId) ?? 0) + question.maximumMark);
  }
  for (const item of joined) {
    if (item.maximumMark <= 0) continue;
    if (item.markAwarded < 0 || item.markAwarded > item.maximumMark) continue;
    if (!item.question.topic || !item.question.difficulty || !item.question.questionType) continue;
    validJoined.push(item);
  }
  const maximumMarkConfirmed = selectedAssessments.reduce((sum, assessment) => {
    return sum + (Number(maxByAssessment.get(assessment.assessmentId)) === Number(assessment.maximumMark) ? assessment.maximumMark : 0);
  }, 0);
  return { duplicateResponses, unmatchedResponses, validJoined, maximumMarkConfirmed };
}

function buildAssessmentProgress(selectedAssessments, joined) {
  return selectedAssessments.map((assessment) => {
    const rows = joined.filter((item) => item.assessment.assessmentId === assessment.assessmentId);
    const markAwarded = sum(rows.map((item) => item.markAwarded));
    const maximumMark = sum(rows.map((item) => item.maximumMark));
    const attemptedQuestions = rows.filter((item) => item.response.studentAnswer || item.markAwarded > 0).length;
    return {
      assessmentId: assessment.assessmentId,
      name: assessment.assessmentName,
      date: assessment.assessmentDate,
      markAwarded,
      maximumMark,
      percentage: maximumMark ? (markAwarded / maximumMark) * 100 : 0,
      attemptedQuestions,
      totalQuestions: rows.length,
      completionRate: rows.length ? (attemptedQuestions / rows.length) * 100 : 0
    };
  });
}

function buildProfile(joined, field, reportDate) {
  const groups = groupBy(joined, (item) => item.question[field] || "Uncategorised");
  return [...groups.entries()].map(([label, rows]) => {
    const weighted = weightedMastery(rows, reportDate);
    const assessmentScores = topicAssessmentScores(rows);
    const trend = calculateTrend(assessmentScores);
    const assessmentCount = unique(rows.map((item) => item.assessment.assessmentId)).length;
    const confidence = confidenceFromCounts(assessmentCount, weighted.marksAvailable);
    const status = statusFromMastery(weighted.mastery, confidence);
    return {
      label,
      mastery: weighted.mastery,
      marksAwarded: round1(sum(rows.map((item) => item.markAwarded))),
      marksAvailable: round1(sum(rows.map((item) => item.maximumMark))),
      questionCount: rows.length,
      assessmentCount,
      firstAssessmentDate: rows.map((item) => item.assessment.assessmentDate).sort()[0],
      latestAssessmentDate: rows.map((item) => item.assessment.assessmentDate).sort().at(-1),
      confidence,
      monthlySlope: trend.monthlySlope,
      trend: trend.label,
      status,
      assessmentScores
    };
  }).sort((a, b) => a.mastery - b.mastery);
}

function buildTopicProfile(joined, reportDate) {
  const groups = groupBy(joined.filter((item) => item.maximumMark > 0), (item) => item.question.topic || "Uncategorised");
  return [...groups.entries()].map(([label, rows]) => {
    const masteryStats = calculateTopicMastery(rows);
    const challengeAdjustedScore = calculateChallengeAdjustedTopicScore(rows);
    const difficultyBreakdown = calculateDifficultyBreakdown(rows);
    const assessmentScores = topicAssessmentScores(rows);
    const trend = calculateTrend(assessmentScores);
    const assessmentCount = unique(rows.map((item) => item.assessment.assessmentId)).length;
    const confidence = getTopicConfidence({
      marksAvailable: masteryStats.marksAvailable,
      questionCount: rows.length,
      assessmentCount
    });
    const status = getTopicStatus(masteryStats.mastery, confidence);
    const errorPatterns = aggregateTopicErrors(rows);
    const longitudinal = weightedMastery(rows, reportDate);
    const stats = {
      label,
      topic: label,
      ...masteryStats,
      rawMastery: masteryStats.mastery,
      longitudinalMastery: longitudinal.mastery,
      challengeAdjustedScore,
      difficultyBreakdown,
      questionCount: rows.length,
      assessmentCount,
      confidence,
      status,
      errorPatterns,
      monthlySlope: trend.monthlySlope,
      trend: trend.label,
      assessmentScores
    };
    return { ...stats, insight: generateTopicInsight(stats) };
  }).filter((item) => item.marksAvailable > 0).sort((a, b) => a.mastery - b.mastery);
}

function calculateQuestionScore(item) {
  if (!item || item.maximumMark <= 0 || item.markAwarded < 0 || item.markAwarded > item.maximumMark) return null;
  return item.markAwarded / item.maximumMark;
}

function calculateTopicMastery(rows) {
  const validRows = rows.filter((item) => calculateQuestionScore(item) !== null);
  const marksAwarded = round1(sum(validRows.map((item) => item.markAwarded)));
  const marksAvailable = round1(sum(validRows.map((item) => item.maximumMark)));
  return {
    mastery: marksAvailable ? (marksAwarded / marksAvailable) * 100 : null,
    marksAwarded,
    marksAvailable
  };
}

function calculateChallengeAdjustedTopicScore(rows) {
  let earned = 0;
  let available = 0;
  for (const item of rows) {
    const normalisedScore = calculateQuestionScore(item);
    if (normalisedScore === null) continue;
    const weight = DIFFICULTY_WEIGHTS[normaliseDifficulty(item.question.difficulty)] ?? 1;
    earned += normalisedScore * item.maximumMark * weight;
    available += item.maximumMark * weight;
  }
  return available ? (earned / available) * 100 : null;
}

function calculateDifficultyBreakdown(rows) {
  return Object.fromEntries(DIFFICULTIES.map((difficulty) => {
    const difficultyRows = rows.filter((item) => normaliseDifficulty(item.question.difficulty) === difficulty);
    const marksAwarded = round1(sum(difficultyRows.map((item) => item.markAwarded)));
    const marksAvailable = round1(sum(difficultyRows.map((item) => item.maximumMark)));
    return [difficulty, {
      accuracy: marksAvailable ? (marksAwarded / marksAvailable) * 100 : null,
      marksAwarded,
      marksAvailable,
      questionCount: difficultyRows.length,
      assessmentCount: unique(difficultyRows.map((item) => item.assessment.assessmentId)).length
    }];
  }));
}

function getTopicConfidence({ marksAvailable, questionCount, assessmentCount }) {
  if (assessmentCount < 2 || marksAvailable < 6 || questionCount < 4) return "Initial evidence";
  if (assessmentCount < 4 || marksAvailable < 16 || questionCount < 8) return "Emerging evidence";
  if (assessmentCount >= 6 && marksAvailable >= 30 && questionCount >= 15) return "Strong evidence";
  return "Reliable evidence";
}

function getTopicStatus(mastery, confidence) {
  if (confidence === "Initial evidence") {
    if (mastery >= 80) return "Positive indication";
    if (mastery >= 60) return "Generally secure in this test";
    if (mastery >= 40) return "Developing";
    return "Possible priority";
  }
  if (mastery >= 80) return "Strong";
  if (mastery >= 65) return "Secure";
  if (mastery >= 50) return "Developing";
  return "Priority";
}

function aggregateTopicErrors(rows) {
  const lostRows = rows.filter((item) => item.maximumMark - item.markAwarded > 0 && item.errorCode);
  return [...groupBy(lostRows, (item) => item.errorCode).entries()].map(([errorCode, items]) => ({
    errorCode,
    lostMarks: round1(sum(items.map((item) => item.maximumMark - item.markAwarded))),
    questionCount: items.length
  })).sort((a, b) => b.lostMarks - a.lostMarks);
}

function generateTopicInsight(topicStats) {
  const easy = topicStats.difficultyBreakdown.Easy;
  const medium = topicStats.difficultyBreakdown.Medium;
  const hardRows = ["Hard", "Exam-style", "Challenge"].map((key) => topicStats.difficultyBreakdown[key]);
  const hard = combineDifficultyStats(hardRows);
  const easyAccuracy = easy.marksAvailable > 0 ? easy.accuracy : null;
  const mediumAccuracy = medium.marksAvailable > 0 ? medium.accuracy : null;
  const hardAccuracy = hard.marksAvailable > 0 ? hard.accuracy : null;
  const initialNote = topicStats.confidence === "Initial evidence"
    ? "This is an initial pattern and should be checked in future assessments."
    : "This pattern is supported by evidence across multiple assessments.";
  let headline = "Mixed performance";
  let explanation = "The available questions show a mixed pattern across difficulty levels. More evidence is needed to determine whether the main issue is topic knowledge, application or answer technique.";
  let recommendation = "Include this topic again in the next assessment using a balanced mix of routine, application and explanation questions.";

  if (easyAccuracy !== null && hardAccuracy !== null && easyAccuracy >= 70 && easyAccuracy - hardAccuracy >= 25) {
    headline = "Basic knowledge is stronger than higher-level application";
    explanation = "The student performed relatively well on routine questions in this topic, but accuracy fell when the questions required deeper application, multi-step reasoning or fuller scientific explanation.";
    recommendation = "Use scaffolded exam-style questions that gradually remove prompts and require the student to explain each step.";
  } else if (easyAccuracy !== null && mediumAccuracy !== null && easyAccuracy < 50 && mediumAccuracy < 50) {
    headline = "Core concepts may require reteaching";
    explanation = "Performance was weak in both routine and moderately demanding questions, suggesting that the issue may involve core topic understanding rather than exam technique alone.";
    recommendation = "Review the underlying concepts using worked examples, retrieval practice and short guided questions before returning to full exam-style tasks.";
  } else if (topicStats.mastery >= 40 && topicStats.mastery < 65 && hardAccuracy !== null && hardAccuracy < 50) {
    headline = "Partial understanding is present";
    explanation = "The student demonstrated some correct knowledge, but did not apply it consistently in more demanding questions.";
    recommendation = "Focus on connecting basic definitions to calculations, explanations and unfamiliar contexts.";
  } else if (hardAccuracy !== null && easyAccuracy !== null && hardAccuracy >= easyAccuracy + 15) {
    headline = "Understanding may be stronger than routine accuracy";
    explanation = "The student performed comparatively well on the harder question but lost marks in more routine work. This may indicate inconsistency, question misreading or avoidable errors rather than a simple topic knowledge gap.";
    recommendation = "Introduce a short checking routine covering command words, units, signs and final-answer accuracy.";
  } else if (topicStats.mastery >= 80 && (hardAccuracy === null || hardAccuracy >= 65)) {
    headline = topicStats.confidence === "Initial evidence" ? "Positive initial indication" : "Consistent topic strength";
    explanation = "The student performed consistently well across the available questions in this topic.";
    recommendation = "Keep this topic active through spaced review and include harder application questions in future checks.";
  }

  const mainError = topicStats.errorPatterns[0];
  if (mainError) recommendation += ` ${errorPatternSentence(mainError.errorCode)}`;
  return { headline, explanation, recommendation, evidenceNote: initialNote };
}

function combineDifficultyStats(items) {
  const marksAwarded = sum(items.map((item) => item.marksAwarded));
  const marksAvailable = sum(items.map((item) => item.marksAvailable));
  const questionCount = sum(items.map((item) => item.questionCount));
  const assessmentCount = Math.max(...items.map((item) => item.assessmentCount), 0);
  return {
    accuracy: marksAvailable ? (marksAwarded / marksAvailable) * 100 : null,
    marksAwarded,
    marksAvailable,
    questionCount,
    assessmentCount
  };
}

function errorPatternSentence(errorCode) {
  return {
    "Incomplete explanation": "The main mark-loss pattern was incomplete explanation. Practise two-mark questions by requiring two clearly linked scientific points.",
    "Calculation method": "Most lost marks came from calculation method. Use structured steps: formula, substitution, working and final answer with unit.",
    "Knowledge gap": "The pattern suggests missing content knowledge. Revisit the core concept before further timed practice.",
    "Command word": "Practise distinguishing between state, describe, explain and calculate.",
    "No attempt": "The student left some questions unanswered. Completion and time management should be monitored in the next assessment."
  }[errorCode] ?? "";
}

function weightedMastery(rows, reportDate) {
  const weightedNumerator = sum(rows.map((item) => {
    const ageDays = daysBetween(new Date(item.assessment.assessmentDate), reportDate);
    const recencyWeight = Math.pow(0.5, ageDays / 180);
    return (item.markAwarded / item.maximumMark) * item.maximumMark * recencyWeight;
  }));
  const weightedDenominator = sum(rows.map((item) => {
    const ageDays = daysBetween(new Date(item.assessment.assessmentDate), reportDate);
    return item.maximumMark * Math.pow(0.5, ageDays / 180);
  }));
  return {
    mastery: weightedDenominator ? (weightedNumerator / weightedDenominator) * 100 : 0,
    marksAvailable: sum(rows.map((item) => item.maximumMark))
  };
}

function topicAssessmentScores(rows) {
  const groups = groupBy(rows, (item) => item.assessment.assessmentId);
  return [...groups.entries()].map(([assessmentId, assessmentRows]) => {
    const markAwarded = sum(assessmentRows.map((item) => item.markAwarded));
    const maximumMark = sum(assessmentRows.map((item) => item.maximumMark));
    return {
      assessmentId,
      date: assessmentRows[0].assessment.assessmentDate,
      percentage: maximumMark ? (markAwarded / maximumMark) * 100 : 0
    };
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function calculateTrend(points) {
  if (points.length < 3) return { label: "Not enough history", monthlySlope: null };
  const firstDate = new Date(points[0].date);
  const xs = points.map((item) => daysBetween(firstDate, new Date(item.date)));
  const ys = points.map((item) => item.percentage);
  const xMean = average(xs);
  const yMean = average(ys);
  const denominator = sum(xs.map((x) => (x - xMean) ** 2));
  const slope = denominator ? sum(xs.map((x, index) => (x - xMean) * (ys[index] - yMean))) / denominator : 0;
  const monthlySlope = slope * 30;
  if (monthlySlope >= 3) return { label: "Improving", monthlySlope };
  if (monthlySlope <= -3) return { label: "Declining", monthlySlope };
  return { label: "Stable", monthlySlope };
}

function confidenceFromCounts(assessmentCount, marksAvailable) {
  return getTopicConfidence({ assessmentCount, marksAvailable, questionCount: Math.max(1, Math.round(marksAvailable)) });
}

function statusFromMastery(mastery, confidence) {
  return getTopicStatus(mastery, confidence);
}

function buildErrorPatterns(joined) {
  const lostRows = joined.filter((item) => item.maximumMark - item.markAwarded > 0 && item.errorCode);
  const groups = groupBy(lostRows, (item) => item.errorCode);
  return [...groups.entries()].map(([errorCode, rows]) => ({
    errorCode,
    lostMarks: round1(sum(rows.map((item) => item.maximumMark - item.markAwarded))),
    recommendation: recommendationForError(errorCode)
  })).sort((a, b) => b.lostMarks - a.lostMarks).slice(0, 5);
}

function buildGradeEvidence(selectedAssessments) {
  if (selectedAssessments.length === 1) return { available: false, message: "Baseline established" };
  if (selectedAssessments.length < 3) return { available: false, message: "Diagnostic performance only — no reliable grade estimate yet." };
  const compatible = selectedAssessments.every((item) => item.examBoard === selectedAssessments[0].examBoard && item.syllabusCode === selectedAssessments[0].syllabusCode);
  if (!compatible || selectedAssessments[0].examBoard !== "Edexcel") {
    return { available: false, message: "Diagnostic performance only — no reliable grade estimate yet." };
  }
  return { available: false, message: "Diagnostic performance only — no reliable grade estimate yet." };
}

function buildForecastEvidence(progress) {
  if (progress.length < 4) return { available: false, message: "Internal learning projection unavailable until at least four comparable assessments are available." };
  const comparable = progress.every((item) => item.maximumMark === progress[0].maximumMark);
  if (!comparable) return { available: false, message: "Internal learning projection unavailable because assessments are not directly comparable." };
  const trend = calculateTrend(progress.map((item) => ({ date: item.date, percentage: item.percentage })));
  const nextPercentage = clamp(progress.at(-1).percentage + (trend.monthlySlope ?? 0), 0, 100);
  const residualSd = forecastResidualSd(progress);
  return {
    available: true,
    nextPercentage,
    lowerPercentage: clamp(nextPercentage - residualSd, 0, 100),
    upperPercentage: clamp(nextPercentage + residualSd, 0, 100),
    residualSd,
    message: `Internal learning projection with an indicative +/-${Math.round(residualSd)} point range — not an examination prediction.`
  };
}

function forecastResidualSd(progress) {
  const firstDate = new Date(progress[0].date);
  const xs = progress.map((item) => daysBetween(firstDate, new Date(item.date)));
  const ys = progress.map((item) => item.percentage);
  const xMean = average(xs);
  const yMean = average(ys);
  const denominator = sum(xs.map((x) => (x - xMean) ** 2));
  const slope = denominator ? sum(xs.map((x, index) => (x - xMean) * (ys[index] - yMean))) / denominator : 0;
  const intercept = yMean - slope * xMean;
  const residuals = ys.map((y, index) => y - (intercept + slope * xs[index]));
  return clamp(standardDeviation(residuals), 3, 12);
}

function difficultyInsight(profile) {
  const easy = profile.find((item) => item.label === "Easy");
  const hard = profile.find((item) => item.label === "Hard" || item.label === "Exam-style" || item.label === "Challenge");
  if (easy && hard && easy.mastery - hard.mastery >= 20 && hard.confidence !== "Insufficient evidence") {
    return "The student is secure with routine knowledge but loses marks when questions require multi-step application or explanation.";
  }
  return "Continue separating routine performance from harder exam-style responses as more evidence is collected.";
}

function generateParentReport(report) {
  const latest = report.latestAssessment;
  const strongest = report.strengths[0];
  const priority = report.priorities[0];
  const error = report.errorPatterns[0];
  const isBaseline = report.dataQuality.assessmentCount === 1;
  const topicParagraph = topicReportParagraph(report, priority, strongest);
  const progressText = report.overallProgress.assessments.length >= 3
    ? `Topic trends are calculated only where at least three assessment-level topic results exist.`
    : "This is a baseline diagnostic profile. It does not support long-term improving or declining claims yet.";

  return `${report.student.name} - ${report.subject.name} Parent Report

Current Performance
The latest assessment score was ${latest ? `${latest.markAwarded}/${latest.maximumMark}, or ${Math.round(latest.percentage)}%` : "not available"}. ${isBaseline ? "Baseline established." : "This remains diagnostic performance unless compatible boundary data and enough comparable full assessments are available."}

Evidence Coverage
Across ${report.dataQuality.assessmentCount} assessments, ${report.dataQuality.responseCount} question-level responses provide ${report.dataQuality.totalEvidenceMarks} marks of evidence. Overall confidence is ${report.dataQuality.overallConfidence}. ${legacyRows.length ? "Some uploaded information is summary-only legacy evidence and should be interpreted cautiously." : ""}

Progress Over Time
${progressText} ${report.forecastEvidence.message}

Topic Diagnostic Profile
${topicParagraph}

Confirmed Strengths
${strongest ? `${strongest.label} is currently ${isBaseline ? "a positive initial indication" : "the strongest supported area"} at ${Math.round(strongest.mastery)}%, based on ${strongest.marksAwarded}/${strongest.marksAvailable} marks across ${strongest.assessmentCount} assessments.` : "No confirmed strength is labelled yet because more evidence is required."}

Learning Priorities
${priority ? `${priority.label} is ${isBaseline ? "a possible priority from this assessment" : "a priority/developing area"} at ${Math.round(priority.mastery)}%, based on ${priority.marksAwarded}/${priority.marksAvailable} marks across ${priority.assessmentCount} assessments.` : "No confirmed priority is labelled yet. Possible review areas should be treated as provisional until more evidence is available."}

Question-Type and Difficulty Performance
${report.difficultyInsight}

Main Mark-Loss Patterns
${error ? `${error.errorCode} accounts for ${error.lostMarks} lost marks. Recommended next step: ${error.recommendation}` : "No repeated error pattern has enough evidence yet."}

Recommended Next Steps
${report.recommendations.join(" ") || "Continue collecting marked question-level evidence and review mistakes after each assessment."}

Data-Confidence Disclaimer
Low-evidence topics are labelled cautiously. The report does not infer motivation, intelligence, unsupported percentiles, or long-term progress from a single assessment.`;
}

function topicReportParagraph(report, priority, strongest) {
  if (report.dataQuality.assessmentCount === 1) {
    const topic = priority ?? strongest ?? report.topicProfile[0];
    if (!topic) return "The topic radar will become available once marked question-level evidence is uploaded.";
    return `The topic radar provides an initial diagnostic profile based on the student's first assessment. ${topic.label} is currently ${topic.status.toLowerCase()}: ${topic.insight.explanation} As the topic was assessed using ${topic.marksAvailable} marks, this conclusion should be checked in future assessments.`;
  }
  const strength = strongest ? `${strongest.label} is supported at ${Math.round(strongest.mastery)}% from ${strongest.marksAvailable} available marks.` : "No reliable strength has enough evidence yet.";
  const priorityText = priority ? `${priority.label} remains ${priority.status.toLowerCase()} at ${Math.round(priority.mastery)}%. ${priority.insight.headline}.` : "No reliable priority has enough evidence yet.";
  return `${strength} ${priorityText}`;
}

function buildRecommendations(errors, priorities) {
  return [
    ...errors.slice(0, 2).map((item) => item.recommendation),
    ...priorities.slice(0, 2).map((item) => `Practise ${item.label} using short targeted questions and correction of marking-scheme language.`)
  ];
}

function recommendationForError(errorCode) {
  return {
    "Knowledge gap": "Use retrieval practice and targeted content review.",
    "Calculation method": "Use worked examples and step-by-step practice.",
    "Unit error": "Require units on every calculation.",
    "Command word": "Practise state, describe, explain and calculate command words.",
    "Incomplete explanation": "Use two linked scientific points in explanation questions.",
    "Practical method": "Practise variables, controls, observations and improvements.",
    "Careless error": "Use an end-of-paper checking routine.",
    "Data interpretation": "Practise reading tables, graphs and anomalous results."
  }[errorCode] ?? "Review the marked response and practise similar question formats.";
}

function createChemistrySample(assessmentCount = 1) {
  const topics = [
    ["A1", "A", "1", 1, "B", "States of matter", "Gas particle arrangement and movement", "Easy", "MCQ"],
    ["A2", "A", "2", 1, "B", "Electrochemistry", "Electrolysis products", "Easy", "MCQ"],
    ["A3", "A", "3", 1, "C", "Acids, bases and salts", "Indicators and neutralisation", "Easy", "MCQ"],
    ["A4", "A", "4", 1, "C", "Chemistry of the environment", "Air and water", "Easy", "MCQ"],
    ["A5", "A", "5", 1, "B", "Atoms, elements and compounds", "Atomic structure", "Medium", "MCQ"],
    ["A6", "A", "6", 1, "C", "Chemical energetics", "Energy changes", "Medium", "MCQ"],
    ["A7", "A", "7", 1, "B", "The Periodic Table", "Group trends", "Medium", "MCQ"],
    ["A8", "A", "8", 1, "B", "Organic chemistry", "Homologous series", "Medium", "MCQ"],
    ["A9", "A", "9", 1, "B", "Stoichiometry", "Moles and reacting masses", "Hard", "MCQ"],
    ["A10", "A", "10", 1, "B", "Chemical reactions", "Rates and reversible reactions", "Hard", "MCQ"],
    ["A11", "A", "11", 1, "C", "Metals", "Extraction and reactivity", "Hard", "MCQ"],
    ["A12", "A", "12", 1, "B", "Experimental techniques", "Separation and purification", "Hard", "MCQ"],
    ["B1", "B", "1", 1, "True", "Stoichiometry", "Empirical formula", "Easy", "True / False"],
    ["B2", "B", "2", 1, "False", "Chemical reactions", "Collision theory", "Easy", "True / False"],
    ["B3", "B", "3", 1, "True", "Metals", "Metal reactions", "Easy", "True / False"],
    ["B4", "B", "4", 1, "False", "Experimental techniques", "Chromatography", "Easy", "True / False"],
    ["B5", "B", "5", 1, "True", "States of matter", "Diffusion", "Medium", "True / False"],
    ["B6", "B", "6", 1, "True", "Electrochemistry", "Ionic conduction", "Medium", "True / False"],
    ["B7", "B", "7", 1, "False", "Acids, bases and salts", "Salt preparation", "Medium", "True / False"],
    ["B8", "B", "8", 1, "True", "Chemistry of the environment", "Pollutants", "Medium", "True / False"],
    ["B9", "B", "9", 1, "True", "Atoms, elements and compounds", "Isotopes", "Hard", "True / False"],
    ["B10", "B", "10", 1, "True", "Chemical energetics", "Bond energy", "Hard", "True / False"],
    ["B11", "B", "11", 1, "True", "The Periodic Table", "Transition metals", "Hard", "True / False"],
    ["B12", "B", "12", 1, "True", "Organic chemistry", "Addition reactions", "Hard", "True / False"]
  ];
  const sectionC = [
    ["C1", "Atoms, elements and compounds", "Electronic structure", "Easy"],
    ["C2", "Chemical energetics", "Exothermic and endothermic", "Easy"],
    ["C3", "The Periodic Table", "Group I and VII", "Easy"],
    ["C4", "Organic chemistry", "Alkanes and alkenes", "Easy"],
    ["C5", "Stoichiometry", "Mole calculations", "Medium"],
    ["C6", "Chemical reactions", "Reaction rate explanations", "Medium"],
    ["C7", "Metals", "Extraction", "Medium"],
    ["C8", "Experimental techniques", "Purity and separation", "Medium"],
    ["C9", "States of matter", "Particle explanations", "Hard"],
    ["C10", "Electrochemistry", "Electrolysis explanation", "Hard"],
    ["C11", "Acids, bases and salts", "Salt preparation method", "Hard"],
    ["C12", "Chemistry of the environment", "Greenhouse gases", "Hard"]
  ].map(([id, topic, subtopic, difficulty], index) => [id, "C", String(index + 1), 2, "", topic, subtopic, difficulty, "Short explanation"]);
  const questionRows = [...topics, ...sectionC];
  const dates = ["2026-07-15", "2026-08-15", "2026-09-15", "2026-10-15"];
  const assessmentList = dates.slice(0, assessmentCount).map((date, index) => ({
    assessmentId: `CHEM-TRIAL-00${index + 1}`,
    studentId: "STU-001",
    studentName: "Amelia Chan",
    qualification: "IGCSE",
    examBoard: "Cambridge",
    syllabusCode: "0620",
    subject: "Chemistry",
    assessmentName: `Chemistry Trial Test ${index + 1}`,
    assessmentDate: date,
    assessmentType: index === 0 ? "Baseline diagnostic" : "Progress check",
    maximumMark: 48,
    durationMinutes: 30
  }));
  const questionList = assessmentList.flatMap((assessment) => questionRows.map((row) => makeQuestion(assessment.assessmentId, row)));
  const responseList = assessmentList.flatMap((assessment, assessmentIndex) => questionRows.map((row, questionIndex) => makeResponse(assessment, row, assessmentIndex, questionIndex)));
  return { assessments: assessmentList, questions: questionList, responses: responseList };
}

function makeQuestion(assessmentId, [questionId, section, questionNumber, maximumMark, correctAnswer, topic, subtopic, difficulty, questionType]) {
  return {
    assessmentId,
    questionId,
    section,
    questionNumber,
    maximumMark,
    correctAnswer,
    topic,
    subtopic,
    difficulty,
    questionType,
    assessmentObjective: "",
    answerMode: ["MCQ", "True / False"].includes(questionType) ? "exact" : "tutor-marked",
    numericalTolerance: null,
    requiredUnit: "",
    coreOrSupplement: "Both"
  };
}

function makeResponse(assessment, row, assessmentIndex, questionIndex) {
  const question = makeQuestion(assessment.assessmentId, row);
  const topicPenalty = ["Stoichiometry", "Experimental techniques", "Acids, bases and salts"].includes(question.topic) ? 1 : 0;
  const improvement = assessmentIndex * 0.28;
  const base = question.maximumMark === 1
    ? (questionIndex % 5 === 0 && assessmentIndex < 2 ? 0 : 1)
    : Math.max(0, Math.min(2, Math.round(1 + improvement - topicPenalty * 0.35 + ((questionIndex + assessmentIndex) % 3 === 0 ? -0.5 : 0.3))));
  const markAwarded = question.questionType === "Short explanation" ? base : (base > 0 ? 1 : 0);
  const errorCode = markAwarded === question.maximumMark ? "" : ["Incomplete explanation", "Knowledge gap", "Unit error", "Calculation method"][questionIndex % 4];
  return {
    assessmentId: assessment.assessmentId,
    studentId: assessment.studentId,
    questionId: question.questionId,
    studentAnswer: markAwarded === question.maximumMark ? (question.correctAnswer || "Tutor marked response") : "Partial / incorrect",
    markAwarded,
    maximumMark: question.maximumMark,
    markingMethod: question.questionType === "Short explanation" ? "tutor" : "automatic",
    errorCode,
    tutorFeedback: errorCode ? recommendationForError(errorCode) : ""
  };
}

function normaliseAssessment(row) {
  const assessmentId = text(row.assessmentId ?? row.AssessmentId ?? row["Assessment ID"]);
  if (!assessmentId) return null;
  return {
    assessmentId,
    studentId: text(row.studentId ?? row.StudentId ?? row["Student ID"]) || text(row.studentName ?? row.Student),
    studentName: text(row.studentName ?? row.StudentName ?? row.student ?? row.Student),
    qualification: text(row.qualification ?? row.Qualification) || "IGCSE",
    examBoard: text(row.examBoard ?? row.ExamBoard ?? row["Exam Board"]),
    syllabusCode: text(row.syllabusCode ?? row.SyllabusCode ?? row["Syllabus Code"]),
    subject: text(row.subject ?? row.Subject),
    assessmentName: text(row.assessmentName ?? row.AssessmentName ?? row["Assessment Name"]) || assessmentId,
    assessmentDate: toIsoDate(row.assessmentDate ?? row.AssessmentDate ?? row.date ?? row.Date),
    assessmentType: text(row.assessmentType ?? row.AssessmentType ?? row["Assessment Type"]),
    maximumMark: number(row.maximumMark ?? row.MaximumMark ?? row.maxScore ?? row["Maximum Mark"]),
    durationMinutes: number(row.durationMinutes ?? row.DurationMinutes ?? row["Duration Minutes"])
  };
}

function normaliseQuestion(row) {
  const assessmentId = text(row.assessmentId ?? row.AssessmentId ?? row["Assessment ID"]);
  const questionId = text(row.questionId ?? row.QuestionId ?? row["Question ID"]);
  if (!assessmentId || !questionId) return null;
  return {
    assessmentId,
    questionId,
    section: text(row.section ?? row.Section),
    questionNumber: text(row.questionNumber ?? row.QuestionNumber ?? row["Question Number"]),
    maximumMark: number(row.maximumMark ?? row.MaximumMark ?? row["Maximum Mark"]) || 1,
    correctAnswer: text(row.correctAnswer ?? row.CorrectAnswer ?? row["Correct Answer"]),
    topic: text(row.topic ?? row.Topic),
    subtopic: text(row.subtopic ?? row.Subtopic),
    difficulty: normaliseDifficulty(text(row.difficulty ?? row.Difficulty)),
    questionType: normaliseQuestionType(text(row.questionType ?? row.QuestionType ?? row["Question Type"])),
    assessmentObjective: text(row.assessmentObjective ?? row.AssessmentObjective ?? row["Assessment Objective"]),
    answerMode: text(row.answerMode ?? row.AnswerMode ?? row["Answer Mode"]) || "tutor-marked",
    numericalTolerance: number(row.numericalTolerance ?? row.NumericalTolerance ?? row["Numerical Tolerance"]),
    requiredUnit: text(row.requiredUnit ?? row.RequiredUnit ?? row["Required Unit"]),
    coreOrSupplement: text(row.coreOrSupplement ?? row.CoreOrSupplement ?? row["Core Or Supplement"]) || "Both"
  };
}

function normaliseResponse(row) {
  const assessmentId = text(row.assessmentId ?? row.AssessmentId ?? row["Assessment ID"]);
  const questionId = text(row.questionId ?? row.QuestionId ?? row["Question ID"]);
  if (!assessmentId || !questionId) return null;
  return {
    assessmentId,
    studentId: text(row.studentId ?? row.StudentId ?? row["Student ID"]),
    questionId,
    studentAnswer: text(row.studentAnswer ?? row.StudentAnswer ?? row["Student Answer"]),
    markAwarded: number(row.markAwarded ?? row.MarkAwarded ?? row["Mark Awarded"]),
    maximumMark: number(row.maximumMark ?? row.MaximumMark ?? row["Maximum Mark"]),
    markingMethod: text(row.markingMethod ?? row.MarkingMethod ?? row["Marking Method"]),
    errorCode: normaliseErrorCode(text(row.errorCode ?? row.ErrorCode ?? row["Error Code"])),
    tutorFeedback: text(row.tutorFeedback ?? row.TutorFeedback ?? row["Tutor Feedback"])
  };
}

function detectLegacyRows(rows) {
  return rows.filter((row) => row.score !== undefined || row.Score !== undefined || row.maxScore !== undefined || row.MaxScore !== undefined);
}

function convertLegacyRows(rows) {
  const assessmentsOut = [];
  const questionsOut = [];
  const responsesOut = [];
  rows.forEach((row, index) => {
    const assessmentId = text(row.assessmentId ?? row.assessment ?? row.exam ?? row.Exam) || `LEGACY-${index + 1}`;
    const studentName = text(row.student ?? row.Student ?? row.name) || "Legacy Student";
    const max = number(row.maxScore ?? row.MaxScore ?? row.total ?? row.Total) || 100;
    const score = number(row.score ?? row.Score ?? row.marks ?? row.Marks) || 0;
    assessmentsOut.push({
      assessmentId,
      studentId: studentName,
      studentName,
      qualification: text(row.qualification ?? row.Qualification) || "IGCSE",
      examBoard: "Legacy",
      syllabusCode: "",
      subject: text(row.subject ?? row.Subject) || "Subject",
      assessmentName: text(row.exam ?? row.Exam) || assessmentId,
      assessmentDate: toIsoDate(row.date ?? row.Date),
      assessmentType: "Summary-only legacy evidence",
      maximumMark: max,
      durationMinutes: null
    });
    questionsOut.push({
      assessmentId,
      questionId: "SUMMARY",
      section: "Legacy",
      questionNumber: "summary",
      maximumMark: max,
      correctAnswer: "",
      topic: text(row.skill ?? row.Skill ?? row.topic ?? row.Topic) || "Summary-only evidence",
      subtopic: text(row.subtopic ?? row.Subtopic) || "",
      difficulty: text(row.difficulty ?? row.Difficulty) || "Medium",
      questionType: normaliseQuestionType(text(row.questionType ?? row.QuestionType)) || "Problem solving",
      assessmentObjective: "",
      answerMode: "legacy-summary",
      numericalTolerance: null,
      requiredUnit: "",
      coreOrSupplement: "Both"
    });
    responsesOut.push({
      assessmentId,
      studentId: studentName,
      questionId: "SUMMARY",
      studentAnswer: "Legacy summary score",
      markAwarded: score,
      maximumMark: max,
      markingMethod: "legacy-summary",
      errorCode: "",
      tutorFeedback: "Summary-only evidence"
    });
  });
  return { assessments: assessmentsOut, questions: questionsOut, responses: responsesOut };
}

function markNumericAnswer(question, studentAnswer) {
  const student = parseNumberAndUnit(studentAnswer);
  const correct = parseNumberAndUnit(question.correctAnswer);
  if (student.value === null || correct.value === null) return false;
  const tolerance = question.numericalTolerance ?? 0;
  const valueOk = Math.abs(student.value - correct.value) <= tolerance;
  const unitOk = !question.requiredUnit || normaliseAnswer(student.unit) === normaliseAnswer(question.requiredUnit);
  return valueOk && unitOk;
}

function normaliseAnswer(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseNumberAndUnit(value) {
  const match = String(value ?? "").trim().match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  return { value: match ? Number(match[1]) : null, unit: match ? match[2].trim() : "" };
}

function normaliseQuestionType(value) {
  const matched = QUESTION_TYPES.find((item) => item.toLowerCase() === value.toLowerCase());
  return matched || value || "Problem solving";
}

function normaliseDifficulty(value) {
  const source = String(value || "Medium").trim().toLowerCase().replace(/[-_]/g, " ");
  if (["easy", "e"].includes(source)) return "Easy";
  if (["medium", "med", "m"].includes(source)) return "Medium";
  if (["hard", "difficult", "h"].includes(source)) return "Hard";
  if (["exam style", "examstyle", "exam", "exam styled"].includes(source)) return "Exam-style";
  if (["challenge", "challenging", "extension"].includes(source)) return "Challenge";
  const matched = DIFFICULTIES.find((item) => item.toLowerCase() === source);
  return matched || "Medium";
}

function normaliseErrorCode(value) {
  const matched = ERROR_CODES.find((item) => item.toLowerCase() === value.toLowerCase());
  return matched ?? value;
}

function downloadTemplates() {
  const files = [
    ["assessment-template.csv", "assessmentId,studentId,studentName,qualification,examBoard,syllabusCode,subject,assessmentName,assessmentDate,assessmentType,maximumMark,durationMinutes\nCHEM-TRIAL-001,STU-001,Amelia Chan,IGCSE,Cambridge,0620,Chemistry,Chemistry Trial Test 1,2026-07-15,Baseline diagnostic,48,30"],
    ["question-blueprint-template.csv", "assessmentId,questionId,section,questionNumber,maximumMark,correctAnswer,topic,subtopic,difficulty,questionType,assessmentObjective,answerMode,numericalTolerance,requiredUnit,coreOrSupplement\nCHEM-TRIAL-001,A1,A,1,1,B,States of matter,Gas particle arrangement and movement,Easy,MCQ,,exact,,,Both"],
    ["student-responses-template.csv", "assessmentId,studentId,questionId,studentAnswer,markAwarded,maximumMark,markingMethod,errorCode,tutorFeedback\nCHEM-TRIAL-001,STU-001,A1,B,1,1,automatic,,"]
  ];
  files.forEach(([filename, content]) => downloadFile(filename, content, "text/csv"));
}

function exportReport() {
  downloadFile(`${evidence?.student.name ?? "student"}-${evidence?.subject.name ?? "subject"}-parent-report.txt`.replace(/\s+/g, "-"), elements.reportText.value, "text/plain");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function chartOptions({ y, x }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: y.min,
        max: y.max,
        title: { display: Boolean(y.title), text: y.title, color: "#17202a", font: { weight: 700 } },
        ticks: { color: "#667085" },
        grid: { color: "#e4e9f1" }
      },
      x: {
        title: { display: Boolean(x.title), text: x.title, color: "#17202a", font: { weight: 700 } },
        ticks: { color: "#667085", maxRotation: 0 },
        grid: { display: false }
      }
    },
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, usePointStyle: true, color: "#17202a" } }
    }
  };
}

function radarChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { stepSize: 20, backdropColor: "transparent" },
        grid: { color: "#d8dee8" },
        pointLabels: { color: "#17202a", font: { weight: 700 } }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context) {
            const item = context.chart.data.topicProfile?.[context.dataIndex];
            if (!item) return `${context.dataset.label}: ${context.formattedValue}%`;
            return [
              `${item.label}`,
              `Mastery: ${Math.round(item.rawMastery ?? item.mastery)}%`,
              `Challenge-adjusted: ${Math.round(item.challengeAdjustedScore ?? item.mastery)}%`,
              `Evidence: ${item.marksAwarded}/${item.marksAvailable} marks`,
              `Questions: ${item.questionCount}`,
              `Assessments: ${item.assessmentCount}`,
              `Confidence: ${item.confidence}`
            ];
          }
        }
      }
    }
  };
}

function periodFor(items) {
  if (!items.length) return { start: "", end: "", label: "No data" };
  const dates = items.map((item) => item.assessmentDate).sort();
  return { start: dates[0], end: dates.at(-1), label: `${shortDate(dates[0])} - ${shortDate(dates.at(-1))}` };
}

function statusClass(status) {
  return {
    Strong: "status-strong",
    Secure: "status-good",
    "Positive indication": "status-good",
    "Generally secure in this test": "status-good",
    Developing: "status-watch",
    Priority: "status-priority",
    "Possible priority": "status-priority",
    Monitor: "status-watch"
  }[status] ?? "status-watch";
}

function confidenceClass(confidence) {
  return confidence.includes("Reliable") || confidence.includes("Strong") ? "confidence-reliable" : confidence.includes("Emerging") ? "confidence-building" : "confidence-limited";
}

function heatClass(value) {
  if (value >= 80) return "heat-strong";
  if (value >= 65) return "heat-good";
  if (value >= 50) return "heat-watch";
  return "heat-priority";
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function optionMarkup(value) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
}

function text(value) {
  return String(value ?? "").trim();
}

function number(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

function shortDate(date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(date));
}

function daysBetween(start, end) {
  return Math.max(0, (end - start) / 86400000);
}

function average(values) {
  return values.length ? sum(values) / values.length : 0;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = sum(values.map((value) => (value - mean) ** 2)) / (values.length - 1);
  return Math.sqrt(variance);
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const ReportCore = {
  normaliseAnswer,
  markNumericAnswer,
  normaliseDifficulty,
  calculateQuestionScore,
  calculateTopicMastery,
  calculateChallengeAdjustedTopicScore,
  calculateDifficultyBreakdown,
  getTopicConfidence,
  getTopicStatus,
  aggregateTopicErrors,
  generateTopicInsight,
  buildTopicProfile,
  applyAutomaticMarking,
  buildStudentReportEvidence,
  buildAssessmentProgress,
  weightedMastery,
  confidenceFromCounts,
  calculateTrend,
  validateData,
  createChemistrySample,
  buildForecastEvidence,
  buildGradeEvidence,
  generateParentReport,
  createCentreSampleSystem,
  createTestSession,
  markMcq,
  markTrueFalse,
  markNumerical,
  normaliseTrueFalse,
  suggestWrittenResponse,
  markObjectiveResponse,
  upsertStudentResponse,
  buildTestModePayload,
  recoverTimeRemaining,
  markSubmittedSession,
  updateSessionScore,
  buildCentreReportEvidence,
  buildReportSnapshotFromState,
  templateSummary,
  validateTestTemplate
};

if (typeof window !== "undefined") {
  window.ReportCore = ReportCore;
}

if (typeof module !== "undefined") {
  module.exports = ReportCore;
}
