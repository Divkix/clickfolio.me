import { ArrowUpRight, Award, Globe, Mail, MapPin, Phone } from "lucide-react";
import type React from "react";
import { Github } from "@/components/icons/BrandIcons";
import { ShareBar } from "@/components/ShareBar";
import { type ContactLinkType, getContactLinks } from "@/lib/templates/contact-links";
import { formatDateRange, formatShortDate } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

const ACCENT = "#C4704F";

const navIconMap = {
  email: <Mail className="w-4 h-4 text-neutral-600 group-hover:text-black" aria-hidden="true" />,
  phone: <Phone className="w-4 h-4 text-neutral-600 group-hover:text-black" aria-hidden="true" />,
  linkedin: (
    <ArrowUpRight className="w-4 h-4 text-neutral-600 group-hover:text-black" aria-hidden="true" />
  ),
  github: <Github className="w-4 h-4 text-neutral-600 group-hover:text-black" aria-hidden={true} />,
  website: <Globe className="w-4 h-4 text-neutral-600 group-hover:text-black" aria-hidden="true" />,
  location: (
    <MapPin className="w-4 h-4 text-neutral-600 group-hover:text-black" aria-hidden="true" />
  ),
  behance: (
    <span className="text-xs font-bold text-neutral-600 group-hover:text-black" aria-hidden="true">
      Be
    </span>
  ),
  dribbble: (
    <span className="text-xs font-bold text-neutral-600 group-hover:text-black" aria-hidden="true">
      Dr
    </span>
  ),
} as const satisfies Record<ContactLinkType, React.ReactNode>;

const noiseBg = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`,
};

const SectionTitle = ({ title, count }: { title: string; count?: number }) => (
  <div className="flex items-center gap-3 mb-10 md:mb-14">
    <div className="flex-1 h-px bg-black/10" />
    <span className="text-xs text-neutral-300" aria-hidden="true">
      ✦
    </span>
    <h2 className="font-serif-me text-sm font-normal uppercase tracking-[0.22em] text-black [text-wrap:unset]">
      {title}
    </h2>
    {count !== undefined && (
      <span className="text-xs font-mono text-neutral-400">
        ({count.toString().padStart(2, "0")})
      </span>
    )}
    <div className="flex-1 h-px bg-black/10" />
  </div>
);

export const MinimalistEditorial: React.FC<TemplateProps> = ({ content, profile, isPreview }) => {
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

  const [firstName, ...rest] = full_name.split(" ");
  const lastName = rest.join(" ");
  const contactLinks = getContactLinks(contact);
  const emailLink = contactLinks.find((link) => link.type === "email");

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" />
      <style>{`
        .font-serif-me { font-family: 'Instrument Serif', serif; }
      `}</style>
      <div className="relative min-h-screen bg-[#FDFCF8] text-[#1a1a1a] font-sans selection:bg-[#C4704F] selection:text-white overflow-x-hidden">
        <div
          className="fixed inset-0 pointer-events-none z-0 opacity-40 mix-blend-overlay"
          style={noiseBg}
          aria-hidden="true"
        />

        {!isPreview && (
          <nav
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl pb-[env(safe-area-inset-bottom)]"
            aria-label="Contact navigation"
          >
            <div className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 bg-white/90 backdrop-blur-md border border-black/8 rounded-full shadow-xl shadow-black/8 overflow-x-auto no-scrollbar">
              <span className="hidden sm:inline text-[11px] font-bold tracking-widest uppercase text-neutral-400 shrink-0 px-2">
                {profile.handle}
              </span>
              {contactLinks
                .filter((link) => link.type !== "location")
                .map((link) => (
                  <a
                    key={link.type}
                    href={link.href}
                    target={link.isExternal ? "_blank" : undefined}
                    rel={link.isExternal ? "noreferrer" : undefined}
                    className="group relative p-2.5 rounded-full hover:bg-neutral-100 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                    aria-label={link.label}
                  >
                    {navIconMap[link.type]}
                    <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-[10px] tracking-wide rounded opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity whitespace-nowrap">
                      {link.label}
                    </span>
                  </a>
                ))}
            </div>
          </nav>
        )}

        <main className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 pt-20 md:pt-28 pb-36">
          <header className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 mb-24 lg:mb-36 border-b border-black/10 pb-16 md:pb-24">
            <div className="lg:col-span-7 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-400 mb-6">
                Portfolio
              </p>
              <h1 className="flex flex-col font-serif-me text-[clamp(3.25rem,9vw,7.5rem)] leading-[0.88] tracking-tight text-black [text-wrap:unset] break-words">
                <span className="block">{firstName}</span>
                {lastName ? (
                  <span className="block italic font-normal text-neutral-400 mt-1">{lastName}</span>
                ) : null}
              </h1>
            </div>

            <div className="lg:col-span-5 flex flex-col justify-end min-w-0 space-y-6">
              {headline && (
                <p className="text-xl md:text-2xl font-serif-me italic text-neutral-800 leading-snug">
                  {headline}
                </p>
              )}
              {summary && (
                <p className="text-base leading-relaxed text-neutral-600 max-w-md">{summary}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {contact.location && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-black/10 rounded-full text-[11px] font-medium uppercase tracking-widest text-neutral-500">
                    <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate max-w-[220px]">{contact.location}</span>
                  </span>
                )}
              </div>
              <div className="pt-6 border-t border-black/5">
                <ShareBar
                  handle={profile.handle}
                  title={`${full_name}'s Portfolio`}
                  name={full_name}
                  variant="minimalist-editorial"
                />
              </div>
            </div>
          </header>

          {experience && experience.length > 0 && (
            <section className="mb-24 md:mb-32" aria-label="Experience">
              <SectionTitle title="Experience" count={experience.length} />
              <div>
                {experience.map((job, index) => (
                  <article
                    key={`${job.company}-${job.title}-${index}`}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-8 py-8 border-b border-black/8 last:border-b-0"
                  >
                    <div className="md:col-span-3 min-w-0">
                      <span className="font-mono text-[11px] text-neutral-400 block mb-1">
                        {formatDateRange(job.start_date, job.end_date)}
                      </span>
                      <span className="text-sm font-semibold tracking-wide text-neutral-900 break-words">
                        {job.company}
                      </span>
                      {job.location && (
                        <p className="text-xs text-neutral-400 mt-1">{job.location}</p>
                      )}
                    </div>

                    <div className="md:col-span-9 min-w-0">
                      <h3 className="text-2xl md:text-3xl font-serif-me italic text-neutral-900 mb-3 [text-wrap:unset] break-words">
                        {job.title}
                      </h3>
                      {job.description && (
                        <p className="text-sm text-neutral-600 leading-relaxed mb-3 max-w-2xl">
                          {job.description}
                        </p>
                      )}
                      {job.highlights && job.highlights.length > 0 && (
                        <ul className="space-y-1.5">
                          {job.highlights.slice(0, 4).map((highlight, i) => (
                            <li
                              key={`${job.title}-${highlight}-${i}`}
                              className="text-sm text-neutral-500 leading-relaxed pl-4 relative before:absolute before:left-0 before:top-[0.55em] before:w-1.5 before:h-px before:bg-neutral-300"
                            >
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section className="mb-24 md:mb-32" aria-label="Selected works">
              <SectionTitle title="Selected Works" count={projects.length} />
              <div className="flex flex-col border-t border-black/10">
                {projects.map((project, index) => {
                  const Wrapper = project.url ? "a" : "div";
                  return (
                    <Wrapper
                      key={`${project.title}-${index}`}
                      {...(project.url
                        ? {
                            href: project.url,
                            target: "_blank" as const,
                            rel: "noopener noreferrer",
                          }
                        : {})}
                      className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/10 py-8 md:py-10 px-1 md:px-3 -mx-1 md:mx-0 rounded-none hover:bg-[#C4704F] hover:text-white hover:border-transparent transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4704F]"
                    >
                      <div className="md:w-[42%] min-w-0">
                        <h3 className="text-3xl md:text-4xl font-serif-me font-light tracking-tight mb-2 group-hover:italic break-words [text-wrap:unset]">
                          {project.title}
                        </h3>
                        {project.technologies && project.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 opacity-60 group-hover:opacity-90">
                            {project.technologies.slice(0, 4).map((tech, i) => (
                              <span
                                key={`${project.title}-${tech}-${i}`}
                                className="text-[11px] uppercase tracking-widest"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {project.description && (
                        <p className="md:w-[42%] opacity-70 group-hover:opacity-95 font-light leading-relaxed text-sm min-w-0">
                          {project.description}
                        </p>
                      )}

                      <div className="hidden md:flex w-10 shrink-0 justify-end">
                        {project.url && (
                          <ArrowUpRight
                            className="w-7 h-7 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-[transform,opacity] duration-300"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </Wrapper>
                  );
                })}
              </div>
            </section>
          )}

          {(education && education.length > 0) || (skills && skills.length > 0) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 mb-24 md:mb-32">
              {education && education.length > 0 && (
                <section aria-label="Education" className="min-w-0">
                  <SectionTitle title="Education" />
                  <div className="space-y-8">
                    {education.map((edu, index) => (
                      <div
                        key={`${edu.institution}-${index}`}
                        className="border-l-2 border-neutral-200 pl-6 py-1 hover:border-black transition-colors duration-300"
                      >
                        <div className="flex justify-between items-baseline gap-4 mb-1">
                          <h3 className="font-semibold text-lg break-words [text-wrap:unset]">
                            {edu.institution}
                          </h3>
                          {edu.graduation_date && (
                            <span className="text-xs font-mono text-neutral-400 shrink-0">
                              {formatShortDate(edu.graduation_date)}
                            </span>
                          )}
                        </div>
                        <p className="font-serif-me italic text-neutral-600 mb-2">{edu.degree}</p>
                        {edu.gpa && (
                          <p className="text-xs bg-neutral-100 inline-block px-2 py-1 rounded">
                            GPA {edu.gpa}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {skills && skills.length > 0 && (
                <section aria-label="Technical skills" className="min-w-0">
                  <SectionTitle title="Technical Skills" />
                  <div className="flex flex-wrap content-start gap-2">
                    {skills
                      .flatMap((s) => s.items)
                      .map((skill, i) => (
                        <span
                          key={`skill-${skill}-${i}`}
                          className="px-3.5 py-1.5 bg-white border border-black/10 text-sm hover:bg-[#C4704F] hover:text-white hover:border-[#C4704F] transition-colors duration-200"
                        >
                          {skill}
                        </span>
                      ))}
                  </div>
                </section>
              )}
            </div>
          ) : null}

          {certifications && certifications.length > 0 && (
            <section className="mb-24 md:mb-32" aria-label="Certifications">
              <SectionTitle title="Certifications" count={certifications.length} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {certifications.map((cert, index) => (
                  <div
                    key={`${cert.name}-${index}`}
                    className="border border-black/10 p-6 hover:border-black/25 transition-colors duration-300 min-w-0"
                  >
                    <div className="flex items-start gap-3">
                      <Award
                        className="w-5 h-5 text-neutral-400 mt-1 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif-me text-lg italic mb-1 break-words">
                          {cert.name}
                        </h3>
                        <p className="text-sm text-neutral-600 font-medium">{cert.issuer}</p>
                        {cert.date && (
                          <p className="text-xs text-neutral-400 mt-2">
                            {formatShortDate(cert.date)}
                          </p>
                        )}
                        {cert.url && (
                          <a
                            href={cert.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-black mt-2 transition-colors focus-visible:outline-none focus-visible:underline"
                          >
                            View credential <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <footer className="flex flex-col items-center justify-center pt-16 md:pt-20 border-t border-black/10 text-center">
            <p className="font-serif-me italic text-2xl md:text-3xl mb-4 text-neutral-800">
              Let&apos;s make something lasting.
            </p>
            {emailLink && (
              <a
                href={emailLink.href}
                className="mb-8 text-sm font-medium tracking-wide underline decoration-neutral-300 underline-offset-4 hover:decoration-[#C4704F] hover:text-[#C4704F] transition-colors"
                style={{ textDecorationColor: ACCENT }}
              >
                {emailLink.label}
              </a>
            )}
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] flex gap-4 text-neutral-400">
              <span suppressHydrationWarning>{new Date().getFullYear()}</span>
              <span aria-hidden="true">•</span>
              <span>{profile.handle}</span>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
};
