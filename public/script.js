const CONFIDENCE_DOMAINS = [
  { key: "coding_xml", label: "Coding in XML" },
  { key: "coding_other", label: "Coding in other programming languages (e.g., Python, R, Java, C++)" },
  { key: "simulating_physiology", label: "Simulating physiological processes" },
  { key: "math_modeling", label: "Mathematical modeling of systems" },
  { key: "search_casual", label: "Using Google Search or GenAI tools (e.g., ChatGPT) to find information" },
  { key: "lit_search", label: "Conducting a scientific literature search (e.g., using databases such as PubMed or Google Scholar)" },
  { key: "math", label: "Mathematics, especially calculus" },
  { key: "it", label: "Using computers (e.g., installing software, using the command line)" },
  { key: "physiology", label: "Knowledge of human physiology" },
];

const CAMPUS_INVOLVEMENTS = [
  "Research courses (e.g., BIOB98, BIOD98)",
  "Non-course-related research (e.g., co-op, volunteer research)",
  "Campus clubs (e.g., BIOSA)",
  "Varsity or intramural athletics",
  "Student government/associations (e.g., SCSU)",
  "Full-time or part-time employment (on- or off-campus)",
  "Peer mentoring or tutoring programs",
];

const RESEARCH_COURSE_OPTIONS = [
  "BIOB98",
  "BIOB99",
  "BIOB97",
  "BIOC99",
  "BIOD98",
  "BIOD99",
  "Course with a Lab Component (e.g., BIOB12, BIOB32, etc.)",
];

function buildScaleButtons(name, min, max) {
  const scale = document.createElement("div");
  scale.className = "likert-scale";
  for (let i = min; i <= max; i++) {
    const optLabel = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = i;
    const span = document.createElement("span");
    span.textContent = i;
    optLabel.appendChild(input);
    optLabel.appendChild(span);
    scale.appendChild(optLabel);
  }
  return scale;
}

function buildScaleCaptions(min, max, captionMap) {
  const captions = document.createElement("div");
  captions.className = "scale-captions";
  for (let i = min; i <= max; i++) {
    const cap = document.createElement("span");
    cap.className = "scale-caption";
    cap.textContent = captionMap[i] || "";
    captions.appendChild(cap);
  }
  return captions;
}

function renderLikertGroup(container, prefix) {
  CONFIDENCE_DOMAINS.forEach((domain) => {
    const row = document.createElement("div");
    row.className = "likert-row";
    const label = document.createElement("span");
    label.className = "likert-label";
    label.textContent = domain.label;
    row.appendChild(label);
    const wrap = document.createElement("div");
    wrap.className = "scale-wrap";
    wrap.appendChild(buildScaleButtons(`${prefix}_${domain.key}`, 1, 5));
    wrap.appendChild(buildScaleCaptions(1, 5, { 1: "Not confident at all", 5: "Very confident" }));
    row.appendChild(wrap);
    container.appendChild(row);
  });
}

function renderSingleScale(container, name, min, max, captionMap) {
  container.appendChild(buildScaleButtons(name, min, max));
  container.appendChild(buildScaleCaptions(min, max, captionMap));
}

function renderCheckboxGroup(container, items, name) {
  items.forEach((item) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.value = item;
    const span = document.createElement("span");
    span.textContent = item;
    label.appendChild(input);
    label.appendChild(span);
    container.appendChild(label);
  });
}

document.querySelectorAll(".likert-group").forEach((el) => renderLikertGroup(el, el.dataset.prefix));
renderSingleScale(document.getElementById("overall-satisfaction-scale"), "overall_satisfaction", 1, 7, {
  1: "Very negative", 4: "Neutral", 7: "Very positive",
});
renderCheckboxGroup(document.getElementById("campus-involvements-group"), CAMPUS_INVOLVEMENTS, "campus_involvements");
renderCheckboxGroup(document.getElementById("research-courses-group"), RESEARCH_COURSE_OPTIONS, "research_courses_completed");

const consentStep = document.getElementById("consent-step");
const surveyStep = document.getElementById("survey-step");
const consentContinue = document.getElementById("consent-continue");
const consentChoices = document.querySelectorAll('input[name="consent_decision"]');
let consentDecision = null;

function showOnly(section) {
  [consentStep, surveyStep, document.getElementById("thank-you")].forEach((el) => {
    el.hidden = el !== section;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

consentChoices.forEach((choice) => {
  choice.addEventListener("change", () => {
    consentContinue.disabled = false;
    document.getElementById("consent-error").hidden = true;
  });
});

consentContinue.addEventListener("click", () => {
  const decision = document.querySelector('input[name="consent_decision"]:checked')?.value;
  if (!decision) {
    document.getElementById("consent-error").hidden = false;
    return;
  }
  consentDecision = decision === "consent";
  const status = document.getElementById("consent-status");
  status.textContent = consentDecision
    ? "You chose to consent to participation in the study."
    : "You chose not to consent to participation in the study. You may still complete this survey and attend your interview.";
  status.classList.toggle("declined-decision", !consentDecision);
  showOnly(surveyStep);
});

document.getElementById("review-consent").addEventListener("click", () => showOnly(consentStep));

const form = document.getElementById("survey-form");
const errorEl = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");
const allSurveyPages = Array.from(form.querySelectorAll(".survey-page"));
const previousStepBtn = document.getElementById("previous-step");
const nextStepBtn = document.getElementById("next-step");
let currentSurveyPage = 0;

function researchCoursesSelected() {
  return Array.from(form.querySelectorAll('input[name="campus_involvements"]:checked'))
    .some((input) => input.value.startsWith("Research courses"));
}

function graduateSchoolSelected() {
  return document.getElementById("postgrad_goal").value === "Graduate school";
}

function pageConditionIsMet(page) {
  if (page.dataset.condition === "research-courses") return researchCoursesSelected();
  if (page.dataset.condition === "graduate-school") return graduateSchoolSelected();
  return true;
}

function getActiveSurveyPages() {
  return allSurveyPages.filter(pageConditionIsMet);
}

function syncConditionalPages() {
  allSurveyPages.forEach((page) => {
    const active = pageConditionIsMet(page);
    page.querySelectorAll("input, select, textarea").forEach((control) => {
      control.disabled = !active;
    });
  });
}

function showSurveyPage(index, { scroll = true } = {}) {
  syncConditionalPages();
  const surveyPages = getActiveSurveyPages();
  currentSurveyPage = Math.max(0, Math.min(index, surveyPages.length - 1));
  allSurveyPages.forEach((page) => { page.hidden = true; });
  surveyPages[currentSurveyPage].hidden = false;
  const stepNumber = currentSurveyPage + 1;
  document.getElementById("survey-progress-label").textContent = `Step ${stepNumber} of ${surveyPages.length}`;
  document.getElementById("survey-progress-title").textContent = surveyPages[currentSurveyPage].dataset.stepTitle;
  document.getElementById("survey-progress-bar").style.width = `${(stepNumber / surveyPages.length) * 100}%`;
  previousStepBtn.hidden = currentSurveyPage === 0;
  nextStepBtn.hidden = currentSurveyPage === surveyPages.length - 1;
  submitBtn.hidden = currentSurveyPage !== surveyPages.length - 1;
  errorEl.hidden = true;
  if (scroll) document.getElementById("survey-title").scrollIntoView({ behavior: "smooth", block: "start" });
}

function currentPageIsValid() {
  const surveyPages = getActiveSurveyPages();
  const controls = Array.from(surveyPages[currentSurveyPage].querySelectorAll("input, select, textarea"));
  for (const control of controls) {
    if (!control.checkValidity()) {
      control.reportValidity();
      return false;
    }
  }
  return true;
}

previousStepBtn.addEventListener("click", () => showSurveyPage(currentSurveyPage - 1));
nextStepBtn.addEventListener("click", () => {
  if (currentPageIsValid()) showSurveyPage(currentSurveyPage + 1);
});
showSurveyPage(0, { scroll: false });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (consentDecision === null) {
    showOnly(consentStep);
    document.getElementById("consent-error").hidden = false;
    return;
  }
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  const formData = new FormData(form);
  const payload = { consent: consentDecision };
  for (const [key, value] of formData.entries()) {
    if (key === "campus_involvements" || key === "research_courses_completed") {
      if (!payload[key]) payload[key] = [];
      payload[key].push(value);
    } else {
      payload[key] = value;
    }
  }

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    form.reset();
    currentSurveyPage = 0;
    showOnly(document.getElementById("thank-you"));
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
});
