const nodemailer = require("nodemailer");

// Configure via environment variables (see .env.example).
// Works with Gmail, Outlook/Office365, or any SMTP provider.
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null; // Email not configured — submissions still succeed, just no notification.
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // true for port 465, false for 587/others
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

async function notifySubmission(response) {
  const t = getTransporter();
  const notifyTo = process.env.NOTIFY_EMAIL;
  if (!t || !notifyTo) {
    console.log("Email notification skipped (SMTP or NOTIFY_EMAIL not configured).");
    return;
  }

  const summary = [
    `Name: ${response.full_name}`,
    `Email: ${response.email}`,
    `Major: ${response.major || "—"}`,
    `CPG membership (semesters): ${response.cpg_membership_semesters || "—"}`,
    `Submitted at: ${response.submitted_at || "just now"}`,
  ].join("\n");

  try {
    await t.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: notifyTo,
      subject: `New CPG pre-interview survey response: ${response.full_name}`,
      text: `A new pre-interview survey response was submitted.\n\n${summary}\n\nFull details are in the database — export via /admin/export?key=... when ready.`,
    });
    console.log(`Notification email sent to ${notifyTo}`);
  } catch (err) {
    // Never let an email failure block or fail the student's submission.
    console.error("Failed to send notification email:", err.message);
  }
}

module.exports = { notifySubmission };
