import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A hospital ID badge on a lanyard: identity hangs in a sticky column beside a shift log.
// Licenses and certifications lead, because that is what a recruiter checks first. Nothing is
// invented for the badge — the credentials line is only short acronyms pulled out of certification
// and degree names, ordered the way nursing writes them: licenses (RN, NP), then degrees (BSN,
// MSN), then certifications. The prototype's availability pill has no resume field, so it is
// dropped rather than faked.

const LINK_REL = "ugc nofollow noopener noreferrer";

const LICENSE_ACRONYMS = {
  RN: true,
  LPN: true,
  LVN: true,
  NP: true,
  APRN: true,
};

type Content = TemplateProps["content"];

// "Registered Nurse (RN)" -> RN, "CCRN, Adult Critical Care" -> CCRN, "BSN" -> BSN, else null.
function acronymOf(text: string): string | null {
  const cleaned = text.replace(/\./g, "").trim().toUpperCase();
  const match = cleaned.match(/\(([A-Z]{2,6})\)/) ?? cleaned.match(/^([A-Z]{2,6})(?=[,\s–-]|$)/);

  return match ? match[1] : null;
}

function credentialAcronyms(
  certifications: Content["certifications"],
  education: Content["education"],
): string[] {
  const licenses: string[] = [];
  const others: string[] = [];

  for (const cert of certifications ?? []) {
    const acronym = acronymOf(cert.name);

    if (acronym) (Object.hasOwn(LICENSE_ACRONYMS, acronym) ? licenses : others).push(acronym);
  }

  const degrees: string[] = [];

  for (const edu of education ?? []) {
    const acronym = acronymOf(edu.degree);

    if (acronym) degrees.push(acronym);
  }

  return [...new Set([...licenses, ...degrees, ...others])];
}

export const Rounds: React.FC<TemplateProps> = ({ content, profile }) => {
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
  const actionLinks = contactLinks.filter((link) => link.href && link.type !== "location");
  const emailLink = actionLinks.find((link) => link.type === "email");
  const otherLinks = actionLinks.filter((link) => link.type !== "email");
  const firstName = full_name.trim().split(/\s+/)[0];
  const creds = credentialAcronyms(certifications, education);
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap" />
      <style>{`
        .rd-root { min-height: 100vh; background: #E7EFF3; color: #123B4A; font-family: 'Atkinson Hyperlegible', system-ui, sans-serif; font-size: 1.0625rem; line-height: 1.6; overflow-x: hidden; }
        .rd-root h1, .rd-root h2, .rd-root h3, .rd-root h4 { font-family: 'Atkinson Hyperlegible', system-ui, sans-serif; letter-spacing: normal; text-wrap: unset; overflow-wrap: anywhere; }
        .rd-root a { color: inherit; }
        .rd-root a:focus-visible { outline: 3px solid #E06D5A; outline-offset: 2px; border-radius: 4px; }
        .rd-root ::selection { background: #8FB3C9; color: #123B4A; }
        .rd-layout { max-width: 72.5rem; margin: 0 auto; padding: 3rem 1.75rem 5rem; display: grid; grid-template-columns: 21.25rem minmax(0, 1fr); gap: 3rem; align-items: start; }

        /* ID badge on a lanyard */
        .rd-badge-wrap { position: sticky; top: 1.5rem; display: flex; flex-direction: column; align-items: center; min-width: 0; }
        .rd-lanyard { width: 2.125rem; height: 4rem; background: repeating-linear-gradient(90deg, #123B4A 0 6px, #8FB3C9 6px 12px); }
        .rd-clip { width: 3.375rem; height: 1.375rem; border-radius: 6px 6px 3px 3px; background: #9AA7AD; margin-top: -2px; }
        .rd-badge { width: 100%; background: #fff; border-radius: 1.125rem; overflow: hidden; margin-top: -0.375rem; box-shadow: 0 1px 0 #C9D9E1, 0 24px 48px -28px rgba(18, 59, 74, 0.55); }
        .rd-badge-top { background: #123B4A; color: #fff; padding: 0.875rem 1.25rem; display: flex; justify-content: space-between; gap: 0.75rem; font-size: 0.8125rem; }
        .rd-badge-top span { overflow-wrap: anywhere; }
        .rd-slot { width: 4rem; height: 0.5rem; border-radius: 999px; background: #E7EFF3; margin: 0.75rem auto 0; }
        .rd-photo { width: 8.25rem; height: 8.25rem; border-radius: 50%; margin: 1.25rem auto 0; border: 4px solid #fff; outline: 2px solid #C9D9E1; background: #D6E4EA; display: flex; align-items: center; justify-content: center; object-fit: cover; color: #123B4A; font-size: 2.25rem; font-weight: 700; letter-spacing: 0.04em; }
        img.rd-photo { display: block; }
        .rd-root h1.rd-name { margin: 1rem 1rem 0; text-align: center; font-size: 1.625rem; line-height: 1.2; font-weight: 700; }
        .rd-creds { margin: 0.25rem 0 0; text-align: center; font-weight: 700; color: #E06D5A; letter-spacing: 0.04em; overflow-wrap: anywhere; }
        .rd-role { margin: 0.2rem 0 0; padding: 0 1.25rem; text-align: center; color: #4C6470; overflow-wrap: anywhere; }
        .rd-actions { display: grid; gap: 0.5rem; padding: 1.25rem; }
        .rd-actions a { padding: 0.7rem 0.75rem; text-align: center; text-decoration: none; border-radius: 0.625rem; font-weight: 700; border: 2px solid #123B4A; color: #123B4A; overflow-wrap: anywhere; }
        .rd-actions a:hover { background: #E7EFF3; }
        .rd-actions a.rd-cta { background: #123B4A; color: #fff; }
        .rd-actions a.rd-cta:hover { background: #0D2F3B; }
        .rd-barcode { height: 2.125rem; margin: 0 1.25rem 1.25rem; background: repeating-linear-gradient(90deg, #123B4A 0 2px, transparent 2px 5px, #123B4A 5px 6px, transparent 6px 9px); opacity: 0.8; }

        .rd-main { min-width: 0; }
        .rd-main > * + * { margin-top: 3rem; }
        .rd-lede { margin: 0; font-size: 1.3125rem; line-height: 1.5; max-width: 52ch; white-space: pre-line; overflow-wrap: anywhere; }
        .rd-root h2 { margin: 0 0 1.125rem; font-size: 1.375rem; font-weight: 700; }

        /* Licenses are what a recruiter checks first */
        .rd-licenses { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13.75rem), 1fr)); gap: 0.875rem; }
        .rd-lic { min-width: 0; padding: 1.125rem; background: #fff; border-radius: 0.875rem; border-left: 6px solid #8FB3C9; }
        .rd-lic b { display: block; font-size: 1.1875rem; overflow-wrap: anywhere; }
        .rd-lic span { display: block; color: #4C6470; font-size: 0.9375rem; overflow-wrap: anywhere; }
        .rd-issued { margin: 0.625rem 0 0; font-size: 0.875rem; color: #123B4A; }

        /* Shift log */
        .rd-shifts { display: grid; gap: 0.75rem; }
        .rd-shift { min-width: 0; padding: 1.375rem 1.5rem; background: #fff; border-radius: 0.875rem; display: grid; grid-template-columns: 9.375rem minmax(0, 1fr); gap: 1.25rem; }
        .rd-when { margin: 0; color: #4C6470; font-size: 0.9375rem; }
        .rd-unit { display: inline-block; margin-top: 0.375rem; padding: 0.125rem 0.625rem; border-radius: 999px; background: #E7EFF3; font-size: 0.8125rem; font-weight: 700; overflow-wrap: anywhere; }
        .rd-root h3.rd-title { margin: 0; font-size: 1.1875rem; line-height: 1.3; font-weight: 700; }
        .rd-org { margin: 0.15rem 0 0; color: #4C6470; overflow-wrap: anywhere; }
        .rd-text { margin: 0.625rem 0 0; max-width: 62ch; white-space: pre-line; overflow-wrap: anywhere; }
        .rd-bullets { margin: 0.625rem 0 0; padding-left: 1.25rem; max-width: 62ch; }
        .rd-bullets li + li { margin-top: 0.25rem; }
        .rd-bullets li::marker { color: #E06D5A; }

        .rd-chips { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .rd-chips li { padding: 0.375rem 0.875rem; background: #fff; border: 1px solid #C9D9E1; border-radius: 999px; font-size: 0.9375rem; overflow-wrap: anywhere; }
        .rd-skill-group + .rd-skill-group { margin-top: 1.25rem; }
        .rd-root h3.rd-group { margin: 0 0 0.5rem; font-size: 1rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #4C6470; }

        .rd-eds { display: grid; gap: 0.75rem; }
        .rd-ed { min-width: 0; padding: 1.25rem 1.5rem; background: #fff; border-radius: 0.875rem; }
        .rd-ed b { display: block; font-size: 1.0625rem; overflow-wrap: anywhere; }
        .rd-ed .rd-chips { margin-top: 0.6rem; }
        .rd-link { text-decoration: underline; text-decoration-color: #8FB3C9; text-decoration-thickness: 2px; text-underline-offset: 2px; }
        .rd-link:hover { color: #E06D5A; }

        .rd-foot { margin-top: 4rem; background: #E7EFF3; border-top: 1px solid #C9D9E1; }
        .rd-foot-in { max-width: 72.5rem; margin: 0 auto; padding: 1.5rem 1.75rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; color: #4C6470; font-size: 0.9375rem; }
        .rd-handle { overflow-wrap: anywhere; }

        @media (max-width: 56.25rem) {
          .rd-layout { grid-template-columns: minmax(0, 1fr); }
          .rd-badge-wrap { position: static; width: 100%; max-width: 22.5rem; margin: 0 auto; }
          .rd-shift { grid-template-columns: minmax(0, 1fr); gap: 0.375rem; }
        }
      `}</style>
      <div className="rd-root">
        <div className="rd-layout">
          <aside className="rd-badge-wrap" aria-label={`${full_name}'s ID badge`}>
            <div className="rd-lanyard" aria-hidden="true" />
            <div className="rd-clip" aria-hidden="true" />
            <div className="rd-badge">
              <div className="rd-badge-top">
                <span>Portfolio</span>
                {contact.location && <span>{contact.location}</span>}
              </div>
              <div className="rd-slot" aria-hidden="true" />
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`Photograph of ${full_name}`}
                  width={132}
                  height={132}
                  className="rd-photo"
                />
              ) : (
                <div className="rd-photo" aria-hidden="true">
                  {getInitials(full_name)}
                </div>
              )}
              <h1 className="rd-name">{full_name}</h1>
              {creds.length > 0 && <p className="rd-creds">{creds.join(", ")}</p>}
              {headline && <p className="rd-role">{headline}</p>}
              {actionLinks.length > 0 && (
                <div className="rd-actions">
                  {emailLink && (
                    <a href={emailLink.href} className="rd-cta">
                      {firstName ? `Email ${firstName}` : "Email"}
                    </a>
                  )}
                  {otherLinks.map((link) => (
                    <a
                      key={link.type}
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? LINK_REL : undefined}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
              <div className="rd-barcode" aria-hidden="true" />
            </div>
          </aside>

          <main className="rd-main">
            {summary && <p className="rd-lede">{summary}</p>}

            {certifications && certifications.length > 0 && (
              <section aria-labelledby="rd-licenses">
                <h2 id="rd-licenses">Licenses and certifications</h2>
                <div className="rd-licenses">
                  {certifications.map((cert) => (
                    <div
                      key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}
                      className="rd-lic"
                    >
                      <b>
                        {cert.url ? (
                          <a href={cert.url} target="_blank" rel={LINK_REL} className="rd-link">
                            {cert.name}
                          </a>
                        ) : (
                          cert.name
                        )}
                      </b>
                      {cert.issuer && <span>{cert.issuer}</span>}
                      {cert.date && (
                        <p className="rd-issued">Issued {formatShortDate(cert.date)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {experience.length > 0 && (
              <section aria-labelledby="rd-exp">
                <h2 id="rd-exp">Experience</h2>
                <div className="rd-shifts">
                  {experience.map((job) => {
                    const highlights = job.highlights?.filter(Boolean) ?? [];
                    const when = formatDateSpan(job.start_date, job.end_date);

                    return (
                      <article
                        key={`${job.company}-${job.title}-${job.start_date}`}
                        className="rd-shift"
                      >
                        <div>
                          {when && <p className="rd-when">{when}</p>}
                          {job.company && <span className="rd-unit">{job.company}</span>}
                        </div>
                        <div>
                          <h3 className="rd-title">{job.title}</h3>
                          {job.location && <p className="rd-org">{job.location}</p>}
                          {job.description && <p className="rd-text">{job.description}</p>}
                          {highlights.length > 0 && (
                            <ul className="rd-bullets">
                              {highlights.map((highlight) => (
                                <li key={`${job.title}-${highlight}`}>{highlight}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {skillGroups.length > 0 && (
              <section aria-labelledby="rd-skills">
                <h2 id="rd-skills">Clinical skills</h2>
                {skillGroups.map((group) => (
                  <div key={group.category} className="rd-skill-group">
                    {skillGroups.length > 1 && <h3 className="rd-group">{group.category}</h3>}
                    <ul className="rd-chips">
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            {projects && projects.length > 0 && (
              <section aria-labelledby="rd-projects">
                <h2 id="rd-projects">Projects</h2>
                <div className="rd-eds">
                  {projects.map((project) => {
                    const tech = project.technologies?.filter(Boolean) ?? [];

                    return (
                      <article
                        key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                        className="rd-ed"
                      >
                        <b>
                          {project.url ? (
                            <a
                              href={project.url}
                              target="_blank"
                              rel={LINK_REL}
                              className="rd-link"
                            >
                              {project.title}
                            </a>
                          ) : (
                            project.title
                          )}
                        </b>
                        {project.year && <p className="rd-org">{formatYear(project.year)}</p>}
                        {project.description && <p className="rd-text">{project.description}</p>}
                        {tech.length > 0 && (
                          <ul className="rd-chips" aria-label="Tools and technologies">
                            {tech.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {education && education.length > 0 && (
              <section aria-labelledby="rd-edu">
                <h2 id="rd-edu">Education</h2>
                <div className="rd-eds">
                  {education.map((edu) => {
                    const detail = [
                      edu.graduation_date ? formatShortDate(edu.graduation_date) : null,
                      edu.location,
                      edu.gpa ? `GPA ${edu.gpa}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <div
                        key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
                        className="rd-ed"
                      >
                        <b>{[edu.degree, edu.institution].filter(Boolean).join(", ")}</b>
                        {detail && <p className="rd-org">{detail}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </main>
        </div>

        <footer className="rd-foot">
          <div className="rd-foot-in">
            <span className="rd-handle">@{profile.handle}</span>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="rounds"
            />
          </div>
        </footer>
      </div>
    </>
  );
};
