const setupForm = document.getElementById("admin-setup");
const loginForm = document.getElementById("admin-login");
const loginPassword = document.getElementById("admin-password");
const errorEl = document.getElementById("admin-error");
const panel = document.getElementById("responses-panel");
const tableBody = document.getElementById("responses-body");
const changePasswordForm = document.getElementById("change-password-form");

async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

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
      : response.consented_at ? "Consented" : "Decision not recorded";
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

function showLogin() {
  setupForm.hidden = true;
  panel.hidden = true;
  loginForm.hidden = false;
  document.getElementById("admin-intro").textContent = "Enter your private administrator password to see who has completed the survey.";
}

async function loadResponses() {
  const data = await requestJson("/admin/api/responses");
  renderResponses(data.responses || []);
  setupForm.hidden = true;
  loginForm.hidden = true;
  panel.hidden = false;
}

async function initialize() {
  try {
    const status = await requestJson("/admin/auth/status");
    if (status.configured) return showLogin();
    setupForm.hidden = false;
    document.getElementById("admin-intro").textContent = "The designated data custodian must create the administrator password before survey responses can be viewed.";
    if (!status.setupAvailable) {
      document.getElementById("setup-error").textContent = "One-time setup is not configured. Ask the survey maintainer to configure ADMIN_KEY.";
      document.getElementById("setup-error").hidden = false;
    }
  } catch (err) {
    showLogin();
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

setupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("setup-error");
  error.hidden = true;
  const password = document.getElementById("admin-new-password").value;
  if (password !== document.getElementById("admin-confirm-password").value) {
    error.textContent = "The two password entries do not match.";
    error.hidden = false;
    return;
  }
  try {
    await requestJson("/admin/auth/setup", {
      method: "POST",
      body: JSON.stringify({ setupKey: document.getElementById("admin-setup-key").value, password }),
    });
    setupForm.reset();
    await loadResponses();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  try {
    await requestJson("/admin/auth/login", { method: "POST", body: JSON.stringify({ password: loginPassword.value }) });
    loginForm.reset();
    await loadResponses();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

document.getElementById("refresh-responses").addEventListener("click", async () => {
  try { await loadResponses(); } catch (err) { alert(err.message); }
});

document.getElementById("download-csv").addEventListener("click", async () => {
  try {
    const res = await fetch("/admin/export");
    if (!res.ok) throw new Error(await res.text() || "Could not download the CSV.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cpg-survey-responses.csv";
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) { alert(err.message); }
});

document.getElementById("change-password").addEventListener("click", () => {
  changePasswordForm.hidden = false;
  document.getElementById("current-password").focus();
});

document.getElementById("cancel-password-change").addEventListener("click", () => {
  changePasswordForm.reset();
  changePasswordForm.hidden = true;
});

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("change-password-error");
  error.hidden = true;
  const newPassword = document.getElementById("changed-password").value;
  if (newPassword !== document.getElementById("confirm-changed-password").value) {
    error.textContent = "The two new-password entries do not match.";
    error.hidden = false;
    return;
  }
  try {
    await requestJson("/admin/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: document.getElementById("current-password").value, newPassword }),
    });
    changePasswordForm.reset();
    changePasswordForm.hidden = true;
    alert("Your administrator password has been changed.");
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  }
});

document.getElementById("admin-logout").addEventListener("click", async () => {
  try { await requestJson("/admin/auth/logout", { method: "POST", body: "{}" }); } catch (_) { /* Session may already have expired. */ }
  showLogin();
});

initialize();
