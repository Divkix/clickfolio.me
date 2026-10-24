import { LINK_REL } from "./shared/ExternalLink";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A link-in-bio page built as one tall stack of full-width bars. Every bar is a tap target: a
// link opens, a role unfolds. The bars run as a single colour ramp from ultramarine down to
// peach, so the order of the page (links first, then work, then the rest) is visible as colour
// before anyone reads a word. Wide display type and edge-to-edge bands keep it from reading as
// a column of rounded buttons, and on desktop the bands simply run across the full window.

const INK = "#160F3D";

// Ramp steps with the text colour that clears WCAG AA (4.5:1) on each. White runs out of
// contrast after the magenta step, so the warm half flips to ink.
const RAMP: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: "#2A1FC7", fg: "#FFFFFF" },
  { bg: "#4B21C9", fg: "#FFFFFF" },
  { bg: "#6A1FC4", fg: "#FFFFFF" },
  { bg: "#8A1CB8", fg: "#FFFFFF" },
  { bg: "#A81AA0", fg: "#FFFFFF" },
  { bg: "#C21F84", fg: "#FFFFFF" },
  { bg: "#D42A7A", fg: "#FFFFFF" },
  { bg: "#F24A62", fg: INK },
  { bg: "#FF7466", fg: INK },
  { bg: "#FF9A74", fg: INK },
  { bg: "#FFBE8F", fg: INK },
  { bg: "#FFD9A8", fg: INK },
];

function rampAt(index: number, total: number): { bg: string; fg: string } {
  const last = RAMP.length - 1;
  const step = total <= 1 ? 0 : Math.round((index / (total - 1)) * last);

  return RAMP[step] ?? RAMP[0];
}

interface BarText {
  title: string;
  sub?: string;
  note?: string;
  meta?: string;
}

type BarSpec =
  | (BarText & { kind: "link"; href: string; external: boolean })
  | (BarText & { kind: "open"; body: React.ReactNode })
  | (BarText & { kind: "plain" });

interface Group {
  label?: string;
  bars: BarSpec[];
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

function ArrowIcon(): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="ls-icon ls-arrow"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

function PlusIcon(): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="ls-icon ls-plus"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function BarFace({ bar, icon }: { bar: BarSpec; icon?: React.ReactNode }): React.ReactElement {
  return (
    <div className="ls-row">
      <p className="ls-meta">{bar.meta}</p>
      <div className="min-w-0">
        <h3 className="ls-display ls-title">{bar.title}</h3>
        {bar.sub && <p className="ls-sub">{bar.sub}</p>}
        {bar.note && <p className="ls-note">{bar.note}</p>}
      </div>
      <span className="ls-icon-slot">{icon}</span>
    </div>
  );
}

function Bar({ bar, color }: { bar: BarSpec; color: { bg: string; fg: string } }) {
  const style = { backgroundColor: color.bg, color: color.fg };

  if (bar.kind === "link") {
    return (
      <a
        href={bar.href}
        className="ls-bar ls-tap"
        style={style}
        {...(bar.external ? { target: "_blank", rel: LINK_REL } : {})}
      >
        <BarFace bar={bar} icon={<ArrowIcon />} />
      </a>
    );
  }

  if (bar.kind === "open") {
    return (
      <details className="ls-bar" style={style}>
        <summary className="ls-tap">
          <BarFace bar={bar} icon={<PlusIcon />} />
        </summary>
        <div className="ls-body">{bar.body}</div>
      </details>
    );
  }

  return (
    <div className="ls-bar" style={style}>
      <BarFace bar={bar} />
    </div>
  );
}

export const LinkStack: React.FC<TemplateProps> = ({ content, profile }) => {
  const {
    full_name,
    summary,
    headline,
    contact,
    experience,
    education,
    skills,
    certifications,
    projects,
  } = content;

  const groups: Group[] = [];

  const linkBars: BarSpec[] = getContactLinks(contact)
    .filter((link) => link.type !== "location")
    .map((link) => {
      if (link.type === "email") {
        return { kind: "link", title: "Email", sub: link.label, href: link.href, external: false };
      }

      if (link.type === "phone") {
        return { kind: "link", title: "Call", sub: link.label, href: link.href, external: false };
      }

      return {
        kind: "link",
        title: link.label,
        sub: stripProtocol(link.href),
        href: link.href,
        external: true,
      };
    });

  if (linkBars.length > 0) groups.push({ bars: linkBars });

  const projectBars: BarSpec[] = (projects ?? []).map((project) => {
    const tools = project.technologies?.filter(Boolean).join(", ");
    const note = tools ? `Made with ${tools}` : undefined;
    const sub = project.description;
    const meta = project.year ? formatYear(project.year) : undefined;

    return project.url
      ? { kind: "link", title: project.title, sub, note, meta, href: project.url, external: true }
      : { kind: "plain", title: project.title, sub, note, meta };
  });

  if (projectBars.length > 0) groups.push({ label: "Projects", bars: projectBars });

  const workBars: BarSpec[] = (experience ?? []).map((job) => {
    const meta = formatDateSpan(job.start_date, job.end_date) ?? undefined;
    const sub = [job.company, job.location].filter(Boolean).join(", ");
    const highlights = job.highlights?.filter(Boolean) ?? [];

    if (!job.description && highlights.length === 0) {
      return { kind: "plain", title: job.title, sub, meta };
    }

    return {
      kind: "open",
      title: job.title,
      sub,
      meta,
      body: (
        <>
          {job.description && <p>{job.description}</p>}
          {highlights.length > 0 && (
            <ul>
              {highlights.map((highlight, i) => (
                <li key={i}>{highlight}</li>
              ))}
            </ul>
          )}
        </>
      ),
    };
  });

  if (workBars.length > 0) groups.push({ label: "Work", bars: workBars });

  const educationBars: BarSpec[] = (education ?? []).map((edu) => ({
    kind: "plain",
    title: edu.degree,
    sub: [edu.institution, edu.gpa ? `GPA ${edu.gpa}` : ""].filter(Boolean).join(", "),
    meta: edu.graduation_date ? formatShortDate(edu.graduation_date) : undefined,
  }));

  if (educationBars.length > 0) groups.push({ label: "Education", bars: educationBars });

  const certBars: BarSpec[] = (certifications ?? []).map((cert) => {
    const meta = cert.date ? formatShortDate(cert.date) : undefined;
    const sub = cert.issuer || undefined;

    return cert.url
      ? { kind: "link", title: cert.name, sub, meta, href: cert.url, external: true }
      : { kind: "plain", title: cert.name, sub, meta };
  });

  if (certBars.length > 0) groups.push({ label: "Certifications", bars: certBars });

  const skillBars: BarSpec[] = (skills ?? [])
    .filter((group) => group.items.length > 0)
    .map((group) => ({ kind: "plain", title: group.category, sub: group.items.join(", ") }));

  if (skillBars.length > 0) groups.push({ label: "Skills", bars: skillBars });

  const total = groups.reduce((sum, group) => sum + group.bars.length, 0);
  let barIndex = 0;

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Hanken+Grotesk:wght@400;500;600&display=swap" />
      <style>{`
        .ls-root, .ls-root :is(p, li, a, span, summary) { font-family: 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif; }
        .ls-root .ls-display { font-family: 'Unbounded', 'Arial Black', ui-sans-serif, sans-serif; }
        .ls-wrap { width: 100%; max-width: 76rem; margin-inline: auto; padding-inline: 1.25rem; }
        .ls-bar { display: block; }
        .ls-tap { display: block; cursor: pointer; list-style: none; text-decoration: none; color: inherit; }
        .ls-tap::-webkit-details-marker { display: none; }
        .ls-tap:focus-visible { outline: 3px solid currentColor; outline-offset: -7px; }
        .ls-row {
          max-width: 76rem; margin-inline: auto; padding: 1.15rem 1.25rem;
          display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 1rem; align-items: center;
        }
        .ls-meta { grid-column: 1 / -1; font-size: 0.8125rem; font-weight: 600; font-variant-numeric: tabular-nums; margin: 0 0 0.3rem; }
        .ls-meta:empty { display: none; }
        .ls-title { font-size: 1.15rem; font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; overflow-wrap: anywhere; margin: 0; }
        .ls-sub { font-size: 0.9375rem; font-weight: 500; line-height: 1.45; margin: 0.35rem 0 0; overflow-wrap: anywhere; max-width: 62ch; }
        .ls-note { font-size: 0.8125rem; font-weight: 600; margin: 0.4rem 0 0; overflow-wrap: anywhere; }
        .ls-icon-slot { display: flex; justify-content: flex-end; }
        .ls-icon { width: 1.75rem; height: 1.75rem; transition: transform 180ms ease; }
        .ls-tap:hover .ls-arrow, .ls-tap:focus-visible .ls-arrow { transform: translate(3px, -3px); }
        details[open] > .ls-tap .ls-plus { transform: rotate(45deg); }
        .ls-tap:hover { filter: brightness(1.06); }
        .ls-body { max-width: 76rem; margin-inline: auto; padding: 0 1.25rem 1.5rem; font-size: 0.9375rem; line-height: 1.6; }
        .ls-body > * { max-width: 62ch; }
        .ls-body p { margin: 0 0 0.75rem; }
        .ls-body ul { margin: 0; padding-left: 1.1rem; list-style: square; }
        .ls-body li { margin-top: 0.35rem; overflow-wrap: anywhere; }
        .ls-strip { padding-block: 1.75rem 0.75rem; }
        .ls-name { font-size: clamp(2.5rem, 12vw, 6.5rem); font-weight: 800; line-height: 0.98; letter-spacing: -0.035em; overflow-wrap: anywhere; }
        @media (min-width: 768px) {
          .ls-wrap, .ls-row, .ls-body { padding-inline: 2.5rem; }
          .ls-row { grid-template-columns: 11rem minmax(0, 1fr) auto; column-gap: 2rem; padding-block: 1.35rem; }
          .ls-meta { grid-column: auto; margin: 0; align-self: center; font-size: 0.875rem; }
          .ls-meta:empty { display: block; }
          .ls-title { font-size: clamp(1.5rem, 2.6vw, 2.5rem); }
          .ls-icon { width: 2.25rem; height: 2.25rem; }
          .ls-body { padding-left: calc(2.5rem + 11rem + 2rem); padding-bottom: 2rem; }
          .ls-strip { padding-block: 2.5rem 1rem; }
        }
        @media (prefers-reduced-motion: reduce) { .ls-icon { transition: none; } }
      `}</style>
      <div className="ls-root min-h-screen overflow-x-hidden" style={{ backgroundColor: INK }}>
        <header className="ls-wrap pt-14 pb-10 md:pt-16 md:pb-14 text-white">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-end md:gap-12">
            <div className="min-w-0">
              {profile.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt=""
                  width={88}
                  height={88}
                  className="mb-6 h-[5.5rem] w-[5.5rem] rounded-2xl object-cover"
                />
              )}
              <h1 className="ls-display ls-name">{full_name}</h1>
            </div>
            <div className="min-w-0 md:pb-2">
              {headline && (
                <p className="text-lg font-semibold leading-snug break-words md:text-xl">
                  {headline}
                </p>
              )}
              {summary && (
                <p className="mt-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-white/80 break-words">
                  {summary}
                </p>
              )}
              {contact.location && (
                <p className="mt-4 text-sm font-medium text-white/70 break-words">
                  Based in {contact.location}
                </p>
              )}
            </div>
          </div>
        </header>

        <div>
          {groups.map((group, groupIndex) => (
            <section key={group.label ?? "links"} aria-label={group.label ?? "Links"}>
              {group.label && (
                <div className="ls-wrap ls-strip">
                  <h2 className="ls-display text-sm font-medium text-white/75 md:text-base">
                    {group.label}
                  </h2>
                </div>
              )}
              {group.bars.map((bar) => {
                const color = rampAt(barIndex, total);
                barIndex += 1;

                return <Bar key={`${groupIndex}-${barIndex}`} bar={bar} color={color} />;
              })}
            </section>
          ))}
        </div>

        <footer className="ls-wrap flex flex-col items-start gap-4 pt-14 pb-20 md:flex-row md:items-center md:justify-between">
          <p className="ls-display text-base font-medium text-white/75 break-all">
            @{profile.handle}
          </p>
          <ShareBar
            handle={profile.handle}
            title={`${full_name}'s Portfolio`}
            name={full_name}
            variant="link-stack"
          />
        </footer>
      </div>
    </>
  );
};
