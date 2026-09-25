import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { PrintButton } from "./shared/PrintButton";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A letter-size resume sheet. Plain structure (one column, text headings, no icons or
// tables) keeps it parseable by applicant tracking systems and clean when printed.

function dateSpan(start?: string, end?: string | null): string | null {
  if (!start) return end ? formatShortDate(end) : null;

  return `${formatShortDate(start)} – ${end ? formatShortDate(end) : "Present"}`;
}

function printableUrl(href: string): string {
  return href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function SheetSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="mt-7 print:mt-[14pt]">
      <h2 className="text-[1.0625rem] print:text-[11.5pt] font-semibold text-[#22385C] border-b border-[#22385C] pb-0.5 mb-3 print:mb-[6pt] break-after-avoid [text-wrap:unset]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  left,
  right,
  className = "",
}: {
  left: React.ReactNode;
  right?: string | null;
  className?: string;
}): React.ReactElement {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 ${className}`}>
      <div className="min-w-0">{left}</div>
      {right && <span className="shrink-0 tabular-nums text-[#3F434A]">{right}</span>}
    </div>
  );
}

export const ClassicATS: React.FC<TemplateProps> = ({ content, profile, isPreview }) => {
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

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap" />
      <style>{`
        .font-ats, .font-ats :is(h1, h2, h3, p, li, a, span, dt, dd) { font-family: 'EB Garamond', Garamond, 'Times New Roman', serif; }
        @media print {
          @page { size: letter; margin: 0.55in 0.6in; }
          html, body { background: #fff !important; }
          .font-ats { font-size: 10.5pt; line-height: 1.32; }
          .font-ats a { color: inherit; text-decoration: none; }
          .ats-entry { break-inside: avoid; }
        }
      `}</style>
      <main className="font-ats min-h-screen bg-[#D9DBDE] print:bg-white text-[#16181D] text-[1.0625rem] leading-[1.45] selection:bg-[#22385C] selection:text-white overflow-x-hidden print:overflow-visible px-3 py-6 sm:px-6 sm:py-10 print:p-0">
        <div className="mx-auto max-w-[8.5in] mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <ShareBar
            handle={profile.handle}
            title={`${full_name}'s Resume`}
            name={full_name}
            variant="classic-ats"
          />
          {!isPreview && (
            <PrintButton className="inline-flex items-center gap-2 rounded-[3px] bg-[#22385C] px-3.5 py-2 text-[0.9375rem] text-white hover:bg-[#1A2B47] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22385C]" />
          )}
        </div>

        <article className="mx-auto max-w-[8.5in] min-h-[11in] print:min-h-0 bg-white px-6 py-8 sm:px-[0.75in] sm:py-[0.7in] print:p-0 shadow-[0_1px_2px_rgba(22,24,29,0.12),0_8px_24px_-8px_rgba(22,24,29,0.25)] print:shadow-none">
          <header className="break-inside-avoid">
            <h1 className="text-[2rem] sm:text-[2.375rem] print:text-[22pt] font-medium leading-tight tracking-[-0.01em] text-[#22385C] break-words [text-wrap:unset]">
              {full_name}
            </h1>
            {headline && (
              <p className="mt-0.5 text-[1.125rem] print:text-[11.5pt] italic text-[#3F434A]">
                {headline}
              </p>
            )}
            {contactLinks.length > 0 && (
              <ul
                aria-label="Contact"
                className="mt-2 flex flex-col sm:flex-row sm:flex-wrap gap-y-0.5 text-[0.9375rem] print:text-[10pt] text-[#16181D]"
              >
                {contactLinks.map((link, index) => (
                  <li key={link.type} className="min-w-0 break-words">
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className="hidden sm:inline print:inline px-2 text-[#9A9EA6]"
                      >
                        |
                      </span>
                    )}
                    {link.type === "location" ? (
                      link.label
                    ) : (
                      <a
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? "noopener noreferrer" : undefined}
                        className="underline decoration-[#9A9EA6] underline-offset-2 hover:decoration-[#22385C] focus-visible:outline-2 focus-visible:outline-[#22385C]"
                      >
                        {link.isExternal ? printableUrl(link.href) : link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </header>

          {summary && (
            <SheetSection title="Summary">
              <p>{summary}</p>
            </SheetSection>
          )}

          {experience && experience.length > 0 && (
            <SheetSection title="Experience">
              <div className="space-y-4 print:space-y-[9pt]">
                {experience.map((job) => (
                  <article
                    key={`${job.title}-${job.company}-${job.start_date}`}
                    className="ats-entry"
                  >
                    <Row
                      left={
                        <h3 className="font-semibold [text-wrap:unset]">
                          {job.title}
                          {job.company && <span className="font-normal">, {job.company}</span>}
                        </h3>
                      }
                      right={dateSpan(job.start_date, job.end_date)}
                    />
                    {job.location && <p className="italic text-[#3F434A]">{job.location}</p>}
                    {job.description && <p className="mt-1">{job.description}</p>}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 space-y-0.5 marker:text-[#3F434A]">
                        {job.highlights.map((highlight) => (
                          <li key={`${job.title}-${highlight}`} className="pl-0.5">
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </SheetSection>
          )}

          {education && education.length > 0 && (
            <SheetSection title="Education">
              <div className="space-y-2.5">
                {education.map((edu) => (
                  <article
                    key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
                    className="ats-entry"
                  >
                    <Row
                      left={
                        <h3 className="font-semibold [text-wrap:unset]">
                          {edu.degree}
                          {edu.institution && (
                            <span className="font-normal">, {edu.institution}</span>
                          )}
                        </h3>
                      }
                      right={edu.graduation_date ? formatYear(edu.graduation_date) : null}
                    />
                    {(edu.location || edu.gpa) && (
                      <p className="italic text-[#3F434A]">
                        {[edu.location, edu.gpa && `GPA ${edu.gpa}`].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </SheetSection>
          )}

          {skillGroups.length > 0 && (
            <SheetSection title="Skills">
              <ul className="space-y-0.5">
                {skillGroups.map((group) => (
                  <li key={group.category}>
                    <span className="font-semibold">{group.category}:</span>{" "}
                    {group.items.join(", ")}
                  </li>
                ))}
              </ul>
            </SheetSection>
          )}

          {certifications && certifications.length > 0 && (
            <SheetSection title="Certifications">
              <ul className="space-y-0.5">
                {certifications.map((cert) => (
                  <li key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}>
                    <Row
                      left={
                        <>
                          <span className="font-semibold">
                            {cert.url ? (
                              <a
                                href={cert.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline decoration-[#9A9EA6] underline-offset-2 hover:decoration-[#22385C]"
                              >
                                {cert.name}
                              </a>
                            ) : (
                              cert.name
                            )}
                          </span>
                          {cert.issuer && <span>, {cert.issuer}</span>}
                        </>
                      }
                      right={cert.date ? formatYear(cert.date) : null}
                    />
                  </li>
                ))}
              </ul>
            </SheetSection>
          )}

          {projects && projects.length > 0 && (
            <SheetSection title="Projects">
              <div className="space-y-2.5">
                {projects.map((project) => (
                  <article
                    key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                    className="ats-entry"
                  >
                    <Row
                      left={
                        <h3 className="font-semibold [text-wrap:unset]">
                          {project.title}
                          {project.url && (
                            <a
                              href={project.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 font-normal underline decoration-[#9A9EA6] underline-offset-2 hover:decoration-[#22385C]"
                            >
                              {printableUrl(project.url)}
                            </a>
                          )}
                        </h3>
                      }
                      right={project.year}
                    />
                    {project.description && <p>{project.description}</p>}
                    {project.technologies && project.technologies.length > 0 && (
                      <p className="italic text-[#3F434A]">
                        Tools: {project.technologies.join(", ")}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </SheetSection>
          )}
        </article>
      </main>
    </>
  );
};
