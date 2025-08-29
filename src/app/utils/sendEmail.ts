/* eslint-disable @typescript-eslint/no-explicit-any */
import ejs from "ejs";
import nodemailer from "nodemailer";
import path from "path";
import { envVars } from "../config/env";
import AppError from "../errorHelper/AppError";

const transporter = nodemailer.createTransport({
    // port: envVars.EMAIL_SENDER.SMTP_PORT,
    // host: envVars.SMTP_HOST,
    port: Number(envVars.SMTP_PORT),
    secure: false,
    service : "gmail" ,
    auth: {
        user: envVars.SMTP_USER,
        pass: envVars.SMTP_PASS
    },
    
})
console.log(333);


interface SendEmailOptions {
    to: string,
    subject: string;
    templateName: string;
    templateData?: Record<string, any>
    attachments?: {
        filename: string,
        content: Buffer | string,
        contentType: string
    }[]
}
console.log(4444);

export const sendEmail = async ({
    to,
    subject,
    templateName,
    templateData,
    attachments
}: SendEmailOptions) => {
    try {
        const templatePath = path.join(__dirname, `templates/${templateName}.ejs`)
        console.log(1);
        
        // const html = await ejs.renderFile(templatePath, templateData)
            const html = `<h1>Hello!</h1><p>Your OTP is: ${templateData?.otp} </p>
            <p> This code is only valid for 2 minute </p>`;
            console.log(2);
            
        await transporter.sendMail({
            from: envVars.SMTP_FROM,
            to: to,
            subject: subject,
            html: html,
            attachments: attachments?.map(attachment => ({
                filename: attachment.filename,
                content: attachment.content,
                contentType: attachment.contentType
            }))
        })

    } catch (error: any) {
        console.error("node_mailer error:", error)
        throw new AppError(401, "Email error", error)
    }

}