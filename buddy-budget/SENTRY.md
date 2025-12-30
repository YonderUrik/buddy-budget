# Sentry.io Integration Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Configuration](#configuration)
4. [Sampling Rates](#sampling-rates)
5. [Error Filtering](#error-filtering)
6. [User Context](#user-context)
7. [Manual Error Tracking](#manual-error-tracking)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Overview

This application uses Sentry.io for error tracking and performance monitoring across three runtime environments:
- **Client-side** (Browser/React components)
- **Server-side** (Node.js API routes, Server Components)
- **Edge runtime** (Middleware)

### Key Features
- ✅ Free-tier optimized (6% error quota, 2.5% transaction quota)
- ✅ Aggressive error filtering to reduce noise
- ✅ Privacy-first (user ID only, no PII)
- ✅ Source maps for production debugging
- ✅ Automatic error capture + manual instrumentation

---

## Architecture

### File Structure

```
buddy-budget/
├── instrumentation.ts              # Entry point - loads configs based on runtime
├── sentry.client.config.ts         # Client-side (browser) configuration
├── sentry.server.config.ts         # Server-side (Node.js) configuration
├── sentry.edge.config.ts           # Edge runtime (middleware) configuration
├── lib/sentry/
│   ├── filters.ts                  # Shared error filtering logic
│   └── user-context.ts             # User context helpers (NextAuth → Sentry)
└── next.config.js                  # Wrapped with withSentryConfig
```

### How It Works

1. **Next.js Instrumentation Hook** (`instrumentation.ts`)
   - Automatically called by Next.js on startup
   - Checks `NEXT_RUNTIME` environment variable
   - Loads appropriate Sentry config (client/server/edge)

2. **Client-side** (`sentry.client.config.ts`)
   - Loaded in browser environment
   - Captures React errors, network errors, console errors
   - Tracks user interactions via breadcrumbs
   - Monitors page load performance

3. **Server-side** (`sentry.server.config.ts`)
   - Loaded in Node.js runtime (API routes)
   - Captures API errors, database errors
   - Tracks API response times

4. **Edge runtime** (`sentry.edge.config.ts`)
   - Loaded in Edge runtime (middleware)
   - Captures middleware errors
   - Lower sampling (runs on every request)

---

## Configuration

### Environment Variables

Required variables in `.env` (local) and Vercel (production):

```bash
# Required - Get from https://sentry.io/settings/projects/
SENTRY_DSN="https://your-key@o123456.ingest.sentry.io/123456"
SENTRY_ORG="your-org-slug"
SENTRY_PROJECT="buddy-budget"

# Optional - Only needed for production source maps
SENTRY_AUTH_TOKEN="your-auth-token"
```

#### Getting Your DSN
1. Go to https://sentry.io
2. Create or select your project
3. Navigate to **Settings → Projects → [Your Project] → Client Keys (DSN)**
4. Copy the DSN

#### Getting Auth Token (for source maps)
1. Go to **Settings → Auth Tokens**
2. Click **Create New Token**
3. Select scopes: `project:releases`, `org:read`
4. Copy token and add to Vercel environment variables

### Core Configuration Options

All three config files (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) support these options:

#### Basic Options

```typescript
Sentry.init({
  // DSN - Your project identifier
  dsn: process.env.SENTRY_DSN,

  // Environment (development, production, staging)
  environment: process.env.NODE_ENV || "development",

  // Only send errors in production (optional)
  enabled: process.env.NODE_ENV === "production",

  // Release tracking (automatic via Vercel)
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version,

  // Debug mode (verbose logging)
  debug: false, // Set to true for troubleshooting
});
```

#### Sampling Options

```typescript
Sentry.init({
  // Error sampling: 0.0 to 1.0 (0% to 100%)
  sampleRate: 0.75, // Capture 75% of errors

  // Performance monitoring: 0.0 to 1.0 (0% to 100%)
  tracesSampleRate: 0.2, // Capture 20% of transactions

  // Session replay (disabled in this setup)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
```

#### Filtering Options

```typescript
Sentry.init({
  // Array of error messages to ignore (string or RegExp)
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    /Network.*failed/i,
  ],

  // URLs to ignore errors from (client-side only)
  denyUrls: [
    /extensions\//i,
    /^chrome-extension:\/\//i,
  ],

  // Custom filtering function
  beforeSend(event, hint) {
    // Return null to drop the event
    if (shouldIgnoreError(hint.originalException)) {
      return null;
    }
    return event;
  },
});
```

---

## Sampling Rates

### Current Configuration

| Runtime | Errors (sampleRate) | Performance (tracesSampleRate) |
|---------|---------------------|--------------------------------|
| Client  | 75% (0.75)          | 20% (0.2)                      |
| Server  | 75% (0.75)          | 20% (0.2)                      |
| Edge    | 50% (0.5)           | 10% (0.1)                      |

### Why Different Rates?

- **Edge runtime** has lower sampling because middleware runs on **every request**
- **Client/Server** can afford higher sampling with low traffic (<1k users/month)

### When to Adjust

#### Increase Sampling (capture more data)
```typescript
// If you have very low traffic or upgraded Sentry plan
sampleRate: 1.0,              // 100% of errors
tracesSampleRate: 0.5,        // 50% of transactions
```

**Use when:**
- Debugging specific issues
- Upgraded to paid plan
- Traffic is very low (<100 users/month)

#### Decrease Sampling (reduce quota usage)
```typescript
// If approaching quota limits
sampleRate: 0.25,             // 25% of errors
tracesSampleRate: 0.05,       // 5% of transactions
```

**Use when:**
- Approaching free tier limits (5k errors, 10k transactions)
- Traffic increased unexpectedly
- Only need to catch critical errors

### Monitoring Quota Usage

Check quota usage at: https://sentry.io/settings/account/usage/

**Free Tier Limits:**
- 5,000 errors/month
- 10,000 transactions/month
- 30-day retention

**Alerts:**
- Set up email alerts at 80% quota usage
- Review quota weekly in Settings

---

## Error Filtering

### Why Filter Errors?

Filtering reduces noise and saves quota for meaningful errors. Common browser quirks, network issues, and third-party errors don't help debug your application.

### Current Filters

#### 1. Common Ignore Patterns (`lib/sentry/filters.ts`)

```typescript
export const commonIgnoreErrors = [
  // Browser quirks
  "ResizeObserver loop limit exceeded",
  "Hydration failed",

  // Network errors (user connectivity)
  "Network request failed",
  "Failed to fetch",

  // Browser extensions
  "chrome-extension://",
  "moz-extension://",

  // Ad blockers
  "adsbygoogle",

  // Navigation (user-initiated)
  "Navigation cancelled",
];
```

#### 2. Client-specific Filters (`sentry.client.config.ts`)

```typescript
// Ignore errors from third-party scripts
denyUrls: [
  /google-analytics\.com/i,
  /facebook\.net/i,
  /extensions\//i,
],
```

#### 3. Server-specific Filters (`sentry.server.config.ts`)

```typescript
ignoreErrors: [
  // Database timeouts (temporary issues)
  "ETIMEDOUT",
  "connection timeout",

  // User-specific errors
  "duplicate key error",
  "OAuthCallbackError",
],
```

### Adding Custom Filters

#### Method 1: Add to `ignoreErrors` array

```typescript
// In sentry.client.config.ts or sentry.server.config.ts
ignoreErrors: [
  ...commonIgnoreErrors,

  // Add your custom patterns
  "My specific error message",
  /pattern to match/i,
],
```

#### Method 2: Use `beforeSend` hook

```typescript
beforeSend(event, hint) {
  const error = hint.originalException;

  // Filter by error type
  if (error instanceof TypeError && error.message.includes("null")) {
    return null; // Don't send to Sentry
  }

  // Filter by URL
  if (event.request?.url?.includes("/health")) {
    return null;
  }

  // Filter by user
  if (event.user?.id === "test-user") {
    return null;
  }

  return event; // Send to Sentry
},
```

#### Method 3: Use shared filter function

```typescript
// In lib/sentry/filters.ts
export function shouldIgnoreError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Add your custom logic
  if (errorMessage.includes("MY_SPECIFIC_ERROR")) {
    return true;
  }

  return false;
}
```

---

## User Context

### Current Implementation

Sentry tracks **user ID only** from NextAuth sessions. No PII (email, name, image) is sent.

### How It Works

1. User signs in via OAuth (Google/GitHub/Apple)
2. `components/auth-sync.tsx` syncs user to database
3. `setSentryUser()` is called with session data
4. Only `user.id` is sent to Sentry

### Files Involved

- `lib/sentry/user-context.ts` - Helper functions
- `components/auth-sync.tsx` - Integration point

### Available Functions

#### `setSentryUser(session)`
Set user context from NextAuth session.

```typescript
import { setSentryUser } from "@/lib/sentry/user-context";

// In a component or API route
const session = await auth();
setSentryUser(session); // Only sends user.id to Sentry
```

#### `setSentryContext(data)`
Add non-PII metadata about the user.

```typescript
import { setSentryContext } from "@/lib/sentry/user-context";

setSentryContext({
  onboardingCompleted: true,
  onboardingStep: "COMPLETED",
  provider: "google",
});
```

This metadata appears in Sentry under "Additional Data" → "user_metadata".

#### `clearSentryUser()`
Clear user context on sign out.

```typescript
import { clearSentryUser } from "@/lib/sentry/user-context";

// In sign out handler
clearSentryUser();
```

### Adding More Context (Non-PII Only)

```typescript
// In setSentryContext() or directly
Sentry.setContext("subscription", {
  plan: "free",
  features: ["dashboard", "portfolio"],
});

Sentry.setTag("user_role", "premium");
```

**Important:** Never add PII like:
- Email addresses
- Full names
- Phone numbers
- Credit card info
- IP addresses

---

## Manual Error Tracking

### Capturing Errors Manually

#### In API Routes

```typescript
import * as Sentry from "@sentry/nextjs";

export async function POST(request: NextRequest) {
  try {
    // Your code
    throw new Error("Something went wrong");
  } catch (error) {
    // Capture with context
    Sentry.captureException(error, {
      tags: {
        api_route: "/api/my-route",
        method: "POST",
      },
      extra: {
        requestBody: await request.json(), // Be careful with PII!
      },
    });

    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

#### In Server Components

```typescript
import * as Sentry from "@sentry/nextjs";

export default async function MyPage() {
  try {
    const data = await fetchData();
    return <div>{data}</div>;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "MyPage" },
    });
    throw error; // Re-throw to show error.tsx
  }
}
```

#### In Client Components

```typescript
"use client";

import * as Sentry from "@sentry/nextjs";

export function MyComponent() {
  const handleClick = async () => {
    try {
      await doSomething();
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: "button_click" },
      });
      // Show user-friendly error message
    }
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

### Capturing Messages (Non-Errors)

```typescript
// Info message
Sentry.captureMessage("User completed onboarding", "info");

// Warning message
Sentry.captureMessage("API rate limit approaching", "warning");

// With extra data
Sentry.captureMessage("Payment processed", {
  level: "info",
  tags: { payment_method: "stripe" },
  extra: { amount: 99.99 },
});
```

### Adding Breadcrumbs

Breadcrumbs are like a trail of events leading up to an error.

```typescript
import * as Sentry from "@sentry/nextjs";

// Add breadcrumb manually
Sentry.addBreadcrumb({
  category: "user_action",
  message: "User clicked upgrade button",
  level: "info",
  data: {
    plan: "premium",
  },
});

// Later, when an error occurs, this breadcrumb will be attached
```

### Performance Monitoring

```typescript
import * as Sentry from "@sentry/nextjs";

// Wrap expensive operations
const transaction = Sentry.startTransaction({
  op: "db.query",
  name: "Fetch user portfolio",
});

try {
  const portfolio = await prisma.portfolio.findMany();
  transaction.setStatus("ok");
  return portfolio;
} catch (error) {
  transaction.setStatus("internal_error");
  throw error;
} finally {
  transaction.finish();
}
```

---

## Testing

### Local Testing

#### 1. Enable Sentry in Development

By default, Sentry is disabled in development. To test locally:

```typescript
// In sentry.client.config.ts (temporarily)
enabled: true, // Remove "process.env.NODE_ENV === 'production'" check
```

#### 2. Create Test Errors

**Client-side test:**
```typescript
// Add to any page temporarily
<button onClick={() => {
  throw new Error("Test client error");
}}>
  Test Error
</button>
```

**Server-side test:**
```typescript
// Create /app/api/test-sentry/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export async function GET() {
  Sentry.captureException(new Error("Test server error"));
  return NextResponse.json({ error: "Test" }, { status: 500 });
}
```

**Edge runtime test:**
```typescript
// In middleware.ts (temporarily)
export default auth((req) => {
  if (req.nextUrl.pathname === "/test-edge") {
    throw new Error("Test edge error");
  }
  // ... rest of middleware
});
```

#### 3. Verify in Sentry Dashboard

1. Go to https://sentry.io
2. Select your project
3. Navigate to **Issues**
4. You should see your test errors appear within 1-2 minutes

### Production Testing

#### 1. Deploy with Environment Variables

Ensure these are set in Vercel:
- `SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

#### 2. Trigger Test Error

Use the same test routes as above on production.

#### 3. Verify Source Maps

1. Check Sentry error details
2. Stack trace should show **unminified code** with original file names
3. If showing minified code (e.g., `chunk-abc123.js`), source maps aren't working

**Fix source maps:**
```bash
# Verify SENTRY_AUTH_TOKEN is set in Vercel
# Check build logs for "Uploading source maps to Sentry"
# Ensure next.config.js has withSentryConfig wrapper
```

---

## Troubleshooting

### Common Issues

#### 1. Errors Not Appearing in Sentry

**Check:**
- Is `enabled: true` or `process.env.NODE_ENV === "production"`?
- Is `SENTRY_DSN` set correctly?
- Are errors being filtered by `ignoreErrors` or `beforeSend`?
- Check browser console for Sentry initialization errors

**Debug:**
```typescript
// Enable debug mode temporarily
debug: true,
```

#### 2. Source Maps Not Working

**Symptoms:** Stack traces show minified code (e.g., `chunk-123.js:1:234`)

**Solutions:**
- Verify `SENTRY_AUTH_TOKEN` is set in Vercel environment variables
- Check Vercel build logs for "Uploading source maps" message
- Ensure `withSentryConfig` is wrapping `nextConfig` in `next.config.js`
- Check Sentry project settings → Source Maps

**Manual upload:**
```bash
npx sentry-cli releases files buddy-budget@<version> upload-sourcemaps .next
```

#### 3. Too Many Errors (Quota Exceeded)

**Solutions:**
1. Lower sampling rates:
   ```typescript
   sampleRate: 0.25,          // 25%
   tracesSampleRate: 0.05,    // 5%
   ```

2. Add more filters to `ignoreErrors`

3. Use `beforeSend` to filter aggressively:
   ```typescript
   beforeSend(event, hint) {
     // Only send critical errors
     if (event.level !== "error" && event.level !== "fatal") {
       return null;
     }
     return event;
   }
   ```

#### 4. User Context Not Attached

**Symptoms:** Errors in Sentry don't show user ID

**Check:**
- Is user authenticated when error occurs?
- Is `setSentryUser()` called in `components/auth-sync.tsx`?
- Check browser console for Sentry errors

**Debug:**
```typescript
// In components/auth-sync.tsx
console.log("Setting Sentry user:", session.user.id);
setSentryUser(session);
```

#### 5. TypeScript Errors

**Common:**
```
Property 'tracePropagationTargets' does not exist...
```

**Solution:** Update `@sentry/nextjs` to latest version:
```bash
npm install @sentry/nextjs@latest --legacy-peer-deps
```

---

## Best Practices

### 1. Error Handling Strategy

**Do:**
- ✅ Capture errors at API route level (already implemented)
- ✅ Let errors bubble to global error boundary
- ✅ Add tags to categorize errors
- ✅ Include non-PII context

**Don't:**
- ❌ Capture the same error multiple times
- ❌ Send PII (email, name, passwords)
- ❌ Capture expected errors (validation, 404s)
- ❌ Log sensitive data in `extra` field

### 2. Performance Monitoring

**Do:**
- ✅ Monitor API response times (automatic)
- ✅ Track database queries with custom spans
- ✅ Monitor page load times (automatic)

**Don't:**
- ❌ Set `tracesSampleRate: 1.0` in production (waste of quota)
- ❌ Create transactions for every function call
- ❌ Track trivial operations (<10ms)

### 3. Quota Management

**Weekly:**
- Check quota usage: https://sentry.io/settings/account/usage/
- Review top errors and fix recurring issues
- Adjust filters if seeing too much noise

**Monthly:**
- Review error trends
- Update `ignoreErrors` based on patterns
- Adjust sampling rates if needed

### 4. Security

**Always:**
- ✅ Use `beforeSend` to scrub sensitive data
- ✅ Only track user ID (no email/name)
- ✅ Remove authorization headers from requests
- ✅ Sanitize error messages (remove tokens, keys)

**Never:**
- ❌ Send passwords, API keys, credit cards
- ❌ Log full request bodies (may contain PII)
- ❌ Include customer data in error messages
- ❌ Disable PII scrubbing

### 5. Maintenance

**After Every Deploy:**
- Verify source maps uploaded (check Sentry)
- Monitor for new error patterns (first 24 hours)
- Check quota usage spike

**Quarterly:**
- Update Sentry SDK: `npm update @sentry/nextjs`
- Review and clean up old filters
- Audit PII protection (search errors for sensitive data)

---

## Quick Reference

### Useful Links

- **Sentry Dashboard:** https://sentry.io
- **Project Settings:** https://sentry.io/settings/projects/
- **Quota Usage:** https://sentry.io/settings/account/usage/
- **Sentry Docs:** https://docs.sentry.io/platforms/javascript/guides/nextjs/

### Common Commands

```bash
# Update Sentry SDK
npm update @sentry/nextjs --legacy-peer-deps

# Test build with Sentry
npm run build

# Upload source maps manually
npx sentry-cli releases files <release> upload-sourcemaps .next
```

### Configuration Files Quick Reference

| File | Purpose | Sampling |
|------|---------|----------|
| `instrumentation.ts` | Entry point, loads configs | N/A |
| `sentry.client.config.ts` | Browser errors | 75% / 20% |
| `sentry.server.config.ts` | API errors | 75% / 20% |
| `sentry.edge.config.ts` | Middleware errors | 50% / 10% |
| `lib/sentry/filters.ts` | Shared filters | N/A |
| `lib/sentry/user-context.ts` | User tracking | N/A |

### Environment Variables

| Variable | Required | Where | Purpose |
|----------|----------|-------|---------|
| `SENTRY_DSN` | Yes | All | Project identifier |
| `SENTRY_ORG` | Yes | Vercel | Organization slug |
| `SENTRY_PROJECT` | Yes | Vercel | Project slug |
| `SENTRY_AUTH_TOKEN` | Production | Vercel | Source map uploads |

---

## Support

### Getting Help

1. **Sentry Documentation:** https://docs.sentry.io
2. **Sentry Support:** https://sentry.io/support/
3. **GitHub Issues:** https://github.com/getsentry/sentry-javascript/issues

### Debugging Checklist

- [ ] Is `SENTRY_DSN` set correctly?
- [ ] Is Sentry enabled (`enabled: true`)?
- [ ] Are errors being filtered too aggressively?
- [ ] Is `debug: true` set for verbose logging?
- [ ] Are source maps uploading (check build logs)?
- [ ] Is quota exceeded (check usage dashboard)?
- [ ] Is user authenticated when setting context?

---

**Last Updated:** 2025-12-29
**Sentry SDK Version:** @sentry/nextjs ^8.x
**Next.js Version:** 15.4.10
