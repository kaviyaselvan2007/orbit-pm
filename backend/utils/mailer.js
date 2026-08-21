const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, text, html }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  console.log('\n==================================================');
  console.log(`✉️  EMAIL SENT TO: ${to}`);
  console.log(`📌  SUBJECT: ${subject}`);
  console.log(`📄  CONTENT:\n${text}`);
  console.log('==================================================\n');

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || '587', 10),
        secure: parseInt(SMTP_PORT, 10) === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: SMTP_FROM || `"ORBITPM" <${SMTP_USER}>`,
        to,
        subject,
        text,
        html: html || text,
      });
      console.log(`✅  Email successfully delivered via SMTP to ${to}`);
    } catch (err) {
      console.error(`❌  Failed to send email via SMTP: ${err.message}`);
    }
  } else {
    console.log('ℹ️  SMTP is not configured in backend/.env. Email printed above to terminal for testing.');
  }
}

module.exports = { sendEmail };
