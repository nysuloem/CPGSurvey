require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("./db");
const { getNotificationStatus, notifySubmission } = require("./mailer");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/submit", async (req, res) => {
  const b = req.body || {};

  if (b.consent !== true) {
    return res.status(400).json({ error: "Consent is required before survey responses can be submitted." });
  }
  if (!b.full_name || !b.full_name.trim()) return res.status(400).json({ error: "Full name is required." });
  if (!b.email || !b.email.trim()) return res.status(400).json({ error: "Email is required." });

  const toInt = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };
  const toJson = (v) => JSON.stringify(Array.isArray(v) ? v : []);

  const stmt = db.prepare(`
    INSERT INTO responses (
      consent_given, consented_at, full_name, email, semesters_utsc, semesters_other_institution, major,
      postgrad_goal, gpa, campus_involvements, campus_involvements_other, how_heard, cpg_membership_semesters,
      conf_entry_coding_xml, conf_entry_coding_other, conf_entry_simulating_physiology, conf_entry_math_modeling, conf_entry_search_casual, conf_entry_lit_search, conf_entry_math, conf_entry_it, conf_entry_physiology,
      conf_today_coding_xml, conf_today_coding_other, conf_today_simulating_physiology, conf_today_math_modeling, conf_today_search_casual, conf_today_lit_search, conf_today_math, conf_today_it, conf_today_physiology,
      overall_satisfaction, notes
    ) VALUES (
      1, @consented_at, @full_name, @email, @semesters_utsc, @semesters_other_institution, @major,
      @postgrad_goal, @gpa, @campus_involvements, @campus_involvements_other, @how_heard, @cpg_membership_semesters,
      @conf_entry_coding_xml, @conf_entry_coding_other, @conf_entry_simulating_physiology, @conf_entry_math_modeling, @conf_entry_search_casual, @conf_entry_lit_search, @conf_entry_math, @conf_entry_it, @conf_entry_physiology,
      @conf_today_coding_xml, @conf_today_coding_other, @conf_today_simulating_physiology, @conf_today_math_modeling, @conf_today_search_casual, @conf_today_lit_search, @conf_today_math, @conf_today_it, @conf_today_physiology,
      @overall_satisfaction, @notes
    )
  `);

  try {
    const submittedAt = new Date().toISOString();
    stmt.run({
      consented_at: submittedAt,
      full_name: b.full_name || null,
      email: b.email || null,
      semesters_utsc: b.semesters_utsc || null,
      semesters_other_institution: b.semesters_other_institution || null,
      major: b.major || null,
      postgrad_goal: b.postgrad_goal || null,
      gpa: b.gpa || null,
      campus_involvements: toJson(b.campus_involvements),
      campus_involvements_other: b.campus_involvements_other || null,
      how_heard: b.how_heard || null,
      cpg_membership_semesters: b.cpg_membership_semesters || null,
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
      submitted_at: submittedAt,
    }).catch((err) => console.error("Unexpected notification failure:", err));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save response. Please try again." });
  }
});

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return res.status(503).json({ error: "Administrative access is not configured." });
  if (req.query.key !== ADMIN_KEY && req.get("x-admin-key") !== ADMIN_KEY) return res.status(403).json({ error: "Forbidden" });
  next();
}

app.get("/admin/notifications/status", requireAdmin, (req, res) => {
  res.json({ ok: true, configured: getNotificationStatus() });
});

app.post("/admin/notifications/test", requireAdmin, async (req, res) => {
  const results = await notifySubmission({ submitted_at: new Date().toISOString() }, { test: true });
  const configured = Object.values(results).filter((r) => r.configured);
  const ok = configured.length > 0 && configured.every((r) => r.sent);
  res.status(ok ? 200 : 503).json({ ok, results });
});

app.get("/admin/export", (req, res) => {
  if (!ADMIN_KEY) return res.status(503).send("Administrative access is not configured.");
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Forbidden");
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

app.get("/health", (req, res) => res.send("ok"));

app.listen(PORT, () => console.log(`CPG survey app listening on port ${PORT}`));
