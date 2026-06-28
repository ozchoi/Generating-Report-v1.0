const sampleBlueprints = [
  {
    student: "Iris Lau",
    qualification: "IGCSE",
    subject: "Physics",
    exam: "International GCSE Physics",
    scores: [128, 136, 142, 150, 158, 163, 170, 176],
    skills: ["Forces and motion", "Electricity", "Waves", "Energy transfers", "Solids, liquids and gases", "Magnetism", "Radioactivity", "Astrophysics"],
    questionTypes: ["Structured calculation", "Practical / data analysis", "Short concept / theory", "Structured calculation", "Long application", "Graph interpretation", "Short concept / theory", "MCQ"],
    subtopics: ["Newton's laws", "Resistance", "Refraction", "Efficiency", "Gas pressure", "Motor effect", "Half-life", "Red-shift"]
  },
  {
    student: "Noah Cheung",
    qualification: "IGCSE",
    subject: "Chemistry",
    exam: "International GCSE Chemistry",
    scores: [132, 141, 148, 156, 161, 168, 174, 181],
    skills: ["Atomic Structure", "Bonding", "Stoichiometry", "Energetics", "Rates", "Organic Chemistry", "Analysis", "Electrolysis"],
    questionTypes: ["Short concept / theory", "Short concept / theory", "Structured calculation", "Structured calculation", "Graph interpretation", "Long application", "Practical / data analysis", "MCQ"],
    subtopics: ["Ions", "Covalent bonding", "Moles", "Exothermic reactions", "Rate graphs", "Alkanes", "Flame tests", "Electrolytes"]
  },
  {
    student: "Hana Patel",
    qualification: "IGCSE",
    subject: "Biology",
    exam: "International GCSE Biology",
    scores: [126, 134, 139, 145, 153, 160, 166, 173],
    skills: ["Cells", "Biological Molecules", "Enzymes", "Plant Physiology", "Human Physiology", "Inheritance", "Ecology", "Microorganisms"],
    questionTypes: ["Short concept / theory", "Practical / data analysis", "Graph interpretation", "Long application", "Structured calculation", "Short concept / theory", "Practical / data analysis", "MCQ"],
    subtopics: ["Microscopy", "Food tests", "Temperature and enzymes", "Photosynthesis", "Heart rate", "Punnett squares", "Sampling", "Fermentation"]
  },
  {
    student: "Leo Ng",
    qualification: "IGCSE",
    subject: "Additional Mathematics",
    exam: "International GCSE Additional Mathematics",
    scores: [118, 126, 137, 145, 152, 158, 166, 172],
    skills: ["Algebra", "Functions", "Quadratics", "Trigonometry", "Calculus", "Coordinate Geometry", "Vectors", "Sequences"],
    questionTypes: ["Structured calculation", "Problem solving", "Structured calculation", "Proof / reasoning", "Structured calculation", "Graph interpretation", "Long application", "MCQ"],
    subtopics: ["Indices", "Composite functions", "Discriminant", "Identities", "Differentiation", "Tangents", "Vector geometry", "Series"]
  },
  {
    student: "Mika Wong",
    qualification: "IAL",
    subject: "Physics",
    exam: "IAL Physics AS",
    scores: [166, 174, 181, 194, 207, 202, 218, 238],
    skills: ["Mechanics", "Materials", "Waves", "Electricity", "Fields", "Thermodynamics", "Particles", "Mechanics"],
    questionTypes: ["Structured calculation", "Practical / data analysis", "Short concept / theory", "Long application", "Graph interpretation", "Practical / data analysis", "Structured calculation", "Long application"],
    subtopics: ["Newton's laws", "Hooke's law", "Refraction", "Resistivity", "Electric fields", "Ideal gas equation", "Radioactive decay", "Moments"]
  },
  {
    student: "Sofia Rahman",
    qualification: "IAL",
    subject: "Chemistry",
    exam: "IAL Chemistry AS",
    scores: [154, 163, 171, 178, 188, 196, 205, 214],
    skills: ["Structure and Bonding", "Energetics", "Kinetics", "Equilibria", "Organic Chemistry", "Group Chemistry", "Calculations", "Practical Skills"],
    questionTypes: ["Short concept / theory", "Structured calculation", "Graph interpretation", "Long application", "Mechanism / pathway", "Practical / data analysis", "Structured calculation", "Practical / data analysis"],
    subtopics: ["Shapes of molecules", "Enthalpy cycles", "Rate equations", "Kc", "Halogenoalkanes", "Group 2", "Titration", "Uncertainty"]
  },
  {
    student: "Ethan Yu",
    qualification: "IAL",
    subject: "Biology",
    exam: "IAL Biology AS",
    scores: [148, 157, 166, 174, 183, 191, 199, 208],
    skills: ["Molecules", "Cells", "Transport", "Membranes", "Genetics", "Biodiversity", "Immunity", "Practical Skills"],
    questionTypes: ["Short concept / theory", "Practical / data analysis", "Structured calculation", "Long application", "Graph interpretation", "Short concept / theory", "Practical / data analysis", "MCQ"],
    subtopics: ["Proteins", "Cell ultrastructure", "Mass transport", "Osmosis", "DNA replication", "Classification", "Antibodies", "Serial dilution"]
  },
  {
    student: "Chloe Lam",
    qualification: "IAL",
    subject: "Pure Mathematics",
    exam: "IAL Pure Mathematics AS",
    scores: [151, 160, 168, 177, 186, 196, 207, 221],
    skills: ["Algebra", "Functions", "Coordinate Geometry", "Sequences", "Trigonometry", "Differentiation", "Integration", "Exponentials"],
    questionTypes: ["Structured calculation", "Problem solving", "Graph interpretation", "Structured calculation", "Proof / reasoning", "Structured calculation", "Long application", "Short concept / theory"],
    subtopics: ["Binomial expansion", "Transformations", "Circles", "Arithmetic series", "Identities", "Stationary points", "Area under curve", "Logarithms"]
  }
];

const sampleRows = sampleBlueprints.flatMap((blueprint) =>
  blueprint.scores.map((score, index) => ({
    student: blueprint.student,
    qualification: blueprint.qualification,
    subject: blueprint.subject,
    exam: blueprint.exam,
    date: weeklyDate(index),
    score,
    maxScore: blueprint.qualification === "IAL" ? 300 : 240,
    skill: blueprint.skills[index],
    questionType: blueprint.questionTypes[index],
    subtopic: blueprint.subtopics[index],
    questionCount: sampleQuestionCount(index),
    difficulty: sampleDifficulty(index)
  }))
);

const gradeBoundaryPresets = {
  IAL: {
    default: {
      source: "2601 IAL subject grade boundaries, AS cash-in UMS",
      maxScore: 300,
      boundaries: [
        { grade: "U", min: 0 },
        { grade: "E", min: 120 },
        { grade: "D", min: 150 },
        { grade: "C", min: 180 },
        { grade: "B", min: 210 },
        { grade: "A", min: 240 }
      ]
    }
  },
  IGCSE: {
    default: {
      source: "2511 International GCSE modular subject boundaries, cash-in UMS",
      maxScore: 240,
      boundaries: [
        { grade: "U", min: 0 },
        { grade: "1", min: 24 },
        { grade: "2", min: 48 },
        { grade: "3", min: 72 },
        { grade: "4", min: 96 },
        { grade: "5", min: 120 },
        { grade: "6", min: 144 },
        { grade: "7", min: 168 },
        { grade: "8", min: 192 },
        { grade: "9", min: 216 }
      ]
    },
    "Additional Mathematics": {
      source: "2511 International GCSE Mathematics A Higher cash-in UMS proxy",
      maxScore: 240,
      boundaries: [
        { grade: "U", min: 0 },
        { grade: "3", min: 84 },
        { grade: "4", min: 96 },
        { grade: "5", min: 120 },
        { grade: "6", min: 144 },
        { grade: "7", min: 168 },
        { grade: "8", min: 192 },
        { grade: "9", min: 216 }
      ]
    }
  }
};

let rows = [...sampleRows];
let trendChart;
let radarChart;
let curveChart;
let radarMode = "topic";
let selectedDrillTopic = "Mechanics";

const questionTypeFormats = [
  "MCQ",
  "Short concept / theory",
  "Long application",
  "Structured calculation",
  "Practical / data analysis",
  "Graph interpretation",
  "Problem solving",
  "Proof / reasoning",
  "Mechanism / pathway"
];

const physicsTaxonomy = {
  IAL: {
    topics: {
      Mechanics: ["Kinematics", "Forces", "Newton's laws", "Moments", "Momentum", "Work and energy", "Power"],
      Materials: ["Density", "Hooke's law", "Elastic deformation", "Stress", "Strain", "Young modulus"],
      Waves: ["Wave properties", "Refraction", "Interference", "Stationary waves", "Polarisation"],
      Electricity: ["Current and potential difference", "Resistance", "Resistivity", "Circuits", "Internal resistance"],
      Fields: ["Gravitational fields", "Electric fields", "Magnetic fields", "Capacitors"],
      Thermodynamics: ["Specific heat capacity", "Latent heat", "Ideal gas equation", "Kinetic theory"],
      Particles: ["Quantum physics", "Photoelectric effect", "Radioactive decay", "Nuclear radiation"],
      Oscillations: ["Simple harmonic motion", "Resonance", "Damping"],
      Cosmology: ["Doppler shift", "Hubble's law", "Stellar evolution"]
    },
    questionTypes: questionTypeFormats
  },
  IGCSE: {
    topics: {
      "Forces and motion": ["Movement and position", "Forces", "Newton's laws", "Momentum", "Moments"],
      Electricity: ["Mains electricity", "Current and voltage", "Resistance", "Energy and power"],
      Waves: ["Wave properties", "Light", "Sound", "Electromagnetic spectrum"],
      "Energy transfers": ["Energy stores", "Work", "Power", "Efficiency"],
      "Solids, liquids and gases": ["Density", "Pressure", "Gas pressure", "Thermal energy transfer"],
      Magnetism: ["Magnetic fields", "Electromagnets", "Motor effect", "Electromagnetic induction"],
      Radioactivity: ["Atomic structure", "Radiation types", "Half-life", "Fission and fusion"],
      Astrophysics: ["Solar system", "Stellar evolution", "Red-shift", "The universe"]
    },
    questionTypes: questionTypeFormats
  }
};

const gradeBoundaryPlugin = {
  id: "gradeBoundaryPlugin",
  afterDatasetsDraw(chart, _args, pluginOptions) {
    const boundaries = pluginOptions.boundaries ?? [];
    const student = pluginOptions.student;
    const { ctx, chartArea, scales } = chart;
    if (!boundaries.length || !scales.x || !scales.y) return;

    ctx.save();
    ctx.strokeStyle = "#667085";
    ctx.fillStyle = "#17202a";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.font = "700 11px Inter, sans-serif";
    ctx.textAlign = "center";

    boundaries.forEach((boundary) => {
      const x = scales.x.getPixelForValue(boundary.min);
      if (x < chartArea.left || x > chartArea.right) return;
      const isNumericGrade = /^[1-9]$/.test(boundary.grade);
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = isNumericGrade ? "#c24138" : "#17202a";
      ctx.fillText(boundary.grade, x, chartArea.top - 20);
      ctx.fillStyle = "#17202a";
      ctx.fillText(String(boundary.min), x, chartArea.top - 6);
      ctx.setLineDash([5, 5]);
    });

    if (student) {
      const x = scales.x.getPixelForValue(student.score);
      const y = scales.y.getPixelForValue(student.density);
      if (x >= chartArea.left && x <= chartArea.right) {
        ctx.strokeStyle = "#c24138";
        ctx.fillStyle = "#c24138";
        ctx.setLineDash([]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.bottom);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = x > chartArea.right - 64 ? "right" : "left";
        ctx.fillText(`Student ${student.score}`, x + (ctx.textAlign === "right" ? -8 : 8), y - 8);
      }
    }

    ctx.restore();
  }
};

Chart.register(gradeBoundaryPlugin);

const studentSelect = document.querySelector("#studentSelect");
const subjectSelect = document.querySelector("#subjectSelect");
const qualificationSelect = document.querySelector("#qualificationSelect");
const reportText = document.querySelector("#reportText");

document.querySelector("#resultsFile").addEventListener("change", handleResultsFile);
document.querySelector("#paperFile").addEventListener("change", handlePaperFiles);
document.querySelector("#loadSample").addEventListener("click", () => {
  rows = [...sampleRows];
  refreshSelectors();
  render();
});
document.querySelector("#downloadTemplate").addEventListener("click", downloadTemplate);
document.querySelector("#printReport").addEventListener("click", () => window.print());
document.querySelector("#exportReport").addEventListener("click", exportReport);
studentSelect.addEventListener("change", () => {
  refreshSubjectSelector();
  render();
});
subjectSelect.addEventListener("change", render);
qualificationSelect.addEventListener("change", render);
document.querySelectorAll("#radarModeControls button").forEach((button) => {
  button.addEventListener("click", () => {
    if (radarMode === button.dataset.mode) return;
    radarMode = button.dataset.mode;
    renderRadarSectionOnly();
  });
});

refreshSelectors();
render();

function handleResultsFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.querySelector("#resultsFileStatus").textContent = `Selected: ${file.name}`;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    document.querySelector("#resultsFileStatus").textContent = `Selected: ${file.name} - XLSX import UI ready; CSV parsing is active in this prototype.`;
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseCsv(String(reader.result));
    const normalized = parsed
      .map(normalizeRow)
      .filter((row) => row.student && row.subject && row.date && Number.isFinite(row.score));

    if (normalized.length) {
      rows = normalized;
      refreshSelectors();
      render();
    } else {
      alert("No valid rows found. Please include student, subject, date, score, maxScore, and skill.");
    }
  };
  reader.readAsText(file);
}

function handlePaperFiles(event) {
  const files = [...event.target.files];
  const status = document.querySelector("#paperFileStatus");
  if (!files.length) {
    status.textContent = "No paper file selected";
    return;
  }
  const names = files.slice(0, 2).map((file) => file.name).join(", ");
  const extra = files.length > 2 ? ` +${files.length - 2} more` : "";
  status.textContent = `Selected: ${names}${extra}`;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
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

function normalizeRow(row) {
  return {
    student: row.student || row.Student || row.name || "",
    qualification: row.qualification || row.Qualification || "",
    subject: row.subject || row.Subject || "",
    exam: row.exam || row.Exam || row.paper || row.Paper || "",
    date: row.date || row.Date || "",
    score: Number(row.score || row.Score || row.marks || row.Marks),
    maxScore: Number(row.maxScore || row.max_score || row.MaxScore || row.total || row.Total || 100),
    skill: row.skill || row.Skill || row.topic || row.Topic || "Overall",
    questionType: row.questionType || row.question_type || row.QuestionType || row.question || row.Question || "",
    subtopic: row.subtopic || row.Subtopic || row.detail || row.Detail || "",
    questionCount: Number(row.questionCount || row.question_count || row.QuestionCount || row.questions || row.Questions || 10),
    difficulty: row.difficulty || row.Difficulty || "Medium"
  };
}

function refreshSelectors() {
  const students = unique(rows.map((row) => row.student));
  studentSelect.innerHTML = students.map(optionMarkup).join("");
  refreshSubjectSelector();
}

function refreshSubjectSelector() {
  const selectedStudent = studentSelect.value || rows[0]?.student;
  const subjects = unique(rows.filter((row) => row.student === selectedStudent).map((row) => row.subject));
  subjectSelect.innerHTML = subjects.map(optionMarkup).join("");
}

function optionMarkup(value) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
}

function render() {
  const selectedStudent = studentSelect.value;
  const selectedSubject = subjectSelect.value;
  const selectedRows = getSelectedRows();

  if (!selectedRows.length) return;

  const selectedQualification = selectedRows[0].qualification || qualificationSelect.value;
  qualificationSelect.value = selectedQualification;
  document.querySelector("#pageTitle").textContent = `${selectedStudent} - ${selectedSubject} Report`;

  const points = selectedRows.map((row, index) => ({
    week: index + 1,
    raw: row.score,
    score: Math.round((row.score / row.maxScore) * 100),
    maxScore: row.maxScore,
    date: row.date,
    skill: row.skill,
    questionType: row.questionType,
    subtopic: row.subtopic,
    questionCount: row.questionCount,
    difficulty: row.difficulty
  }));

  const latest = points.at(-1);
  const previous = points.at(-2);
  const change = previous ? latest.score - previous.score : 0;
  const latestRawScore = selectedRows.at(-1).score;
  const grade = gradeFor(latestRawScore, selectedRows.at(-1).maxScore, selectedSubject, selectedQualification);
  const skillAverages = buildSkillAverages(selectedRows);
  const radarProfiles = buildRadarProfiles(selectedRows, selectedSubject);
  const activeProfile = radarMode === "question" ? radarProfiles.question : radarProfiles.topic;
  const weakestSkill = [...activeProfile.entries()].sort((a, b) => a[1] - b[1])[0];
  const strongestSkill = [...activeProfile.entries()].sort((a, b) => b[1] - a[1])[0];

  document.querySelector("#latestScore").textContent = `${latest.score}%`;
  document.querySelector("#latestMeta").textContent = `${latest.raw}/${latest.maxScore} on ${formatDate(latest.date)}`;
  document.querySelector("#weeklyChange").textContent = `${change >= 0 ? "+" : ""}${change} pts`;
  document.querySelector("#estimatedGrade").textContent = grade;
  document.querySelector("#gradeMeta").textContent = `Estimated from ${latestRawScore}/${selectedRows.at(-1).maxScore}`;
  document.querySelector("#focusArea").textContent = weakestSkill?.[0] ?? "Overall";

  renderTrend(points);
  renderRadar(activeProfile, selectedRows, selectedSubject);
  renderCurve(latestRawScore, selectedRows.at(-1).maxScore, selectedSubject, selectedQualification);
  renderPerformanceAnnotations(weakestSkill, strongestSkill, selectedSubject);
  renderTopicMap(selectedRows, selectedSubject);
  renderBoundaryDistance(latestRawScore, selectedRows.at(-1).maxScore, selectedSubject, selectedQualification, weakestSkill);
  renderHeatmap(selectedRows, selectedSubject);
  renderDifficultyPanel(selectedRows);
  reportText.value = generateReport(selectedStudent, selectedSubject, points, grade, weakestSkill, activeProfile);
}

function getSelectedRows() {
  const selectedStudent = studentSelect.value;
  const selectedSubject = subjectSelect.value;
  return rows
    .filter((row) => row.student === selectedStudent && row.subject === selectedSubject)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function renderRadarSectionOnly() {
  const selectedRows = getSelectedRows();
  if (!selectedRows.length) return;

  const selectedSubject = subjectSelect.value;
  const radarProfiles = buildRadarProfiles(selectedRows, selectedSubject);
  const activeProfile = radarMode === "question" ? radarProfiles.question : radarProfiles.topic;
  renderRadar(activeProfile, selectedRows, selectedSubject);
}

function buildSkillAverages(selectedRows) {
  const grouped = new Map();
  selectedRows.forEach((row) => {
    const list = grouped.get(row.skill) ?? [];
    list.push((row.score / row.maxScore) * 100);
    grouped.set(row.skill, list);
  });
  return new Map([...grouped.entries()].map(([skill, scores]) => [skill, average(scores)]));
}

function buildRadarProfiles(selectedRows, subject) {
  const isPhysics = subject.toLowerCase() === "physics";
  const topicGroups = new Map();
  const questionGroups = new Map();

  selectedRows.forEach((row) => {
    const topic = isPhysics ? inferPhysicsTopic(row) : row.skill;
    const question = inferQuestionType(row);
    addScore(topicGroups, topic, row);
    addScore(questionGroups, question, row);
  });

  return {
    topic: averageGroups(topicGroups),
    question: averageGroups(questionGroups)
  };
}

function addScore(grouped, key, row) {
  const list = grouped.get(key) ?? [];
  list.push((row.score / row.maxScore) * 100);
  grouped.set(key, list);
}

function averageGroups(grouped) {
  return new Map([...grouped.entries()].map(([key, scores]) => [key, average(scores)]));
}

function inferPhysicsTopic(row) {
  const qualification = qualificationSelect.value;
  const topics = physicsTaxonomy[qualification].topics;
  const source = `${row.skill} ${row.subtopic} ${row.exam}`.toLowerCase();

  const aliases = {
    Mechanics: ["mechanics", "force", "newton", "moment", "momentum", "kinematic", "projectile"],
    "Forces and motion": ["mechanics", "force", "motion", "newton", "moment", "momentum"],
    Materials: ["material", "hooke", "elastic", "stress", "strain", "young"],
    Waves: ["wave", "refraction", "diffraction", "interference", "standing", "stationary", "sound", "light"],
    Electricity: ["electric", "circuit", "current", "voltage", "potential", "resistance", "resistivity"],
    Fields: ["field", "capacitor", "gravitational", "magnetic"],
    Thermodynamics: ["thermal", "thermodynamic", "gas", "heat", "temperature", "latent"],
    Particles: ["particle", "quantum", "radioactive", "radiation", "nuclear", "decay"],
    Oscillations: ["oscillation", "shm", "resonance", "damping"],
    Cosmology: ["cosmology", "hubble", "red-shift", "redshift", "star", "stellar", "universe"],
    "Energy transfers": ["energy", "work", "power", "efficiency"],
    "Solids, liquids and gases": ["solid", "liquid", "gas", "pressure", "density"],
    Magnetism: ["magnet", "electromagnet", "motor", "induction"],
    Radioactivity: ["radioactive", "radiation", "half-life", "nuclear"],
    Astrophysics: ["astro", "planet", "solar", "red-shift", "redshift", "universe"]
  };

  const matched = Object.keys(topics).find((topic) => {
    const words = aliases[topic] ?? [topic.toLowerCase()];
    return words.some((word) => source.includes(word));
  });

  return matched ?? Object.keys(topics)[0];
}

function inferQuestionType(row) {
  const source = String(row.questionType || "").toLowerCase();
  const exact = questionTypeFormats.find((type) => source === type.toLowerCase());

  if (exact) return exact;
  if (source.includes("mcq") || source.includes("multiple choice")) return "MCQ";
  if (source.includes("long") || source.includes("apply") || source.includes("application") || source.includes("essay")) return "Long application";
  if (source.includes("short") || source.includes("concept") || source.includes("theory") || source.includes("explain") || source.includes("describe")) return "Short concept / theory";
  if (source.includes("data") || source.includes("practical") || source.includes("experiment") || source.includes("uncertainty")) return "Practical / data analysis";
  if (source.includes("graph")) return "Graph interpretation";
  if (source.includes("proof") || source.includes("reason")) return "Proof / reasoning";
  if (source.includes("problem")) return "Problem solving";
  if (source.includes("mechanism") || source.includes("pathway")) return "Mechanism / pathway";
  if (source.includes("calculate") || source.includes("calculation") || source.includes("equation") || source.includes("circuit")) return "Structured calculation";
  return "Short concept / theory";
}

function renderTrend(points) {
  const forecasts = buildForecast(points);
  const labels = [...points.map((point) => `W${point.week}`), ...forecasts.labels];
  const actual = [...points.map((point) => point.score), ...Array(forecasts.labels.length).fill(null)];
  const baseNulls = Array(points.length - 1).fill(null);

  trendChart?.destroy();
  trendChart = new Chart(document.querySelector("#trendChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        lineDataset("Actual score", "#2563eb", actual, 3),
        lineDataset("Conservative forecast", "#1f8a52", [...baseNulls, ...forecasts.conservative], 2),
        lineDataset("Expected forecast", "#c05f18", [...baseNulls, ...forecasts.expected], 2),
        lineDataset("Optimistic forecast", "#d99a1c", [...baseNulls, ...forecasts.optimistic], 2)
      ]
    },
    options: chartOptions({
      y: { min: 0, max: 100, title: "Score %" },
      x: { title: "Assessment week" }
    })
  });
}

function buildForecast(points) {
  const latest = points.at(-1).score;
  const recent = points.slice(-4).map((point) => point.score);
  const slope = Math.max(-1.2, Math.min(2.4, averageDelta(recent)));
  const weeks = 8;
  const labels = Array.from({ length: weeks }, (_, index) => `W${points.length + index + 1}`);
  const path = (multiplier) => {
    const values = [latest];
    for (let index = 1; index <= weeks; index += 1) {
      const fatigue = 1 - index * 0.055;
      values.push(Math.max(0, Math.min(100, latest + slope * multiplier * index * fatigue)));
    }
    return values;
  };
  return {
    labels,
    conservative: path(0.55),
    expected: path(1),
    optimistic: path(1.55)
  };
}

function renderRadar(profile, selectedRows, subject) {
  const labels = [...profile.keys()];
  const values = [...profile.values()].map((value) => Math.round(value));
  const isPhysics = subject.toLowerCase() === "physics";
  const controls = document.querySelector("#radarModeControls");

  controls.hidden = false;
  document.querySelectorAll("#radarModeControls button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === radarMode);
  });
  document.querySelector("#radarHeading").textContent =
    radarMode === "topic" ? `${subject} Ability Radar: Topic` : `${subject} Ability Radar: Question Type`;
  document.querySelector("#radarDescription").textContent = radarMode === "topic"
    ? isPhysics
      ? "Click a topic to inspect syllabus subtopics and recent evidence."
      : "Topic profile for the selected subject."
    : "Exam-format profile across MCQ, short theory, long application, calculation, practical/data, and graph questions.";

  if (!labels.includes(selectedDrillTopic) && labels.length) {
    selectedDrillTopic = labels[0];
  }

  radarChart?.destroy();
  radarChart = new Chart(document.querySelector("#radarChart"), {
    type: "radar",
    data: {
      labels,
      datasets: [
        {
          label: "Ability",
          data: values,
          backgroundColor: "rgba(37, 99, 235, 0.18)",
          borderColor: "#2563eb",
          pointBackgroundColor: "#2563eb",
          borderWidth: 2
        }
      ]
    },
    options: {
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
        legend: { display: false }
      },
      onClick: (_event, elements) => {
        if (!isPhysics || radarMode !== "topic" || !elements.length) return;
        selectedDrillTopic = labels[elements[0].index];
        renderTopicDetail(selectedRows, selectedDrillTopic, profile);
      }
    }
  });

  renderTopicDetail(selectedRows, selectedDrillTopic, profile, isPhysics);
}

function renderTopicDetail(selectedRows, topic, profile, isPhysics = true) {
  const detail = document.querySelector("#topicDetail");
  if (!isPhysics && radarMode === "topic") {
    detail.innerHTML = "";
    return;
  }

  if (radarMode === "question") {
    const weakest = [...profile.entries()].sort((a, b) => a[1] - b[1])[0];
    detail.innerHTML = `
      <span>Question Type Focus</span>
      <strong>${escapeHtml(weakest?.[0] ?? "Calculation")}</strong>
      <p>Use this view to separate content knowledge from exam format. A low score here means the student needs targeted practice with this style of question, not only more topic revision.</p>
    `;
    return;
  }

  const qualification = qualificationSelect.value;
  const syllabusItems = physicsTaxonomy[qualification].topics[topic] ?? [];
  const evidence = selectedRows
    .filter((row) => inferPhysicsTopic(row) === topic)
    .map((row) => row.subtopic || row.skill)
    .filter(Boolean);
  const chips = Object.keys(physicsTaxonomy[qualification].topics)
    .map((item) => `<button type="button" data-topic="${escapeHtml(item)}">${escapeHtml(item)}</button>`)
    .join("");

  detail.innerHTML = `
    <span>Topic Detail</span>
    <strong>${escapeHtml(topic)} - ${Math.round(profile.get(topic) ?? 0)}%</strong>
    <p>${escapeHtml(syllabusItems.join(", "))}</p>
    <p>Recent evidence: ${escapeHtml(unique(evidence).join(", ") || "No detailed subtopic rows yet.")}</p>
    <div class="topic-chips">${chips}</div>
  `;

  detail.querySelectorAll("button[data-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDrillTopic = button.dataset.topic;
      renderTopicDetail(selectedRows, selectedDrillTopic, profile, true);
    });
  });
}

function renderCurve(latestScore, maxScore, subject, qualification) {
  const boundaryPreset = boundaryPresetFor(subject, qualification);
  const boundaries = scaledBoundaries(maxScore, subject, qualification);
  const scores = Array.from({ length: 81 }, (_, index) => Math.round((index / 80) * maxScore));
  const center = maxScore * 0.66;
  const spread = maxScore * 0.2;
  const distribution = scores.map((score) => ({ x: score, y: gaussian(score, center, spread) * 100 }));
  const studentDensity = gaussian(latestScore, center, spread) * 100;
  document.querySelector("#curveDescription").textContent = `${boundaryPreset.source}; scaled to ${maxScore} marks.`;
  const curveOptions = chartOptions({
    y: { title: "Estimated density", displayTicks: false },
    x: { title: "Score with grade boundaries" }
  });
  curveOptions.layout = { padding: { top: 34 } };
  curveOptions.scales.x.type = "linear";
  curveOptions.scales.x.min = 0;
  curveOptions.scales.x.max = maxScore;
  curveOptions.plugins.gradeBoundaryPlugin = {
    boundaries,
    student: { score: latestScore, density: studentDensity }
  };

  curveChart?.destroy();
  curveChart = new Chart(document.querySelector("#curveChart"), {
    type: "line",
    data: {
      datasets: [
        {
          label: "Estimated cohort density",
          data: distribution,
          borderColor: "#1f78a8",
          backgroundColor: "rgba(31, 120, 168, 0.12)",
          fill: true,
          tension: 0.42,
          pointRadius: 0,
          borderWidth: 3
        }
      ]
    },
    options: curveOptions
  });
}

function lineDataset(label, color, data, borderWidth) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    tension: 0.38,
    spanGaps: true,
    pointRadius: 3,
    borderWidth
  };
}

function chartOptions({ y, x }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    scales: {
      y: {
        min: y.min,
        max: y.max,
        title: { display: Boolean(y.title), text: y.title, color: "#17202a", font: { weight: 700 } },
        ticks: { display: y.displayTicks !== false, color: "#667085" },
        grid: { color: "#e4e9f1" }
      },
      x: {
        title: { display: Boolean(x.title), text: x.title, color: "#17202a", font: { weight: 700 } },
        ticks: { color: "#667085", maxRotation: 0 },
        grid: { display: false }
      }
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, usePointStyle: true, color: "#17202a" }
      }
    }
  };
}

function renderPerformanceAnnotations(weakestSkill, strongestSkill, subject) {
  const annotations = document.querySelector("#performanceAnnotations");
  const label = radarMode === "question" ? "Question Type" : "Topic";
  annotations.innerHTML = `
    <div class="annotation-card">
      <span>Weak ${label}</span>
      <strong>${escapeHtml(weakestSkill?.[0] ?? "Overall")}</strong>
      <p>Average ${Math.round(weakestSkill?.[1] ?? 0)}%. Prioritise this area in the next practice cycle.</p>
    </div>
    <div class="annotation-card">
      <span>Strong ${label}</span>
      <strong>${escapeHtml(strongestSkill?.[0] ?? "Overall")}</strong>
      <p>Average ${Math.round(strongestSkill?.[1] ?? 0)}%. Keep this strength warm with mixed review.</p>
    </div>
  `;
}

function renderTopicMap(selectedRows, subject) {
  const table = document.querySelector("#topicMapTable");
  const topicStats = buildTopicStats(selectedRows, subject);

  table.innerHTML = `
    <thead>
      <tr>
        <th>Area</th>
        <th>Accuracy</th>
        <th>Trend</th>
        <th>Status</th>
        <th>Data confidence</th>
      </tr>
    </thead>
    <tbody>
      ${topicStats
        .map((item) => `
          <tr>
            <td><strong>${escapeHtml(item.topic)}</strong></td>
            <td>${Math.round(item.accuracy)}%</td>
            <td>${escapeHtml(item.trendLabel)}</td>
            <td><span class="status-pill ${item.statusClass}">${escapeHtml(item.status)}</span></td>
            <td>
              <span class="confidence-pill ${item.confidenceClass}">${escapeHtml(item.confidence)}</span>
              <div class="muted-line">based on ${item.questions} questions</div>
            </td>
          </tr>
        `)
        .join("")}
    </tbody>
  `;
}

function buildTopicStats(selectedRows, subject) {
  const grouped = new Map();
  selectedRows.forEach((row) => {
    const topic = topicForRow(row, subject);
    const list = grouped.get(topic) ?? [];
    list.push(row);
    grouped.set(topic, list);
  });

  return [...grouped.entries()]
    .map(([topic, topicRows]) => {
      const sorted = [...topicRows].sort((a, b) => new Date(a.date) - new Date(b.date));
      const accuracy = weightedAccuracy(sorted);
      const questions = sorted.reduce((sum, row) => sum + safeQuestionCount(row), 0);
      const trend = sorted.length > 1
        ? accuracyOf(sorted.at(-1)) - accuracyOf(sorted[0])
        : estimateTopicTrend(selectedRows, sorted[0]);
      const confidence = confidenceForQuestions(questions);
      const status = statusForAccuracy(accuracy, trend, questions);
      return {
        topic,
        accuracy,
        questions,
        trend,
        trendLabel: trendLabel(trend, sorted.length),
        confidence: confidence.label,
        confidenceClass: confidence.className,
        status: status.label,
        statusClass: status.className
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);
}

function renderBoundaryDistance(currentScore, maxScore, subject, qualification, weakestSkill) {
  const container = document.querySelector("#boundaryDistance");
  const boundaries = scaledBoundaries(maxScore, subject, qualification).filter((boundary) => boundary.grade !== "U");
  const currentIndex = boundaries.findLastIndex((boundary) => currentScore >= boundary.min);
  const visible = boundaries
    .filter((_boundary, index) => index >= Math.max(0, currentIndex - 1) && index <= Math.min(boundaries.length - 1, currentIndex + 2))
    .slice(0, 4);
  const nextTarget = boundaries.find((boundary) => boundary.min > currentScore);
  const currentGrade = gradeFor(currentScore, maxScore, subject, qualification);
  const targetText = nextTarget
    ? `Short-term target: secure Grade ${nextTarget.grade} by improving ${Math.max(1, nextTarget.min - currentScore)} marks in ${weakestSkill?.[0] ?? "the focus area"}.`
    : "Short-term target: maintain the current top boundary and reduce careless mark loss.";

  container.innerHTML = `
    <div class="boundary-summary">
      <div><span>Current mark</span><strong>${currentScore}/${maxScore}</strong></div>
      <div><span>Current grade</span><strong>${escapeHtml(currentGrade)}</strong></div>
      <div><span>Next boundary</span><strong>${nextTarget ? `Grade ${escapeHtml(nextTarget.grade)} at ${nextTarget.min}` : "Top band"}</strong></div>
    </div>
    <div class="table-wrap">
      <table class="boundary-table">
        <thead>
          <tr><th>Target</th><th>Required</th><th>Current</th><th>Gap</th></tr>
        </thead>
        <tbody>
          ${visible
            .map((boundary) => {
              const gap = currentScore - boundary.min;
              return `<tr>
                <td>Grade ${escapeHtml(boundary.grade)}</td>
                <td>${boundary.min}</td>
                <td>${currentScore}</td>
                <td>${gap >= 0 ? `+${gap}` : gap}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="boundary-target">${escapeHtml(targetText)}</p>
  `;
}

function renderHeatmap(selectedRows, subject) {
  const table = document.querySelector("#heatmapTable");
  const weeks = selectedRows.slice(-4).map((row, index) => ({
    label: `Week ${selectedRows.length - 4 + index + 1}`,
    row
  }));
  const stats = buildTopicStats(selectedRows, subject).slice(0, 8);
  const overallAverage = average(selectedRows.map(accuracyOf));

  table.innerHTML = `
    <thead>
      <tr>
        <th>Topic</th>
        ${weeks.map((week) => `<th>${escapeHtml(week.label)}</th>`).join("")}
        <th>Current</th>
      </tr>
    </thead>
    <tbody>
      ${stats
        .map((stat) => {
          const cells = weeks.map((week) => heatmapValueForTopic(selectedRows, subject, stat.topic, week.row, overallAverage));
          return `<tr>
            <td><strong>${escapeHtml(stat.topic)}</strong></td>
            ${cells.map((value) => `<td class="heat-cell ${heatClass(value)}">${Math.round(value)}%</td>`).join("")}
            <td><span class="status-pill ${stat.statusClass}">${escapeHtml(stat.status)}</span></td>
          </tr>`;
        })
        .join("")}
    </tbody>
  `;
}

function renderDifficultyPanel(selectedRows) {
  const panel = document.querySelector("#difficultyPanel");
  const grouped = new Map();
  selectedRows.forEach((row) => {
    const difficulty = normalizeDifficulty(row.difficulty);
    const list = grouped.get(difficulty) ?? [];
    list.push(row);
    grouped.set(difficulty, list);
  });

  const order = ["Easy", "Medium", "Hard", "Exam-style", "Challenge"];
  const rowsByDifficulty = order
    .filter((difficulty) => grouped.has(difficulty))
    .map((difficulty) => {
      const list = grouped.get(difficulty);
      return {
        difficulty,
        accuracy: weightedAccuracy(list),
        questions: list.reduce((sum, row) => sum + safeQuestionCount(row), 0)
      };
    });

  const adjustedIndex = adjustedPerformanceIndex(selectedRows);
  const weakestDifficulty = [...rowsByDifficulty].sort((a, b) => a.accuracy - b.accuracy)[0];
  panel.innerHTML = `
    <div class="difficulty-note">
      <span>Adjusted Performance Index</span>
      <strong>${Math.round(adjustedIndex)}%</strong>
      <p>${escapeHtml(difficultyInsight(rowsByDifficulty, weakestDifficulty))}</p>
    </div>
    <div class="table-wrap">
      <table class="difficulty-table">
        <thead>
          <tr><th>Difficulty</th><th>Accuracy</th><th>Evidence</th></tr>
        </thead>
        <tbody>
          ${rowsByDifficulty
            .map((item) => `
              <tr>
                <td><strong>${escapeHtml(item.difficulty)}</strong></td>
                <td>${Math.round(item.accuracy)}%</td>
                <td>${item.questions} questions</td>
              </tr>
            `)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function generateReport(student, subject, points, grade, weakestSkill, skillAverages) {
  const latest = points.at(-1);
  const previous = points.at(-2);
  const first = points[0];
  const totalGrowth = latest.score - first.score;
  const recentChange = previous ? latest.score - previous.score : 0;
  const strongestSkill = [...skillAverages.entries()].sort((a, b) => b[1] - a[1])[0];
  const forecast = buildForecast(points).expected.at(-1);

  return `${student} - ${subject} Ability Report

Overall progress
${student} is currently performing at ${latest.score}% in ${subject}, with an estimated grade of ${grade}. Across the recorded assessments, the score has changed by ${totalGrowth >= 0 ? "+" : ""}${totalGrowth} percentage points, which suggests ${totalGrowth >= 8 ? "clear upward progress" : totalGrowth >= 0 ? "steady development" : "a need to stabilise recent performance"}.

Recent movement
The most recent weekly change is ${recentChange >= 0 ? "+" : ""}${recentChange} percentage points. If the current learning pattern continues, the expected forecast places ${student} around ${Math.round(forecast)}% after the next cycle of lessons and practice papers.

Ability profile
The strongest area is ${strongestSkill?.[0] ?? "Overall"}, averaging ${Math.round(strongestSkill?.[1] ?? latest.score)}%. The main focus area is ${weakestSkill?.[0] ?? "Overall"}, averaging ${Math.round(weakestSkill?.[1] ?? latest.score)}%. This should be targeted through short weekly drills, exam-style correction, and review of marking scheme language.

Recommendation for parents
Maintain regular timed practice and ask ${student} to explain mistakes after each paper. The next month should prioritise accuracy in the focus area while preserving confidence in stronger topics. A useful target is to raise the weakest skill by 5-8 percentage points before the next full mock exam.`;
}

function gradeFor(score, maxScore, subject, qualification) {
  const boundaries = scaledBoundaries(maxScore, subject, qualification);
  return boundaries.reduce((grade, boundary) => (score >= boundary.min ? boundary.grade : grade), "U");
}

function boundaryPresetFor(subject, qualification) {
  const presets = gradeBoundaryPresets[qualification] ?? gradeBoundaryPresets.IAL;
  return presets[subject] ?? presets.default;
}

function scaledBoundaries(maxScore, subject, qualification) {
  const preset = boundaryPresetFor(subject, qualification);
  return preset.boundaries.map((boundary) => ({
    grade: boundary.grade,
    min: Math.round((boundary.min / preset.maxScore) * maxScore)
  }));
}

function topicForRow(row, subject) {
  return subject.toLowerCase() === "physics" ? inferPhysicsTopic(row) : row.skill;
}

function accuracyOf(row) {
  return (row.score / row.maxScore) * 100;
}

function safeQuestionCount(row) {
  const count = Number(row.questionCount);
  return Number.isFinite(count) && count > 0 ? count : 10;
}

function weightedAccuracy(rowList) {
  const totalQuestions = rowList.reduce((sum, row) => sum + safeQuestionCount(row), 0);
  const weighted = rowList.reduce((sum, row) => sum + accuracyOf(row) * safeQuestionCount(row), 0);
  return totalQuestions ? weighted / totalQuestions : average(rowList.map(accuracyOf));
}

function estimateTopicTrend(selectedRows, topicRow) {
  const sorted = [...selectedRows].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sorted.length < 2) return 0;
  const overallTrend = accuracyOf(sorted.at(-1)) - accuracyOf(sorted[0]);
  const position = sorted.findIndex((row) => row === topicRow);
  const recencyBoost = position >= sorted.length - 3 ? 1 : 0.5;
  return overallTrend * 0.25 * recencyBoost;
}

function trendLabel(trend, rowCount) {
  if (rowCount < 2 && Math.abs(trend) < 2) return "not enough history";
  if (trend >= 3) return "Improving";
  if (trend <= -3) return "Declining";
  return "Stable";
}

function confidenceForQuestions(questions) {
  if (questions >= 12) return { label: "reliable", className: "confidence-reliable" };
  if (questions >= 6) return { label: "building", className: "confidence-building" };
  return { label: "not enough data", className: "confidence-limited" };
}

function statusForAccuracy(accuracy, trend, questions) {
  if (questions < 6) return { label: "Watch", className: "status-watch" };
  if (accuracy >= 78 && trend >= -4) return { label: "Strong", className: "status-strong" };
  if (accuracy >= 68) return { label: "Good", className: "status-good" };
  if (accuracy >= 58 || trend > 3) return { label: "Developing", className: "status-watch" };
  return { label: "Priority", className: "status-priority" };
}

function heatmapValueForTopic(selectedRows, subject, topic, weekRow, overallAverage) {
  const direct = selectedRows.find((row) => row.date === weekRow.date && topicForRow(row, subject) === topic);
  if (direct) return accuracyOf(direct);

  const topicRows = selectedRows.filter((row) => topicForRow(row, subject) === topic);
  const topicAverage = topicRows.length ? weightedAccuracy(topicRows) : overallAverage;
  const weekOffset = accuracyOf(weekRow) - overallAverage;
  return clamp(topicAverage + weekOffset * 0.35, 0, 100);
}

function heatClass(value) {
  if (value >= 78) return "heat-strong";
  if (value >= 68) return "heat-good";
  if (value >= 58) return "heat-watch";
  return "heat-priority";
}

function normalizeDifficulty(value) {
  const source = String(value || "Medium").toLowerCase();
  if (source.includes("easy")) return "Easy";
  if (source.includes("hard")) return "Hard";
  if (source.includes("exam")) return "Exam-style";
  if (source.includes("challenge")) return "Challenge";
  return "Medium";
}

function difficultyWeight(difficulty) {
  return {
    Easy: 0.9,
    Medium: 1,
    Hard: 1.12,
    "Exam-style": 1.18,
    Challenge: 1.25
  }[difficulty] ?? 1;
}

function adjustedPerformanceIndex(selectedRows) {
  const weighted = selectedRows.reduce((sum, row) => {
    const difficulty = normalizeDifficulty(row.difficulty);
    return sum + accuracyOf(row) * difficultyWeight(difficulty) * safeQuestionCount(row);
  }, 0);
  const weightTotal = selectedRows.reduce((sum, row) => sum + difficultyWeight(normalizeDifficulty(row.difficulty)) * safeQuestionCount(row), 0);
  return weightTotal ? clamp(weighted / weightTotal, 0, 100) : 0;
}

function difficultyInsight(rowsByDifficulty, weakestDifficulty) {
  const easy = rowsByDifficulty.find((item) => item.difficulty === "Easy");
  const examStyle = rowsByDifficulty.find((item) => item.difficulty === "Exam-style" || item.difficulty === "Hard" || item.difficulty === "Challenge");
  if (easy && examStyle && easy.accuracy - examStyle.accuracy >= 15) {
    return "Student handles routine questions well but loses marks when questions become exam-style or multi-step.";
  }
  if (weakestDifficulty) {
    return `${weakestDifficulty.difficulty} questions are currently the best place to gain marks quickly.`;
  }
  return "Add difficulty tags to the CSV to separate routine marks from harder exam-style performance.";
}

function sampleQuestionCount(index) {
  return [12, 14, 16, 12, 18, 10, 14, 18][index % 8];
}

function sampleDifficulty(index) {
  return ["Challenge", "Exam-style", "Hard", "Medium", "Exam-style", "Hard", "Medium", "Easy"][index % 8];
}

function gaussian(x, mean, standardDeviation) {
  return Math.exp(-0.5 * ((x - mean) / standardDeviation) ** 2);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageDelta(values) {
  if (values.length < 2) return 0;
  const deltas = values.slice(1).map((value, index) => value - values[index]);
  return average(deltas);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function weeklyDate(index) {
  const date = new Date("2026-04-25T00:00:00");
  date.setDate(date.getDate() + index * 7);
  return date.toISOString().slice(0, 10);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

function downloadTemplate() {
  const template = [
    "student,qualification,subject,exam,date,score,maxScore,skill,questionType,subtopic,questionCount,difficulty",
    "Mika Wong,IAL,Physics,IAL Physics Unit 1,2026-06-20,238,300,Mechanics,Long application,Moments,12,Exam-style"
  ].join("\n");
  downloadFile("student-results-template.csv", template, "text/csv");
}

function exportReport() {
  const student = studentSelect.value || "student";
  const subject = subjectSelect.value || "subject";
  downloadFile(`${student}-${subject}-parent-report.txt`.replace(/\s+/g, "-"), reportText.value, "text/plain");
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
