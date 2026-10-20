import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import type { ContactLinkDescriptor } from "@/lib/templates/contact-links";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// The McKinsey/Harvard "one-pager": black on white, thin rules, dash-led bullets,
// tabular numerals, almost no decoration. Built to be screenshotted and printed as one page.

function ContactLinkLabel({ link }: { link: ContactLinkDescriptor }): React.ReactElement {
  if (link.type === "location") return <>{link.label}</>;

  if (link.type === "phone") {
    return (
      <a href={link.href} className="hover:underline">
        {link.label}
      </a>
    );
  }

  return (
    <a
      href={link.href}
      target={link.isExternal ? "_blank" : undefined}
      rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
      className="hover:underline"
    >
      {link.label}
    </a>
  );
}

export const ConsultingBrief: React.FC<TemplateProps> = ({ content, profile }) => {
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
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap" />
      <style>{`
        .cb-root, .cb-root :is(h1, h2, h3, p, li, dt, dd, a, span, button) { font-family: 'Archivo', Helvetica, Arial, sans-serif; }
      `}</style>
      <div className="cb-root min-h-screen bg-white text-black overflow-x-hidden">
        <main className="mx-auto max-w-[40rem] px-5 sm:px-8 pt-16 pb-24 text-[0.9375rem] leading-[1.6]">
          <header className="pb-5 border-b-2 border-black">
            <h1 className="text-[clamp(1.75rem,5vw,2.25rem)] font-bold tracking-[-0.01em] break-words [text-wrap:balance]">
              {full_name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.9375rem]">
              {headline && <span className="font-medium">{headline}</span>}
              {contactLinks.length > 0 && headline && <span aria-hidden="true">—</span>}
              {contactLinks.map((link, i) => (
                <span key={link.type} className="min-w-0 break-all">
                  {i > 0 && (
                    <span aria-hidden="true" className="mr-2">
                      |
                    </span>
                  )}
                  <ContactLinkLabel link={link} />
                </span>
              ))}
            </div>
          </header>

          {summary && <p className="mt-4">{summary}</p>}

          {experience && experience.length > 0 && (
            <section className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] border-b border-black pb-1 mb-3">
                Experience
              </h2>
              <div className="space-y-4">
                {experience.map((job) => (
                  <article key={`${job.company}-${job.title}-${job.start_date}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <h3 className="font-bold break-words">
                        {job.company}
                        {job.location && <span className="font-normal"> — {job.location}</span>}
                      </h3>
                      <p className="text-sm tabular-nums shrink-0">
                        {formatDateSpan(job.start_date, job.end_date)}
                      </p>
                    </div>
                    <p className="italic break-words">{job.title}</p>
                    {job.description && <p className="mt-1">{job.description}</p>}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {job.highlights.map((highlight) => (
                          <li
                            key={`${job.title}-${highlight}`}
                            className="pl-4 relative before:absolute before:left-0 before:content-['–']"
                          >
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] border-b border-black pb-1 mb-3">
                Selected Work
              </h2>
              <div className="space-y-2.5">
                {projects.map((project) => (
                  <p key={`${project.title}-${project.year ?? ""}`}>
                    <span className="font-bold break-words">
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
                    </span>
                    {project.year && <span className="tabular-nums"> ({project.year})</span>}
                    {project.description && <span> — {project.description}</span>}
                  </p>
                ))}
              </div>
            </section>
          )}

          <div className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-6">
            {education && education.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] border-b border-black pb-1 mb-3">
                  Education
                </h2>
                <div className="space-y-2.5">
                  {education.map((edu) => (
                    <div key={`${edu.institution}-${edu.degree}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <p className="font-bold break-words">{edu.institution}</p>
                        {edu.graduation_date && (
                          <p className="text-sm tabular-nums shrink-0">
                            {formatShortDate(edu.graduation_date)}
                          </p>
                        )}
                      </div>
                      <p className="break-words">
                        {edu.degree}
                        {edu.gpa && <span> · GPA {edu.gpa}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {skillGroups.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] border-b border-black pb-1 mb-3">
                  Skills
                </h2>
                <dl className="space-y-1.5">
                  {skillGroups.map((group) => (
                    <div key={group.category}>
                      <dt className="font-bold inline">{group.category}: </dt>
                      <dd className="inline">{group.items.join(", ")}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>

          {certifications && certifications.length > 0 && (
            <section className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] border-b border-black pb-1 mb-3">
                Certifications
              </h2>
              <p>
                {certifications
                  .map((cert) => (cert.issuer ? `${cert.name} (${cert.issuer})` : cert.name))
                  .join("  ·  ")}
              </p>
            </section>
          )}

          <footer className="mt-10 pt-3 border-t border-black flex flex-wrap items-center justify-between gap-4 text-xs">
            <p>@{profile.handle}</p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="consulting-brief"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
