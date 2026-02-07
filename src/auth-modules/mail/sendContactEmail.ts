import nodemailer, { Transporter } from "nodemailer";

interface ContactEmailOptions {
    name?: string;
    email: string;
    phone?: string;
    address?: string;
    message: string;
}

let transporter: Transporter;

function getTransporter(): Transporter {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    return transporter;
}

export async function sendContactEmail(details: ContactEmailOptions): Promise<void> {
    try {
        const emailTransporter = getTransporter();
        const to = "itsramky234@gmail.com";
        const from = process.env.SMTP_USER;

        if (!from) {
            throw new Error("SMTP_USER is not defined in environment variables");
        }

        const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">New Contact Form Submission</h2>
        
        <div style="margin-top: 20px;">
          <p><strong>Email:</strong> ${details.email}</p>
          <p><strong>Phone:</strong> ${details.phone || "Not provided"}</p>
          <p><strong>Address:</strong> ${details.address || "Not provided"}</p>
        </div>

        <div style="margin-top: 20px; background-color: #f9f9f9; padding: 15px; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #555;">Message:</h3>
          <p style="white-space: pre-wrap; color: #333;">${details.message}</p>
        </div>

        <p style="margin-top: 30px; font-size: 12px; color: #888;">
          Sent from Zyotra Contact Form
        </p>
      </div>
    `;

        await emailTransporter.sendMail({
            to,
            from,
            replyTo: details.email,
            subject: `New Contact Form Submission from ${details.email}`,
            html: htmlContent,
        });

        console.log(`Contact form email sent to ${to} from ${details.email}`);
    } catch (error) {
        console.error("Error sending contact form email:", error);
        throw error;
    }
}

export default sendContactEmail;
