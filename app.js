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
  renderRadar(evidence.topicProfile, "Topic");
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
  generateParentReport
};

if (typeof window !== "undefined") {
  window.ReportCore = ReportCore;
}

if (typeof module !== "undefined") {
  module.exports = ReportCore;
}
