# Security Policy

## Our Commitment to Security

Buddy Budget is a privacy-first, open-source personal finance application. We take security seriously and are committed to protecting our users' financial data and privacy.

## Supported Versions

We currently support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

**Note:** We follow semantic versioning. As we're in active development, we recommend always using the latest stable release. Security patches are prioritized for the current major version (1.x.x).

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

### Alternative Method: Email

For security issues that cannot be reported via GitHub:

- **Email**: [roccafortedaniele28@gmail.com](mailto:roccafortedaniele28@gmail.com)
- **Subject**: `[SECURITY] Buddy Budget - [Brief Description]`

Please include:
- Detailed description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact assessment
- Proof of concept (if applicable)


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

## Data Privacy

### Data Storage Models

Buddy Budget offers two deployment options with different data storage approaches:

#### Hosted Version (buddybudget.io)

When using the hosted version:
- **Server-Side Storage**: Financial data is stored on our infrastructure
- **HTTPS Encryption**: All data transmitted over encrypted connections
- **Data Sovereignty**: We recommend self-hosting for complete data control
- **Privacy-Focused**: We do not sell or share your data with third parties
- **No Third-Party Tracking**: No analytics or tracking scripts

**What We Store**:
- Financial data you input (budgets, goals, tracked stocks)
- User preferences and settings
- Session information

**What We DON'T Store**:
- Bank account credentials (when integration is added)
- Unnecessary personal information
- Third-party cookies or tracking data

#### Self-Hosted Version

When self-hosting:
- **Full Control**: You own and control all your data
- **Your Infrastructure**: Choose your own hosting provider
- **Custom Security**: Configure security settings to your requirements
- **Data Privacy**: Your data never touches our servers
- **Complete Transparency**: Audit the entire codebase

See the [Self-Hosting Security](#self-hosting-security) section below.

---

## Self-Hosting Security

When deploying your own instance of Buddy Budget, follow these security best practices:

### Infrastructure Security

**Hosting Environment**:
- Use reputable hosting providers (Vercel, AWS, DigitalOcean, etc.)
- Enable HTTPS/TLS for all traffic (Let's Encrypt is free)
- Keep server OS and software updated
- Configure firewall rules to limit exposed ports
- Use strong passwords and SSH keys

**Database Security** (when applicable):
- Use managed database services with automatic backups
- Enable encryption at rest
- Restrict database access to application only
- Use strong, unique database passwords
- Regular automated backups with encryption

### Self-Hosted Support

For self-hosting security questions:
- Check our [Deployment Guide](README.md#deployment)
- Join [GitHub Discussions](https://github.com/YonderUrik/buddy-budget/discussions)
- Review [Security Best Practices](#security-best-practices)


---

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

---

## Data Breach Response Plan

### For Hosted Version (buddybudget.io)

In the unlikely event of a data breach on our hosted platform:

#### Immediate Actions (0-24 hours)

1. **Detection & Containment**
   - Identify the scope and nature of the breach
   - Isolate affected systems immediately
   - Preserve evidence for forensic analysis
   - Engage security incident response team

2. **Initial Assessment**
   - Determine what data was accessed or compromised
   - Identify affected users
   - Assess the severity level (Critical, High, Medium, Low)
   - Document timeline of events

3. **Emergency Response**
   - Patch vulnerabilities immediately
   - Rotate all secrets, API keys, and credentials
   - Enable additional monitoring and logging
   - Prepare communication plan

#### Short-term Response (24-72 hours)

4. **User Notification**
   - Email all affected users within 72 hours
   - Provide clear, honest details about what happened
   - Explain what data was compromised
   - Offer actionable steps users should take
   - Set up dedicated support channel

5. **Public Disclosure**
   - Publish security advisory on GitHub
   - Update website with incident details
   - Notify relevant authorities if legally required
   - Issue press release if breach is significant

6. **Mitigation Support**
   - Force password resets for all affected accounts
   - Offer credit monitoring if financial data exposed
   - Provide step-by-step security guidance
   - Set up dedicated incident FAQ

#### Long-term Response (1-4 weeks)

7. **Forensic Investigation**
   - Complete detailed forensic analysis
   - Identify root cause and attack vector
   - Document all findings
   - Engage third-party security audit if needed

8. **System Hardening**
   - Implement additional security controls
   - Conduct comprehensive security audit
   - Update security policies and procedures
   - Train team on lessons learned

9. **Transparency Report**
   - Publish detailed incident report
   - Share lessons learned with community
   - Document improvements implemented
   - Provide timeline and impact assessment

### User Communication Template

Users will receive communications in this format:

```
Subject: [URGENT] Security Incident Notification - Buddy Budget

Dear Buddy Budget User,

We are writing to inform you of a security incident that may have
affected your account.

WHAT HAPPENED:
[Clear description of the incident]

WHAT DATA WAS AFFECTED:
[Specific data types compromised]

WHAT WE'RE DOING:
[Actions we've taken]

WHAT YOU SHOULD DO:
1. [Specific action item]
2. [Specific action item]
3. [Specific action item]

We sincerely apologize for this incident and are committed to
preventing future occurrences.

For questions: security@yonderurik.dev
```

### For Self-Hosted Deployments

If you're running a self-hosted instance:

- **You are responsible** for security monitoring and incident response
- Follow your organization's incident response procedures
- We recommend having a plan before deploying
- Contact us if the breach is related to application code vulnerabilities

**Recommended Steps**:
1. Take affected systems offline immediately
2. Assess the breach scope
3. Contact your hosting provider
4. Review application and server logs
5. Report vulnerabilities to us via security@yonderurik.dev
6. Restore from clean backups after patching

---

Thank you for helping keep Buddy Budget and its users safe!
