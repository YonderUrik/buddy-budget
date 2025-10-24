# Security Policy

## Our Commitment to Security

Buddy Budget is a privacy-first, open-source personal finance application. We take security seriously and are committed to protecting our users' financial data and privacy.

## Supported Versions

We currently support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

As we're in early development, we recommend always using the latest version from the `main` branch.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please report it privately using one of these methods:

### Preferred Method: GitHub Security Advisories

1. Go to the [Security Advisories page](https://github.com/YonderUrik/buddy-budget/security/advisories)
2. Click "Report a vulnerability"
3. Fill out the advisory form with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if known)


### What to Expect

- **Acknowledgment**: We'll acknowledge your report within 48 hours
- **Updates**: We'll keep you informed about our progress
- **Timeline**: We aim to release fixes within 7 days for critical issues, 30 days for others
- **Credit**: We'll credit you in the security advisory (unless you prefer anonymity)

## Security Best Practices

### For Users


#### Recommended Security Practices

1. **Keep your browser updated** - Use the latest version of your web browser
2. **Use HTTPS** - Always access the app via HTTPS in production
3. **Be cautious with extensions** - Browser extensions can access your data
4. **Regular backups** - Export your data regularly for backup
5. **Secure your device** - Use device encryption and screen locks

### For Developers

#### Development Security

1. **Dependencies**
   - Regularly update dependencies to patch vulnerabilities
   - Run `bun audit` to check for known vulnerabilities
   - Review dependency changes in pull requests

2. **Code Review**
   - All code changes require review before merging
   - Security-sensitive changes require extra scrutiny
   - Use automated security scanning in CI/CD

3. **API Security**
   - Never commit API keys or secrets to the repository
   - Use environment variables for sensitive configuration
   - Validate and sanitize all external API responses

4. **Input Validation**
   - Validate all user inputs on both client and server
   - Sanitize data before rendering
   - Use TypeScript for type safety

5. **Authentication & Authorization**
   - When user auth is added, use industry-standard libraries
   - Implement proper session management
   - Use HTTPS for all authentication flows

## API Security

### Yahoo Finance Integration

Buddy Budget integrates with Yahoo Finance for real-time stock data:

- **Read-only access** - We only fetch publicly available market data
- **Rate limiting** - Implement responsible API usage to avoid abuse
- **Error handling** - Gracefully handle API failures
- **No personal data** - Stock searches don't include personal information

**API Endpoints:**
- `/api/stocks/search` - Stock symbol search
- `/api/stocks/details` - Stock information
- `/api/stocks/historical` - Historical price data

All API routes validate inputs and handle errors securely.

## Data Privacy

### What Data We Collect

**In the current version**: None. All data stays in your browser's local storage.

**Future considerations** (if implemented):
- **Cloud sync** (optional) - Encrypted user data with explicit opt-in
- **Analytics** (optional) - Anonymous usage statistics with opt-in
- **Crash reports** (optional) - Anonymous error logs with opt-in

### Data Storage

- **Local Storage**: Browser's localStorage API (unencrypted by browser)
- **Session Data**: Temporary session storage cleared on exit
- **No Cookies**: We don't use tracking cookies
- **No Third-Party Tracking**: No analytics or tracking scripts

### Your Rights

- **Export**: Export all your data in JSON format
- **Delete**: Clear all local data with one click
- **Control**: Full control over your financial data
- **Transparency**: Open-source code for full visibility

## Vulnerability Disclosure Policy

### Coordinated Disclosure

We follow coordinated disclosure principles:

1. **Report received** - Researcher reports vulnerability privately
2. **Validation** - We validate and assess the impact
3. **Fix developed** - We develop and test a fix
4. **Researcher review** - We share the fix with the researcher
5. **Public disclosure** - We release the fix and publish an advisory
6. **Credit given** - We credit the researcher (if desired)

### Timeline

- **Critical vulnerabilities**: 7 days
- **High severity**: 30 days
- **Medium/Low severity**: 90 days

We may request an extension if the fix is complex or requires extensive testing.

## Security Features

### Current Implementation

- **TypeScript** - Type safety to prevent common vulnerabilities
- **ESLint** - Static analysis to catch security issues
- **Next.js Security** - Built-in security features from Next.js
- **CSP** - Content Security Policy headers (when deployed)
- **HTTPS** - Enforced HTTPS in production
- **Dependency Scanning** - Automated via GitHub Dependabot


## Dependency Management

### Automated Updates

We use **Dependabot** to keep dependencies up to date:

- **Security updates** - Automatic PRs for security patches
- **Version updates** - Regular dependency updates
- **Changelog review** - All updates reviewed before merging

### Manual Review

Critical dependencies are manually reviewed:
- Major version updates
- Security-sensitive packages
- Build tooling changes

### Vulnerability Scanning

```bash
# Check for vulnerabilities
bun audit

# Update dependencies
bun update

# Check outdated packages
bun outdated
```

## Secure Development Lifecycle

### Pre-Commit

- **Linting** - ESLint checks for code quality and security
- **Type checking** - TypeScript validation
- **Formatting** - Prettier for consistent code

### Pull Request

- **Code review** - All changes reviewed by maintainers
- **CI/CD checks** - Automated testing and linting
- **Build verification** - Ensure production build succeeds

### Deployment

- **HTTPS only** - All production traffic encrypted
- **Security headers** - Proper HTTP security headers
- **Dependency audit** - Pre-deployment vulnerability check
- **Environment variables** - Secrets never in source code


## Security Tools & Resources

### Recommended Tools

- **GitHub Security** - Dependabot, Secret Scanning, Code Scanning
- **npm audit / bun audit** - Dependency vulnerability scanning
- **Snyk** - Open-source security platform
- **OWASP ZAP** - Web application security scanner
- **Lighthouse** - Security audits for web apps

### Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/security)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [TypeScript Security](https://www.typescriptlang.org/docs/handbook/type-checking-javascript-files.html)

## Incident Response

In the event of a security incident:

1. **Immediate response** - Assess and contain the threat
2. **User notification** - Inform affected users if applicable
3. **Fix deployment** - Deploy patches as quickly as possible
4. **Post-mortem** - Analyze what happened and how to prevent it
5. **Transparency** - Publish incident report (when safe to do so)

## Security Hall of Fame

We recognize and thank security researchers who responsibly disclose vulnerabilities:

<!-- List of contributors will be added here -->

*Be the first to help make Buddy Budget more secure!*

## Questions?

If you have questions about this security policy:

- **General inquiries**: Open a [GitHub Discussion](https://github.com/YonderUrik/buddy-budget/discussions)
- **Security concerns**: Use private reporting methods above

## Updates to This Policy

This security policy may be updated periodically. Significant changes will be announced via:

- GitHub Security Advisories
- Repository README
- Release notes

---

**Last Updated**: 2025-10-24

**Version**: 1.0

Thank you for helping keep Buddy Budget and its users safe!
