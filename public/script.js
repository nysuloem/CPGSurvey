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

const consentStep = document.getElementById("consent-step");
const surveyStep = document.getElementById("survey-step");
const declined = document.getElementById("declined");
const consentContinue = document.getElementById("consent-continue");
const consentChoices = document.querySelectorAll('input[name="consent_decision"]');
let hasConsented = false;

function showOnly(section) {
  [consentStep, surveyStep, declined, document.getElementById("thank-you")].forEach((el) => {
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
  hasConsented = decision === "consent";
  showOnly(hasConsented ? surveyStep : declined);
});

document.getElementById("review-consent").addEventListener("click", () => showOnly(consentStep));
document.getElementById("change-decision").addEventListener("click", () => showOnly(consentStep));

const form = document.getElementById("survey-form");
const errorEl = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!hasConsented) {
    showOnly(consentStep);
    document.getElementById("consent-error").hidden = false;
    return;
  }
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  const formData = new FormData(form);
  const payload = { consent: true };
  for (const [key, value] of formData.entries()) {
    if (key === "campus_involvements") {
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
    showOnly(document.getElementById("thank-you"));
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
});
