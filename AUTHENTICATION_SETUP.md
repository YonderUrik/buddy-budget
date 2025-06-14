# Authentication System Setup

This document explains how to set up and use the authentication system in Buddy Budget.

## Overview

The authentication system uses:
- **NextAuth.js v5** for authentication management
- **Prisma** as the ORM
- **MongoDB** as the database
- **bcryptjs** for password hashing
- **nodemailer** for email functionality

## Features

- ✅ Email/password authentication
- ✅ User registration
- ✅ Password reset via email
- ✅ Password strength validation (frontend & backend)
- ✅ Real-time password strength indicator
- ✅ Session management
- ✅ Route protection and session-based navigation

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="mongodb://localhost:27017/buddy-budget"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"

# Email configuration (for password reset)
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="your-email@gmail.com"

```

### 2. Database Setup

To set up MongoDB Atlas:

1. Create a free account on [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a new project
3. Build a database cluster:
   - Choose the FREE shared cluster option
   - Select your preferred cloud provider and region
   - Choose M0 Sandbox (Free) for cluster tier
   - Give your cluster a name

4. Configure cluster access:
   - Add your IP address to IP Access List
   - Create a database user with read/write permissions

5. Get your connection string:
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string

6. Update your `.env` file:

### 3. Email Configuration

For Gmail:
1. Enable 2-factor authentication
2. Generate an app password
3. Use the app password in `EMAIL_SERVER_PASSWORD`

For other providers, update the SMTP settings accordingly.

### 4. Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to Credentials > Create Credentials > OAuth 2.0 Client IDs
5. Set Application type to "Web application"
6. Add authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
7. Copy Client ID and Client Secret to your `.env` file:
   ```
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   ```

### 5. Generate Prisma Client

```bash
npx prisma generate
```

### 6. Push Database Schema

```bash
npx prisma db push
```

## Usage

### Available Routes

- `/` - Splash screen with automatic session-based redirection
- `/login` - User login page (redirects to dashboard if already authenticated)
- `/signup` - User registration page (redirects to dashboard if already authenticated)
- `/forgot-password` - Password reset request page (redirects to dashboard if already authenticated)
- `/reset-password` - Password reset form (redirects to dashboard if already authenticated)
- `/dashboard` - Protected dashboard page (requires authentication)

### Authentication Components

- `LoginForm` - Login form component
- `SignupForm` - Registration form component
- `ForgotPasswordForm` - Password reset request form
- `ResetPasswordForm` - Password reset form
- `SplashScreen` - Animated loading screen with progress bar
- `AuthGuard` - Session-aware route protection component

### API Routes

- `POST /api/auth/signup` - User registration
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `/api/auth/[...nextauth]` - NextAuth.js endpoints


### Protecting Routes

```jsx
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

function ProtectedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.push("/login")
  }, [session, status, router])

  if (status === "loading") return <div>Loading...</div>
  if (!session) return null

  return <div>Protected content</div>
}
```

## Database Schema

The Prisma schema includes:

- **User** - User accounts with email, password, and profile info
- **Account** - OAuth account connections
- **Session** - User sessions
- **VerificationToken** - Email verification tokens

## Security Features

- Passwords are hashed with bcryptjs (12 rounds)
- Strong password requirements enforced:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter  
  - At least one number
  - At least one special character
- Real-time password strength validation
- Consistent validation on frontend and backend
- CSRF protection via NextAuth.js
- Secure session management
- Password reset tokens expire after 1 hour
- Email verification for sensitive actions

## Password Requirements

The system enforces strong password requirements:

1. **Length**: At least 8 characters
2. **Uppercase**: At least one uppercase letter (A-Z)
3. **Lowercase**: At least one lowercase letter (a-z)
4. **Numbers**: At least one digit (0-9)
5. **Special Characters**: At least one special character (!@#$%^&*()_+-=[]{}|;':\"\\,.<>/?)

### Password Strength Indicator

The password strength indicator provides real-time feedback:
- **Weak** (1-2 requirements): Red indicator
- **Fair** (3 requirements): Yellow indicator  
- **Good** (4 requirements): Blue indicator
- **Strong** (5 requirements): Green indicator

Users must meet all requirements to create an account or reset their password.

## Splash Screen & Route Protection

### Splash Screen Features

The splash screen provides a smooth user experience when entering the application:

- **Animated Logo**: App branding with typing animation
- **Progress Bar**: Visual loading feedback (0-100%)
- **Feature Preview**: Small icons showcasing app capabilities
- **Background Effects**: FlickeringGrid animation for visual appeal
- **Automatic Navigation**: Redirects based on authentication status

### AuthGuard Component

The `AuthGuard` component handles all session-based redirections:

```jsx
import { AuthGuard } from "@/components/auth-guard"

// Show splash screen and redirect based on session
<AuthGuard 
  showSplash={true}
  redirectIfAuthenticated={true}
  redirectAuthenticatedTo="/dashboard"
  redirectTo="/login"
>
  <YourComponent />
</AuthGuard>
```

### Higher-Order Components

Use these HOCs to easily protect routes:

```jsx
// For pages that require authentication
export default withAuth(DashboardPage)

// For pages that should redirect if authenticated
export default withGuest(LoginPage)
```

### Navigation Flow

1. **First Visit**: User sees splash screen → redirected to login
2. **Already Logged In**: User sees splash screen → redirected to dashboard
3. **Auth Pages**: If logged in, immediately redirected to dashboard
4. **Protected Pages**: If not logged in, redirected to login

## Customization

### Email Templates
Email templates can be customized in the forgot password API route (`/api/auth/forgot-password/route.js`).

### Authentication Providers
Additional providers can be added in `/lib/auth.js`.

## Production Deployment

1. Set strong NEXTAUTH_SECRET (use: `openssl rand -base64 32`)
2. Use production MongoDB database
3. Configure production email service
4. Update NEXTAUTH_URL to your domain
5. Ensure all environment variables are set
6. Run database migrations: `npx prisma db push` 