import nodemailer from 'nodemailer';
let transport;
export async function sendFormMail({ subject, text }) {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) throw new Error('Zoho SMTP is not configured.');
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zoho.eu', port: 465, secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000
  });
  const result = await transport.sendMail({ from: SMTP_USER, to: 'gabriel@corvus.gent', subject, text });
  if (!result.accepted?.some(address => address.toLowerCase() === 'gabriel@corvus.gent')) throw new Error('Zoho did not accept the recipient.');
  return { messageId: result.messageId };
}
