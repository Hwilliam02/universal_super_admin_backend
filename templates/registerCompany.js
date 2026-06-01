import transporter from '../utils/mailer.js';

 function sendResetEmail(email, token) {
 
  
  const resetLink = `${process.env.CLIENT_URL}/signup?token=${token}`;

  return transporter.sendMail({
    from: "naxapedev@gmail.com",
    to: email,
    subject: "Register new company",
    html: `<!DOCTYPE html>
<html>
  <head>
    <title>Register new company Request</title>
  </head>
  <body
    style="
      font-family: Arial, sans-serif;
      background-color: #f9fafb;
      padding: 20px 0px;
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
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        text-align: center;
      "
    >
      <!-- Logo -->


      <!-- Main Content -->
      <h2
        style="
          color: #333;
          font-size: 32px;
          font-weight: 500;
          margin: 0 0 30px 0;
          font-family: Arial, sans-serif;
        "
      >
        Company Registration
      </h2>

      <p
        style="
          font-size: 16px;
          color: #666;
          margin: 0 0 30px 0;
          font-weight: 400;
          font-family: Arial, sans-serif;
          line-height: 1.6;
        "
      >
        We received a request to register your company.<br>
        Click the button below to complete the registration process.
      </p>

      <!-- Action Button -->
      <div style="margin: 30px 0 10px 0;">
        <a
          href="${resetLink}"
          style="
            display: inline-block;
            background-color: #3A27C9;
            color: white;
            padding: 12px 40px;
            text-decoration: none;
            font-size: 14px;
            border-radius: 6px;
            font-weight: 500;
            margin-bottom: 15px;
            font-family: Arial, sans-serif;
            width: 100%;
            max-width: 300px;
          "
        >
          Complete Registration
        </a>
      </div>

      <p
        style="
          font-size: 14px;
          color: #666;
          margin: 20px 0 0 0;
          font-family: Arial, sans-serif;
          line-height: 1.6;
        "
      >
       
      </p>

      <p
        style="
          font-size: 12px;
          color: #999;
          margin: 20px 0 0 0;
          font-family: Arial, sans-serif;
          line-height: 1.6;
        "
      >
        This link will expire in 24 hours for security reasons.
      </p>

      <!-- Terms Notice -->
      <p
        style="
          font-size: 12px;
          color: #999;
          line-height: 1.6;
          margin: 40px 0 0 0;
          font-family: Arial, sans-serif;
        "
      >
        Please note that by completing your sign-up you are agreeing to our
        <a
          href="#"
          style="color: #333; text-decoration: underline;"
        >
          Terms of Service
        </a>
        and
        <a
          href="#"
          style="color: #333; text-decoration: underline;"
        >
          Privacy Policy
        </a>
      </p>
      <p 
      style="
          font-size: 12px;
          color: #666;
          line-height: 1.6;
          margin: 10px 0 0 0;
          font-family: Arial, sans-serif;
        "
      >© 2025 test</p>
    </div>
  </body>
</html>
`,
  });
};

export { sendResetEmail };