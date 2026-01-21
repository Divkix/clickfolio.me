# Contributing to webresume.now

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build something useful.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- [Node.js](https://nodejs.org) v20+ (for some tooling)
- [Cloudflare Account](https://cloudflare.com) with R2 and D1 enabled
- [Google Cloud Console](https://console.cloud.google.com) project for OAuth
- [OpenRouter](https://openrouter.ai) account for AI parsing (uses Gemini)

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/webresume.now.git
   cd webresume.now
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in your credentials. See `.env.example` for detailed instructions.

4. **Set up the database**

   ```bash
   bun run db:migrate
   ```

5. **Start the development server**

   ```bash
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

## Development Workflow

### Branch Naming

Use descriptive branch names:

- `feat/add-dark-mode` - New features
- `fix/oauth-redirect-loop` - Bug fixes
- `docs/update-readme` - Documentation updates
- `refactor/auth-middleware` - Code refactoring
- `chore/update-deps` - Maintenance tasks

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(templates): add dark mode template variant

fix(auth): resolve OAuth redirect loop on production

docs(readme): add self-hosting guide

chore(deps): update drizzle-orm to v0.35.0
```

### Code Quality

Before submitting a PR:

```bash
# Check types
bun run type-check

# Lint code
bun run lint

# Auto-fix issues
bun run fix

# Build to verify
bun run build
```

### Code Style

- **Formatter**: [Biome](https://biomejs.dev/)
- **Indentation**: 2 spaces (not tabs)
- **Quotes**: Double quotes
- **Semicolons**: Required
- **Trailing commas**: Required
- **Images**: Use `<img>` tags (not Next.js `<Image />`)

The Biome configuration is in `biome.json`. Run `bun run fix` to auto-format.

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** with clear, atomic commits
3. **Update documentation** if needed
4. **Run all checks** (`bun run ci`)
5. **Open a Pull Request** with:
   - Clear title following conventional commits
   - Description of changes
   - Screenshots for UI changes
   - Breaking changes noted

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-reviewed the code
- [ ] Types are correct (`bun run type-check`)
- [ ] Linting passes (`bun run lint`)
- [ ] Build succeeds (`bun run build`)
- [ ] Tested locally
- [ ] Documentation updated (if applicable)

## Project Structure

```
webresume.now/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth API routes
│   ├── (public)/          # Public pages (/, /[handle])
│   ├── (protected)/       # Auth-required pages
│   └── api/               # API routes
├── components/
│   ├── auth/              # Auth components
│   ├── dashboard/         # Dashboard components
│   ├── templates/         # Resume templates
│   └── ui/                # Reusable UI (shadcn/ui)
├── lib/
│   ├── auth/              # Better Auth config
│   ├── db/                # Drizzle schema and client
│   ├── schemas/           # Zod validation schemas
│   └── utils/             # Utility functions
├── migrations/            # D1 database migrations
└── public/                # Static assets
```

## Key Files

- `lib/db/schema.ts` - Database schema (Drizzle ORM)
- `lib/auth/index.ts` - Better Auth server configuration
- `lib/env.ts` - Environment variable handling
- `wrangler.jsonc` - Cloudflare Workers configuration
- `drizzle.config.ts` - Drizzle ORM configuration

## Testing

Currently, testing is manual. Follow the testing checklist:

1. **Upload flow**: Upload PDF, verify R2 storage
2. **Auth flow**: Google OAuth login/logout
3. **Parsing**: AI extraction and waiting room
4. **Editing**: Content editor with auto-save
5. **Privacy**: Toggle settings, verify public profile
6. **Responsive**: Test on mobile viewports

## Areas for Contribution

### Good First Issues

Look for issues labeled `good first issue` or `help wanted`.

### Feature Ideas

- Additional resume templates
- PDF export functionality
- Custom domain support
- Analytics dashboard
- Portfolio projects section
- Multi-language support

### Documentation

- Improve setup instructions
- Add API documentation
- Create video tutorials
- Translate documentation

### Bug Fixes

- Check open issues for bugs
- Fix TypeScript type issues
- Improve error handling
- Enhance accessibility

## Cloudflare Workers Constraints

Remember these limitations when contributing:

- **No `fs` module** - Use R2 for file operations
- **No Next.js `<Image />`** - Use `<img>` with CSS
- **No middleware D1 access** - Database in components/routes only
- **Edge runtime** - Keep bundle size small

## Questions?

- Open a [GitHub Discussion](https://github.com/divkix/webresume.now/discussions) for questions
- Open an [Issue](https://github.com/divkix/webresume.now/issues) for bugs
- Check existing issues before opening new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
