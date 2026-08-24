const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

function getNotificationStatus() {
  return {
    email: Boolean(getTransporter() && process.env.NOTIFY_EMAIL),
    sms: Boolean(process.env.TEXTBELT_API_KEY && process.env.NOTIFY_SMS_TO),
    smsProvider: process.env.TEXTBELT_API_KEY ? "Textbelt" : null,
  };
}

async function sendEmailNotification(response, { test = false } = {}) {
  const t = getTransporter();
  const notifyTo = process.env.NOTIFY_EMAIL;
  if (!t || !notifyTo) return { configured: false, sent: false, detail: "SMTP or NOTIFY_EMAIL is not configured." };

  const summary = [
    `Name: ${response.full_name}`,
    `Email: ${response.email}`,
    `Consent decision: ${response.consent_given ? "Consented" : "Did not consent"}`,
    `Major: ${response.major || "—"}`,
    `CPG membership (semesters): ${response.cpg_membership_semesters || "—"}`,
    `Submitted at: ${response.submitted_at || "just now"}`,
  ].join("\n");

  try {
    const info = await t.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: notifyTo,
      subject: test ? "TEST: CPG survey email notification" : `New CPG pre-interview survey response: ${response.full_name}`,
      text: test
        ? "This is a test of the CPG survey completion-email system. No student submitted a response."
        : `A new pre-interview survey response was submitted.\n\n${summary}\n\nFull details are in the database — export via /admin/export?key=... when ready.`,
    });
    console.log(`${test ? "Test notification" : "Notification"} email accepted for ${notifyTo}`);
    return { configured: true, sent: true, recipient: notifyTo, messageId: info.messageId || null };
  } catch (err) {
    console.error("Failed to send notification email:", err.message);
    return { configured: true, sent: false, detail: err.message };
  }
}

async function sendSmsNotification(response, { test = false } = {}) {
  const { TEXTBELT_API_KEY: key, NOTIFY_SMS_TO: to } = process.env;
  if (!key || !to) {
    return { configured: false, sent: false, detail: "Textbelt API key or SMS recipient is not configured." };
  }

  // Deliberately exclude participant names, email addresses, and survey answers from SMS.
  const body = test
    ? "TEST: CPG survey text alerts are working. No student submitted a response."
    : "New CPG survey response received. Open the CPG Survey admin page to see who submitted.";

  try {
    const res = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: to, message: body, key }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || `Textbelt returned HTTP ${res.status}.`);
    console.log(`${test ? "Test" : "Notification"} SMS accepted for ${to}`);
    return {
      configured: true,
      sent: true,
      provider: "Textbelt",
      recipient: to,
      textId: data.textId || null,
      quotaRemaining: data.quotaRemaining,
    };
  } catch (err) {
    console.error("Failed to send notification SMS:", err.message);
    return { configured: true, sent: false, detail: err.message };
  }
}

async function notifySubmission(response, options = {}) {
  const sms = await sendSmsNotification(response, options);
  if (sms.sent) {
    return {
      sms,
      email: {
        configured: Boolean(getTransporter() && process.env.NOTIFY_EMAIL),
        sent: false,
        suppressed: true,
        detail: "Email not sent because the Textbelt SMS notification succeeded.",
      },
    };
  }

  // Keep the existing email path as a fallback until Textbelt is configured,
  // and also if Textbelt ever rejects a message or runs out of quota.
  const email = await sendEmailNotification(response, options);
  return { email, sms };
}

module.exports = { getNotificationStatus, notifySubmission };
