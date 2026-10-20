import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A founder's deck: a cover slide, then every section as a numbered slide with a tab in the
// corner. White slides, one confident blue, generous padding.

const BLUE = "#2F5CFF";

const DOT_GRID_LIGHT: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(47,92,255,0.09) 1px, transparent 1px)",
  backgroundSize: "20px 20px",
};

const DOT_GRID_ON_BLUE: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

function Slide({
  n,
  total,
  title,
  children,
}: {
  n: number;
  total: number;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="relative rounded-2xl border-2 border-[#E7E9F5] bg-white px-6 sm:px-10 py-8 mt-7 shadow-[0_10px_28px_-18px_rgba(47,92,255,0.35)]">
      <span
        className="absolute -top-3 left-6 sm:left-10 text-[0.6875rem] font-bold tabular-nums rounded-full px-2.5 py-1 text-white"
        style={{ backgroundColor: BLUE }}
      >
        {String(n).padStart(2, "0")}
        <span className="opacity-60">/{String(total).padStart(2, "0")}</span>
      </span>
      <h2 className="text-sm font-extrabold uppercase tracking-[0.1em] text-[#6B6F8A] mb-5">
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export const PitchDeck: React.FC<TemplateProps> = ({ content, profile }) => {
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

  const sectionOrder = [
    summary ? "summary" : null,
    experience && experience.length > 0 ? "experience" : null,
    projects && projects.length > 0 ? "projects" : null,
    skillGroups.length > 0 ? "skills" : null,
    education && education.length > 0 ? "education" : null,
    certifications && certifications.length > 0 ? "certifications" : null,
  ].filter((key): key is string => key !== null);

  const slideNumber = (key: string) => sectionOrder.indexOf(key) + 2;
  const totalSlides = sectionOrder.length + 1;

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" />
      <style>{`
        .font-pd-body, .font-pd-body :is(h1, h2, h3, p, li, dt, dd, a, span) { font-family: 'Space Grotesk', ui-sans-serif, sans-serif; }
      `}</style>
      <div
        className="font-pd-body min-h-screen bg-[#F4F5FB] text-[#191B2B] overflow-x-hidden"
        style={DOT_GRID_LIGHT}
      >
        <main className="mx-auto max-w-[48rem] px-5 sm:px-8 pt-14 pb-24">
          <section
            className="relative rounded-2xl px-6 sm:px-10 py-12 text-white overflow-hidden shadow-[0_18px_40px_-20px_rgba(47,92,255,0.55)]"
            style={{ backgroundColor: BLUE }}
          >
            <div className="absolute inset-0 z-0" style={DOT_GRID_ON_BLUE} aria-hidden="true" />
            <div
              className="absolute -right-10 -top-10 z-0 h-40 w-40 rounded-full opacity-25"
              style={{ background: "radial-gradient(circle, #FFFFFF, transparent 70%)" }}
              aria-hidden="true"
            />
            <span className="absolute z-10 -top-3 left-6 sm:left-10 text-[0.6875rem] font-bold tabular-nums rounded-full px-2.5 py-1 bg-white text-[#191B2B]">
              01<span className="opacity-50">/{String(totalSlides).padStart(2, "0")}</span>
            </span>
            <div className="relative z-10 flex flex-wrap items-center gap-6">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  width={88}
                  height={88}
                  className="w-[5.5rem] h-[5.5rem] rounded-xl object-cover shrink-0 ring-2 ring-white/30"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="w-[5.5rem] h-[5.5rem] rounded-xl bg-white/15 flex items-center justify-center text-2xl font-bold shrink-0"
                >
                  {getInitials(full_name)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-[clamp(1.875rem,5.5vw,2.75rem)] font-bold leading-[1.05] break-words">
                  {full_name}
                </h1>
                {headline && <p className="mt-1.5 text-lg text-white/90 break-words">{headline}</p>}
              </div>
            </div>

            {contactLinks.length > 0 && (
              <ul className="relative z-10 mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {contactLinks.map((link) => (
                  <li key={link.type} className="min-w-0 break-all">
                    {link.href ? (
                      <a
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                        className="underline underline-offset-2 hover:text-white/80"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span className="text-white/80">{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {summary && (
            <Slide n={slideNumber("summary")} total={totalSlides} title="The One-Liner">
              <p className="text-[1.0625rem] leading-[1.7]">{summary}</p>
            </Slide>
          )}

          {experience && experience.length > 0 && (
            <Slide n={slideNumber("experience")} total={totalSlides} title="Traction">
              <div className="space-y-6">
                {experience.map((job) => (
                  <article
                    key={`${job.company}-${job.title}-${job.start_date}`}
                    className="min-w-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-lg font-bold break-words">{job.title}</h3>
                      <p className="text-sm text-[#6B6F8A] tabular-nums shrink-0">
                        {formatDateSpan(job.start_date, job.end_date)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: BLUE }}>
                      {job.company}
                      {job.location && (
                        <span className="text-[#6B6F8A] font-normal">, {job.location}</span>
                      )}
                    </p>
                    {job.description && <p className="mt-2 text-[0.9375rem]">{job.description}</p>}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-2 grid gap-1.5">
                        {job.highlights.map((highlight) => (
                          <li
                            key={`${job.title}-${highlight}`}
                            className="text-[0.9375rem] rounded-lg bg-[#F4F5FB] px-3 py-2"
                          >
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </Slide>
          )}

          {projects && projects.length > 0 && (
            <Slide n={slideNumber("projects")} total={totalSlides} title="Side Bets">
              <div className="grid sm:grid-cols-2 gap-4">
                {projects.map((project) => (
                  <div key={`${project.title}-${project.year ?? ""}`} className="min-w-0">
                    <h3 className="font-bold break-words">
                      {project.url ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="ugc nofollow noopener noreferrer"
                          className="hover:underline"
                          style={{ color: BLUE }}
                        >
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                    </h3>
                    {project.description && (
                      <p className="mt-1 text-sm text-[#44475E]">{project.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </Slide>
          )}

          {skillGroups.length > 0 && (
            <Slide n={slideNumber("skills")} total={totalSlides} title="Stack">
              <div className="flex flex-wrap gap-2">
                {skillGroups
                  .flatMap((g) => g.items)
                  .map((item) => (
                    <span
                      key={item}
                      className="text-sm font-semibold rounded-full px-3.5 py-1.5"
                      style={{ backgroundColor: `${BLUE}14`, color: BLUE }}
                    >
                      {item}
                    </span>
                  ))}
              </div>
            </Slide>
          )}

          {education && education.length > 0 && (
            <Slide n={slideNumber("education")} total={totalSlides} title="Background">
              <div className="space-y-3">
                {education.map((edu) => (
                  <div key={`${edu.institution}-${edu.degree}`} className="min-w-0">
                    <p className="font-bold break-words">{edu.degree}</p>
                    <p className="text-sm text-[#6B6F8A]">
                      {edu.institution}
                      {edu.graduation_date && (
                        <span> · {formatShortDate(edu.graduation_date)}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </Slide>
          )}

          {certifications && certifications.length > 0 && (
            <Slide n={slideNumber("certifications")} total={totalSlides} title="Credentials">
              <ul className="space-y-1.5">
                {certifications.map((cert) => (
                  <li key={`${cert.name}-${cert.issuer ?? ""}`} className="text-[0.9375rem]">
                    <span className="font-semibold">{cert.name}</span>
                    {cert.issuer && <span className="text-[#6B6F8A]"> — {cert.issuer}</span>}
                  </li>
                ))}
              </ul>
            </Slide>
          )}

          <footer className="mt-10 pt-6 border-t border-[#E7E9F5] flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[#6B6F8A]">@{profile.handle}</p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="pitch-deck"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
