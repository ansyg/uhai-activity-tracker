import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Self-hosted email delivery — plain SMTP via nodemailer against whatever
 * mail server the owner configures (their own domain, any standards-based
 * relay). No third-party marketing/transactional API. When SMTP_HOST isn't
 * set (local dev), mail is logged instead of sent so the app runs without
 * any mail server at all.
 */
let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromName?: string;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  fromName = "UHAI Activity Tracker (UAT)",
}: SendEmailInput): Promise<{ delivered: boolean }> {
  const t = getTransporter();
  if (!t) {
    console.log(
      `[email:dev-fallback — no SMTP_HOST configured] to=${to}\nsubject=${subject}\n\n${text}\n`,
    );
    return { delivered: false };
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || `${fromName} <${process.env.SMTP_USER ?? "no-reply@localhost"}>`,
    to,
    subject,
    text,
    html,
  });
  return { delivered: true };
}
