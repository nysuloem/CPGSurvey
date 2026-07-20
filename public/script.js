const CONFIDENCE_DOMAINS = [
  { key: "coding", label: "Coding" },
  { key: "lit_search", label: "Finding research on a specific topic" },
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
  "Part-time employment (on- or off-campus)",
  "Peer mentoring or tutoring programs",
];

function renderLikertGroup(container, prefix) {
  CONFIDENCE_DOMAINS.forEach((domain) => {
    const row = document.createElement("div");
    row.className = "likert-row";

    const label = document.createElement("span");
    label.className = "likert-label";
    label.textContent = domain.label;
    row.appendChild(label);

    const scale = document.createElement("div");
    scale.className = "likert-scale";
    for (let i = 1; i <= 5; i++) {
      const optLabel = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `${prefix}_${domain.key}`;
      input.value = i;
      const span = document.createElement("span");
      span.textContent = i;
      optLabel.appendChild(input);
      optLabel.appendChild(span);
      scale.appendChild(optLabel);
    }
    row.appendChild(scale);
    container.appendChild(row);
  });
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

document.querySelectorAll(".likert-group").forEach((el) => {
  renderLikertGroup(el, el.dataset.prefix);
});
renderCheckboxGroup(
  document.getElementById("campus-involvements-group"),
  CAMPUS_INVOLVEMENTS,
  "campus_involvements"
);

const form = document.getElementById("survey-form");
const errorEl = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  const formData = new FormData(form);
  const payload = {};
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

    form.hidden = true;
    document.getElementById("thank-you").hidden = false;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
});
