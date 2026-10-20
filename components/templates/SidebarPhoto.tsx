import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

type Content = TemplateProps["content"];

// The classic two-column "modern resume": a fixed photo-and-contact sidebar, career content
// in the wide column beside it. Skills read as labelled chip rows, not fabricated percentages —
// a resume template shouldn't invent a number for how good someone is at something.

const INK = "#26324A";

const AMBER = "#C9842F";

const SLATE = "#5B6472";

function Sidebar({ content, avatarUrl }: { content: Content; avatarUrl: string | null }) {
  const contactLinks = getContactLinks(content.contact).filter((link) => link.type !== "location");
  const skills = content.skills?.filter((group) => group.items.length > 0) ?? [];

  return (
    <aside
      className="px-7 pb-10 pt-12 text-white sm:px-10 lg:px-8 lg:pb-16 lg:pt-16 xl:px-10"
      style={{ backgroundColor: INK }}
    >
      <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full ring-4 ring-white/10">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`Portrait of ${content.full_name}`}
            width={112}
            height={112}
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className="font-head-sp text-3xl font-bold"
            style={{ color: AMBER }}
            aria-hidden="true"
          >
            {getInitials(content.full_name)}
          </span>
        )}
      </div>

      <h1 className="font-head-sp mt-6 text-[1.875rem] font-bold leading-tight break-words [text-wrap:unset]">
        {content.full_name}
      </h1>
      {content.headline && (
        <p className="mt-2 text-[15px] leading-snug text-white/70">{content.headline}</p>
      )}

      {content.contact?.location && (
        <p className="mt-5 flex items-center gap-2 text-sm text-white/60">
          {getContactIcon("location", { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": true })}
          {content.contact.location}
        </p>
      )}

      {contactLinks.length > 0 && (
        <nav aria-label="Contact" className="mt-7 border-t border-white/15 pt-6">
          <ul className="space-y-3">
            {contactLinks.map((link) => (
              <li key={link.type} className="min-w-0">
                <a
                  href={link.href}
                  target={link.isExternal ? "_blank" : undefined}
                  rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                  className="inline-flex max-w-full items-center gap-3 text-sm text-white/85 hover:text-white underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm"
                >
                  <span className="flex shrink-0 text-white/50" style={{ color: AMBER }}>
                    {getContactIcon(link.type, {
                      className: "h-4 w-4",
                      variant: "white",
                      "aria-hidden": true,
                    })}
                  </span>
                  <span className="truncate">{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {skills.length > 0 && (
        <section aria-labelledby="sp-skills" className="mt-7 border-t border-white/15 pt-6">
          <h2 id="sp-skills" className="font-head-sp text-sm font-bold uppercase tracking-[0.08em]">
            Skills
          </h2>
          <div className="mt-5 space-y-5">
            {skills.map((group) => (
              <div key={group.category}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.06em] text-white/60">
                    {group.category}
                  </span>
                  <span className="h-px flex-1" style={{ backgroundColor: `${AMBER}66` }} />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border px-2.5 py-1 text-[12.5px] leading-none text-white/90"
                      style={{
                        borderColor: "rgba(255,255,255,0.18)",
                        backgroundColor: "rgba(255,255,255,0.06)",
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-head-sp mb-6 flex items-center gap-3 text-xl font-bold tracking-[-0.01em]"
      style={{ color: INK }}
    >
      {children}
      <span className="h-[2px] flex-1" style={{ backgroundColor: AMBER }} aria-hidden="true" />
    </h2>
  );
}

export const SidebarPhoto: React.FC<TemplateProps> = ({ content, profile }) => {
  const experience = content.experience ?? [];
  const projects = content.projects ?? [];
  const education = content.education ?? [];
  const certifications = content.certifications ?? [];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&display=swap" />
      <style>{`.font-head-sp { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; }`}</style>

      <main
        className="min-h-screen bg-white text-[15px] leading-relaxed antialiased lg:grid lg:grid-cols-[19rem_1fr]"
        style={{ color: "#1C2230" }}
      >
        <Sidebar content={content} avatarUrl={profile.avatar_url} />

        <div className="min-w-0 px-6 py-10 sm:px-10 lg:px-14 lg:py-16 xl:px-16">
          <div className="max-w-2xl space-y-12">
            {content.summary && (
              <p className="text-[1.0625rem] leading-[1.6]" style={{ color: "#333B49" }}>
                {content.summary}
              </p>
            )}

            {experience.length > 0 && (
              <section aria-labelledby="sp-experience">
                <SectionHeading>Experience</SectionHeading>
                <ol className="space-y-8">
                  {experience.map((job) => (
                    <li key={`${job.title}-${job.company}-${job.start_date}`} className="min-w-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className="text-[1.0625rem] font-bold leading-snug break-words">
                          {job.title}
                        </h3>
                        <p className="shrink-0 text-sm tabular-nums" style={{ color: SLATE }}>
                          {formatDateSpan(job.start_date, job.end_date)}
                        </p>
                      </div>
                      <p className="text-sm font-medium" style={{ color: AMBER }}>
                        {job.company}
                        {job.location && <span style={{ color: SLATE }}>, {job.location}</span>}
                      </p>
                      {job.description && (
                        <p className="mt-2.5 leading-relaxed">{job.description}</p>
                      )}
                      {job.highlights && job.highlights.length > 0 && (
                        <ul className="mt-2.5 space-y-1.5">
                          {job.highlights.map((highlight, i) => (
                            <li key={`${job.title}-${i}`} className="relative pl-5 leading-relaxed">
                              <span
                                className="absolute left-0 top-[0.65em] h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: AMBER }}
                                aria-hidden="true"
                              />
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {projects.length > 0 && (
              <section aria-labelledby="sp-projects">
                <SectionHeading>Projects</SectionHeading>
                <div className="grid gap-6 sm:grid-cols-2">
                  {projects.map((project) => (
                    <article
                      key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                      className="min-w-0 rounded-lg border p-4"
                      style={{ borderColor: "#E6E8EC" }}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-bold leading-snug break-words">
                          {project.url ? (
                            <a
                              href={project.url}
                              target="_blank"
                              rel="ugc nofollow noopener noreferrer"
                              className="underline decoration-[#C9842F]/40 underline-offset-2 hover:decoration-[#C9842F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26324A] rounded-sm"
                            >
                              {project.title}
                            </a>
                          ) : (
                            project.title
                          )}
                        </h3>
                        {project.year && (
                          <span className="shrink-0 text-xs tabular-nums" style={{ color: SLATE }}>
                            {project.year}
                          </span>
                        )}
                      </div>
                      {project.description && (
                        <p className="mt-1.5 text-sm leading-relaxed">{project.description}</p>
                      )}
                      {project.technologies && project.technologies.length > 0 && (
                        <p className="mt-2 text-xs" style={{ color: SLATE }}>
                          {project.technologies.join(" · ")}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {education.length > 0 && (
              <section aria-labelledby="sp-education">
                <SectionHeading>Education</SectionHeading>
                <ul className="space-y-4">
                  {education.map((edu) => (
                    <li
                      key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
                    >
                      <div className="min-w-0">
                        <h3 className="font-bold leading-snug break-words">{edu.degree}</h3>
                        <p className="text-sm" style={{ color: SLATE }}>
                          {edu.institution}
                          {edu.gpa && ` · GPA ${edu.gpa}`}
                        </p>
                      </div>
                      {edu.graduation_date && (
                        <p className="shrink-0 text-sm tabular-nums" style={{ color: SLATE }}>
                          {formatYear(edu.graduation_date)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {certifications.length > 0 && (
              <section aria-labelledby="sp-certifications">
                <SectionHeading>Certifications</SectionHeading>
                <ul className="space-y-3">
                  {certifications.map((cert) => (
                    <li
                      key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
                    >
                      <div className="min-w-0">
                        <h3 className="font-bold leading-snug break-words">
                          {cert.url ? (
                            <a
                              href={cert.url}
                              target="_blank"
                              rel="ugc nofollow noopener noreferrer"
                              className="underline decoration-[#C9842F]/40 underline-offset-2 hover:decoration-[#C9842F] rounded-sm"
                            >
                              {cert.name}
                            </a>
                          ) : (
                            cert.name
                          )}
                        </h3>
                        {cert.issuer && (
                          <p className="text-sm" style={{ color: SLATE }}>
                            {cert.issuer}
                          </p>
                        )}
                      </div>
                      {cert.date && (
                        <p className="shrink-0 text-sm tabular-nums" style={{ color: SLATE }}>
                          {formatYear(cert.date)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="border-t pt-8" style={{ borderColor: "#E6E8EC" }}>
              <ShareBar
                handle={profile.handle}
                title={`${content.full_name}'s Portfolio`}
                name={content.full_name}
                variant="sidebar-photo"
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
