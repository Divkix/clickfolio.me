import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A fashion-magazine masthead, not an executive ledger: pure black, thin gold hairlines,
// small-caps letterspaced heads, a huge vertical-feeling name treatment and real whitespace.
// Boardroom already owns the dark-and-gold/ruled-ledger look — this stays editorial instead.

const GOLD = "#C9A86A";

export const Noir: React.FC<TemplateProps> = ({ content, profile }) => {
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
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600&family=Jost:wght@300;400;500&display=swap" />
      <style>{`
        .nr-root, .nr-root :is(p, li, dt, dd, a, span, button) { font-family: 'Jost', system-ui, sans-serif; }
        .nr-root :is(h1, h2, h3) { font-family: 'Cormorant', Georgia, serif; }
      `}</style>
      <div className="nr-root min-h-screen bg-black text-[#EDEAE2] overflow-x-hidden">
        <main className="mx-auto max-w-[38rem] px-5 sm:px-8 pt-20 pb-24">
          <header className="text-center">
            <p
              className="text-[0.6875rem] font-light uppercase tracking-[0.4em]"
              style={{ color: GOLD }}
            >
              {headline || "Portfolio"}
            </p>
            <h1 className="mt-5 text-[clamp(2.75rem,9vw,5rem)] font-medium leading-[0.95] tracking-[0.02em] break-words [text-wrap:balance]">
              {full_name}
            </h1>
            <div
              aria-hidden="true"
              className="mx-auto mt-6 h-px w-20"
              style={{ backgroundColor: GOLD }}
            />
            {contact.location && (
              <p className="mt-5 text-xs uppercase tracking-[0.2em] text-[#A8A196]">
                {contact.location}
              </p>
            )}
          </header>

          {profile.avatar_url && (
            <img
              src={profile.avatar_url}
              alt=""
              width={120}
              height={120}
              className="w-28 h-28 rounded-full object-cover mx-auto mt-10 grayscale"
            />
          )}

          {summary && (
            <p className="mt-10 text-center text-lg font-light leading-relaxed text-[#CFC9BE] max-w-md mx-auto">
              {summary}
            </p>
          )}

          {contactLinks.length > 0 && (
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-1.5 text-xs uppercase tracking-[0.15em] text-[#A8A196]">
              {contactLinks
                .filter((link) => link.type !== "location")
                .map((link) => (
                  <li key={link.type} className="min-w-0 break-all">
                    {link.type === "phone" ? (
                      <a href={link.href} className="hover:text-white">
                        {link.label}
                      </a>
                    ) : (
                      <a
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                        className="hover:text-white"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
            </ul>
          )}

          {experience && experience.length > 0 && (
            <section className="mt-16">
              <h2 className="text-center text-xs font-light uppercase tracking-[0.35em] mb-10" style={{ color: GOLD }}>
                Career
              </h2>
              <div className="space-y-10">
                {experience.map((job) => (
                  <article
                    key={`${job.company}-${job.title}-${job.start_date}`}
                    className="text-center"
                  >
                    <p className="text-sm uppercase tracking-[0.15em] text-[#A8A196] tabular-nums">
                      {formatDateSpan(job.start_date, job.end_date)}
                    </p>
                    <h3 className="mt-2 text-2xl font-medium break-words [text-wrap:balance]">
                      {job.title}
                    </h3>
                    <p className="mt-1 text-[#CFC9BE]">
                      {job.company}
                      {job.location && <span> · {job.location}</span>}
                    </p>
                    {job.description && (
                      <p className="mt-3 text-[0.9375rem] font-light leading-relaxed max-w-md mx-auto text-[#CFC9BE]">
                        {job.description}
                      </p>
                    )}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-3 space-y-1 text-[0.9375rem] font-light text-[#CFC9BE] max-w-md mx-auto">
                        {job.highlights.map((highlight) => (
                          <li key={`${job.title}-${highlight}`}>{highlight}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section className="mt-16 text-center">
              <h2 className="text-xs font-light uppercase tracking-[0.35em] mb-8" style={{ color: GOLD }}>
                Selected Work
              </h2>
              <div className="space-y-6">
                {projects.map((project) => (
                  <article key={`${project.title}-${project.year ?? ""}`}>
                    <h3 className="text-xl font-medium break-words">
                      {project.url ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="ugc nofollow noopener noreferrer"
                          className="hover:underline"
                          style={{ color: GOLD }}
                        >
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                    </h3>
                    {project.description && (
                      <p className="mt-1 text-[0.9375rem] font-light text-[#CFC9BE] max-w-md mx-auto">
                        {project.description}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="mt-16 grid sm:grid-cols-2 gap-10 text-center">
            {education && education.length > 0 && (
              <section>
                <h2 className="text-xs font-light uppercase tracking-[0.35em] mb-5" style={{ color: GOLD }}>
                  Education
                </h2>
                <div className="space-y-4">
                  {education.map((edu) => (
                    <div key={`${edu.institution}-${edu.degree}`}>
                      <p className="font-medium break-words">{edu.degree}</p>
                      <p className="text-sm text-[#A8A196]">
                        {edu.institution}
                        {edu.graduation_date && (
                          <span> · {formatShortDate(edu.graduation_date)}</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(skillGroups.length > 0 || (certifications && certifications.length > 0)) && (
              <section>
                <h2 className="text-xs font-light uppercase tracking-[0.35em] mb-5" style={{ color: GOLD }}>
                  Expertise
                </h2>
                {skillGroups.length > 0 && (
                  <p className="text-sm font-light text-[#CFC9BE] leading-relaxed">
                    {skillGroups.flatMap((g) => g.items).join(" · ")}
                  </p>
                )}
                {certifications && certifications.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-[#A8A196]">
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

          <footer
            className="mt-20 pt-6 border-t flex flex-wrap items-center justify-center sm:justify-between gap-4"
            style={{ borderColor: `${GOLD}33` }}
          >
            <p className="text-xs uppercase tracking-[0.15em] text-[#A8A196]">
              {getInitials(full_name)} / @{profile.handle}
            </p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="noir"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
