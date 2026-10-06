import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A craft-paper desk: taped index cards, sticky-note skills and a polaroid portrait, tilted a
// degree or two. Education leads because students usually have more of it than experience.
// Tilts are fixed by position in the list, so server and client markup always match.

const LINK_REL = "ugc nofollow noopener noreferrer";

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="sb-h2">{children}</h2>;
}

export const Scrapbook: React.FC<TemplateProps> = ({ content, profile }) => {
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
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap" />
      <style>{`
        .sb-root { min-height: 100vh; background-color: #F1E6D3; background-image: radial-gradient(rgba(120, 90, 50, 0.16) 1px, transparent 1.2px); background-size: 18px 18px; color: #2B2622; font-family: 'DM Sans', system-ui, sans-serif; font-size: 1rem; line-height: 1.6; overflow-x: hidden; }
        .sb-root h1, .sb-root h2, .sb-root h3 { text-wrap: unset; overflow-wrap: anywhere; }
        .sb-root h1, .sb-root h2 { font-family: 'Caveat', 'Comic Sans MS', cursive; color: #2B2622; }
        .sb-root h3 { font-family: 'DM Sans', system-ui, sans-serif; color: #2B2622; }
        .sb-root ::selection { background: #FFD84D; }
        .sb-wrap { max-width: 64rem; margin: 0 auto; padding: clamp(1.5rem, 5vw, 3.5rem) 1.25rem 5rem; }
        .sb-top { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2rem; align-items: center; }
        @media (min-width: 48rem) { .sb-top { grid-template-columns: 15rem minmax(0, 1fr); gap: 3rem; } }
        .sb-polaroid { position: relative; width: 13rem; margin: 0 auto; padding: 0.7rem 0.7rem 2.6rem; background: #fff; box-shadow: 0 6px 16px rgba(60, 40, 10, 0.25); transform: rotate(-3deg); }
        .sb-polaroid-img, .sb-polaroid-fill { width: 100%; aspect-ratio: 1; object-fit: cover; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #F7B7A3, #FFD84D); font-family: 'Caveat', cursive; font-size: 4.5rem; font-weight: 700; color: #2B2622; }
        .sb-polaroid-cap { position: absolute; left: 0; right: 0; bottom: 0.55rem; text-align: center; font-family: 'Caveat', cursive; font-size: 1.35rem; color: #2B2622; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding: 0 0.6rem; }
        .sb-tape { position: absolute; width: 5.2rem; height: 1.6rem; background: rgba(255, 216, 77, 0.75); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15); }
        .sb-polaroid .sb-tape { top: -0.8rem; left: 50%; margin-left: -2.6rem; transform: rotate(3deg); }
        .sb-root h1.sb-name { margin: 0; font-size: clamp(3.2rem, 10vw, 6rem); line-height: 0.95; font-weight: 700; }
        .sb-headline { display: inline; margin: 0.8rem 0 0; font-size: 1.25rem; font-weight: 500; background: linear-gradient(transparent 55%, #FFD84D 55%); padding: 0 0.2rem; box-decoration-break: clone; -webkit-box-decoration-break: clone; overflow-wrap: anywhere; }
        .sb-headline-wrap { margin: 0.9rem 0 0; line-height: 1.9; }
        .sb-contact { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1.25rem 0 0; padding: 0; list-style: none; }
        .sb-contact li { min-width: 0; }
        .sb-pill { display: inline-block; max-width: 100%; padding: 0.3rem 0.85rem; border: 2px solid #2B2622; border-radius: 999px; background: #fff; color: #2B2622; font-size: 0.9rem; font-weight: 500; text-decoration: none; overflow-wrap: anywhere; box-shadow: 2px 2px 0 #2B2622; }
        .sb-contact li:nth-child(4n+1) .sb-pill { background: #FFD84D; transform: rotate(-1.5deg); }
        .sb-contact li:nth-child(4n+2) .sb-pill { background: #BFE3D0; transform: rotate(1deg); }
        .sb-contact li:nth-child(4n+3) .sb-pill { background: #F7B7A3; transform: rotate(-0.5deg); }
        .sb-contact li:nth-child(4n+4) .sb-pill { background: #BCD7F2; transform: rotate(1.5deg); }
        a.sb-pill:hover { box-shadow: 4px 4px 0 #2B2622; }
        a.sb-pill:focus-visible, .sb-link:focus-visible { outline: 3px solid #2B2622; outline-offset: 3px; }
        .sb-notebook { position: relative; margin-top: 2.5rem; padding: 1.4rem 1.5rem 1.4rem 4rem; background: #fff; background-image: repeating-linear-gradient(transparent 0 1.7rem, #BCD7F2 1.7rem 1.75rem); border-left: 0; box-shadow: 0 4px 12px rgba(60, 40, 10, 0.18); transform: rotate(0.4deg); white-space: pre-line; line-height: 1.75rem; }
        .sb-notebook::before { content: ""; position: absolute; top: 0; bottom: 0; left: 2.6rem; width: 2px; background: #F29B8B; }
        @media (max-width: 36rem) { .sb-notebook { padding-left: 2.4rem; } .sb-notebook::before { left: 1.4rem; } }
        .sb-section { margin-top: clamp(2.75rem, 7vw, 4.5rem); }
        .sb-root .sb-h2 { margin: 0 0 1.5rem; display: inline-block; font-size: clamp(2.2rem, 5vw, 3rem); line-height: 1; font-weight: 700; border-bottom: 5px solid #FFD84D; }
        .sb-cards { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.75rem 1.5rem; }
        @media (min-width: 44rem) { .sb-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .sb-card { position: relative; min-width: 0; padding: 1.6rem 1.35rem 1.35rem; background: #FFFDF8; box-shadow: 0 4px 12px rgba(60, 40, 10, 0.2); }
        .sb-cards > .sb-card:nth-child(4n+1) { transform: rotate(-0.8deg); }
        .sb-cards > .sb-card:nth-child(4n+2) { transform: rotate(0.7deg); }
        .sb-cards > .sb-card:nth-child(4n+3) { transform: rotate(0.5deg); }
        .sb-cards > .sb-card:nth-child(4n+4) { transform: rotate(-0.6deg); }
        .sb-card .sb-tape { top: -0.7rem; left: 1.2rem; transform: rotate(-4deg); }
        .sb-cards > .sb-card:nth-child(2n) .sb-tape { left: auto; right: 1.2rem; transform: rotate(5deg); background: rgba(247, 183, 163, 0.8); }
        .sb-root .sb-card h3 { margin: 0; font-size: 1.2rem; line-height: 1.25; font-weight: 700; }
        .sb-sub { margin: 0.2rem 0 0; font-size: 0.92rem; color: #5B524A; overflow-wrap: anywhere; }
        .sb-when { margin: 0.55rem 0 0; display: inline-block; padding: 0 0.5rem; background: #BFE3D0; border-radius: 0.2rem; font-size: 0.82rem; font-weight: 700; }
        .sb-text { margin: 0.7rem 0 0; white-space: pre-line; }
        .sb-list { margin: 0.6rem 0 0; padding-left: 1.3rem; list-style: none; }
        .sb-list li { position: relative; margin: 0.3rem 0; }
        .sb-list li::before { content: "★"; position: absolute; left: -1.3rem; color: #E8A317; font-size: 0.8rem; top: 0.2rem; }
        .sb-pin { position: absolute; top: -0.55rem; left: 50%; width: 1.1rem; height: 1.1rem; margin-left: -0.55rem; border-radius: 50%; background: #E5533D; box-shadow: inset -2px -2px 0 rgba(0, 0, 0, 0.25), 0 2px 3px rgba(0, 0, 0, 0.3); }
        .sb-link { color: inherit; text-decoration: underline; text-decoration-thickness: 2px; text-decoration-color: #E5533D; text-underline-offset: 3px; }
        .sb-link:hover { background: #FFD84D; }
        .sb-tags { margin: 0.8rem 0 0; display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0; list-style: none; }
        .sb-tags li { padding: 0.05rem 0.55rem; border: 1.5px solid #2B2622; border-radius: 999px; font-size: 0.8rem; font-weight: 500; overflow-wrap: anywhere; }
        .sb-notes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13.5rem), 1fr)); gap: 1.5rem; }
        .sb-note { min-width: 0; padding: 1.25rem 1.1rem 1.4rem; box-shadow: 3px 5px 10px rgba(60, 40, 10, 0.22); }
        .sb-notes > .sb-note:nth-child(4n+1) { background: #FFE97A; transform: rotate(-1.5deg); }
        .sb-notes > .sb-note:nth-child(4n+2) { background: #F7B7A3; transform: rotate(1.2deg); }
        .sb-notes > .sb-note:nth-child(4n+3) { background: #BFE3D0; transform: rotate(-0.8deg); }
        .sb-notes > .sb-note:nth-child(4n+4) { background: #BCD7F2; transform: rotate(1.6deg); }
        .sb-note h3 { margin: 0; font-family: 'Caveat', cursive; font-size: 1.7rem; line-height: 1; font-weight: 700; }
        .sb-note ul { margin: 0.6rem 0 0; padding: 0; list-style: none; }
        .sb-note li { margin: 0.15rem 0; overflow-wrap: anywhere; }
        .sb-ticket { position: relative; min-width: 0; padding: 1.1rem 1.3rem; background: #fff; border: 2px dashed #2B2622; border-radius: 0.4rem; }
        .sb-tickets { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.25rem; }
        @media (min-width: 44rem) { .sb-tickets { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .sb-tickets > .sb-ticket:nth-child(odd) { transform: rotate(-0.6deg); }
        .sb-tickets > .sb-ticket:nth-child(even) { transform: rotate(0.6deg); }
        .sb-ticket-label { margin: 0 0 0.3rem; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #E5533D; }
        .sb-root .sb-ticket h3 { margin: 0; font-size: 1.15rem; line-height: 1.25; font-weight: 700; }
        .sb-foot { margin-top: clamp(3.5rem, 9vw, 5.5rem); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
        .sb-sign { font-family: 'Caveat', cursive; font-size: 1.8rem; font-weight: 700; overflow-wrap: anywhere; }
        @media (prefers-reduced-motion: reduce) { .sb-root * { transition: none !important; } }
      `}</style>
      <div className="sb-root">
        <div className="sb-wrap">
          <header>
            <div className="sb-top">
              <figure className="sb-polaroid">
                <span className="sb-tape" aria-hidden="true" />
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    width={176}
                    height={176}
                    className="sb-polaroid-img"
                  />
                ) : (
                  <div className="sb-polaroid-fill" aria-hidden="true">
                    {getInitials(full_name)}
                  </div>
                )}
                <figcaption className="sb-polaroid-cap">@{profile.handle}</figcaption>
              </figure>
              <div style={{ minWidth: 0 }}>
                <h1 className="sb-name">{full_name}</h1>
                {headline && (
                  <p className="sb-headline-wrap">
                    <span className="sb-headline">{headline}</span>
                  </p>
                )}
                {contactLinks.length > 0 && (
                  <ul className="sb-contact" aria-label="Contact">
                    {contactLinks.map((link) => (
                      <li key={link.type}>
                        {link.href ? (
                          <a
                            href={link.href}
                            target={link.isExternal ? "_blank" : undefined}
                            rel={link.isExternal ? LINK_REL : undefined}
                            className="sb-pill"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <span className="sb-pill">{link.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {summary && <p className="sb-notebook">{summary}</p>}
          </header>

          <main>
            {education && education.length > 0 && (
              <section className="sb-section" aria-labelledby="sb-edu">
                <Heading>
                  <span id="sb-edu">Education</span>
                </Heading>
                <div className="sb-tickets">
                  {education.map((edu) => (
                    <article
                      key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
                      className="sb-ticket"
                    >
                      <p className="sb-ticket-label">
                        {edu.graduation_date
                          ? `Class of ${formatYear(edu.graduation_date)}`
                          : "School"}
                      </p>
                      <h3>{edu.degree}</h3>
                      <p className="sb-sub">
                        {[edu.institution, edu.location].filter(Boolean).join(", ")}
                      </p>
                      {edu.gpa && <p className="sb-sub">GPA {edu.gpa}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {experience.length > 0 && (
              <section className="sb-section" aria-labelledby="sb-exp">
                <Heading>
                  <span id="sb-exp">Experience</span>
                </Heading>
                <div className="sb-cards">
                  {experience.map((job) => {
                    const highlights = job.highlights?.filter(Boolean) ?? [];
                    const when = formatDateSpan(job.start_date, job.end_date);

                    return (
                      <article
                        key={`${job.company}-${job.title}-${job.start_date}`}
                        className="sb-card"
                      >
                        <span className="sb-tape" aria-hidden="true" />
                        <h3>{job.title}</h3>
                        <p className="sb-sub">
                          {[job.company, job.location].filter(Boolean).join(", ")}
                        </p>
                        {when && <p className="sb-when">{when}</p>}
                        {job.description && <p className="sb-text">{job.description}</p>}
                        {highlights.length > 0 && (
                          <ul className="sb-list">
                            {highlights.map((highlight) => (
                              <li key={`${job.title}-${highlight}`}>{highlight}</li>
                            ))}
                          </ul>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {projects && projects.length > 0 && (
              <section className="sb-section" aria-labelledby="sb-proj">
                <Heading>
                  <span id="sb-proj">Projects</span>
                </Heading>
                <div className="sb-cards">
                  {projects.map((project) => {
                    const keywords = project.technologies?.filter(Boolean) ?? [];

                    return (
                      <article
                        key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                        className="sb-card"
                      >
                        <span className="sb-pin" aria-hidden="true" />
                        <h3>
                          {project.url ? (
                            <a
                              href={project.url}
                              target="_blank"
                              rel={LINK_REL}
                              className="sb-link"
                            >
                              {project.title}
                            </a>
                          ) : (
                            project.title
                          )}
                        </h3>
                        {project.year && <p className="sb-when">{formatYear(project.year)}</p>}
                        {project.description && <p className="sb-text">{project.description}</p>}
                        {keywords.length > 0 && (
                          <ul className="sb-tags" aria-label="Technologies">
                            {keywords.map((keyword) => (
                              <li key={keyword}>{keyword}</li>
                            ))}
                          </ul>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {skillGroups.length > 0 && (
              <section className="sb-section" aria-labelledby="sb-skills">
                <Heading>
                  <span id="sb-skills">Skills</span>
                </Heading>
                <div className="sb-notes">
                  {skillGroups.map((group) => (
                    <div key={group.category} className="sb-note">
                      <h3>{group.category}</h3>
                      <ul>
                        {group.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {certifications && certifications.length > 0 && (
              <section className="sb-section" aria-labelledby="sb-certs">
                <Heading>
                  <span id="sb-certs">Certificates</span>
                </Heading>
                <div className="sb-tickets">
                  {certifications.map((cert) => (
                    <article
                      key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}
                      className="sb-ticket"
                    >
                      <p className="sb-ticket-label">
                        {cert.date ? formatShortDate(cert.date) : "Certificate"}
                      </p>
                      <h3>
                        {cert.url ? (
                          <a href={cert.url} target="_blank" rel={LINK_REL} className="sb-link">
                            {cert.name}
                          </a>
                        ) : (
                          cert.name
                        )}
                      </h3>
                      {cert.issuer && <p className="sb-sub">{cert.issuer}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </main>

          <footer className="sb-foot">
            <span className="sb-sign">— {full_name}</span>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="scrapbook"
            />
          </footer>
        </div>
      </div>
    </>
  );
};
