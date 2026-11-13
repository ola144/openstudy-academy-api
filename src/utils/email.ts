import dotenv from "dotenv";
dotenv.config();
import { BrevoClient } from "@getbrevo/brevo";

const apiKey = process.env.BREVO_API_KEY || "";

const brevo = new BrevoClient({
  apiKey: apiKey,
});

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
}: {
  to: any;
  subject: any;
  html: any;
  text?: any;
}) => {
  try {
    const response = await brevo.transactionalEmails.sendTransacEmail({
      sender: {
        name: "E-Learning Platform",
        email: process.env.EMAIL_FROM,
      },

      to: Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }],

      subject,
      htmlContent: html,

      ...(text && {
        textContent: text,
      }),
    });
    console.log("Brevo email sent successfully:", response);

    return response;
  } catch (error: any) {
    console.error("Brevo email error:", error?.response?.body || error);

    throw error;
  }
};

export const sendVerificationEmail = async (
  email: any,
  name: any,
  token: any,
) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;

  await sendEmail({
    to: email,
    subject: "Verify your OpenStudy account",
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h1>Welcome to Open Study</h1>

        <p>Hello ${name},</p>

        <p>
          Thanks for creating your open study account.
          Please verify your email address.
        </p>

        <a
          href="${verificationUrl}"
          style="
            display:inline-block;
            padding:12px 20px;
            background:#ea580c;
            color:white;
            text-decoration:none;
            border-radius:6px;
          "
        >
          Verify Email
        </a>

        <p>
          This link expires in 24 hours.
        </p>
      </div>
    `,
  });
};

export const sendInvitationEmail = async (
  email: any,
  name: any,
  token: any,
) => {
  const setupUrl = `${process.env.CLIENT_URL}/create-password/?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Create your One Study Platform Dashboard Password",
    html: `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: auto;
            padding: 30px;
          "
        >

          <h2>
            Welcome to One Study
          </h2>

          <p>
            Hello ${name},
          </p>

          <p>
            An administrator has created a
            teacher account for you.
          </p>

          <p>
            Click the button below to create
            your password and access your
            dashboard.
          </p>

          <div style="margin: 30px 0;">

            <a
              href="${setupUrl}"
              target="_blank"
              style="
                display: inline-block;
                background: #2563eb;
                color: white;
                padding: 14px 24px;
                border-radius: 8px;
                text-decoration: none;
              "
            >
              Create Password
            </a>

          </div>

          <p>
            This link will expire in
            <strong>30 minutes</strong>.
          </p>

          <p>
            If you did not expect this email,
            you can safely ignore it.
          </p>

        </div>
      `,
  });
};
