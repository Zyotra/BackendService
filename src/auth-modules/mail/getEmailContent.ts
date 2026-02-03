
const generateOtpEmailContent = (otp:string): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zyotra Verification Email</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
        }
        .header img {
            max-width: 150px;
        }
        .content {
            line-height: 1.6;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            margin-top: 20px;
            background-color: #28a745;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #777777;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://zyotra.com/assets/images/logo.png" alt="Zyotra Logo">
        </div>
        <div class="content">
            <h2>Welcome to Zyotra!</h2>
            <p>Thank you for signing up. Please use otp : ${otp} for verification.</p>
            <p>If you did not sign up for this account, please ignore this email.</p>
        </div>
        <div class="footer">
            &copy; 2024 Zyotra. All rights reserved.
        </div>
    </div>
</body>
</html>`
}
export default generateOtpEmailContent;