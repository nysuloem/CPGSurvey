const Database = require("better-sqlite3");
const path = require("path");

// On Railway, mount a volume at /data and set DB_PATH=/data/cpg-survey.db
// so responses survive redeploys. Falls back to a local file otherwise.
const dbPath = process.env.DB_PATH || path.join(__dirname, "cpg-survey.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

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
    postgrad_goal_other TEXT,
    gpa TEXT,
    other_involvements TEXT,
    cpg_membership_length TEXT,
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
    notes TEXT
  )
`);

module.exports = db;
