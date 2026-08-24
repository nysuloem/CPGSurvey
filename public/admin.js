const loginForm = document.getElementById("admin-login");
const keyInput = document.getElementById("admin-key");
const errorEl = document.getElementById("admin-error");
const panel = document.getElementById("responses-panel");
const tableBody = document.getElementById("responses-body");
let adminKey = "";

function formatSubmittedAt(value) {
  if (!value) return "—";
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value ?? "—";
  row.appendChild(cell);
}

function renderResponses(responses) {
  tableBody.replaceChildren();
  responses.forEach((response) => {
    const row = document.createElement("tr");
    addCell(row, formatSubmittedAt(response.submitted_at));
    addCell(row, response.full_name);
    addCell(row, response.email);
    const consentLabel = response.consent_given === 0
      ? "Did not consent"
      : response.consented_at
        ? "Consented"
        : "Decision not recorded";
    addCell(row, consentLabel);
    addCell(row, response.major);
    tableBody.appendChild(row);
  });
  if (responses.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No survey responses have been submitted yet.";
    cell.className = "empty-table";
    row.appendChild(cell);
    tableBody.appendChild(row);
  }
  document.getElementById("response-count").textContent = `${responses.length} response${responses.length === 1 ? "" : "s"} shown, newest first.`;
}

async function loadResponses() {
  errorEl.hidden = true;
  const res = await fetch("/admin/api/responses", { headers: { "x-admin-key": adminKey } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load survey responses.");
  renderResponses(data.responses || []);
  loginForm.hidden = true;
  panel.hidden = false;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminKey = keyInput.value;
  try {
    await loadResponses();
    keyInput.value = "";
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

document.getElementById("refresh-responses").addEventListener("click", async () => {
  try {
    await loadResponses();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById("download-csv").addEventListener("click", async () => {
  try {
    const res = await fetch("/admin/export", { headers: { "x-admin-key": adminKey } });
    if (!res.ok) throw new Error(await res.text() || "Could not download the CSV.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cpg-survey-responses.csv";
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
});
