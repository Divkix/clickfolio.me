import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A fashion-magazine masthead, not a ledger: a full-bleed name treatment up top, a single
// elegant column below, thin gold-foil hairlines, small-caps letterspaced heads.

const GOLD = "#C9A86A";

function Masthead({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <h2
      className="text-[0.75rem] font-semibold uppercase tracking-[0.3em] pb-3 mb-7 border-b"
      style={{ color: GOLD, borderColor: `${GOLD}40` }}
    >
      {children}
    </h2>
  );
}

export const Noir: React.FC<TemplateProps> = ({ content, profile }) => {
  const { full_name, summary, headline, contact, experience, education, skills, certifications, projects } =
    content;

  const contactLinks = getContactLinks(contact);
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,400&family=Jost:wght@400;500&display=swap" />
      <style>{`
        .font-nr-head, .font-nr-head :is(h1, h2, h3) { font-family: 'Playfair Display', Georgia, serif; }
        .font-nr-body, .font-nr-body :is(p, li, dt, dd, a, span) { font-family: 'Jost', ui-sans-serif, sans-serif; }
      `}</style>
      <div className="font-nr-body font-nr-head min-h-screen bg-[#0A0A0A] text-[#E7E4DC] overflow-x-hidden">
        <header className="px-5 sm:px-8 pt-20 pb-14 text-center border-b" style={{ borderColor: `${GOLD}2A` }}>
          <p
            className="text-[0.75rem] uppercase tracking-[0.35em]"
            style={{ color: GOLD }}
          >
            Portfolio
          </p>
          <h1 className="mt-4 text-[clamp(2.75rem,9vw,5rem)] font-medium leading-[0.95] break-words">
            {full_name}
          </h1>
          {headline && (
            <p className="font-nr-body mt-5 text-lg italic text-[#B8B3A6] max-w-xl mx-auto break-words">
              "{headline}"
            </p>
          )}
          {contact.location && (
            <p className="font-nr-body mt-3 text-sm uppercase tracking-[0.15em] text-[#8A8578]">
              {contact.location}
            </p>
          )}
        </header>

        <main className="mx-auto max-w-[36rem] px-5 sm:px-8 py-16">
          {contactLinks.filter((l) => l.type !== "location").length > 0 && (
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm mb-14">
              {contactLinks
                .filter((l) => l.type !== "location")
                .map((link) => (
                  <li key={link.type} className="min-w-0 break-all">
                    {link.href ? (
                      <a
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                        className="hover:underline"
                        style={{ color: GOLD }}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span className="text-[#B8B3A6]">{link.label}</span>
                    )}
                  </li>
                ))}
            </ul>
          )}

          {summary && (
            <p className="text-[1.0625rem] leading-[1.85] text-[#D8D4C9] text-center mb-16">
              {summary}
            </p>
          )}

          {experience && experience.length > 0 && (
            <section className="mb-14">
              <Masthead>Experience</Masthead>
              <div className="space-y-9">
                {experience.map((job) => (
                  <article key={`${job.company}-${job.title}-${job.start_date}`} className="min-w-0">
                    <p className="font-nr-body text-[0.75rem] uppercase tracking-[0.15em] text-[#8A8578]">
                      {formatDateSpan(job.start_date, job.end_date)}
                    </p>
                    <h3 className="mt-1 text-xl font-medium break-words">{job.title}</h3>
                    <p className="font-nr-body text-sm" style={{ color: GOLD }}>
                      {job.company}
                      {job.location && <span className="text-[#8A8578]">, {job.location}</span>}
                    </p>
                    {job.description && (
                      <p className="font-nr-body mt-3 text-[0.9375rem] text-[#D8D4C9]">
                        {job.description}
                      </p>
                    )}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="font-nr-body mt-3 space-y-1.5 text-[0.9375rem] text-[#D8D4C9]">
                        {job.highlights.map((highlight) => (
                          <li key={`${job.title}-${highlight}`}>— {highlight}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section className="mb-14">
              <Masthead>Selected Work</Masthead>
              <div className="space-y-5">
                {projects.map((project) => (
                  <div key={`${project.title}-${project.year ?? ""}`} className="min-w-0">
                    <h3 className="text-lg font-medium break-words">
                      {project.url ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="ugc nofollow noopener noreferrer"
                          className="hover:underline"
                          style={{ color: GOLD }}
                        >
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                    </h3>
                    {project.description && (
                      <p className="font-nr-body mt-1 text-[0.9375rem] text-[#D8D4C9]">
                        {project.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {skillGroups.length > 0 && (
            <section className="mb-14">
              <Masthead>Expertise</Masthead>
              <p className="font-nr-body text-[0.9375rem] leading-[1.9] text-[#D8D4C9]">
                {skillGroups.flatMap((g) => g.items).join("  ·  ")}
              </p>
            </section>
          )}

          {education && education.length > 0 && (
            <section className="mb-14">
              <Masthead>Education</Masthead>
              <div className="space-y-3">
                {education.map((edu) => (
                  <p key={`${edu.institution}-${edu.degree}`} className="font-nr-body text-[0.9375rem]">
                    <span className="font-semibold">{edu.degree}</span>
                    <span className="text-[#8A8578]"> — {edu.institution}</span>
                    {edu.graduation_date && (
                      <span className="text-[#8A8578]"> · {formatShortDate(edu.graduation_date)}</span>
                    )}
                  </p>
                ))}
              </div>
            </section>
          )}

          {certifications && certifications.length > 0 && (
            <section>
              <Masthead>Recognition</Masthead>
              <ul className="font-nr-body space-y-1.5 text-[0.9375rem] text-[#D8D4C9]">
                {certifications.map((cert) => (
                  <li key={`${cert.name}-${cert.issuer ?? ""}`}>
                    {cert.name}
                    {cert.issuer && <span className="text-[#8A8578]"> — {cert.issuer}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer
            className="mt-16 pt-6 border-t flex flex-wrap items-center justify-between gap-4"
            style={{ borderColor: `${GOLD}2A` }}
          >
            <p className="font-nr-body text-sm text-[#8A8578]">@{profile.handle}</p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="noir"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
