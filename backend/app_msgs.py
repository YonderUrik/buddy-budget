##################
# ERROR MESSAGES #
##################

SOMETHING_GOES_WRONG_ENG = "Something goes wrong"
INVALID_CREDENTIALS_ENG = "Invalid username or password"
RESET_PASSWORD_REQUIRED_ENG = "User need to set password"
INVALID_CODE_ENG = "Invalid code"
EMAIL_SENT_ENG = "Email sent"
PASSWORD_SETTED_ENG = "Password setted"

####################
# SUCCESS MESSAGES #
####################

EMAIL_SENT_ENG = "Email sent"
USER_REGISTERED_ENG = "successfully registered user"

# OTHER MESSAGES #
##################

FORGOT_PASSWORD_EMAIL_TEMPLATE = """
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Request</title>
</head>
<body>
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
        <tr>
            <td align="center" bgcolor="#f0f0f0" style="padding: 40px 0 30px 0;">
                <h1>Password Reset Request</h1>
            </td>
        </tr>
        <tr>
            <td bgcolor="#ffffff" style="padding: 40px 30px 40px 30px;">
                <p>Dear User,</p>
                <p>We have received a request to reset your password. To proceed, please use the following code:</p>
                <p style="font-size: 24px; font-weight: bold;">Your Reset Code: <span style="color: #C2151C;">{code}</span></p>
                <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
                <p>Thank you,</p>
            </td>
        </tr>
        <tr>
            <td bgcolor="#f0f0f0" style="padding: 20px 0 30px 0;">
                <p>If you have any questions, please contact us at <a href="mailto:contact@example.com">contact@example.com</a>.</p>
            </td>
        </tr>
    </table>
</body>
"""

PASSWORD_SETTED_EMAIL_TEMPLATE = """
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Successful</title>
</head>
<body>
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
        <tr>
            <td bgcolor="#f0f0f0" style="padding: 40px 0 30px 0;">
                <h1>Password Reset Successful</h1>
            </td>
        </tr>
        <tr>
            <td bgcolor="#ffffff" style="padding: 40px 30px 40px 30px;">
                <p>Good news!</p>
                <p>Your password has been successfully reset. You can now access your account with your email and the new password you've set.</p>
                <ol>
                    <li>Visit our website at <a href="{PLATFORM_URL}">{PLATFORM_URL}</a>.</li>
                    <li>Enter your registered email address and the new password you've just set.</li>
                    <li>Click "Login" to access your account.</li>
                </ol>
                <p>If you encounter any issues or have any questions, please don't hesitate to contact us at <a href="mailto:contact@example.com">contact@example.com</a>.</p>
                <p>Thank you for using our service!</p>
            </td>
        </tr>
    </table>
</body>
"""