import transporter from '../utils/mailer.js';
import path from 'path';

function sendTrialSignupEmail(email, token, companyName) {
  const registrationLink = `${process.env.CLIENT_URL}/signup?token=${token}&flow=trial`;
  
  // Use public IP for most reliable loading, with CID as backup
  const publicLogoUrl = "http://192.168.1.6:4000/logos/default_trial_logo.png";

  return transporter.sendMail({
    from: "naxapedev@gmail.com",
    to: email,
    subject: `Complete Your Free Trial Registration - ${companyName}`,
    html: `<!DOCTYPE html>
<html>
  <head>
    <title>Complete Your Free Trial</title>
  </head>
  <body
    style="
      font-family: Arial, sans-serif;
      background-color: #f9fafb;
      padding: 40px 0px;
      margin: 0;
    "
  >
    <!-- Email Container -->
    <div
      style="
        max-width: 600px;
        margin: 20px auto;
        background: white;
        padding: 40px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        text-align: center;
        border: 1px solid #e5e7eb;
      "
    >
      <!-- Logo -->
      <div
        style="
          text-align: center;
          padding-bottom: 30px;
        "
      >
        <img
          src="${publicLogoUrl}"
          alt="RouteGenius Logo"
          width="80"
          style="display: inline-block; border: 0;"
        />
      </div>

      <!-- Main Content -->
      <h2
        style="
          color: #0f172a;
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 10px 0;
          font-family: Arial, sans-serif;
          letter-spacing: -0.02em;
        "
      >
        Welcome to RouteGenius!
      </h2>

      <p
        style="
          font-size: 14px;
          color: #1A66FE;
          margin: 0 0 30px 0;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-family: Arial, sans-serif;
        "
      >
        Trial Registration
      </p>

      <p
        style="
          font-size: 16px;
          color: #475569;
          margin: 0 0 10px 0;
          font-weight: 400;
          font-family: Arial, sans-serif;
          line-height: 1.6;
        "
      >
        Hi there! We received a free trial request for <strong>${companyName}</strong>.
      </p>

      <p
        style="
          font-size: 16px;
          color: #475569;
          margin: 0 0 30px 0;
          font-weight: 400;
          font-family: Arial, sans-serif;
          line-height: 1.6;
        "
      >
        Click the button below to set up your account, choose your features, and start your free trial.
      </p>

      <!-- Action Button -->
      <div style="margin: 30px 0 10px 0;">
        <a
          href="${registrationLink}"
          style="
            display: inline-block;
            background: #1A66FE;
            color: #ffffff;
            padding: 16px 40px;
            text-decoration: none;
            font-size: 16px;
            border-radius: 12px;
            font-weight: 700;
            margin-bottom: 15px;
            font-family: Arial, sans-serif;
            box-shadow: 0 10px 20px rgba(26, 102, 254, 0.2);
          "
        >
          Complete Registration
        </a>
      </div>

      <p
        style="
          font-size: 12px;
          color: #94a3b8;
          margin: 20px 0 0 0;
          font-family: Arial, sans-serif;
          line-height: 1.6;
        "
      >
        This link will expire in <strong>24 hours</strong> for security reasons.
      </p>

      <!-- Terms Notice -->
      <p
        style="
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.6;
          margin: 40px 0 0 0;
          font-family: Arial, sans-serif;
        "
      >
        Please note that by completing your sign-up you are agreeing to our
        <a
          href="#"
          style="color: #1A66FE; text-decoration: underline;"
        >
          Terms of Service
        </a>
        and
        <a
          href="#"
          style="color: #1A66FE; text-decoration: underline;"
        >
          Privacy Policy
        </a>
      </p>
      <p
        style="
          font-size: 12px;
          color: #64748b;
          line-height: 1.6;
          margin: 10px 0 0 0;
          font-family: Arial, sans-serif;
        "
      >© ${new Date().getFullYear()} RouteGenius AI</p>
    </div>
  </body>
</html>
`,
    attachments: [
      {
        filename: "logo.png",
        path: path.join(__dirname, "../public/logos/default_trial_logo.png"),
        cid: "routegenius_logo",
      },
    ],
  });
}

export { sendTrialSignupEmail  };
