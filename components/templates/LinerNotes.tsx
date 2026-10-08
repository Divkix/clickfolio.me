import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A record sleeve: the resume as an album — the name on the cover, work as numbered tracks on
// Side A, projects on Side B, skills as session personnel. Everything shown comes from the
// parsed resume; the vinyl, its label and the sleeve arc are pure CSS decoration.

const LINK_REL = "ugc nofollow noopener noreferrer";

// The cover title sits in a fixed square sleeve, so the type steps down as the name grows.
function coverTypeSize(name: string): string {
  const length = name.trim().replace(/\s+/g, " ").length;

  if (length <= 12) return "clamp(3.5rem, 10vw, 7.75rem)";

  if (length <= 24) return "clamp(2.75rem, 7.5vw, 5.75rem)";

  if (length <= 40) return "clamp(2.1rem, 5.5vw, 4.25rem)";

  if (length <= 80) return "clamp(1.6rem, 4vw, 3rem)";

  return "clamp(1.25rem, 2.75vw, 2.125rem)";
}

export const LinerNotes: React.FC<TemplateProps> = ({ content, profile }) => {
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

  const location = contact.location?.trim();
  // The location already sits bottom-right of the sleeve, so it is not repeated as a chip.
  const contactLinks = getContactLinks(contact).filter((link) => link.type !== "location");
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];
  const eduList = education ?? [];
  const certList = certifications ?? [];
  const projectList = projects ?? [];
  const hasCredits = skillGroups.length > 0 || eduList.length > 0 || certList.length > 0;
  const hasBack = experience.length > 0 || projectList.length > 0 || hasCredits;

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Instrument+Sans:wght@400;500;600&display=swap" />
      <style>{`
        .ln-root { min-height: 100vh; background: #C9D6CF; color: #1D2A33; font-family: 'Instrument Sans', system-ui, sans-serif; font-size: 1rem; line-height: 1.55; overflow-x: hidden; }
        .ln-root h1, .ln-root h2, .ln-root h3, .ln-root h4 { font-family: 'Big Shoulders Display', 'Instrument Sans', sans-serif; letter-spacing: normal; text-wrap: unset; overflow-wrap: anywhere; }
        .ln-root ::selection { background: #C8412F; color: #EEF2EF; }
        .ln-wrap { max-width: 70rem; margin: 0 auto; padding: 3.5rem 2rem 5rem; }
        .ln-cover { display: grid; grid-template-columns: minmax(0, 32.5rem) minmax(0, 1fr); gap: 8.75rem; align-items: center; }
        .ln-stack { position: relative; aspect-ratio: 1; min-width: 0; }
        .ln-record { position: absolute; inset: 4% -14% 4% 22%; border-radius: 50%; background: repeating-radial-gradient(circle, #1C1C1C 0 2px, #161616 2px 4px); box-shadow: 0 20px 40px -20px rgba(29, 42, 51, 0.6); }
        .ln-record::after { content: ""; position: absolute; inset: 34%; border-radius: 50%; background: radial-gradient(circle, #161616 0 5%, #C8412F 5.5%); }
        .ln-avatar { position: absolute; left: 50%; top: 50%; z-index: 1; width: 27%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%; object-fit: cover; }
        .ln-sleeve { position: relative; height: 100%; display: flex; flex-direction: column; justify-content: space-between; gap: 1.5rem; padding: 2.25rem; background: #1D2A33; color: #EEF2EF; overflow: hidden; }
        .ln-sleeve::before { content: ""; position: absolute; left: -70%; bottom: -80%; width: 140%; aspect-ratio: 1; border: 3.5rem solid #C8412F; border-radius: 50%; opacity: 0.95; }
        .ln-root .ln-sleeve h1 { position: relative; margin: 0; font-weight: 900; line-height: 0.82; letter-spacing: -0.01em; text-transform: uppercase; }
        .ln-credit { position: relative; margin: 0; max-width: 18ch; font-size: 1.125rem; font-weight: 500; }
        .ln-catalog { position: relative; margin: 0; align-self: flex-end; max-width: 100%; font-size: 0.8125rem; text-align: right; opacity: 0.75; }
        .ln-intro { min-width: 0; }
        .ln-root .ln-intro h2 { margin: 0 0 1rem; font-size: 2.125rem; line-height: 1.1; font-weight: 700; text-transform: uppercase; }
        .ln-summary { margin: 0; max-width: 46ch; color: #51616B; font-size: 1.0625rem; white-space: pre-line; }
        .ln-chips { margin: 1.75rem 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 0.625rem; }
        .ln-chips li { min-width: 0; }
        .ln-chip { display: inline-block; max-width: 100%; padding: 0.625rem 1rem; border: 2px solid #1D2A33; border-radius: 999px; font-size: 0.875rem; font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
        .ln-chips li:first-child .ln-chip { background: #1D2A33; color: #EEF2EF; }
        a.ln-chip:hover { background: #1D2A33; color: #EEF2EF; }
        .ln-chip:focus-visible, .ln-link:focus-visible { outline: 3px solid #C8412F; outline-offset: 3px; }
        .ln-back { margin-top: 6rem; padding: 3rem; background: #EEF2EF; display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 3.5rem; }
        .ln-left > section + section { margin-top: 3rem; }
        .ln-root h3.ln-head { display: flex; gap: 0.75rem; align-items: baseline; margin: 0; padding-bottom: 0.625rem; border-bottom: 3px solid #1D2A33; font-size: 1.375rem; line-height: 1; font-weight: 900; text-transform: uppercase; }
        .ln-head span { color: #C8412F; }
        .ln-tracks { margin: 0.5rem 0 0; padding: 0; list-style: none; counter-reset: ln-track; }
        .ln-track { counter-increment: ln-track; display: grid; grid-template-columns: 2.25rem minmax(0, 1fr) auto; gap: 0.25rem 0.75rem; padding: 1rem 0; border-bottom: 1px solid #CFD8D3; }
        .ln-track::before { content: counter(ln-track, decimal-leading-zero); font-weight: 600; color: #C8412F; font-variant-numeric: tabular-nums; }
        .ln-track b { font-weight: 600; overflow-wrap: anywhere; }
        .ln-yr { color: #51616B; font-size: 0.875rem; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
        .ln-track p { grid-column: 2 / 4; margin: 0; max-width: 60ch; font-size: 0.9375rem; overflow-wrap: anywhere; }
        .ln-co { font-weight: 600; }
        .ln-desc { color: #51616B; white-space: pre-line; }
        .ln-hi { grid-column: 2 / 4; margin: 0.3rem 0 0; padding-left: 1.1rem; list-style: disc; max-width: 60ch; color: #51616B; font-size: 0.9375rem; overflow-wrap: anywhere; }
        .ln-hi li { margin: 0.2rem 0; }
        .ln-hi li::marker { color: #C8412F; }
        .ln-credits section + section { margin-top: 2.5rem; }
        .ln-credits dl { margin: 1rem 0 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.625rem 1.125rem; font-size: 0.9375rem; }
        .ln-credits dt { font-weight: 600; overflow-wrap: anywhere; }
        .ln-credits dd { margin: 0; color: #51616B; overflow-wrap: anywhere; }
        .ln-link { color: inherit; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
        a.ln-link:hover { color: #C8412F; }
        .ln-foot { background: #1D2A33; color: #C9D6CF; }
        .ln-share { max-width: 70rem; margin: 0 auto; padding: 2rem 2rem 2.5rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; font-size: 0.9375rem; }
        @media (max-width: 53.75rem) {
          .ln-wrap { padding: 2.5rem 1.25rem 3.5rem; }
          .ln-cover { grid-template-columns: minmax(0, 1fr); gap: 3rem; }
          .ln-stack { width: 100%; max-width: 26rem; margin: 0 auto; }
          .ln-record { inset: 4% -6% 4% 30%; }
          .ln-back { grid-template-columns: minmax(0, 1fr); gap: 2.5rem; padding: 1.75rem; }
        }
      `}</style>
      <div className="ln-root">
        <main className="ln-wrap">
          <div className="ln-cover">
            <div className="ln-stack">
              <div className="ln-record" aria-hidden="true">
                {profile.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    width={140}
                    height={140}
                    className="ln-avatar"
                  />
                )}
              </div>
              <div className="ln-sleeve">
                <h1 style={{ fontSize: coverTypeSize(full_name) }}>{full_name}</h1>
                {headline && <p className="ln-credit">{headline}</p>}
                {location && <p className="ln-catalog">{location}</p>}
              </div>
            </div>

            <div className="ln-intro">
              <h2>About the record</h2>
              {summary && <p className="ln-summary">{summary}</p>}
              {contactLinks.length > 0 && (
                <ul className="ln-chips" aria-label="Contact">
                  {contactLinks.map((link) => (
                    <li key={link.type}>
                      {link.href ? (
                        <a
                          href={link.href}
                          target={link.isExternal ? "_blank" : undefined}
                          rel={link.isExternal ? LINK_REL : undefined}
                          className="ln-chip"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <span className="ln-chip">{link.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {hasBack && (
            <section className="ln-back">
              {(experience.length > 0 || projectList.length > 0) && (
                <div className="ln-left">
                  {experience.length > 0 && (
                    <section aria-labelledby="ln-side-a">
                      <h3 className="ln-head" id="ln-side-a">
                        <span>Side A</span> Experience
                      </h3>
                      <ol className="ln-tracks">
                        {experience.map((job) => {
                          const highlights = job.highlights?.filter(Boolean) ?? [];
                          const when = formatDateSpan(job.start_date, job.end_date);
                          const company = [job.company, job.location].filter(Boolean).join(" · ");

                          return (
                            <li
                              key={`${job.company}-${job.title}-${job.start_date}`}
                              className="ln-track"
                            >
                              <b>{job.title}</b>
                              {when && <span className="ln-yr">{when}</span>}
                              {company && <p className="ln-co">{company}</p>}
                              {job.description && <p className="ln-desc">{job.description}</p>}
                              {highlights.length > 0 && (
                                <ul className="ln-hi">
                                  {highlights.map((highlight) => (
                                    <li key={`${job.title}-${highlight}`}>{highlight}</li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  )}

                  {projectList.length > 0 && (
                    <section aria-labelledby="ln-side-b">
                      <h3 className="ln-head" id="ln-side-b">
                        <span>Side B</span> Projects
                      </h3>
                      <ol className="ln-tracks">
                        {projectList.map((project) => (
                          <li
                            key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                            className="ln-track"
                          >
                            <b>
                              {project.url ? (
                                <a
                                  href={project.url}
                                  target="_blank"
                                  rel={LINK_REL}
                                  className="ln-link"
                                >
                                  {project.title}
                                </a>
                              ) : (
                                project.title
                              )}
                            </b>
                            {project.year && (
                              <span className="ln-yr">{formatYear(project.year)}</span>
                            )}
                            {project.description && (
                              <p className="ln-desc">{project.description}</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                </div>
              )}

              {hasCredits && (
                <aside className="ln-credits">
                  {skillGroups.length > 0 && (
                    <section aria-labelledby="ln-crew">
                      <h3 className="ln-head" id="ln-crew">
                        Personnel
                      </h3>
                      <dl>
                        {skillGroups.flatMap((group) => [
                          <dt key={`${group.category}-term`}>{group.category}</dt>,
                          <dd key={`${group.category}-items`}>{group.items.join(", ")}</dd>,
                        ])}
                      </dl>
                    </section>
                  )}

                  {(eduList.length > 0 || certList.length > 0) && (
                    <section aria-labelledby="ln-recorded">
                      <h3 className="ln-head" id="ln-recorded">
                        Recorded at
                      </h3>
                      <dl>
                        {eduList.flatMap((edu) => [
                          <dt key={`${edu.institution}-${edu.degree}-term`}>{edu.institution}</dt>,
                          <dd key={`${edu.institution}-${edu.degree}-detail`}>
                            {[
                              edu.degree,
                              edu.graduation_date ? formatShortDate(edu.graduation_date) : null,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </dd>,
                        ])}
                        {certList.flatMap((cert) => [
                          <dt key={`${cert.name}-${cert.issuer ?? ""}-term`}>
                            {cert.url ? (
                              <a href={cert.url} target="_blank" rel={LINK_REL} className="ln-link">
                                {cert.name}
                              </a>
                            ) : (
                              cert.name
                            )}
                          </dt>,
                          <dd key={`${cert.name}-${cert.issuer ?? ""}-detail`}>
                            {[cert.issuer, cert.date ? formatShortDate(cert.date) : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </dd>,
                        ])}
                      </dl>
                    </section>
                  )}
                </aside>
              )}
            </section>
          )}
        </main>

        <footer className="ln-foot">
          <div className="ln-share">
            <span>@{profile.handle}</span>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="liner-notes"
            />
          </div>
        </footer>
      </div>
    </>
  );
};
