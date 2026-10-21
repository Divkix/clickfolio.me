import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A creator's media kit, set like the one-sheet a brand partnerships team receives: a fuchsia
// cover with the name as a magazine masthead, a "worked with" wall where every employer is set as
// its own wordmark, results lifted from highlight sentences that carry a real figure (212%, $2.1M,
// 3.4x), campaigns as case studies, and skills as a services sheet. Nothing is counted or
// invented: every figure on the page is quoted from the resume text, next to its sentence.

type Content = TemplateProps["content"];

const LINK_REL = "ugc nofollow noopener noreferrer";

// A figure needs a %, $, x or K/M/B marker so years and plain counts are never picked up.
const METRIC = /\$\d[\d,]*(?:\.\d+)?[kKmMbB]?\+?|\d[\d,]*(?:\.\d+)?(?:%|[xX]|[kKmMbB]\b)\+?/;

const MAX_RESULTS = 6;
const MAX_PER_JOB = 2;
const WORDMARK_STYLES = 4;

interface Result {
  figure: string;
  sentence: string;
  source: string;
}

function findFigure(text?: string): string | undefined {
  return text ? METRIC.exec(text)?.[0] : undefined;
}

function collectResults(experience: Content["experience"]): Result[] {
  const results: Result[] = [];

  for (const job of experience) {
    let fromJob = 0;

    for (const highlight of job.highlights ?? []) {
      const figure = findFigure(highlight);

      if (!figure || fromJob >= MAX_PER_JOB) continue;

      results.push({ figure, sentence: highlight, source: job.company });
      fromJob += 1;

      if (results.length >= MAX_RESULTS) return results;
    }
  }

  return results;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mk-section" aria-labelledby={id}>
      <h2 id={id} className="mk-h2">
        {title}
      </h2>
      <div className="mk-body">{children}</div>
    </section>
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

  const bookingLinks = contactLinks.filter(
    (link) => link.type !== "email" && link.type !== "location",
  );

  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];
  const results = collectResults(experience);
  const quoted = new Set(results.map((result) => result.sentence));
  const brands = [...new Set(experience.map((job) => job.company?.trim()).filter(Boolean))];
  const caseStudies = projects?.filter((project) => project.title) ?? [];
  const firstName = full_name.trim().split(/\s+/)[0];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..800;1,6..96,400..800&display=swap" />
      <style>{`
        .mk-root { --ink: #2A0B22; --blush: #FBEAEE; --fuchsia: #C0175A; --petal: #FF9EC1; --muted: #6E4A60; --sheet: #FFF7F9;
          min-height: 100vh; background: var(--blush); color: var(--ink); font-family: 'Archivo', system-ui, sans-serif; font-size: 1rem; line-height: 1.6; overflow-x: hidden; }
        .mk-root h1, .mk-root h2, .mk-root h3 { font-family: 'Bodoni Moda', Didot, 'Times New Roman', serif; text-wrap: unset; overflow-wrap: anywhere; color: inherit; margin: 0; }
        .mk-root ::selection { background: var(--petal); color: var(--ink); }
        .mk-root a:focus-visible { outline: 3px solid var(--petal); outline-offset: 3px; }
        .mk-inner { max-width: 72rem; margin: 0 auto; padding-inline: clamp(1rem, 4vw, 2.5rem); }

        .mk-cover { background: var(--fuchsia); color: #FFF4F7; padding-block: clamp(1.25rem, 3vw, 2rem) clamp(2.5rem, 6vw, 4.5rem); }
        .mk-cover-top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.25rem 1.5rem; padding-bottom: 0.9rem; border-bottom: 2px solid rgba(255, 244, 247, 0.55); font-size: 0.95rem; font-weight: 600; font-stretch: 112%; }
        .mk-cover-top span { min-width: 0; overflow-wrap: anywhere; }
        .mk-masthead { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.75rem; align-items: end; margin-top: clamp(1.75rem, 5vw, 3.5rem); }
        .mk-masthead.has-photo { grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 48rem) { .mk-masthead.has-photo { grid-template-columns: minmax(0, 1fr) minmax(10rem, 15rem); } }
        .mk-root h1.mk-name { font-size: clamp(3.25rem, 11.5vw, 9.25rem); line-height: 0.9; font-weight: 700; letter-spacing: -0.025em; font-variation-settings: 'opsz' 40; color: #FFF4F7; }
        .mk-photo { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; display: block; border: 3px solid #FFF4F7; max-width: 15rem; }
        .mk-cover-foot { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem 3rem; margin-top: clamp(1.5rem, 4vw, 2.5rem); }
        @media (min-width: 48rem) { .mk-cover-foot { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); } }
        .mk-headline { margin: 0; font-size: clamp(1.2rem, 2.4vw, 1.6rem); line-height: 1.3; font-weight: 500; font-stretch: 108%; max-width: 32ch; overflow-wrap: anywhere; }
        .mk-book { min-width: 0; border-left: 2px solid rgba(255, 244, 247, 0.55); padding-left: 1.1rem; }
        .mk-book-label { margin: 0; font-family: 'Bodoni Moda', serif; font-style: italic; font-size: 1.15rem; }
        .mk-book-mail { display: inline-block; margin-top: 0.15rem; color: #FFF4F7; font-size: 1.15rem; font-weight: 700; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; overflow-wrap: anywhere; max-width: 100%; }
        .mk-book-links { margin: 0.6rem 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 0.35rem 1.1rem; font-size: 0.95rem; }
        .mk-book-links li { min-width: 0; overflow-wrap: anywhere; }
        .mk-book-links a { color: #FFF4F7; text-underline-offset: 3px; }
        .mk-book-mail:hover, .mk-book-links a:hover { color: var(--ink); background: var(--petal); }

        .mk-summary { margin: 0; max-width: 54ch; font-family: 'Bodoni Moda', serif; font-size: clamp(1.25rem, 2.3vw, 1.6rem); line-height: 1.5; font-weight: 400; white-space: pre-line; overflow-wrap: anywhere; }

        .mk-section { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem 2.5rem; margin-top: clamp(2.75rem, 7vw, 4.5rem); padding-top: 1.1rem; border-top: 2px solid var(--ink); }
        @media (min-width: 56rem) { .mk-section { grid-template-columns: 13rem minmax(0, 1fr); } }
        main > .mk-inner:first-child > .mk-section:first-child { margin-top: clamp(1.75rem, 4vw, 2.5rem); }
        .mk-root h2.mk-h2 { font-size: clamp(1.75rem, 3.6vw, 2.35rem); line-height: 1.05; font-weight: 500; font-style: italic; letter-spacing: -0.01em; }
        .mk-body { min-width: 0; }

        .mk-wall { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13.5rem), 1fr)); border-top: 1px solid rgba(42, 11, 34, 0.35); border-left: 1px solid rgba(42, 11, 34, 0.35); }
        .mk-wall li { min-width: 0; min-height: 7rem; display: flex; align-items: center; justify-content: center; padding: 1.25rem 1rem; text-align: center; border-right: 1px solid rgba(42, 11, 34, 0.35); border-bottom: 1px solid rgba(42, 11, 34, 0.35); overflow-wrap: anywhere; line-height: 1.05; }
        @media (max-width: 30rem) { .mk-wall { grid-template-columns: repeat(2, minmax(0, 1fr)); } .mk-wall li { min-height: 5.5rem; padding: 1rem 0.6rem; } .mk-wall li[class] { font-size: 1.15rem; } }
        .mk-wm-0 { font-family: 'Archivo', sans-serif; font-stretch: 125%; font-weight: 850; font-size: 1.45rem; letter-spacing: -0.03em; }
        .mk-wm-1 { font-family: 'Bodoni Moda', serif; font-style: italic; font-weight: 500; font-size: 1.85rem; letter-spacing: -0.01em; }
        .mk-wm-2 { font-family: 'Archivo', sans-serif; font-stretch: 62%; font-weight: 700; font-size: 1.7rem; text-transform: uppercase; letter-spacing: 0.04em; }
        .mk-wm-3 { font-family: 'Bodoni Moda', serif; font-weight: 800; font-size: 1.6rem; letter-spacing: -0.035em; }

        .mk-results-band { margin-top: clamp(2.75rem, 7vw, 4.5rem); background: var(--ink); color: var(--blush); padding-block: clamp(2.25rem, 6vw, 4rem); }
        .mk-results-band .mk-section { margin-top: 0; border-top-color: var(--petal); }
        .mk-results-band h2.mk-h2 { color: var(--petal); }
        .mk-results { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr)); gap: 2rem 2.5rem; }
        .mk-result { min-width: 0; }
        .mk-fig { margin: 0; font-family: 'Bodoni Moda', serif; font-weight: 700; font-size: clamp(3rem, 7vw, 4.75rem); line-height: 0.95; letter-spacing: -0.03em; color: var(--petal); overflow-wrap: anywhere; font-variation-settings: 'opsz' 18; }
        .mk-sentence { margin: 0.6rem 0 0; font-size: 1rem; line-height: 1.5; overflow-wrap: anywhere; max-width: 44ch; }
        .mk-source { margin: 0.5rem 0 0; font-size: 0.9rem; font-weight: 700; font-stretch: 112%; color: #E8C9D6; overflow-wrap: anywhere; }

        .mk-cases { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr)); gap: 2.25rem 2.5rem; }
        .mk-case { min-width: 0; }
        .mk-case-img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; margin-bottom: 1rem; border: 2px solid var(--ink); background: var(--sheet); }
        .mk-case-fig { margin: 0 0 0.35rem; font-family: 'Bodoni Moda', serif; font-weight: 700; font-size: clamp(2.4rem, 5vw, 3.25rem); line-height: 1; letter-spacing: -0.03em; color: var(--fuchsia); overflow-wrap: anywhere; font-variation-settings: 'opsz' 18; }
        .mk-root .mk-case h3 { font-size: 1.6rem; line-height: 1.15; font-weight: 600; }
        .mk-case-meta { margin: 0.3rem 0 0; font-size: 0.9rem; font-weight: 600; color: var(--muted); overflow-wrap: anywhere; }
        .mk-case-year { color: var(--fuchsia); margin-right: 0.75rem; }
        .mk-text { margin: 0.6rem 0 0; white-space: pre-line; overflow-wrap: anywhere; max-width: 62ch; }
        .mk-link { color: inherit; text-decoration: underline; text-decoration-color: var(--fuchsia); text-decoration-thickness: 2px; text-underline-offset: 4px; }
        .mk-link:hover { color: var(--fuchsia); }

        .mk-sheet { background: var(--sheet); border: 2px solid var(--ink); }
        .mk-sheet-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.35rem 2rem; padding: 1.1rem 1.25rem; border-top: 1px solid rgba(42, 11, 34, 0.25); }
        .mk-sheet-row:first-child { border-top: 0; }
        @media (min-width: 40rem) { .mk-sheet-row { grid-template-columns: 12rem minmax(0, 1fr); } }
        .mk-root .mk-sheet-row h3 { font-size: 1.3rem; line-height: 1.25; font-weight: 500; font-style: italic; }
        .mk-sheet-items { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr)); gap: 0.25rem 1.5rem; }
        .mk-sheet-items li { min-width: 0; font-weight: 600; overflow-wrap: anywhere; }

        .mk-jobs { margin: 0; padding: 0; list-style: none; }
        .mk-job { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.2rem 2rem; padding-block: 1.25rem; border-top: 1px solid rgba(42, 11, 34, 0.25); }
        .mk-job:first-child { border-top: 0; padding-top: 0.15rem; }
        @media (min-width: 40rem) { .mk-job { grid-template-columns: 10rem minmax(0, 1fr); } }
        .mk-when { margin: 0; font-size: 0.92rem; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; padding-top: 0.3rem; }
        .mk-root .mk-job h3 { font-size: 1.45rem; line-height: 1.2; font-weight: 600; }
        .mk-co { margin: 0.1rem 0 0; font-weight: 700; font-stretch: 112%; color: var(--fuchsia); overflow-wrap: anywhere; }
        .mk-co span { color: var(--muted); font-weight: 500; font-stretch: 100%; }
        .mk-bullets { margin: 0.5rem 0 0; padding-left: 1.15rem; max-width: 64ch; list-style: disc; }
        .mk-bullets li { margin: 0.25rem 0; overflow-wrap: anywhere; }
        .mk-bullets li::marker { color: var(--fuchsia); }

        .mk-creds { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2rem 2.5rem; }
        @media (min-width: 40rem) { .mk-creds { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .mk-root .mk-creds h3.mk-creds-h { font-size: 1.15rem; font-weight: 500; font-style: italic; color: var(--muted); margin-bottom: 0.6rem; }
        .mk-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.85rem; }
        .mk-list li { min-width: 0; }
        .mk-item { margin: 0; font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; }
        .mk-list p.mk-sub { margin: 0.1rem 0 0; color: var(--muted); font-size: 0.93rem; overflow-wrap: anywhere; }

        .mk-close { margin-top: clamp(3rem, 8vw, 5.5rem); background: var(--ink); color: var(--blush); }
        .mk-close-in { padding-block: clamp(2.5rem, 7vw, 4.5rem) 1.5rem; }
        .mk-root .mk-close h2 { font-size: clamp(2.5rem, 8vw, 5.5rem); line-height: 0.95; font-weight: 700; letter-spacing: -0.025em; color: var(--petal); font-variation-settings: 'opsz' 36; }
        .mk-cta { display: inline-block; margin-top: 1.5rem; padding: 0.8rem 1.5rem; background: var(--petal); color: var(--ink); font-weight: 700; font-size: 1.05rem; text-decoration: none; max-width: 100%; overflow-wrap: anywhere; }
        .mk-cta:hover { background: #FFFFFF; }
        .mk-share { margin-top: clamp(2.5rem, 6vw, 3.5rem); padding-top: 1rem; border-top: 1px solid rgba(251, 234, 238, 0.25); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; color: #E8C9D6; font-size: 0.92rem; }
        .mk-share span { overflow-wrap: anywhere; min-width: 0; }
      `}</style>
      <div className="mk-root">
        <header className="mk-cover">
          <div className="mk-inner">
            <div className="mk-cover-top">
              <span>Media kit</span>
              {contact.location && <span>{contact.location}</span>}
            </div>
            <div className={`mk-masthead${profile.avatar_url ? " has-photo" : ""}`}>
              <h1 className="mk-name">{full_name}</h1>
              {profile.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt={full_name}
                  width={240}
                  height={300}
                  className="mk-photo"
                />
              )}
            </div>
            {(headline || emailLink || bookingLinks.length > 0) && (
              <div className="mk-cover-foot">
                <div>{headline && <p className="mk-headline">{headline}</p>}</div>
                {(emailLink || bookingLinks.length > 0) && (
                  <div className="mk-book">
                    <p className="mk-book-label">Partnerships and bookings</p>
                    {emailLink && (
                      <a href={emailLink.href} className="mk-book-mail">
                        {emailLink.label}
                      </a>
                    )}
                    {bookingLinks.length > 0 && (
                      <ul className="mk-book-links" aria-label="Other contact links">
                        {bookingLinks.map((link) => (
                          <li key={link.type}>
                            <a
                              href={link.href}
                              target={link.isExternal ? "_blank" : undefined}
                              rel={link.isExternal ? LINK_REL : undefined}
                            >
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main>
          <div className="mk-inner">
            {brands.length > 0 && (
              <Section id="mk-brands" title="Worked with">
                <ul className="mk-wall">
                  {brands.map((brand, index) => (
                    <li key={brand} className={`mk-wm-${index % WORDMARK_STYLES}`}>
                      {brand}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {summary && (
              <Section id="mk-about" title="About">
                <p className="mk-summary">{summary}</p>
              </Section>
            )}
          </div>

          {results.length > 0 && (
            <div className="mk-results-band">
              <div className="mk-inner">
                <Section id="mk-results" title="Results">
                  <ul className="mk-results">
                    {results.map((result) => (
                      <li key={`${result.source}-${result.sentence}`} className="mk-result">
                        <p className="mk-fig">{result.figure}</p>
                        <p className="mk-sentence">{result.sentence}</p>
                        {result.source && <p className="mk-source">{result.source}</p>}
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
            </div>
          )}

          <div className="mk-inner">
            {caseStudies.length > 0 && (
              <Section id="mk-cases" title="Case studies">
                <div className="mk-cases">
                  {caseStudies.map((project) => {
                    const channels = project.technologies?.filter(Boolean) ?? [];
                    const figure = findFigure(project.description);
                    const year = project.year ? formatYear(project.year) : "";

                    return (
                      <article
                        key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                        className="mk-case"
                      >
                        {project.image_url && (
                          <img
                            src={project.image_url}
                            alt=""
                            width={640}
                            height={400}
                            loading="lazy"
                            className="mk-case-img"
                          />
                        )}
                        {figure && <p className="mk-case-fig">{figure}</p>}
                        <h3>
                          {project.url ? (
                            <a
                              href={project.url}
                              target="_blank"
                              rel={LINK_REL}
                              className="mk-link"
                            >
                              {project.title}
                            </a>
                          ) : (
                            project.title
                          )}
                        </h3>
                        {(year || channels.length > 0) && (
                          <p className="mk-case-meta">
                            {year && <span className="mk-case-year">{year}</span>}
                            {channels.length > 0 && <span>{channels.join(", ")}</span>}
                          </p>
                        )}
                        {project.description && <p className="mk-text">{project.description}</p>}
                      </article>
                    );
                  })}
                </div>
              </Section>
            )}

            {skillGroups.length > 0 && (
              <Section id="mk-services" title="Services">
                <div className="mk-sheet">
                  {skillGroups.map((group) => (
                    <div key={group.category} className="mk-sheet-row">
                      <h3>{group.category}</h3>
                      <ul className="mk-sheet-items">
                        {group.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {experience.length > 0 && (
              <Section id="mk-exp" title="Experience">
                <ul className="mk-jobs">
                  {experience.map((job) => {
                    const highlights =
                      job.highlights?.filter((highlight) => highlight && !quoted.has(highlight)) ??
                      [];

                    const when = formatDateSpan(job.start_date, job.end_date);

                    return (
                      <li key={`${job.company}-${job.title}-${job.start_date}`} className="mk-job">
                        <p className="mk-when">{when}</p>
                        <div>
                          <h3>{job.title}</h3>
                          {(job.company || job.location) && (
                            <p className="mk-co">
                              {job.company}
                              {job.location && (
                                <span>
                                  {job.company ? ", " : ""}
                                  {job.location}
                                </span>
                              )}
                            </p>
                          )}
                          {job.description && <p className="mk-text">{job.description}</p>}
                          {highlights.length > 0 && (
                            <ul className="mk-bullets">
                              {highlights.map((highlight) => (
                                <li key={`${job.title}-${highlight}`}>{highlight}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            {((education && education.length > 0) ||
              (certifications && certifications.length > 0)) && (
              <Section id="mk-creds" title="Credentials">
                <div className="mk-creds">
                  {education && education.length > 0 && (
                    <div>
                      <h3 className="mk-creds-h">Education</h3>
                      <ul className="mk-list">
                        {education.map((edu) => (
                          <li key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}>
                            <p className="mk-item">{edu.degree}</p>
                            <p className="mk-sub">
                              {[
                                edu.institution,
                                edu.location,
                                edu.graduation_date ? formatShortDate(edu.graduation_date) : null,
                                edu.gpa ? `GPA ${edu.gpa}` : null,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {certifications && certifications.length > 0 && (
                    <div>
                      <h3 className="mk-creds-h">Certifications</h3>
                      <ul className="mk-list">
                        {certifications.map((cert) => {
                          const detail = [
                            cert.issuer,
                            cert.date ? formatShortDate(cert.date) : null,
                          ]
                            .filter(Boolean)
                            .join(", ");

                          return (
                            <li key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}>
                              <p className="mk-item">
                                {cert.url ? (
                                  <a
                                    href={cert.url}
                                    target="_blank"
                                    rel={LINK_REL}
                                    className="mk-link"
                                  >
                                    {cert.name}
                                  </a>
                                ) : (
                                  cert.name
                                )}
                              </p>
                              {detail && <p className="mk-sub">{detail}</p>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </Section>
            )}
          </div>
        </main>

        <footer className="mk-close">
          <div className="mk-inner mk-close-in">
            <h2>{firstName ? `Work with ${firstName}` : "Work with me"}</h2>
            {emailLink && (
              <a href={emailLink.href} className="mk-cta">
                Email {emailLink.label}
              </a>
            )}
            <div className="mk-share">
              <span>@{profile.handle}</span>
              <ShareBar
                handle={profile.handle}
                title={`${full_name}'s Portfolio`}
                name={full_name}
                variant="media-kit"
              />
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};
