# Clickfolio design system — how to build with it

Clickfolio turns a PDF resume into a hosted portfolio at `clickfolio.me/@handle`. The look is warm and editorial: cream backgrounds, a coral brand colour, Bricolage Grotesque display headings over Hanken Grotesk body text, and JetBrains Mono for handles and code.

## Setup
- Every component lives on `window.Clickfolio` (e.g. `const { Button, Card, Icons } = window.Clickfolio;`).
- Wrap each screen in `<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>`. For dark mode, put `className="dark"` on a wrapper; tokens are scoped to the `.dark` class, so a `<div className="dark bg-background text-foreground">` subtree renders dark.
- Icons: use `Icons.<Name>` (a curated lucide-react set, e.g. `Icons.Upload`, `Icons.Sparkles`, `Icons.ArrowRight`, `Icons.Check`). Check the Icons card for the full list; any icon not in it doesn't exist here. Brand marks are separate components: `GitHubIcon`, `LinkedInIcon`, `WhatsAppIcon`, `BehanceIcon`, `DribbbleIcon`.

## Styling: Tailwind 4 with semantic tokens only
- Style with Tailwind utility classes built on the semantic tokens. Never use raw hex values or the Tailwind palette (`bg-red-500`).
  - Surfaces: `bg-background`, `bg-card`, `bg-muted`, `bg-surface-2`, `bg-brand-subtle`
  - Text: `text-foreground`, `text-muted-foreground`, `text-brand`
  - Brand: `bg-brand text-brand-foreground`, `hover:bg-brand-hover`
  - Status: `success`, `warning`, `info` and `destructive` (as `bg-*`, `text-*` and `border-*`, plus opacity steps like `bg-success/10`)
  - Borders: `border-border`, `border-border-strong`
  - Charts: `chart-1` to `chart-5`
- Type: headings (`h1`–`h4`) get the display font automatically. Use `font-display` for display text on other elements, `font-mono` for handles and URLs, and `tabular-nums` for stats.
- The CSS is precompiled. The token families above, standard spacing, sizing and layout steps, and responsive `sm:`/`md:`/`lg:` prefixes are all available. **Arbitrary values (`w-[37rem]`, `bg-[#f00]`) don't exist**; use an inline `style` for one-offs.

## Composition
- Primary action: `<Button>` (variants: `default`, `outline`, `secondary`, `ghost`, `link`, `destructive`; sizes: `sm`, `default`, `lg`, `icon`, `icon-sm`, `icon-lg`; supports `loading`). Keep one primary action per view.
- Status pills: `<Badge variant="success|warning|info|destructive|brand|outline">`. For resume and user state in admin views, use `ResumeStatusBadge` and `UserStatusBadge`.
- Panels: `Card` > `CardHeader` > `CardTitle`, then `CardContent`. For form groups, use `FormSectionCard`.
- Dialogs: `Dialog` > `DialogTrigger` + `DialogContent` > `DialogHeader` > `DialogTitle` + `DialogDescription`.
- Marketing pages: open with `SiteHeader`, close with `Footer`, and use `Logo` for the wordmark. `FaqAccordion`, `StatsGrid`, `ComparisonTable` and `PostSection`/`PostList` cover long-form content.
- Toasts: render `<Toaster />` once and call `toast.success("Saved")` / `toast.error(...)` via `window.Clickfolio.toast`. Don't import sonner directly; that creates a separate toast store that never renders.
- Product flows: `FileDropzone` (resume upload), `WizardProgress` (onboarding steps), `SaveIndicator` (autosave), `ShareBar`/`SharePopover`/`CopyLinkButton` (sharing a portfolio link), `PersonCard`, `ExploreHeader` and `NoResults` (the /explore directory).
- Voice: short, confident and second-person ("Your portfolio is live"). Use realistic resume content: names, roles, companies, and `@handle`s.
