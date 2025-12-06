# webresume.now

The fastest way to turn a static resume into a hosted, shareable web portfolio. Drop a PDF, get a link.

**Status**: Production Ready
**Version**: 1.0.0
**License**: MIT

---

## What is webresume.now?

webresume.now transforms your PDF resume into a beautiful, shareable web portfolio in under 60 seconds. No design skills, no coding, no hassle.

### Core Features

- **Upload & Parse**: Drop a PDF, AI extracts your information
- **Instant Publishing**: Get a clean URL immediately (webresume.now/yourname)
- **Privacy Controls**: Show/hide phone and address with one click
- **Professional Templates**: Clean, ATS-friendly design
- **Mobile Responsive**: Looks great on all devices
- **SEO Optimized**: Metadata, Open Graph tags, fast loading

---

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org) (App Router)
- **Runtime**: Cloudflare Workers (Node.js compatibility)
- **Database**: Cloudflare D1 (SQLite) with [Drizzle ORM](https://orm.drizzle.team)
- **Authentication**: [Better Auth](https://better-auth.com) (Google OAuth)
- **Storage**: Cloudflare R2 (S3-compatible)
- **AI Parsing**: [Replicate](https://replicate.com) (datalab-to/marker)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com)
- **UI Components**: [Radix UI](https://radix-ui.com)
- **Package Manager**: [Bun](https://bun.sh)

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed
- [Cloudflare](https://cloudflare.com) account with R2 and D1 enabled
- [Replicate](https://replicate.com) account
- [Google Cloud Console](https://console.cloud.google.com) project for OAuth

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/webresume.now.git
   cd webresume.now
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   Fill in your credentials (see [Environment Variables](#environment-variables) below).

4. **Set up D1 database**

   Run migrations locally:

   ```bash
   bun run db:migrate
   ```

   Run migrations for production:

   ```bash
   bun run db:migrate:prod
   ```

5. **Configure Google OAuth**

   Follow instructions in `docs/deployment-guide.md` to set up Google OAuth in Google Cloud Console.

6. **Run development server**

   ```bash
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

Required environment variables (see `.env.example` for full template):

```bash
# Better Auth
BETTER_AUTH_SECRET=your-random-secret-key
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudflare R2
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=webresume-uploads

# Replicate AI
REPLICATE_API_TOKEN=your-replicate-token

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Project Structure

```
app/
├── (auth)/              # Authentication routes
├── (public)/            # Public-facing pages
│   ├── [handle]/        # Dynamic resume viewer
│   └── page.tsx         # Homepage with upload
├── (protected)/         # Auth-required pages
│   ├── dashboard/       # User dashboard
│   ├── edit/            # Resume editor
│   ├── settings/        # User settings
│   ├── onboarding/      # Post-auth onboarding
│   └── waiting/         # AI processing waiting room
└── api/                 # API routes
    ├── upload/          # R2 presigned URLs
    ├── resume/          # Resume operations
    └── profile/         # Profile updates

components/
├── auth/                # Auth components
├── dashboard/           # Dashboard components
├── templates/           # Resume templates
└── ui/                  # Reusable UI components

lib/
├── db/                  # D1 database client and Drizzle schema
├── auth/                # Better Auth configuration
├── types/               # TypeScript types
└── utils/               # Utility functions
```

---

## Architecture

### The "Claim Check" Pattern

Allows anonymous users to upload before authentication:

1. Anonymous user uploads PDF to R2 with temp key
2. User logs in with Google OAuth
3. Claim API links upload to authenticated user
4. AI parsing triggered automatically

### Privacy by Default

- Phone numbers: HIDDEN by default
- Addresses: City/State only (full address hidden)
- Email: PUBLIC (uses mailto: links)
- User can toggle visibility in settings

### AI Parsing

Uses Replicate's `datalab-to/marker` model with structured JSON schema to extract:

- Full name, headline, summary
- Work experience (max 5 entries)
- Education, skills, certifications
- Contact information

Typical parsing time: 30-40 seconds for a 2-page resume.

---

## Available Scripts

```bash
# Development
bun run dev              # Start dev server

# Building
bun run build            # Build for production
bun run build:worker     # Build with Cloudflare adapter
bun run preview          # Preview Cloudflare build locally

# Deployment
bun run deploy           # Deploy to Cloudflare Workers

# Linting & Quality
bun run lint             # Run ESLint

# Database (D1 with Drizzle)
bun run db:migrate       # Run migrations locally
bun run db:migrate:prod  # Run migrations for production
bun run db:generate      # Generate migrations from schema
bun run db:studio        # Open Drizzle Studio
```

---

## Deployment

### Deploy to Cloudflare Workers

1. **Build the application**

   ```bash
   bun run build
   ```

2. **Generate Cloudflare Workers bundle**

   ```bash
   bunx opennextjs-cloudflare
   ```

3. **Deploy with Wrangler**

   ```bash
   bunx wrangler deploy
   ```

4. **Set environment variables**

   In Cloudflare Dashboard > Workers & Pages > Your Worker > Settings > Variables, add all environment variables from `.env.example`.

For detailed deployment instructions, see `docs/deployment-guide.md`.

---

## Security

- **Application-Level Authorization**: All data access controlled in application code
- **Rate Limiting**: 5 uploads/day, 10 updates/hour per user
- **Input Validation**: Zod schemas on all forms
- **XSS Protection**: React sanitization (default)
- **Middleware Protection**: Auth required for all protected routes
- **Encrypted Secrets**: Sensitive env vars encrypted in Cloudflare

---

## Performance

- **Build Time**: ~1.1 seconds
- **Bundle Size**: 102 kB shared, <220 kB largest page
- **TTFIS** (Time to First Interactive Site): <60 seconds
- **Page Load**: <2 seconds (homepage, public profile)

---

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Android)

---

## Documentation

Comprehensive documentation in `/docs`:

- **CLAUDE.md**: AI development context and guidelines
- **deployment-guide.md**: Complete deployment instructions
- **phase5-completion.md**: Feature completion report
- **testing-checklist.md**: Manual testing checklist
- **prd.md**: Product requirements document
- **tech-spec.md**: Technical specification
- **roadmap.md**: Development roadmap

---

## Testing

### Manual Testing

Follow the comprehensive checklist in `docs/testing-checklist.md` to test all flows:

- Anonymous upload flow
- Google OAuth authentication
- AI parsing and waiting room
- Dashboard and content preview
- Edit form with auto-save
- Settings and privacy controls
- Public profile rendering
- Security and rate limiting

### Running Tests Locally

1. **Test upload flow**
   - Visit `http://localhost:3000`
   - Upload a PDF resume (use a real 1-2 page resume)
   - Log in with Google
   - Verify claim and parsing

2. **Test editing**
   - Navigate to `/edit`
   - Make changes to content
   - Verify auto-save (3-second debounce)

3. **Test privacy controls**
   - Go to `/settings`
   - Toggle "Show phone" and "Show address"
   - Visit public profile to verify filtering

---

## Known Limitations (MVP)

1. **Single Template**: Only "Minimalist Creme" available (more coming)
2. **No Image Optimization**: Using native `<img>` tags (Cloudflare Workers constraint)
3. **No Custom Domains**: Users get `webresume.now/{handle}` only
4. **No PDF Export**: Can't export web resume back to PDF (future feature)

---

## Roadmap

### Phase 1 (Completed)

- Skeleton & plumbing (Next.js + D1 + Better Auth + Cloudflare)

### Phase 2 (Completed)

- Drop & claim loop (R2 upload + claim check pattern)

### Phase 3 (Completed)

- Public viewer with mock data

### Phase 4 (Completed)

- AI integration (Replicate parsing)

### Phase 5 (Completed)

- Polish & launch (edit, settings, final touches)

### Future Enhancements

- Multiple templates (Modern, Classic, Creative)
- Custom domains support
- PDF export from web resume
- Social sharing with OG images
- Theme customization (colors, fonts)
- Portfolio projects section
- ATS compatibility scoring

---

## Contributing

Contributions welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
4. Run `bun run lint` before committing
5. Ensure TypeScript builds without errors (`bun run build`)
6. Submit a pull request

---

## Troubleshooting

### Build Fails

**Error**: TypeScript compilation errors

**Solution**: Run `bun run build` and fix all type errors. Check `tsconfig.json` is properly configured.

---

### OAuth Redirect Loop

**Error**: Infinite redirect after Google login

**Solution**:

1. Verify `BETTER_AUTH_URL` includes `https://` for production
2. Check redirect URLs in Google Cloud Console match your domain
3. Clear browser cookies and try again

---

### R2 Upload Fails

**Error**: CORS error or 403 Forbidden

**Solution**:

1. Check R2 CORS policy includes your domain
2. Verify R2 API token has Read & Write permissions
3. Ensure `R2_BUCKET_NAME` matches actual bucket name

---

### Parsing Stuck

**Error**: Resume stuck in "processing" status

**Solution**:

1. Check Replicate API token is valid
2. Verify PDF is not corrupted (try re-uploading)
3. Use retry button on waiting room page
4. Check Replicate dashboard for job status

---

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/webresume.now/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/webresume.now/discussions)
- **Email**: support@webresume.now

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Next.js](https://nextjs.org) for the incredible framework
- [Better Auth](https://better-auth.com) for authentication
- [Drizzle ORM](https://orm.drizzle.team) for type-safe database access
- [Cloudflare](https://cloudflare.com) for Workers, D1, and R2
- [Replicate](https://replicate.com) for AI parsing
- [Radix UI](https://radix-ui.com) for accessible components
- [Tailwind CSS](https://tailwindcss.com) for styling

---

**Built with TypeScript, deployed on the edge, designed for speed.**

webresume.now - Your resume, reimagined.
