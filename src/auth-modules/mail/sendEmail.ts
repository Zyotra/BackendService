import nodemailer, { Transporter } from "nodemailer";
import generateOtpEmailContent from "./getEmailContent";
import { db } from "../db/client";
import { otps } from "../db/schema";
import generateOtp from "./generateOtp";

interface SendEmailOptions {
  to: string;
}

let transporter: Transporter;

function getTransporter(): Transporter {
  console.log("Creating email transporter...");
  console.log("SMTP_HOST:", process.env.SMTP_HOST);
  console.log("SMTP_PORT:", process.env.SMTP_PORT);
  console.log("SMTP_USER:", process.env.SMTP_USER ? "defined" : "undefined");
  console.log("SMTP_PASS:", process.env.SMTP_PASS ? "defined" : "undefined");
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",        // e.g., "smtp.gmail.com"
      port: 587,
      secure: false,                      // true if using port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}      

export async function sendEmail({
  to,
}: SendEmailOptions): Promise<void> {
  try {
    const emailTransporter = getTransporter();
    const from = process.env.SMTP_USER;

    if (!from) {
      throw new Error("SMTP_USER is not defined in environment variables");
    }
    const otp=generateOtp()
    await emailTransporter.sendMail({
      to,
      from,
      subject:"Zyotra Verification Email",
      html: await generateOtpEmailContent(otp),
    });
    console.log(`Email sent to ${to}`);
    await db.insert(otps).values({
        email: to,
        otp: otp
    })
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
export default sendEmail;
