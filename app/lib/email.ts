// app/lib/email.ts
// Resend ile email gönderme servisi

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'noreply@mgtapp.com';
const FROM_NAME = 'Gizem Yolcu Studio';

interface EmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: EmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject: subject,
        text: text,
        html: html,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Email sent to ${to}, id: ${data.id}`);
      return true;
    } else {
      const error = await response.text();
      console.error(`❌ Email failed: ${error}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Email error:', error);
    return false;
  }
}

// Şifre sıfırlama emaili
export async function sendPasswordResetEmail(
  to: string, 
  name: string, 
  newPassword: string
): Promise<boolean> {
  const subject = '🔐 Yeni Şifreniz - Gizem Yolcu Studio';
  
  const text = `
Merhaba ${name},

Şifreniz sıfırlandı. Yeni giriş bilgileriniz:

Email: ${to}
Şifre: ${newPassword}

Güvenliğiniz için lütfen giriş yaptıktan sonra şifrenizi değiştirin.

Giriş yapmak için: https://gmt-app-main.vercel.app/login

İyi çalışmalar,
Gizem Yolcu Studio
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 500px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 40px; }
    .title { font-size: 24px; font-weight: bold; color: #333; margin: 10px 0; }
    .credentials { background: linear-gradient(135deg, #fdf2f8 0%, #faf5ff 100%); border-radius: 12px; padding: 20px; margin: 20px 0; }
    .credential-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .credential-row:last-child { border-bottom: none; }
    .label { color: #6b7280; font-size: 14px; }
    .value { font-weight: 600; color: #111; font-family: monospace; font-size: 16px; }
    .button { display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; margin: 20px 0; }
    .warning { background: #fef3c7; border-radius: 8px; padding: 12px; font-size: 14px; color: #92400e; margin: 20px 0; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">💄</div>
      <div class="title">Gizem Yolcu Studio</div>
    </div>
    
    <p>Merhaba <strong>${name}</strong>,</p>
    <p>Şifreniz sıfırlandı. Yeni giriş bilgileriniz:</p>
    
    <div class="credentials">
      <div class="credential-row">
        <span class="label">Email</span>
        <span class="value">${to}</span>
      </div>
      <div class="credential-row">
        <span class="label">Yeni Şifre</span>
        <span class="value">${newPassword}</span>
      </div>
    </div>
    
    <div style="text-align: center;">
      <a href="https://gmt-app-main.vercel.app/login" class="button">Giriş Yap</a>
    </div>
    
    <div class="warning">
      ⚠️ Güvenliğiniz için lütfen giriş yaptıktan sonra şifrenizi değiştirin.
    </div>
    
    <div class="footer">
      <p>İyi çalışmalar,<br>Gizem Yolcu Studio</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject, text, html });
}