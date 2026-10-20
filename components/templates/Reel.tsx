import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A film-editing timeline: a horizontal track with clip markers, a red playhead rule,
// monospace timecodes. Near-black, built for editors and filmmakers.

const RED = "#E53935";

export const Reel: React.FC<TemplateProps> = ({ content, profile }) => {
  const {
    full_name,
    summary,
    headline,
    contact,
    experience,
    education,
    skills,
    projects,
    certifications,
  } = content;

  const contactLinks = getContactLinks(contact);
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=JetBrains+Mono:wght@400;600&display=swap" />
      <style>{`
        .font-rl-head, .font-rl-head :is(h1, h2, h3) { font-family: 'Oswald', ui-sans-serif, sans-serif; }
        .font-rl-mono, .font-rl-mono :is(span.tc) { font-family: 'JetBrains Mono', ui-monospace, monospace; }
      `}</style>
      <div className="font-rl-head font-rl-mono min-h-screen bg-[#0D0D0E] text-[#EDEDE9] overflow-x-hidden">
        <div aria-hidden="true" className="h-1" style={{ backgroundColor: RED }} />
        <main className="mx-auto max-w-[50rem] px-5 sm:px-8 pt-14 pb-24">
          <header className="flex flex-wrap items-center gap-6">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                width={84}
                height={84}
                className="w-[4.5rem] h-[4.5rem] rounded object-cover shrink-0 grayscale"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-[4.5rem] h-[4.5rem] rounded bg-[#1A1A1C] flex items-center justify-center text-xl font-bold shrink-0"
                style={{ color: RED }}
              >
                {getInitials(full_name)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[clamp(1.875rem,5.5vw,2.75rem)] uppercase tracking-tight leading-[1.02] break-words">
                {full_name}
              </h1>
              {headline && (
                <p className="font-rl-mono mt-1.5 text-[#A3A39B] break-words">{headline}</p>
              )}
            </div>
          </header>

          {contactLinks.length > 0 && (
            <ul className="font-rl-mono mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {contactLinks.map((link) => (
                <li key={link.type} className="min-w-0 break-all">
                  {link.href ? (
                    <a
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                      className="hover:underline"
                      style={{ color: RED }}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <span className="text-[#A3A39B]">{link.label}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {summary && (
            <p className="mt-7 text-[1.0625rem] leading-[1.7] text-[#D6D6D0]">{summary}</p>
          )}

          {skillGroups.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-2">
              {skillGroups
                .flatMap((g) => g.items)
                .map((item) => (
                  <span
                    key={item}
                    className="font-rl-mono text-[0.75rem] uppercase tracking-wide rounded border px-2.5 py-1"
                    style={{ borderColor: `${RED}66`, color: "#D6D6D0" }}
                  >
                    {item}
                  </span>
                ))}
            </div>
          )}

          {experience && experience.length > 0 && (
            <section className="mt-14">
              <h2 className="text-sm uppercase tracking-[0.14em] mb-6" style={{ color: RED }}>
                Timeline
              </h2>
              <div className="relative pl-6 border-l" style={{ borderColor: "#2A2A2C" }}>
                {experience.map((job) => (
                  <article
                    key={`${job.company}-${job.title}-${job.start_date}`}
                    className="relative mb-8 min-w-0"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -left-[1.6rem] top-1.5 w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: RED }}
                    />
                    <p className="font-rl-mono tc text-[0.75rem] text-[#A3A39B]">
                      {formatDateSpan(job.start_date, job.end_date)}
                    </p>
                    <h3 className="text-lg font-bold break-words mt-0.5">{job.title}</h3>
                    <p className="text-sm text-[#A3A39B]">
                      {job.company}
                      {job.location && <span>, {job.location}</span>}
                    </p>
                    {job.description && (
                      <p className="mt-2 text-[0.9375rem] text-[#D6D6D0]">{job.description}</p>
                    )}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-2 space-y-1 list-disc pl-5 marker:text-[#4A4A48]">
                        {job.highlights.map((highlight) => (
                          <li
                            key={`${job.title}-${highlight}`}
                            className="text-[0.9375rem] text-[#D6D6D0] pl-1"
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
              <h2 className="text-sm uppercase tracking-[0.14em] mb-5" style={{ color: RED }}>
                Reel
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {projects.map((project) => (
                  <div
                    key={`${project.title}-${project.year ?? ""}`}
                    className="rounded border border-[#2A2A2C] p-4 min-w-0"
                  >
                    <h3 className="font-bold break-words">
                      {project.url ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="ugc nofollow noopener noreferrer"
                          className="hover:underline"
                          style={{ color: RED }}
                        >
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                    </h3>
                    {project.description && (
                      <p className="mt-1 text-sm text-[#A3A39B]">{project.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {education && education.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm uppercase tracking-[0.14em] mb-4" style={{ color: RED }}>
                Education
              </h2>
              <div className="space-y-2">
                {education.map((edu) => (
                  <p key={`${edu.institution}-${edu.degree}`} className="text-[0.9375rem]">
                    <span className="font-bold">{edu.degree}</span>
                    <span className="text-[#A3A39B]"> — {edu.institution}</span>
                    {edu.graduation_date && (
                      <span className="font-rl-mono tc text-[#A3A39B]">
                        {" "}
                        · {formatShortDate(edu.graduation_date)}
                      </span>
                    )}
                  </p>
                ))}
              </div>
            </section>
          )}

          {certifications && certifications.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm uppercase tracking-[0.14em] mb-4" style={{ color: RED }}>
                Certifications
              </h2>
              <ul className="space-y-1.5">
                {certifications.map((cert) => (
                  <li key={`${cert.name}-${cert.issuer ?? ""}`} className="text-[0.9375rem]">
                    {cert.name}
                    {cert.issuer && <span className="text-[#A3A39B]"> — {cert.issuer}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="mt-16 pt-6 border-t border-[#2A2A2C] flex flex-wrap items-center justify-between gap-4">
            <p className="font-rl-mono text-sm text-[#A3A39B]">@{profile.handle}</p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="reel"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
