import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A marketer's media kit: a colour-block hero, a "by the numbers" strip counted from the resume,
// and a results wall. Results are highlight sentences that contain a metric (212%, $2.1M, 3.4x);
// the figure is shown large and the full original sentence stays beside it, so nothing is
// rewritten or invented.

type Content = TemplateProps["content"];

const LINK_REL = "ugc nofollow noopener noreferrer";

// A figure needs a %, $, x or K/M/B marker so years and plain counts are never picked up.
const METRIC = /\$\d[\d,]*(?:\.\d+)?[kKmMbB]?\+?|\d[\d,]*(?:\.\d+)?(?:%|[xX]|[kKmMbB]\b)\+?/;

const MAX_RESULTS = 6;

interface Result {
  figure: string;
  sentence: string;
  source: string;
}

function collectResults(experience: Content["experience"]): Result[] {
  const results: Result[] = [];

  for (const job of experience) {
    let fromJob = 0;

    for (const highlight of job.highlights ?? []) {
      const figure = METRIC.exec(highlight)?.[0];

      if (!figure || fromJob >= 2) continue;

      results.push({ figure, sentence: highlight, source: job.company });
      fromJob += 1;

      if (results.length >= MAX_RESULTS) return results;
    }
  }

  return results;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="mk-stat">
      <p className="mk-stat-n">{value}</p>
      <p className="mk-stat-l">{label}</p>
    </div>
  );
}

export const MediaKit: React.FC<TemplateProps> = ({ content, profile }) => {
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
  const emailLink = contactLinks.find((link) => link.type === "email");
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];
  const results = collectResults(experience);
  const brands = [...new Set(experience.map((job) => job.company).filter(Boolean))];
  const projectCount = projects?.length ?? 0;
  const hasStats = experience.length > 0 || projectCount > 0;

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600&display=swap" />
      <style>{`
        .mk-root { min-height: 100vh; background: #F7F5FF; color: #14122B; font-family: 'Inter', system-ui, sans-serif; font-size: 1rem; line-height: 1.6; overflow-x: hidden; }
        .mk-root h1, .mk-root h2, .mk-root h3 { font-family: 'Bricolage Grotesque', 'Inter', sans-serif; text-wrap: unset; overflow-wrap: anywhere; color: #14122B; }
        .mk-root ::selection { background: #C6FF3D; color: #14122B; }
        .mk-hero { background: #4B2BFF; color: #fff; padding: clamp(2rem, 6vw, 4.5rem) 1.25rem clamp(2.5rem, 7vw, 5rem); }
        .mk-inner { max-width: 67.5rem; margin: 0 auto; }
        .mk-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2rem; align-items: end; }
        @media (min-width: 52rem) { .mk-hero-grid { grid-template-columns: minmax(0, 1fr) 16rem; gap: 3rem; } }
        .mk-kicker { margin: 0 0 1rem; display: inline-block; padding: 0.15rem 0.7rem; border-radius: 999px; background: #C6FF3D; color: #14122B; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
        .mk-root h1.mk-name { margin: 0; color: #fff; font-size: clamp(3rem, 11vw, 7.5rem); line-height: 0.9; font-weight: 800; letter-spacing: -0.04em; }
        .mk-headline { margin: 1.25rem 0 0; font-size: clamp(1.15rem, 2.4vw, 1.6rem); line-height: 1.3; font-weight: 500; color: #E4DEFF; max-width: 36ch; overflow-wrap: anywhere; }
        .mk-side { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
        .mk-avatar { width: 7.5rem; height: 7.5rem; border-radius: 50%; object-fit: cover; border: 4px solid #C6FF3D; }
        .mk-contact { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .mk-contact li { min-width: 0; }
        .mk-chip { display: inline-block; max-width: 100%; padding: 0.3rem 0.85rem; border: 1.5px solid rgba(255, 255, 255, 0.7); border-radius: 999px; color: #fff; font-size: 0.9rem; text-decoration: none; overflow-wrap: anywhere; }
        a.mk-chip:hover { background: #C6FF3D; border-color: #C6FF3D; color: #14122B; }
        a.mk-chip:focus-visible, .mk-link:focus-visible, .mk-cta:focus-visible { outline: 3px solid #C6FF3D; outline-offset: 3px; }
        .mk-wrap { max-width: 70rem; margin: 0 auto; padding: 0 1.25rem 5rem; }
        .mk-summary { margin: clamp(1.75rem, 4vw, 3rem) 0 0; max-width: 56rem; font-size: clamp(1.15rem, 2.2vw, 1.5rem); line-height: 1.5; font-weight: 500; white-space: pre-line; }
        .mk-stats { margin-top: 2rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); border: 2px solid #14122B; background: #fff; }
        .mk-stat { padding: 1.1rem 1.25rem; border-right: 2px solid #14122B; }
        .mk-stat:last-child { border-right: 0; }
        @media (max-width: 36rem) { .mk-stat { border-right: 0; border-bottom: 2px solid #14122B; } .mk-stat:last-child { border-bottom: 0; } }
        .mk-stat-n { margin: 0; font-family: 'Bricolage Grotesque', sans-serif; font-size: 3rem; line-height: 1; font-weight: 800; color: #4B2BFF; }
        .mk-stat-l { margin: 0.3rem 0 0; font-size: 0.85rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
        .mk-section { margin-top: clamp(3rem, 8vw, 5rem); }
        .mk-root .mk-section > h2 { margin: 0 0 1.5rem; font-size: clamp(1.9rem, 4.5vw, 2.8rem); line-height: 1; font-weight: 800; letter-spacing: -0.03em; }
        .mk-root .mk-section > h2::after { content: ""; display: block; width: 3.5rem; height: 6px; margin-top: 0.6rem; background: #C6FF3D; box-shadow: 0 0 0 2px #14122B; }
        .mk-results { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr)); gap: 1rem; }
        .mk-result { min-width: 0; padding: 1.3rem 1.3rem 1.2rem; background: #14122B; color: #F7F5FF; border-radius: 0.9rem; }
        .mk-results > .mk-result:nth-child(3n+1) { background: #4B2BFF; }
        .mk-results > .mk-result:nth-child(3n+2) { background: #14122B; }
        .mk-results > .mk-result:nth-child(3n+3) { background: #C6FF3D; color: #14122B; }
        .mk-fig { margin: 0; font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(2.6rem, 6vw, 3.6rem); line-height: 1; font-weight: 800; letter-spacing: -0.03em; overflow-wrap: anywhere; }
        .mk-results > .mk-result:nth-child(3n+2) .mk-fig { color: #C6FF3D; }
        .mk-sentence { margin: 0.7rem 0 0; font-size: 0.97rem; line-height: 1.45; }
        .mk-source { margin: 0.8rem 0 0; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.75; }
        .mk-jobs { display: grid; gap: 1rem; }
        .mk-job { min-width: 0; padding: 1.4rem 1.5rem; background: #fff; border: 2px solid #14122B; border-radius: 0.9rem; box-shadow: 5px 5px 0 #14122B; }
        .mk-job-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.3rem 1rem; align-items: baseline; }
        .mk-root .mk-job h3 { margin: 0; font-size: 1.45rem; line-height: 1.15; font-weight: 700; letter-spacing: -0.01em; }
        .mk-when { margin: 0; font-size: 0.85rem; font-weight: 600; color: #4B2BFF; }
        .mk-co { margin: 0.15rem 0 0; color: #5A5775; font-weight: 500; overflow-wrap: anywhere; }
        .mk-text { margin: 0.7rem 0 0; white-space: pre-line; max-width: 62ch; }
        .mk-bullets { margin: 0.6rem 0 0; padding-left: 1.3rem; max-width: 62ch; list-style: disc; }
        .mk-bullets li { margin: 0.25rem 0; padding-left: 0.2rem; }
        .mk-bullets li::marker { color: #4B2BFF; }
        .mk-wall { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 0.6rem; }
        .mk-wall li { padding: 0.6rem 1.15rem; border: 2px solid #14122B; border-radius: 0.6rem; background: #fff; font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.15rem; font-weight: 700; overflow-wrap: anywhere; }
        .mk-wall li:nth-child(3n+1) { background: #C6FF3D; }
        .mk-campaigns { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr)); gap: 1rem; }
        .mk-campaign { min-width: 0; padding: 1.2rem 1.3rem; background: #fff; border-radius: 0.9rem; border-left: 8px solid #4B2BFF; box-shadow: 0 1px 3px rgba(20, 18, 43, 0.15); }
        .mk-campaigns > .mk-campaign:nth-child(2n) { border-left-color: #C6FF3D; }
        .mk-root .mk-campaign h3 { margin: 0; font-size: 1.2rem; line-height: 1.2; font-weight: 700; }
        .mk-year { margin: 0.2rem 0 0; font-size: 0.82rem; font-weight: 600; color: #5A5775; }
        .mk-link { color: inherit; text-decoration: underline; text-decoration-color: #4B2BFF; text-decoration-thickness: 2px; text-underline-offset: 3px; }
        .mk-link:hover { background: #C6FF3D; }
        .mk-tags { margin: 0.8rem 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .mk-tags li { padding: 0.05rem 0.6rem; border-radius: 999px; background: #EDE9FF; font-size: 0.8rem; font-weight: 500; overflow-wrap: anywhere; }
        .mk-skills { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr)); gap: 1.25rem 2rem; }
        .mk-root .mk-skills h3 { margin: 0 0 0.5rem; font-size: 1rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #4B2BFF; }
        .mk-skills .mk-tags { margin-top: 0; }
        .mk-root .mk-two h2 { margin: 0 0 1rem; font-size: 1.6rem; line-height: 1; font-weight: 800; letter-spacing: -0.03em; }
        .mk-two { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2.5rem; }
        @media (min-width: 48rem) { .mk-two { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3rem; } }
        .mk-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.9rem; }
        .mk-root .mk-list h3 { margin: 0; font-size: 1.05rem; line-height: 1.3; font-weight: 700; }
        .mk-list p { margin: 0.1rem 0 0; color: #5A5775; font-size: 0.93rem; overflow-wrap: anywhere; }
        .mk-band { margin-top: clamp(3.5rem, 9vw, 6rem); background: #14122B; color: #F7F5FF; }
        .mk-band-in { max-width: 70rem; margin: 0 auto; padding: clamp(2rem, 6vw, 3.5rem) 1.25rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.5rem; }
        .mk-root .mk-band h2 { margin: 0; color: #fff; font-size: clamp(1.9rem, 5vw, 3.2rem); line-height: 1; font-weight: 800; letter-spacing: -0.03em; }
        .mk-cta { display: inline-block; padding: 0.75rem 1.4rem; border-radius: 999px; background: #C6FF3D; color: #14122B; font-weight: 700; text-decoration: none; overflow-wrap: anywhere; }
        .mk-cta:hover { background: #fff; }
        .mk-share { max-width: 70rem; margin: 0 auto; padding: 0 1.25rem 2rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; color: #B9B3DE; font-size: 0.9rem; }
        .mk-foot-dark { background: #14122B; }
      `}</style>
      <div className="mk-root">
        <header className="mk-hero">
          <div className="mk-inner mk-hero-grid">
            <div style={{ minWidth: 0 }}>
              <p className="mk-kicker">Media kit</p>
              <h1 className="mk-name">{full_name}</h1>
              {headline && <p className="mk-headline">{headline}</p>}
            </div>
            <div className="mk-side">
              {profile.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt=""
                  width={120}
                  height={120}
                  className="mk-avatar"
                />
              )}
              {contactLinks.length > 0 && (
                <ul className="mk-contact" aria-label="Contact">
                  {contactLinks.map((link) => (
                    <li key={link.type}>
                      {link.href ? (
                        <a
                          href={link.href}
                          target={link.isExternal ? "_blank" : undefined}
                          rel={link.isExternal ? LINK_REL : undefined}
                          className="mk-chip"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <span className="mk-chip">{link.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </header>

        <main className="mk-wrap">
          {summary && <p className="mk-summary">{summary}</p>}

          {hasStats && (
            <section className="mk-stats" aria-label="By the numbers">
              {experience.length > 0 && (
                <Stat
                  value={experience.length}
                  label={experience.length === 1 ? "Role" : "Roles"}
                />
              )}
              {brands.length > 0 && (
                <Stat value={brands.length} label={brands.length === 1 ? "Brand" : "Brands"} />
              )}
              {projectCount > 0 && (
                <Stat value={projectCount} label={projectCount === 1 ? "Campaign" : "Campaigns"} />
              )}
            </section>
          )}

          {results.length > 0 && (
            <section className="mk-section" aria-labelledby="mk-results">
              <h2 id="mk-results">Results</h2>
              <div className="mk-results">
                {results.map((result) => (
                  <figure key={`${result.source}-${result.sentence}`} className="mk-result">
                    <p className="mk-fig">{result.figure}</p>
                    <p className="mk-sentence">{result.sentence}</p>
                    <p className="mk-source">{result.source}</p>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {experience.length > 0 && (
            <section className="mk-section" aria-labelledby="mk-exp">
              <h2 id="mk-exp">Experience</h2>
              <div className="mk-jobs">
                {experience.map((job) => {
                  const highlights = job.highlights?.filter(Boolean) ?? [];
                  const when = formatDateSpan(job.start_date, job.end_date);

                  return (
                    <article
                      key={`${job.company}-${job.title}-${job.start_date}`}
                      className="mk-job"
                    >
                      <div className="mk-job-head">
                        <h3>{job.title}</h3>
                        {when && <p className="mk-when">{when}</p>}
                      </div>
                      <p className="mk-co">
                        {[job.company, job.location].filter(Boolean).join(" · ")}
                      </p>
                      {job.description && <p className="mk-text">{job.description}</p>}
                      {highlights.length > 0 && (
                        <ul className="mk-bullets">
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

          {brands.length > 1 && (
            <section className="mk-section" aria-labelledby="mk-brands">
              <h2 id="mk-brands">Brands &amp; teams</h2>
              <ul className="mk-wall">
                {brands.map((brand) => (
                  <li key={brand}>{brand}</li>
                ))}
              </ul>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section className="mk-section" aria-labelledby="mk-campaigns">
              <h2 id="mk-campaigns">Campaigns &amp; projects</h2>
              <div className="mk-campaigns">
                {projects.map((project) => {
                  const channels = project.technologies?.filter(Boolean) ?? [];

                  return (
                    <article
                      key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                      className="mk-campaign"
                    >
                      <h3>
                        {project.url ? (
                          <a href={project.url} target="_blank" rel={LINK_REL} className="mk-link">
                            {project.title}
                          </a>
                        ) : (
                          project.title
                        )}
                      </h3>
                      {project.year && <p className="mk-year">{formatYear(project.year)}</p>}
                      {project.description && <p className="mk-text">{project.description}</p>}
                      {channels.length > 0 && (
                        <ul className="mk-tags" aria-label="Channels and tools">
                          {channels.map((channel) => (
                            <li key={channel}>{channel}</li>
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
            <section className="mk-section" aria-labelledby="mk-skills">
              <h2 id="mk-skills">Skills</h2>
              <div className="mk-skills">
                {skillGroups.map((group) => (
                  <div key={group.category}>
                    <h3>{group.category}</h3>
                    <ul className="mk-tags">
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {((education && education.length > 0) ||
            (certifications && certifications.length > 0)) && (
            <div className="mk-section mk-two">
              {education && education.length > 0 && (
                <section aria-labelledby="mk-edu">
                  <h2 id="mk-edu">Education</h2>
                  <ul className="mk-list">
                    {education.map((edu) => (
                      <li key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}>
                        <h3>{edu.degree}</h3>
                        <p>
                          {[
                            edu.institution,
                            edu.location,
                            edu.graduation_date ? formatShortDate(edu.graduation_date) : null,
                            edu.gpa ? `GPA ${edu.gpa}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {certifications && certifications.length > 0 && (
                <section aria-labelledby="mk-certs">
                  <h2 id="mk-certs">Certifications</h2>
                  <ul className="mk-list">
                    {certifications.map((cert) => (
                      <li key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}>
                        <h3>
                          {cert.url ? (
                            <a href={cert.url} target="_blank" rel={LINK_REL} className="mk-link">
                              {cert.name}
                            </a>
                          ) : (
                            cert.name
                          )}
                        </h3>
                        <p>
                          {[cert.issuer, cert.date ? formatShortDate(cert.date) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </main>

        <footer className="mk-foot-dark">
          <div className="mk-band">
            <div className="mk-band-in">
              <h2>{emailLink ? "Let's work together." : `@${profile.handle}`}</h2>
              {emailLink && (
                <a href={emailLink.href} className="mk-cta">
                  {emailLink.label}
                </a>
              )}
            </div>
          </div>
          <div className="mk-share">
            <span>@{profile.handle}</span>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="media-kit"
            />
          </div>
        </footer>
      </div>
    </>
  );
};
