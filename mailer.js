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
    sms: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER &&
      process.env.NOTIFY_SMS_TO
    ),
  };
}

async function sendEmailNotification(response, { test = false } = {}) {
  const t = getTransporter();
  const notifyTo = process.env.NOTIFY_EMAIL;
  if (!t || !notifyTo) return { configured: false, sent: false, detail: "SMTP or NOTIFY_EMAIL is not configured." };

  const summary = [
    `Name: ${response.full_name}`,
    `Email: ${response.email}`,
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
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from, NOTIFY_SMS_TO: to } = process.env;
  if (!sid || !token || !from || !to) {
    return { configured: false, sent: false, detail: "Twilio SMS variables are not fully configured." };
  }

  // Deliberately exclude participant names, email addresses, and survey answers from SMS.
  const body = test
    ? "TEST: CPG survey text alerts are working. No student submitted a response."
    : `New CPG survey response received at ${response.submitted_at || new Date().toISOString()}. Check the secure survey export.`;
  const form = new URLSearchParams({ To: to, From: from, Body: body });

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Twilio returned HTTP ${res.status}.`);
    console.log(`${test ? "Test" : "Notification"} SMS accepted for ${to}`);
    return { configured: true, sent: true, recipient: to, messageSid: data.sid || null };
  } catch (err) {
    console.error("Failed to send notification SMS:", err.message);
    return { configured: true, sent: false, detail: err.message };
  }
}

async function notifySubmission(response, options = {}) {
  const [email, sms] = await Promise.all([
    sendEmailNotification(response, options),
    sendSmsNotification(response, options),
  ]);
  return { email, sms };
}

module.exports = { getNotificationStatus, notifySubmission };
