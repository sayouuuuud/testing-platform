import nodemailer from "nodemailer"

const connectionUrl = process.env.SMTP_CONNECTION_URL ?? ""
const transporter = nodemailer.createTransport(connectionUrl)

const senderName = process.env.SMTP_SENDER_NAME ?? "ITQ Testing"

function getSenderEmail(): string {
  try {
    const url = new URL(connectionUrl)
    return decodeURIComponent(url.username)
  } catch {
    return ""
  }
}

export async function sendInviteEmail(to: string, actionLink: string, displayName?: string) {
  const greeting = displayName ? `أهلاً ${displayName}،` : "أهلاً،"
  const senderEmail = getSenderEmail()

  await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to,
    subject: "دعوة للانضمام لمنصة الاختبار — ITQ",
    html: `
      <div dir="rtl" style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">${greeting}</h2>
        <p style="color: #333; line-height: 1.8;">
          تم دعوتك للانضمام لمنصة تتبع الاختبار. اضغط على الزر أدناه لإنشاء كلمة المرور والبدء:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${actionLink}"
             style="background: #0B3D2E; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            قبول الدعوة
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">
          أو انسخ الرابط ده: <br/>
          <a href="${actionLink}" style="color: #0B3D2E; word-break: break-all;">${actionLink}</a>
        </p>
      </div>
    `,
  })
}
