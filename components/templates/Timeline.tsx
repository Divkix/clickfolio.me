import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A literal career roadmap: a vertical line with a dated marker at every stop. Experience and
// education each get their own line, since the two arrays aren't guaranteed to interleave
// chronologically — merging them would invent an ordering the resume data doesn't promise.

const SIENNA = "#B5502A";

const INK = "#262220";

function RoadLine<T extends { key: string }>({
  entries,
  renderMarker,
  renderBody,
}: {
  entries: readonly T[];
  renderMarker: (entry: T, index: number) => React.ReactNode;
  renderBody: (entry: T, index: number) => React.ReactNode;
}) {
  return (
    <ol className="relative">
      <div
        className="absolute left-[0.9375rem] top-2 bottom-2 w-[2px] sm:left-[1.0625rem]"
        style={{ backgroundColor: "#E6DED3" }}
        aria-hidden="true"
      />
      {entries.map((entry, index) => (
        <li key={entry.key} className="relative flex gap-5 pb-10 last:pb-0 sm:gap-6">
          <div className="relative z-10 shrink-0">{renderMarker(entry, index)}</div>
          <div className="min-w-0 flex-1 pt-0.5">{renderBody(entry, index)}</div>
        </li>
      ))}
    </ol>
  );
}

function Marker({ children }: { children?: React.ReactNode }) {
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] bg-white text-[11px] font-bold sm:h-9 sm:w-9"
      style={{ borderColor: SIENNA, color: SIENNA }}
    >
      {children}
    </div>
  );
}

export const Timeline: React.FC<TemplateProps> = ({ content, profile }) => {
  const experience = content.experience ?? [];
  const education = content.education ?? [];
  const certifications = content.certifications ?? [];
  const projects = content.projects ?? [];
  const skills = content.skills?.filter((group) => group.items.length > 0) ?? [];
  const contactLinks = getContactLinks(content.contact);

  const experienceEntries = experience.map((job, i) => ({
    key: `${job.title}-${job.company}-${job.start_date}-${i}`,
    job,
  }));

  const educationEntries = education.map((edu, i) => ({
    key: `${edu.institution}-${edu.degree}-${i}`,
    edu,
  }));

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&display=swap" />
      <style>{`.font-head-tl { font-family: 'Fraunces', Georgia, serif; }`}</style>

      <main className="min-h-screen bg-[#FBF8F3] text-[15.5px] leading-relaxed antialiased" style={{ color: INK }}>
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
          <header className="flex items-start gap-5 sm:gap-6">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`Portrait of ${content.full_name}`}
                width={80}
                height={80}
                className="h-16 w-16 shrink-0 rounded-full object-cover sm:h-20 sm:w-20"
              />
            ) : (
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white sm:h-20 sm:w-20"
                style={{ backgroundColor: SIENNA }}
                aria-hidden="true"
              >
                {getInitials(content.full_name)}
              </div>
            )}
            <div className="min-w-0 pt-1">
              <h1 className="font-head-tl text-[clamp(1.875rem,5.5vw,2.625rem)] font-semibold leading-tight break-words [text-wrap:unset]">
                {content.full_name}
              </h1>
              {content.headline && <p className="mt-1.5 text-lg leading-snug text-[#6B6158]">{content.headline}</p>}
            </div>
          </header>

          {content.summary && <p className="mt-8 max-w-[62ch] text-[1.0625rem] leading-[1.65]">{content.summary}</p>}

          {contactLinks.length > 0 && (
            <ul aria-label="Contact" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {contactLinks.map((link) => (
                <li key={link.type} className="flex min-w-0 items-center gap-1.5 text-[#6B6158]">
                  <span className="shrink-0" style={{ color: SIENNA }}>
                    {getContactIcon(link.type, { className: "h-4 w-4", "aria-hidden": true })}
                  </span>
                  {link.href ? (
                    <a
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                      className="truncate underline decoration-[#B5502A]/30 underline-offset-2 hover:decoration-[#B5502A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B5502A] rounded-sm"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <span className="truncate">{link.label}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {experienceEntries.length > 0 && (
            <section aria-labelledby="tl-experience" className="mt-14">
              <h2 id="tl-experience" className="font-head-tl mb-8 text-2xl font-semibold tracking-[-0.01em]">
                Experience
              </h2>
              <RoadLine
                entries={experienceEntries}
                renderMarker={({ job }) => <Marker>{job.end_date ? "" : "●"}</Marker>}
                renderBody={({ job }) => {
                  return (
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className="text-lg font-bold leading-snug break-words">{job.title}</h3>
                        <p className="shrink-0 text-sm font-medium tabular-nums" style={{ color: SIENNA }}>
                          {formatDateSpan(job.start_date, job.end_date)}
                        </p>
                      </div>
                      <p className="text-sm text-[#847A70]">
                        {job.company}
                        {job.location && <span>, {job.location}</span>}
                      </p>
                      {job.description && <p className="mt-2.5 leading-relaxed">{job.description}</p>}
                      {job.highlights && job.highlights.length > 0 && (
                        <ul className="mt-2.5 space-y-1.5">
                          {job.highlights.map((highlight, i) => (
                            <li key={`${job.title}-${i}`} className="relative pl-5 leading-relaxed">
                              <span
                                className="absolute left-0 top-[0.65em] h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: SIENNA }}
                                aria-hidden="true"
                              />
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                }}
              />
            </section>
          )}

          {educationEntries.length > 0 && (
            <section aria-labelledby="tl-education" className="mt-14">
              <h2 id="tl-education" className="font-head-tl mb-8 text-2xl font-semibold tracking-[-0.01em]">
                Education
              </h2>
              <RoadLine
                entries={educationEntries}
                renderMarker={({ edu }) => (
                  <Marker>{edu.graduation_date ? formatYear(edu.graduation_date).slice(-2) : ""}</Marker>
                )}
                renderBody={({ edu }) => {
                  return (
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className="text-lg font-bold leading-snug break-words">{edu.degree}</h3>
                        {edu.graduation_date && (
                          <p className="shrink-0 text-sm font-medium tabular-nums" style={{ color: SIENNA }}>
                            {formatYear(edu.graduation_date)}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-[#847A70]">
                        {edu.institution}
                        {edu.gpa && ` · GPA ${edu.gpa}`}
                      </p>
                    </div>
                  );
                }}
              />
            </section>
          )}

          {projects.length > 0 && (
            <section aria-labelledby="tl-projects" className="mt-14">
              <h2 id="tl-projects" className="font-head-tl mb-6 text-2xl font-semibold tracking-[-0.01em]">
                Projects
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {projects.map((project) => (
                  <article
                    key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                    className="min-w-0 rounded-lg border border-[#E6DED3] bg-white/60 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-bold leading-snug break-words">
                        {project.url ? (
                          <a
                            href={project.url}
                            target="_blank"
                            rel="ugc nofollow noopener noreferrer"
                            className="underline decoration-[#B5502A]/40 underline-offset-2 hover:decoration-[#B5502A] rounded-sm"
                          >
                            {project.title}
                          </a>
                        ) : (
                          project.title
                        )}
                      </h3>
                      {project.year && (
                        <span className="shrink-0 text-xs tabular-nums text-[#847A70]">{project.year}</span>
                      )}
                    </div>
                    {project.description && <p className="mt-1.5 text-sm leading-relaxed">{project.description}</p>}
                    {project.technologies && project.technologies.length > 0 && (
                      <p className="mt-2 text-xs text-[#847A70]">{project.technologies.join(" · ")}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {skills.length > 0 && (
            <section aria-labelledby="tl-skills" className="mt-14">
              <h2 id="tl-skills" className="font-head-tl mb-5 text-2xl font-semibold tracking-[-0.01em]">
                Skills
              </h2>
              <dl className="space-y-3">
                {skills.map((group) => (
                  <div key={group.category} className="flex flex-wrap gap-x-2 gap-y-1">
                    <dt className="font-semibold text-[#6B6158]">{group.category}:</dt>
                    <dd>{group.items.join(", ")}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {certifications.length > 0 && (
            <section aria-labelledby="tl-certifications" className="mt-14">
              <h2 id="tl-certifications" className="font-head-tl mb-6 text-2xl font-semibold tracking-[-0.01em]">
                Certifications
              </h2>
              <ul className="space-y-3">
                {certifications.map((cert) => (
                  <li key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <p className="font-bold leading-snug break-words">
                      {cert.url ? (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="ugc nofollow noopener noreferrer"
                          className="underline decoration-[#B5502A]/40 underline-offset-2 hover:decoration-[#B5502A] rounded-sm"
                        >
                          {cert.name}
                        </a>
                      ) : (
                        cert.name
                      )}
                      {cert.issuer && <span className="font-normal text-[#847A70]"> — {cert.issuer}</span>}
                    </p>
                    {cert.date && (
                      <p className="shrink-0 text-sm tabular-nums text-[#847A70]">{formatYear(cert.date)}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-16 border-t border-[#E6DED3] pt-8">
            <ShareBar handle={profile.handle} title={`${content.full_name}'s Portfolio`} name={content.full_name} variant="timeline" />
          </div>
        </div>
      </main>
    </>
  );
};
