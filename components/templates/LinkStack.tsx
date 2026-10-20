import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A link-in-bio creator page, built to feel native to the apps creators already use: a tilted
// sticker-stack of color-coded cards rather than a uniform white list, each type keeping its
// own hue so the page reads at a glance before anyone reads a word.

const INK = "#2B2740";

const TYPE_COLORS = {
  contact: "#7C5CFC",
  experience: "#2FB7A0",
  project: "#F0609A",
  education: "#F0A63B",
  skills: "#5B8DEF",
  certification: "#7C5CFC",
} as const;

const ROTATIONS = [-1.1, 0.9, -0.6, 1.3, -1.4, 0.6, -0.9, 1.1];

function LinkCard({
  index,
  color,
  eyebrow,
  title,
  subtitle,
  href,
}: {
  index: number;
  color: string;
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  href?: string;
}): React.ReactElement {
  const rotation = ROTATIONS[index % ROTATIONS.length] ?? 0;

  const inner = (
    <>
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl"
        style={{ backgroundColor: color }}
      />
      <div className="pl-4">
        {eyebrow && (
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.08em]" style={{ color }}>
            {eyebrow}
          </p>
        )}
        <p className="font-bold break-words text-[#201C33]">{title}</p>
        {subtitle && <p className="text-sm text-[#716C85] break-words">{subtitle}</p>}
      </div>
      {href && (
        <span
          aria-hidden="true"
          className="shrink-0 self-center text-lg font-bold opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
          style={{ color }}
        >
          →
        </span>
      )}
    </>
  );

  const cls =
    "group flex items-center gap-3 w-full rounded-2xl bg-white px-4 py-4 min-w-0 shadow-[0_6px_16px_-8px_rgba(43,39,64,0.18)] transition-transform hover:-translate-y-0.5 hover:rotate-0";

  const style = { transform: `rotate(${rotation}deg)` };

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="ugc nofollow noopener noreferrer"
        className={cls}
        style={style}
      >
        {inner}
      </a>
    );
  }

  return (
    <div className={cls} style={style}>
      {inner}
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

  const contactLinks = getContactLinks(contact);

  const socialLinks = contactLinks.filter(
    (l) => l.type !== "location" && l.type !== "email" && l.type !== "phone",
  );

  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];

  const cards: React.ReactElement[] = [];
  let cardIndex = 0;

  const pushCard = (card: Omit<Parameters<typeof LinkCard>[0], "index">) => {
    cards.push(<LinkCard key={cards.length} index={cardIndex} {...card} />);
    cardIndex += 1;
  };

  if (contact.email || contact.phone || contact.location) {
    pushCard({
      color: TYPE_COLORS.contact,
      eyebrow: "Reach me",
      title: [contact.email, contact.phone, contact.location].filter(Boolean).join(" · "),
    });
  }

  for (const job of experience ?? []) {
    pushCard({
      color: TYPE_COLORS.experience,
      eyebrow: formatDateSpan(job.start_date, job.end_date) ?? "Experience",
      title: `${job.title} · ${job.company}`,
      subtitle: job.description || job.highlights?.[0],
    });
  }

  for (const project of projects ?? []) {
    pushCard({
      color: TYPE_COLORS.project,
      eyebrow: "Project",
      title: project.title,
      subtitle: project.description,
      href: project.url,
    });
  }

  for (const edu of education ?? []) {
    pushCard({
      color: TYPE_COLORS.education,
      eyebrow: edu.graduation_date ? formatShortDate(edu.graduation_date) : "Education",
      title: edu.degree,
      subtitle: edu.institution,
    });
  }

  if (skillGroups.length > 0) {
    pushCard({
      color: TYPE_COLORS.skills,
      eyebrow: "Skills",
      title: skillGroups.flatMap((g) => g.items).join(" · "),
    });
  }

  for (const cert of certifications ?? []) {
    pushCard({
      color: TYPE_COLORS.certification,
      eyebrow: "Certification",
      title: cert.name,
      subtitle: cert.issuer,
      href: cert.url,
    });
  }

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" />
      <style>{`
        .font-ls-body, .font-ls-body :is(h1, h2, h3, p, li, dt, dd, a, span, button) { font-family: 'Plus Jakarta Sans', ui-sans-serif, sans-serif; }
      `}</style>
      <div className="font-ls-body min-h-screen text-[#2B2740] overflow-x-hidden bg-[#FBF8FF]">
        <main className="mx-auto max-w-[27rem] px-5 pt-16 pb-24">
          <div className="text-center">
            <div
              className="mx-auto w-24 h-24 rounded-full p-[3px]"
              style={{
                background:
                  "conic-gradient(from 180deg, #7C5CFC, #F0609A, #F0A63B, #5B8DEF, #7C5CFC)",
              }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  width={88}
                  height={88}
                  className="w-full h-full rounded-full object-cover ring-[3px] ring-[#FBF8FF]"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="w-full h-full rounded-full flex items-center justify-center text-2xl font-extrabold text-white ring-[3px] ring-[#FBF8FF]"
                  style={{ backgroundColor: INK }}
                >
                  {getInitials(full_name)}
                </div>
              )}
            </div>
            <h1 className="mt-4 text-[1.625rem] font-extrabold break-words">{full_name}</h1>
            {headline && (
              <p className="mt-1 text-[#716C85] font-semibold break-words">{headline}</p>
            )}
            {summary && (
              <p className="mt-3 text-sm leading-relaxed text-[#514C68] max-w-sm mx-auto">
                {summary}
              </p>
            )}

            {socialLinks.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                {socialLinks.map((link, i) => (
                  <a
                    key={link.type}
                    href={link.href}
                    target="_blank"
                    rel="ugc nofollow noopener noreferrer"
                    className="text-[0.8125rem] font-bold rounded-full px-4 py-1.5 text-white transition-transform hover:-translate-y-0.5"
                    style={{
                      backgroundColor:
                        Object.values(TYPE_COLORS)[i % Object.values(TYPE_COLORS).length],
                    }}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="mt-10 space-y-4">{cards}</div>

          <footer className="mt-12 flex flex-col items-center gap-3">
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="link-stack"
            />
            <p className="text-[0.8125rem] font-semibold text-[#9992AD]">@{profile.handle}</p>
          </footer>
        </main>
      </div>
    </>
  );
};
