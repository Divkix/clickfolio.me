import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// Quiet single column. Dates hang in the left margin on wide screens, like marginal notes
// in a book; on narrow screens they stack above the entry they belong to.

const LINK =
  "text-[#1F5C4A] underline decoration-[#1F5C4A]/35 underline-offset-[3px] hover:decoration-[#1F5C4A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F5C4A] rounded-[1px]";

function dateSpan(start?: string, end?: string | null): string | null {
  if (!start) return end ? formatShortDate(end) : null;

  return `${formatShortDate(start)} – ${end ? formatShortDate(end) : "Present"}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="max-w-[40rem] lg:ml-[14rem] mt-16 md:mt-24">
      <h2 className="text-[1.625rem] md:text-[1.875rem] font-normal leading-tight tracking-[-0.01em] text-[#1B1B1F] mb-8 [text-wrap:unset]">
        {title}
      </h2>
      <div className="min-w-0 space-y-10">{children}</div>
    </section>
  );
}

function Entry({
  aside,
  children,
}: {
  aside?: string | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <article className="relative min-w-0">
      {aside && (
        <p className="text-[0.9375rem] italic text-[#6B6B73] mb-1 tabular-nums lg:absolute lg:right-full lg:mr-12 lg:mb-0 lg:w-[11rem] lg:top-[0.3rem] lg:leading-snug">
          {aside}
        </p>
      )}
      {children}
    </article>
  );
}

export const MinimalistEditorial: React.FC<TemplateProps> = ({ content, profile }) => {
  const {
    full_name,
    summary,
    headline,
    contact,
    experience,
    projects,
    education,
    skills,
    certifications,
  } = content;

  const contactLinks = getContactLinks(contact).filter((link) => link.type !== "location");
  const emailLink = contactLinks.find((link) => link.type === "email");
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" />
      <style>{`
        .font-serif-me, .font-serif-me :is(h1, h2, h3, p, li, dt, dd, a) { font-family: 'Source Serif 4', Georgia, serif; font-optical-sizing: auto; }
      `}</style>
      <div className="font-serif-me min-h-screen bg-white text-[#1B1B1F] text-[1.0625rem] md:text-lg leading-[1.7] selection:bg-[#1F5C4A] selection:text-white overflow-x-hidden">
        <main className="mx-auto max-w-[40rem] lg:max-w-[54rem] px-5 sm:px-8 pt-16 md:pt-28 pb-24">
          <header className="grid grid-cols-1 lg:grid-cols-[11rem_minmax(0,40rem)] lg:gap-x-12">
            <div className="mb-8 lg:mb-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  width={88}
                  height={88}
                  className="w-[4.5rem] h-[4.5rem] lg:w-[5.5rem] lg:h-[5.5rem] rounded-full object-cover grayscale-[15%]"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="w-[4.5rem] h-[4.5rem] lg:w-[5.5rem] lg:h-[5.5rem] rounded-full bg-[#F1F1F2] text-[#6B6B73] flex items-center justify-center text-xl italic"
                >
                  {getInitials(full_name)}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="text-[clamp(2.5rem,7vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.02em] break-words [text-wrap:balance]">
                {full_name}
              </h1>
              {headline && (
                <p className="mt-4 text-xl md:text-[1.375rem] leading-snug italic text-[#6B6B73]">
                  {headline}
                </p>
              )}
              {contact.location && (
                <p className="mt-2 text-[0.9375rem] text-[#6B6B73]">{contact.location}</p>
              )}

              {summary && (
                <p className="mt-10 text-[1.1875rem] md:text-xl leading-[1.65] text-[#1B1B1F]">
                  {summary}
                </p>
              )}

              {contactLinks.length > 0 && (
                <ul
                  aria-label="Contact"
                  className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]"
                >
                  {contactLinks.map((link) => (
                    <li key={link.type} className="min-w-0 break-all sm:break-normal">
                      {link.type === "phone" ? (
                        <a href={link.href} className={LINK}>
                          {link.label}
                        </a>
                      ) : (
                        <a
                          href={link.href}
                          target={link.isExternal ? "_blank" : undefined}
                          rel={link.isExternal ? "noopener noreferrer" : undefined}
                          className={LINK}
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </header>

          {experience && experience.length > 0 && (
            <Section title="Experience">
              {experience.map((job) => (
                <Entry
                  key={`${job.company}-${job.title}-${job.start_date}`}
                  aside={dateSpan(job.start_date, job.end_date)}
                >
                  <h3 className="text-[1.1875rem] md:text-xl font-semibold leading-snug break-words [text-wrap:unset]">
                    {job.title}
                  </h3>
                  <p className="text-[#6B6B73]">
                    {job.company}
                    {job.location && <span>, {job.location}</span>}
                  </p>
                  {job.description && <p className="mt-3">{job.description}</p>}
                  {job.highlights && job.highlights.length > 0 && (
                    <ul className="mt-3 space-y-1.5 list-disc pl-5 marker:text-[#B4B4BA]">
                      {job.highlights.map((highlight) => (
                        <li key={`${job.title}-${highlight}`} className="pl-1">
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  )}
                </Entry>
              ))}
            </Section>
          )}

          {projects && projects.length > 0 && (
            <Section title="Projects">
              {projects.map((project) => (
                <Entry
                  key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                  aside={project.year}
                >
                  <h3 className="text-[1.1875rem] md:text-xl font-semibold leading-snug break-words [text-wrap:unset]">
                    {project.url ? (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={LINK}
                      >
                        {project.title}
                      </a>
                    ) : (
                      project.title
                    )}
                  </h3>
                  {project.description && <p className="mt-2">{project.description}</p>}
                  {project.technologies && project.technologies.length > 0 && (
                    <p className="mt-2 text-[0.9375rem] italic text-[#6B6B73]">
                      {project.technologies.join(", ")}
                    </p>
                  )}
                </Entry>
              ))}
            </Section>
          )}

          {education && education.length > 0 && (
            <Section title="Education">
              {education.map((edu) => (
                <Entry
                  key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
                  aside={edu.graduation_date ? formatShortDate(edu.graduation_date) : null}
                >
                  <h3 className="text-[1.1875rem] md:text-xl font-semibold leading-snug break-words [text-wrap:unset]">
                    {edu.degree}
                  </h3>
                  <p className="text-[#6B6B73]">
                    {edu.institution}
                    {edu.location && <span>, {edu.location}</span>}
                  </p>
                  {edu.gpa && <p className="mt-1 text-[0.9375rem]">GPA {edu.gpa}</p>}
                </Entry>
              ))}
            </Section>
          )}

          {skillGroups.length > 0 && (
            <Section title="Skills">
              <dl className="space-y-4">
                {skillGroups.map((group) => (
                  <div key={group.category} className="min-w-0">
                    <dt className="italic text-[#6B6B73]">{group.category}</dt>
                    <dd>{group.items.join(", ")}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {certifications && certifications.length > 0 && (
            <Section title="Certifications">
              {certifications.map((cert) => (
                <Entry
                  key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}
                  aside={cert.date ? formatShortDate(cert.date) : null}
                >
                  <h3 className="text-[1.0625rem] md:text-lg font-semibold leading-snug break-words [text-wrap:unset]">
                    {cert.url ? (
                      <a href={cert.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                        {cert.name}
                      </a>
                    ) : (
                      cert.name
                    )}
                  </h3>
                  {cert.issuer && <p className="text-[#6B6B73]">{cert.issuer}</p>}
                </Entry>
              ))}
            </Section>
          )}

          <footer className="mt-24 pt-8 border-t border-[#E4E4E7] grid grid-cols-1 lg:grid-cols-[11rem_minmax(0,40rem)] lg:gap-x-12">
            <p className="text-[0.9375rem] text-[#6B6B73] mb-4 lg:mb-0">@{profile.handle}</p>
            <div className="min-w-0 flex flex-wrap items-center justify-between gap-4">
              {emailLink ? (
                <a href={emailLink.href} className={`${LINK} text-[0.9375rem] break-all`}>
                  {emailLink.label}
                </a>
              ) : (
                <span />
              )}
              <ShareBar
                handle={profile.handle}
                title={`${full_name}'s Portfolio`}
                name={full_name}
                variant="minimalist-editorial"
              />
            </div>
          </footer>
        </main>
      </div>
    </>
  );
};
