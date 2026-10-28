
import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT ?? 465);

export const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS?.replace(/\s+/g, ""),
  },
});
