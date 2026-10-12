import { sendEmail as sendRawEmail } from "@/integration/mail/email/mailer";
import { BRAND } from "@/lib/branding";

/**
 * Escapes user-controlled text (tracker names, etc.) before it's interpolated
 * into an email's HTML `body`/`heading` — those fields are otherwise raw HTML
 * by design (callers intentionally embed tags like `<strong>`), so this has
 * to happen at each call site rather than inside renderTemplate itself.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface SendEmailInput {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

function renderTemplate({ heading, body, ctaUrl, ctaLabel }: SendEmailInput): string {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; background: #f5f6f0; padding: 32px;">
      <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e1e6d9;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
          <div style="width: 32px; height: 32px; border-radius: 10px; background: #1f6f50; display: inline-block;"></div>
          <strong style="font-size: 15px; color: #13201b;">${BRAND.name}</strong>
        </div>
        <h1 style="font-size: 20px; color: #13201b; margin: 0 0 12px;">${heading}</h1>
        <p style="font-size: 14px; color: #5e685f; line-height: 1.6; margin: 0 0 24px;">${body}</p>
        ${
          ctaUrl
            ? `<a href="${ctaUrl}" style="display: inline-block; background: #1f6f50; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;">${ctaLabel ?? "Open"}</a>`
            : ""
        }
        <p style="font-size: 12px; color: #93a399; margin-top: 32px;">
          ${BRAND.company} · ${BRAND.address}<br />
          ${BRAND.email}
        </p>
      </div>
    </div>
  `;
}

function renderPlainText({ heading, body, ctaUrl }: SendEmailInput): string {
  const plainBody = body.replace(/<[^>]+>/g, "");
  const lines = [heading, "", plainBody];
  if (ctaUrl) lines.push("", ctaUrl);
  lines.push("", `${BRAND.company} · ${BRAND.address}`, BRAND.email);
  return lines.join("\n");
}

/**
 * Sends a branded transactional email over the owner's own SMTP account
 * (src/integration/mail/email/mailer.ts) — no third-party email API. When
 * SMTP_HOST isn't configured, that mailer logs instead of sending, so local
 * dev still works without a mail server.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  await sendRawEmail({
    to: input.to,
    subject: input.subject,
    text: renderPlainText(input),
    html: renderTemplate(input),
    fromName: BRAND.name,
  });
}
