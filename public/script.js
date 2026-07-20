const CONFIDENCE_DOMAINS = [
  { key: "coding", label: "Coding" },
  { key: "lit_search", label: "Finding research on a specific topic" },
  { key: "math", label: "Mathematics, especially calculus" },
  { key: "it", label: "Using computers (e.g., installing software, using the command line)" },
  { key: "physiology", label: "Knowledge of human physiology" },
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

document.querySelectorAll(".likert-group").forEach((el) => {
  renderLikertGroup(el, el.dataset.prefix);
});

document.getElementById("postgrad_goal").addEventListener("change", (e) => {
  document.getElementById("postgrad_other_wrap").hidden = e.target.value !== "Other";
});

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
    payload[key] = value;
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
