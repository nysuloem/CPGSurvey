const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// On Railway, mount a volume at /data and set DB_PATH=/data/cpg-survey.db
// so responses survive redeploys. Falls back to a local file otherwise.
const dbPath = process.env.DB_PATH || path.join(__dirname, "cpg-survey.db");

// Defensive: if the target directory doesn't exist yet (e.g. a volume
// mount path that doesn't quite match DB_PATH), create it rather than
// crashing with an opaque SQLITE_CANTOPEN error.
const dbDir = path.dirname(dbPath);
try {
  fs.mkdirSync(dbDir, { recursive: true });
} catch (err) {
  console.error(`Could not create database directory "${dbDir}":`, err.message);
}

let db;
try {
  db = new Database(dbPath);
} catch (err) {
  console.error(`Failed to open database at "${dbPath}". If you're on Railway, check that:`);
  console.error(`  1. A Volume is attached to this service.`);
  console.error(`  2. Its Mount Path exactly matches the directory in DB_PATH ("${dbDir}").`);
  console.error(`  3. The service has redeployed since the Volume was attached.`);
  throw err;
}

db.pragma("journal_mode = WAL");

// Base schema (used when the table doesn't exist yet at all).
db.exec(`
  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    full_name TEXT,
    email TEXT,
    semesters_utsc TEXT,
    semesters_other_institution TEXT,
    major TEXT,
    postgrad_goal TEXT,
    gpa TEXT,
    campus_involvements TEXT,
    campus_involvements_other TEXT,
    how_heard TEXT,
    cpg_membership_semesters TEXT,
    conf_entry_coding INTEGER,
    conf_entry_lit_search INTEGER,
    conf_entry_math INTEGER,
    conf_entry_it INTEGER,
    conf_entry_physiology INTEGER,
    conf_today_coding INTEGER,
    conf_today_lit_search INTEGER,
    conf_today_math INTEGER,
    conf_today_it INTEGER,
    conf_today_physiology INTEGER,
    overall_satisfaction INTEGER,
    notes TEXT
  )
`);

// --- Migration: bring an already-deployed table up to the current schema ---
// Safe to run every startup; each step is guarded by a column-existence check.
const existingCols = db.prepare("PRAGMA table_info(responses)").all().map((c) => c.name);
const hasCol = (name) => existingCols.includes(name);

if (!hasCol("campus_involvements")) {
  db.exec("ALTER TABLE responses ADD COLUMN campus_involvements TEXT");
}
if (!hasCol("campus_involvements_other")) {
  db.exec("ALTER TABLE responses ADD COLUMN campus_involvements_other TEXT");
}
if (!hasCol("how_heard")) {
  db.exec("ALTER TABLE responses ADD COLUMN how_heard TEXT");
}
if (!hasCol("overall_satisfaction")) {
  db.exec("ALTER TABLE responses ADD COLUMN overall_satisfaction INTEGER");
}
if (!hasCol("cpg_membership_semesters")) {
  if (hasCol("cpg_membership_length")) {
    // Old dropdown values (e.g. "1–2 semesters") don't convert cleanly to a
    // number, so keep them in the old column and add the new numeric one
    // fresh rather than guessing a number from the old text.
    db.exec("ALTER TABLE responses ADD COLUMN cpg_membership_semesters TEXT");
  } else {
    db.exec("ALTER TABLE responses ADD COLUMN cpg_membership_semesters TEXT");
  }
}
if (hasCol("postgrad_goal_other")) {
  db.exec("ALTER TABLE responses DROP COLUMN postgrad_goal_other");
}
if (hasCol("other_involvements")) {
  db.exec("ALTER TABLE responses DROP COLUMN other_involvements");
}
// cpg_membership_length (old dropdown column) is intentionally left in place
// if present, rather than dropped, so no historical data is lost silently.

module.exports = db;
