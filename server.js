require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");
const { getNotificationStatus, notifySubmission } = require("./mailer");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY;
const SESSION_COOKIE = "cpg_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const failedAuth = new Map();

app.set("trust proxy", 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function adminIsConfigured() {
  return Boolean(db.prepare("SELECT 1 FROM admin_credentials WHERE id = 1").get());
}

function derivePassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function safeEqual(a, b) {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

function verifyPassword(password) {
  const row = db.prepare("SELECT password_salt, password_hash FROM admin_credentials WHERE id = 1").get();
  if (!row) return false;
  return safeEqual(derivePassword(password, row.password_salt), row.password_hash);
}

function parseCookies(req) {
  return Object.fromEntries((req.get("cookie") || "").split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }).filter(([name]) => name));
}

function createSession(res) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  const secure = process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: SESSION_TTL_MS,
    path: "/admin",
  });
}

function clearSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.clearCookie(SESSION_COOKIE, { path: "/admin" });
}

function authKey(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function isRateLimited(req) {
  const record = failedAuth.get(authKey(req));
  if (!record || record.resetAt <= Date.now()) return false;
  return record.count >= 5;
}

function recordFailedAuth(req) {
  const key = authKey(req);
  const existing = failedAuth.get(key);
  const record = existing && existing.resetAt > Date.now()
    ? existing
    : { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
  record.count += 1;
  failedAuth.set(key, record);
}

function clearFailedAuth(req) {
  failedAuth.delete(authKey(req));
}

app.post("/api/submit", async (req, res) => {
  const b = req.body || {};

  if (typeof b.consent !== "boolean") {
    return res.status(400).json({ error: "A consent decision is required before survey responses can be submitted." });
  }
  if (!b.full_name || !b.full_name.trim()) return res.status(400).json({ error: "Full name is required." });
  if (!b.email || !b.email.trim()) return res.status(400).json({ error: "Email is required." });

  const toInt = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };
  const toJson = (v) => JSON.stringify(Array.isArray(v) ? v : []);
  const selectedResearchCourses = Array.isArray(b.campus_involvements)
    && b.campus_involvements.some((item) => String(item).startsWith("Research courses"));
  const selectedGraduateSchool = b.postgrad_goal === "Graduate school";

  const stmt = db.prepare(`
    INSERT INTO responses (
      consent_given, consented_at, full_name, email, semesters_utsc, semesters_other_institution, major,
      postgrad_goal, gpa, campus_involvements, campus_involvements_other, research_courses_completed, graduate_school_discipline, how_heard, cpg_membership_semesters, cpg_active_member,
      conf_entry_coding_xml, conf_entry_coding_other, conf_entry_simulating_physiology, conf_entry_math_modeling, conf_entry_search_casual, conf_entry_lit_search, conf_entry_math, conf_entry_it, conf_entry_physiology,
      conf_today_coding_xml, conf_today_coding_other, conf_today_simulating_physiology, conf_today_math_modeling, conf_today_search_casual, conf_today_lit_search, conf_today_math, conf_today_it, conf_today_physiology,
      overall_satisfaction, notes
    ) VALUES (
      @consent_given, @consented_at, @full_name, @email, @semesters_utsc, @semesters_other_institution, @major,
      @postgrad_goal, @gpa, @campus_involvements, @campus_involvements_other, @research_courses_completed, @graduate_school_discipline, @how_heard, @cpg_membership_semesters, @cpg_active_member,
      @conf_entry_coding_xml, @conf_entry_coding_other, @conf_entry_simulating_physiology, @conf_entry_math_modeling, @conf_entry_search_casual, @conf_entry_lit_search, @conf_entry_math, @conf_entry_it, @conf_entry_physiology,
      @conf_today_coding_xml, @conf_today_coding_other, @conf_today_simulating_physiology, @conf_today_math_modeling, @conf_today_search_casual, @conf_today_lit_search, @conf_today_math, @conf_today_it, @conf_today_physiology,
      @overall_satisfaction, @notes
    )
  `);

  try {
    const submittedAt = new Date().toISOString();
    stmt.run({
      consent_given: b.consent ? 1 : 0,
      consented_at: b.consent ? submittedAt : null,
      full_name: b.full_name || null,
      email: b.email || null,
      semesters_utsc: b.semesters_utsc || null,
      semesters_other_institution: b.semesters_other_institution || null,
      major: b.major || null,
      postgrad_goal: b.postgrad_goal || null,
      gpa: b.gpa || null,
      campus_involvements: toJson(b.campus_involvements),
      campus_involvements_other: b.campus_involvements_other || null,
      research_courses_completed: selectedResearchCourses ? toJson(b.research_courses_completed) : "[]",
      graduate_school_discipline: selectedGraduateSchool ? (b.graduate_school_discipline || null) : null,
      how_heard: b.how_heard || null,
      cpg_membership_semesters: b.cpg_membership_semesters || null,
      cpg_active_member: b.cpg_active_member === "Yes" || b.cpg_active_member === "No" ? b.cpg_active_member : null,
      conf_entry_coding_xml: toInt(b.conf_entry_coding_xml),
      conf_entry_coding_other: toInt(b.conf_entry_coding_other),
      conf_entry_simulating_physiology: toInt(b.conf_entry_simulating_physiology),
      conf_entry_math_modeling: toInt(b.conf_entry_math_modeling),
      conf_entry_search_casual: toInt(b.conf_entry_search_casual),
      conf_entry_lit_search: toInt(b.conf_entry_lit_search),
      conf_entry_math: toInt(b.conf_entry_math),
      conf_entry_it: toInt(b.conf_entry_it),
      conf_entry_physiology: toInt(b.conf_entry_physiology),
      conf_today_coding_xml: toInt(b.conf_today_coding_xml),
      conf_today_coding_other: toInt(b.conf_today_coding_other),
      conf_today_simulating_physiology: toInt(b.conf_today_simulating_physiology),
      conf_today_math_modeling: toInt(b.conf_today_math_modeling),
      conf_today_search_casual: toInt(b.conf_today_search_casual),
      conf_today_lit_search: toInt(b.conf_today_lit_search),
      conf_today_math: toInt(b.conf_today_math),
      conf_today_it: toInt(b.conf_today_it),
      conf_today_physiology: toInt(b.conf_today_physiology),
      overall_satisfaction: toInt(b.overall_satisfaction),
      notes: b.notes || null,
    });

    res.json({ ok: true });
    void notifySubmission({
      full_name: b.full_name,
      email: b.email,
      major: b.major,
      cpg_membership_semesters: b.cpg_membership_semesters,
      consent_given: b.consent,
      submitted_at: submittedAt,
    }).catch((err) => console.error("Unexpected notification failure:", err));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save response. Please try again." });
  }
});

function requireAdmin(req, res, next) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const expiresAt = token && sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: "Your administrative session has expired. Please sign in again." });
  }
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  next();
}

app.get("/admin/auth/status", (req, res) => {
  res.json({ configured: adminIsConfigured(), setupAvailable: Boolean(ADMIN_KEY) });
});

app.post("/admin/auth/setup", (req, res) => {
  if (adminIsConfigured()) return res.status(409).json({ error: "The administrator password has already been created." });
  if (!ADMIN_KEY) return res.status(503).json({ error: "One-time administrator setup is not available. Ask the survey maintainer to configure ADMIN_KEY." });
  if (isRateLimited(req)) return res.status(429).json({ error: "Too many unsuccessful attempts. Please wait 15 minutes and try again." });

  const setupKey = String(req.body?.setupKey || "");
  const password = String(req.body?.password || "");
  if (!safeEqual(setupKey, ADMIN_KEY)) {
    recordFailedAuth(req);
    return res.status(403).json({ error: "The one-time setup code is incorrect." });
  }
  if (password.length < 12 || password.length > 256) {
    return res.status(400).json({ error: "Choose a password between 12 and 256 characters." });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  try {
    db.prepare(`
      INSERT INTO admin_credentials (id, password_salt, password_hash)
      VALUES (1, ?, ?)
    `).run(salt, derivePassword(password, salt));
  } catch (err) {
    if (adminIsConfigured()) return res.status(409).json({ error: "The administrator password has already been created." });
    console.error("Could not create administrator password:", err);
    return res.status(500).json({ error: "Could not create the administrator password." });
  }

  clearFailedAuth(req);
  createSession(res);
  res.json({ ok: true });
});

app.post("/admin/auth/login", (req, res) => {
  if (!adminIsConfigured()) return res.status(409).json({ error: "The administrator password has not been created yet." });
  if (isRateLimited(req)) return res.status(429).json({ error: "Too many unsuccessful attempts. Please wait 15 minutes and try again." });
  const password = String(req.body?.password || "");
  if (!verifyPassword(password)) {
    recordFailedAuth(req);
    return res.status(403).json({ error: "Incorrect password." });
  }
  clearFailedAuth(req);
  createSession(res);
  res.json({ ok: true });
});

app.post("/admin/auth/logout", requireAdmin, (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

app.post("/admin/auth/change-password", requireAdmin, (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  if (!verifyPassword(currentPassword)) return res.status(403).json({ error: "The current password is incorrect." });
  if (newPassword.length < 12 || newPassword.length > 256) {
    return res.status(400).json({ error: "Choose a password between 12 and 256 characters." });
  }
  const salt = crypto.randomBytes(16).toString("hex");
  db.prepare(`
    UPDATE admin_credentials
    SET password_salt = ?, password_hash = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(salt, derivePassword(newPassword, salt));
  sessions.clear();
  createSession(res);
  res.json({ ok: true });
});

app.get("/admin/notifications/status", requireAdmin, (req, res) => {
  res.json({ ok: true, configured: getNotificationStatus() });
});

app.post("/admin/notifications/test", requireAdmin, async (req, res) => {
  const results = await notifySubmission({ submitted_at: new Date().toISOString() }, { test: true });
  const configured = Object.values(results).filter((r) => r.configured && !r.suppressed);
  const ok = configured.length > 0 && configured.every((r) => r.sent);
  res.status(ok ? 200 : 503).json({ ok, results });
});

app.get("/admin/api/responses", requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, submitted_at, consent_given, consented_at, full_name, email, major,
           cpg_membership_semesters
    FROM responses
    ORDER BY id DESC
    LIMIT 200
  `).all();
  res.json({ ok: true, responses: rows });
});

app.get("/admin/export", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM responses ORDER BY id").all();
  if (rows.length === 0) return res.status(200).send("No responses yet.");
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    return `"${String(v).replace(/"/g, '""')}"`;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="cpg-survey-responses.csv"');
  res.send(csv);
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/health", (req, res) => res.send("ok"));

app.listen(PORT, () => console.log(`CPG survey app listening on port ${PORT}`));
