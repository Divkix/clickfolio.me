# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in webresume.now, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email security concerns to: **security@webresume.now** (or the repository maintainer)
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Assessment**: We will assess the vulnerability within 7 days
- **Resolution**: Critical vulnerabilities will be patched within 14 days
- **Credit**: We will credit you in the release notes (unless you prefer anonymity)

## Security Best Practices for Self-Hosting

When deploying your own instance, follow these security practices:

### Environment Variables

- **NEVER** commit `.env.local` or any file containing secrets to git
- Use `wrangler secret put` for production secrets on Cloudflare
- Rotate secrets periodically (especially `BETTER_AUTH_SECRET`)
- Use strong, unique values for all secrets:
  ```bash
  # Generate a secure secret
  openssl rand -base64 32
  ```

### Authentication

- Keep `GOOGLE_CLIENT_SECRET` strictly confidential
- Configure Google OAuth redirect URIs to match your exact domain
- Review Google Cloud Console access regularly

### R2 Storage

- Use separate R2 tokens for development and production
- Apply least-privilege permissions to R2 API tokens
- Enable R2 access logging for audit trails

### Database (D1)

- Never expose D1 database IDs in client-side code
- All database access is server-side only
- Authorization is enforced at the application level

### Rate Limiting

The application includes built-in rate limiting:
- 5 uploads per day per IP
- 10 content updates per hour per user

### Content Security

- All user input is validated with Zod schemas
- XSS protection via React's default sanitization
- PDF content is parsed server-side only

## Known Security Considerations

### Cloudflare Workers Environment

- No filesystem access (by design)
- All file operations use R2 presigned URLs
- Secrets are injected at runtime, not bundled

### OAuth Flow

- OAuth state parameter protects against CSRF
- Session tokens are HTTP-only cookies
- Better Auth handles token rotation automatically

## Third-Party Dependencies

We regularly update dependencies via Dependabot to address known vulnerabilities. Check `package.json` for current versions.

## Security Headers

The application sets appropriate security headers through Cloudflare Workers. For additional hardening, consider:

- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options

These can be configured in `middleware.ts` or via Cloudflare Page Rules.
