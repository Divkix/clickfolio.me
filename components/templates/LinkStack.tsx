import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A link-in-bio creator page: a narrow centered column, an avatar, a bio, then every resume
// section rendered as a stack of tappable rounded cards instead of conventional prose.

const VIOLET = "#7C5CFC";

function LinkCard({
  eyebrow,
  title,
  subtitle,
  href,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  href?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  const inner = (
    <>
      {eyebrow && (
        <p className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: VIOLET }}>
          {eyebrow}
        </p>
      )}
      <p className="font-bold break-words">{title}</p>
      {subtitle && <p className="text-sm text-[#6B6680] break-words">{subtitle}</p>}
      {children}
    </>
  );

  const cls =
    "block w-full rounded-2xl bg-white border border-[#ECE9F7] px-5 py-4 shadow-[0_1px_2px_rgba(60,40,120,0.04)] min-w-0";

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="ugc nofollow noopener noreferrer"
        className={`${cls} hover:border-[#7C5CFC] transition-colors`}
      >
        {inner}
      </a>
    );
  }

  return <div className={cls}>{inner}</div>;
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

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&display=swap" />
      <style>{`
        .font-ls-body, .font-ls-body :is(h1, h2, h3, p, li, dt, dd, a, span) { font-family: 'Quicksand', ui-sans-serif, sans-serif; }
      `}</style>
      <div
        className="font-ls-body min-h-screen text-[#2B2740] overflow-x-hidden"
        style={{
          backgroundImage: "linear-gradient(160deg, #F6F1FF 0%, #FDF2F8 50%, #F0F6FF 100%)",
        }}
      >
        <main className="mx-auto max-w-[26rem] px-5 pt-16 pb-24">
          <div className="text-center">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                width={88}
                height={88}
                className="w-[5.5rem] h-[5.5rem] rounded-full object-cover mx-auto ring-4 ring-white"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-[5.5rem] h-[5.5rem] rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white ring-4 ring-white"
                style={{ backgroundColor: VIOLET }}
              >
                {getInitials(full_name)}
              </div>
            )}
            <h1 className="mt-4 text-2xl font-bold break-words">{full_name}</h1>
            {headline && <p className="mt-1 text-[#6B6680] break-words">{headline}</p>}
            {summary && <p className="mt-3 text-sm leading-relaxed text-[#453F60]">{summary}</p>}

            {socialLinks.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {socialLinks.map((link) => (
                  <a
                    key={link.type}
                    href={link.href}
                    target="_blank"
                    rel="ugc nofollow noopener noreferrer"
                    className="text-[0.8125rem] font-bold rounded-full px-3.5 py-1.5 text-white"
                    style={{ backgroundColor: VIOLET }}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="mt-9 space-y-3">
            {(contact.email || contact.phone || contact.location) && (
              <LinkCard
                eyebrow="Reach me"
                title={[contact.email, contact.phone, contact.location].filter(Boolean).join(" · ")}
              />
            )}

            {experience?.map((job) => (
              <LinkCard
                key={`${job.company}-${job.title}-${job.start_date}`}
                eyebrow={formatDateSpan(job.start_date, job.end_date) ?? undefined}
                title={`${job.title} · ${job.company}`}
                subtitle={job.description || job.highlights?.[0]}
              />
            ))}

            {projects?.map((project) => (
              <LinkCard
                key={`${project.title}-${project.year ?? ""}`}
                eyebrow="Project"
                title={project.title}
                subtitle={project.description}
                href={project.url}
              />
            ))}

            {education?.map((edu) => (
              <LinkCard
                key={`${edu.institution}-${edu.degree}`}
                eyebrow={edu.graduation_date ? formatShortDate(edu.graduation_date) : "Education"}
                title={edu.degree}
                subtitle={edu.institution}
              />
            ))}

            {skillGroups.length > 0 && (
              <LinkCard eyebrow="Skills" title={skillGroups.flatMap((g) => g.items).join(" · ")} />
            )}

            {certifications?.map((cert) => (
              <LinkCard
                key={`${cert.name}-${cert.issuer ?? ""}`}
                eyebrow="Certification"
                title={cert.name}
                subtitle={cert.issuer}
                href={cert.url}
              />
            ))}
          </div>

          <footer className="mt-12 flex flex-col items-center gap-3">
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="link-stack"
            />
            <p className="text-[0.8125rem] text-[#6B6680]">@{profile.handle}</p>
          </footer>
        </main>
      </div>
    </>
  );
};
