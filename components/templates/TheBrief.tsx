import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A legal resume styled like a filed brief: a boxed caption header, roman-numeral section
// headings, double-spaced serif body, thin rules. Navy and muted gold, never burgundy —
// that pairing already belongs to Manuscript.

const NAVY = "#1B2A4A";
const GOLD = "#B08D3D";
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

function BriefSection({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="mt-10">
      <h2 className="flex items-baseline gap-3 pb-2 border-b" style={{ borderColor: `${NAVY}33` }}>
        <span className="text-sm font-semibold tabular-nums" style={{ color: GOLD }}>
          {ROMAN[index] ?? index + 1}.
        </span>
        <span className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: NAVY }}>
          {title}
        </span>
      </h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

export const TheBrief: React.FC<TemplateProps> = ({ content, profile }) => {
  const {
    full_name,
    headline,
    summary,
    contact,
    experience,
    education,
    skills,
    certifications,
    projects,
  } = content;

  const contactLinks = getContactLinks(contact);
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];
  let sectionIndex = 0;

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" />
      <style>{`
        .tb-root, .tb-root :is(p, li, dt, dd, a, span, button) { font-family: 'Source Serif 4', Georgia, serif; }
        .tb-root :is(h1, h2, h3) { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>
      <div className="tb-root min-h-screen bg-[#FBF8F0] text-[#1C1A16] overflow-x-hidden">
        <main className="mx-auto max-w-[40rem] px-5 sm:px-8 pt-16 pb-24">
          <header
            className="border-2 px-6 py-7 text-center"
            style={{ borderColor: NAVY }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: GOLD }}
            >
              Professional Profile
            </p>
            <h1 className="mt-3 text-[clamp(1.75rem,5vw,2.5rem)] font-bold break-words [text-wrap:balance]">
              {full_name}
            </h1>
            {headline && (
              <p className="mt-2 text-lg italic" style={{ color: NAVY }}>
                {headline}
              </p>
            )}
            {contactLinks.length > 0 && (
              <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm">
                {contactLinks.map((link) => (
                  <li key={link.type} className="min-w-0 break-all">
                    {link.type === "location" ? (
                      link.label
                    ) : link.type === "phone" ? (
                      <a href={link.href} className="hover:underline">
                        {link.label}
                      </a>
                    ) : (
                      <a
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                        className="hover:underline"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </header>

          {summary && (
            <p className="mt-8 leading-[1.9] text-[1.0625rem]">
              <span className="font-bold mr-1" style={{ color: GOLD }}>
                ¶1.
              </span>
              {summary}
            </p>
          )}

          {experience && experience.length > 0 && (
            <BriefSection index={sectionIndex++} title="Professional Experience">
              {experience.map((job) => (
                <article key={`${job.company}-${job.title}-${job.start_date}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-bold break-words">
                      {job.title}, {job.company}
                    </h3>
                    <p className="text-sm tabular-nums shrink-0" style={{ color: NAVY }}>
                      {formatDateSpan(job.start_date, job.end_date)}
                    </p>
                  </div>
                  {job.location && <p className="text-sm italic">{job.location}</p>}
                  {job.description && <p className="mt-1.5 leading-[1.8]">{job.description}</p>}
                  {job.highlights && job.highlights.length > 0 && (
                    <ul className="mt-1.5 space-y-1 leading-[1.8]">
                      {job.highlights.map((highlight, i) => (
                        <li key={`${job.title}-${highlight}`} className="pl-6 relative">
                          <span
                            className="absolute left-0 text-sm font-semibold"
                            style={{ color: GOLD }}
                          >
                            ({String.fromCodePoint(97 + (i % 26))})
                          </span>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </BriefSection>
          )}

          {projects && projects.length > 0 && (
            <BriefSection index={sectionIndex++} title="Notable Matters">
              {projects.map((project) => (
                <article key={`${project.title}-${project.year ?? ""}`}>
                  <p className="font-bold break-words">
                    {project.url ? (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="ugc nofollow noopener noreferrer"
                        className="hover:underline"
                      >
                        {project.title}
                      </a>
                    ) : (
                      project.title
                    )}
                    {project.year && <span className="font-normal tabular-nums"> ({project.year})</span>}
                  </p>
                  {project.description && <p className="leading-[1.8]">{project.description}</p>}
                </article>
              ))}
            </BriefSection>
          )}

          {education && education.length > 0 && (
            <BriefSection index={sectionIndex++} title="Education">
              {education.map((edu) => (
                <div key={`${edu.institution}-${edu.degree}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-bold break-words">{edu.degree}</p>
                    {edu.graduation_date && (
                      <p className="text-sm tabular-nums shrink-0" style={{ color: NAVY }}>
                        {formatShortDate(edu.graduation_date)}
                      </p>
                    )}
                  </div>
                  <p className="italic">
                    {edu.institution}
                    {edu.location && <span> — {edu.location}</span>}
                  </p>
                  {edu.gpa && <p className="text-sm">GPA {edu.gpa}</p>}
                </div>
              ))}
            </BriefSection>
          )}

          {(skillGroups.length > 0 || (certifications && certifications.length > 0)) && (
            <BriefSection index={sectionIndex++} title="Credentials">
              {skillGroups.length > 0 && (
                <dl className="space-y-1.5">
                  {skillGroups.map((group) => (
                    <div key={group.category}>
                      <dt className="font-bold inline">{group.category}: </dt>
                      <dd className="inline">{group.items.join(", ")}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {certifications && certifications.length > 0 && (
                <ul className="space-y-1">
                  {certifications.map((cert) => (
                    <li key={`${cert.name}-${cert.issuer ?? ""}`} className="break-words">
                      <span className="font-semibold">{cert.name}</span>
                      {cert.issuer && <span> — {cert.issuer}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </BriefSection>
          )}

          <footer
            className="mt-12 pt-5 border-t flex flex-wrap items-center justify-between gap-4 text-sm"
            style={{ borderColor: `${NAVY}33` }}
          >
            <p>@{profile.handle}</p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="the-brief"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
