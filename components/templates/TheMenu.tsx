import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// An elegant tasting-menu card: a small-caps course label above each job like a menu
// listing, a thin gold rule under the header, warm charcoal-on-cream paper.

const GOLD = "#A9842F";

const COURSE_LABELS = ["First Course", "Second Course", "Entrée", "Fourth Course", "Fifth Course"];

export const TheMenu: React.FC<TemplateProps> = ({ content, profile }) => {
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
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@400;500;600&display=swap" />
      <style>{`
        .tm-root, .tm-root :is(p, li, dt, dd, a, span, button) { font-family: 'Jost', system-ui, sans-serif; }
        .tm-root :is(h1, h2, h3) { font-family: 'Cormorant Garamond', Georgia, serif; }
      `}</style>
      <div className="tm-root min-h-screen bg-[#F7F1E6] text-[#2B2620] overflow-x-hidden">
        <main className="mx-auto max-w-[36rem] px-5 sm:px-8 pt-16 pb-24">
          <header className="text-center">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                width={88}
                height={88}
                className="w-20 h-20 rounded-full object-cover mx-auto grayscale-[10%]"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-xl font-semibold text-white"
                style={{ backgroundColor: "#2B2620" }}
              >
                {getInitials(full_name)}
              </div>
            )}
            <h1 className="mt-5 text-[clamp(2rem,6vw,3rem)] font-semibold leading-tight break-words [text-wrap:balance]">
              {full_name}
            </h1>
            {headline && (
              <p className="mt-2 text-lg italic text-[#5E5648]">{headline}</p>
            )}
            <div
              aria-hidden="true"
              className="mx-auto mt-5 h-px w-24"
              style={{ backgroundColor: GOLD }}
            />
            {contactLinks.length > 0 && (
              <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm text-[#5E5648]">
                {contactLinks.map((link) => (
                  <li key={link.type} className="min-w-0 break-all">
                    {link.type === "location" ? (
                      link.label
                    ) : link.type === "phone" ? (
                      <a href={link.href} className="hover:text-[#2B2620]">
                        {link.label}
                      </a>
                    ) : (
                      <a
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                        className="hover:text-[#2B2620]"
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
            <p className="mt-10 text-center text-lg italic leading-relaxed text-[#443E34]">
              {summary}
            </p>
          )}

          {experience && experience.length > 0 && (
            <section className="mt-14">
              <h2 className="text-center text-sm font-medium uppercase tracking-[0.25em] mb-8" style={{ color: GOLD }}>
                The Menu
              </h2>
              <div className="space-y-10">
                {experience.map((job, i) => (
                  <article key={`${job.company}-${job.title}-${job.start_date}`} className="text-center">
                    <p className="text-xs uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                      {COURSE_LABELS[i] ?? `Course ${i + 1}`}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold break-words [text-wrap:balance]">
                      {job.title}
                    </h3>
                    <p className="mt-1 text-[#5E5648]">
                      {job.company}
                      {job.location && <span> · {job.location}</span>}
                    </p>
                    <p className="text-sm tabular-nums text-[#8A8071] mt-0.5">
                      {formatDateSpan(job.start_date, job.end_date)}
                    </p>
                    {job.description && (
                      <p className="mt-3 text-[0.9375rem] leading-relaxed max-w-md mx-auto">
                        {job.description}
                      </p>
                    )}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-3 space-y-1 text-[0.9375rem] max-w-md mx-auto">
                        {job.highlights.map((highlight) => (
                          <li key={`${job.title}-${highlight}`}>{highlight}</li>
                        ))}
                      </ul>
                    )}
                    <div
                      aria-hidden="true"
                      className="mx-auto mt-8 h-px w-16"
                      style={{ backgroundColor: `${GOLD}55` }}
                    />
                  </article>
                ))}
              </div>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section className="mt-12">
              <h2 className="text-center text-sm font-medium uppercase tracking-[0.25em] mb-6" style={{ color: GOLD }}>
                Chef's Specials
              </h2>
              <div className="space-y-5 text-center">
                {projects.map((project) => (
                  <article key={`${project.title}-${project.year ?? ""}`}>
                    <h3 className="text-xl font-semibold break-words">
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
                    </h3>
                    {project.description && (
                      <p className="mt-1 text-[0.9375rem] max-w-md mx-auto">{project.description}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="mt-12 grid sm:grid-cols-2 gap-10 text-center sm:text-left">
            {education && education.length > 0 && (
              <section>
                <h2 className="text-sm font-medium uppercase tracking-[0.25em] mb-4" style={{ color: GOLD }}>
                  Training
                </h2>
                <div className="space-y-3">
                  {education.map((edu) => (
                    <div key={`${edu.institution}-${edu.degree}`}>
                      <p className="font-semibold break-words">{edu.degree}</p>
                      <p className="text-sm text-[#5E5648]">
                        {edu.institution}
                        {edu.graduation_date && <span> · {formatShortDate(edu.graduation_date)}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(skillGroups.length > 0 || (certifications && certifications.length > 0)) && (
              <section>
                <h2 className="text-sm font-medium uppercase tracking-[0.25em] mb-4" style={{ color: GOLD }}>
                  Palate
                </h2>
                {skillGroups.length > 0 && (
                  <p className="text-[0.9375rem] leading-relaxed">
                    {skillGroups.flatMap((g) => g.items).join(" · ")}
                  </p>
                )}
                {certifications && certifications.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-[#5E5648]">
                    {certifications.map((cert) => (
                      <li key={`${cert.name}-${cert.issuer ?? ""}`} className="break-words">
                        {cert.name}
                        {cert.issuer && <span> — {cert.issuer}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          <footer className="mt-16 pt-6 border-t flex flex-wrap items-center justify-center sm:justify-between gap-4" style={{ borderColor: `${GOLD}33` }}>
            <p className="text-sm text-[#8A8071]">@{profile.handle}</p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="the-menu"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
