/* eslint-disable @typescript-eslint/no-explicit-any */
import nodemailer from "nodemailer";
import { envVars } from "../config/env";
import AppError from "../errorHelper/AppError";

const transporter = nodemailer.createTransport({
  port: Number(envVars.SMTP_PORT),
  secure: false,
  service: "gmail",
  auth: {
    user: envVars.SMTP_USER,
    pass: envVars.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  templateName: string;
  templateData?: Record<string, any>;
  attachments?: {
    filename: string;
    content: Buffer | string;
    contentType: string;
  }[];
}

export const sendEmail = async ({
  to,
  subject,
  templateData,
  attachments,
}: SendEmailOptions) => {
  try {
    const html = `<h1>Hello!</h1><p>Your OTP is: ${templateData?.otp} </p>
            <p> This code is only valid for 2 minute </p>`;

    await transporter.sendMail({
      from: envVars.SMTP_FROM,
      to: to,
      subject: subject,
      html: html,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error: any) {
    throw new AppError(401, "Email error");
  }
};
