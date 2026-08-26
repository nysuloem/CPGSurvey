const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = process.env.DB_PATH || path.join(__dirname, "cpg-survey.db");
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
  console.error("  1. A Volume is attached to this service.");
  console.error(`  2. Its Mount Path exactly matches the directory in DB_PATH ("${dbDir}").`);
  console.error("  3. The service has redeployed since the Volume was attached.");
  throw err;
}

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    consent_given INTEGER NOT NULL DEFAULT 1,
    consented_at TEXT,
    full_name TEXT,
    email TEXT,
    semesters_utsc TEXT,
    semesters_other_institution TEXT,
    major TEXT,
    postgrad_goal TEXT,
    gpa TEXT,
    campus_involvements TEXT,
    campus_involvements_other TEXT,
    research_courses_completed TEXT,
    graduate_school_discipline TEXT,
    how_heard TEXT,
    cpg_membership_semesters TEXT,
    cpg_active_member TEXT,
    conf_entry_coding_xml INTEGER,
    conf_entry_coding_other INTEGER,
    conf_entry_simulating_physiology INTEGER,
    conf_entry_math_modeling INTEGER,
    conf_entry_search_casual INTEGER,
    conf_entry_lit_search INTEGER,
    conf_entry_math INTEGER,
    conf_entry_it INTEGER,
    conf_entry_physiology INTEGER,
    conf_today_coding_xml INTEGER,
    conf_today_coding_other INTEGER,
    conf_today_simulating_physiology INTEGER,
    conf_today_math_modeling INTEGER,
    conf_today_search_casual INTEGER,
    conf_today_lit_search INTEGER,
    conf_today_math INTEGER,
    conf_today_it INTEGER,
    conf_today_physiology INTEGER,
    overall_satisfaction INTEGER,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS admin_credentials (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const existingCols = db.prepare("PRAGMA table_info(responses)").all().map((c) => c.name);
const hasCol = (name) => existingCols.includes(name);

if (!hasCol("consent_given")) db.exec("ALTER TABLE responses ADD COLUMN consent_given INTEGER NOT NULL DEFAULT 1");
if (!hasCol("consented_at")) db.exec("ALTER TABLE responses ADD COLUMN consented_at TEXT");
if (!hasCol("campus_involvements")) db.exec("ALTER TABLE responses ADD COLUMN campus_involvements TEXT");
if (!hasCol("campus_involvements_other")) db.exec("ALTER TABLE responses ADD COLUMN campus_involvements_other TEXT");
if (!hasCol("research_courses_completed")) db.exec("ALTER TABLE responses ADD COLUMN research_courses_completed TEXT");
if (!hasCol("graduate_school_discipline")) db.exec("ALTER TABLE responses ADD COLUMN graduate_school_discipline TEXT");
if (!hasCol("how_heard")) db.exec("ALTER TABLE responses ADD COLUMN how_heard TEXT");
if (!hasCol("overall_satisfaction")) db.exec("ALTER TABLE responses ADD COLUMN overall_satisfaction INTEGER");

const newConfCols = [
  "conf_entry_coding_xml", "conf_entry_coding_other", "conf_entry_simulating_physiology", "conf_entry_math_modeling", "conf_entry_search_casual",
  "conf_today_coding_xml", "conf_today_coding_other", "conf_today_simulating_physiology", "conf_today_math_modeling", "conf_today_search_casual",
];
for (const col of newConfCols) {
  if (!hasCol(col)) db.exec(`ALTER TABLE responses ADD COLUMN ${col} INTEGER`);
}
if (!hasCol("cpg_membership_semesters")) db.exec("ALTER TABLE responses ADD COLUMN cpg_membership_semesters TEXT");
if (!hasCol("cpg_active_member")) db.exec("ALTER TABLE responses ADD COLUMN cpg_active_member TEXT");

// Preserve superseded columns if they exist. Historical research data should
// never be deleted automatically during an application deployment.

module.exports = db;
