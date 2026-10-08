import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A manuscript on a slate board, opened as a two-page spread: the left page is the title page
// (kicker, name, headline, summary as an epigraph, colophon at the foot); the right page opens
// with a Contents list and runs the resume as chapters — roles as titled entries, projects set
// as a bibliography. The title page sticks while long chapters scroll past.

const LINK_REL = "ugc nofollow noopener noreferrer";

const ROMAN = ["I", "II", "III", "IV", "V"];

interface Chapter {
  id: string;
  title: string;
  numeral: string;
  body: React.ReactNode;
}

export const Manuscript: React.FC<TemplateProps> = ({ content, profile }) => {
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

  const jobs = experience;
  const educationEntries = education ?? [];
  const certEntries = certifications ?? [];
  const works = projects ?? [];
  const skillGroups = skills?.filter((group) => group.items.some(Boolean)) ?? [];

  const contactLinks = getContactLinks(contact);
  const location = contactLinks.find((link) => link.type === "location")?.label;
  const links = contactLinks.filter((link) => link.type !== "location");

  const chapters: Chapter[] = [];

  if (jobs.length > 0) {
    const firstTextIndex = jobs.findIndex((job) => job.description.trim());

    chapters.push({
      id: "ms-experience",
      title: "Experience",
      numeral: ROMAN[chapters.length],
      body: (
        <>
          {jobs.map((job, index) => {
            const highlights = job.highlights?.filter(Boolean) ?? [];
            const when = formatDateSpan(job.start_date, job.end_date);
            const meta = [job.company, when].filter(Boolean).join(" · ");

            return (
              <article key={`${job.company}-${job.title}-${job.start_date}`} className="ms-entry">
                <h5>{job.title}</h5>
                {meta && <p className="ms-entry-meta">{meta}</p>}
                {job.description && (
                  <p className={index === firstTextIndex ? "ms-text ms-first" : "ms-text"}>
                    {job.description}
                  </p>
                )}
                {highlights.length > 0 && (
                  <ul className="ms-highlights">
                    {highlights.map((highlight) => (
                      <li key={`${job.title}-${highlight}`}>{highlight}</li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </>
      ),
    });
  }

  if (works.length > 0) {
    chapters.push({
      id: "ms-work",
      title: "Selected work",
      numeral: ROMAN[chapters.length],
      body: (
        <ol className="ms-bib">
          {works.map((project) => (
            <li key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}>
              {full_name && `${full_name}. `}
              {project.url ? (
                <a href={project.url} target="_blank" rel={LINK_REL}>
                  “{project.title}.”
                </a>
              ) : (
                <>“{project.title}.”</>
              )}
              {project.year && ` ${formatYear(project.year)}.`}
              {project.description && <p className="ms-bib-note">{project.description}</p>}
            </li>
          ))}
        </ol>
      ),
    });
  }

  if (skillGroups.length > 0) {
    chapters.push({
      id: "ms-skills",
      title: "Skills",
      numeral: ROMAN[chapters.length],
      body: (
        <>
          {skillGroups.map((group) => (
            <p key={group.category} className="ms-skill">
              <span className="ms-sc ms-skill-cat">{group.category}</span>
              {group.items.filter(Boolean).join(" · ")}
            </p>
          ))}
        </>
      ),
    });
  }

  if (certEntries.length > 0) {
    chapters.push({
      id: "ms-certs",
      title: "Certifications",
      numeral: ROMAN[chapters.length],
      body: (
        <>
          {certEntries.map((cert) => {
            const meta = [cert.issuer, cert.date ? formatShortDate(cert.date) : null]
              .filter(Boolean)
              .join(" · ");

            return (
              <article
                key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}
                className="ms-entry"
              >
                <h5>
                  {cert.url ? (
                    <a href={cert.url} target="_blank" rel={LINK_REL}>
                      {cert.name}
                    </a>
                  ) : (
                    cert.name
                  )}
                </h5>
                {meta && <p className="ms-entry-meta">{meta}</p>}
              </article>
            );
          })}
        </>
      ),
    });
  }

  if (educationEntries.length > 0) {
    chapters.push({
      id: "ms-education",
      title: "Education",
      numeral: ROMAN[chapters.length],
      body: (
        <>
          {educationEntries.map((entry) => {
            const meta = [
              entry.institution,
              entry.location,
              entry.graduation_date ? formatShortDate(entry.graduation_date) : null,
              entry.gpa ? `GPA ${entry.gpa}` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <article
                key={`${entry.institution}-${entry.degree}-${entry.graduation_date ?? ""}`}
                className="ms-entry"
              >
                <h5>{entry.degree}</h5>
                {meta && <p className="ms-entry-meta">{meta}</p>}
              </article>
            );
          })}
        </>
      ),
    });
  }

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Spectral+SC:wght@500&display=swap" />
      <style>{`
        .ms-root {
          --ms-board: #3B4A52;
          --ms-page: #FBFAF7;
          --ms-ink: #22201C;
          --ms-muted: #6D675E;
          --ms-ribbon: #7A1F2B;
          min-height: 100vh;
          background: var(--ms-board);
          color: var(--ms-ink);
          font: 300 19px/1.7 'Spectral', Georgia, 'Times New Roman', serif;
          padding: clamp(2rem, 5vw, 3.5rem) 20px clamp(3rem, 6vw, 4.5rem);
          overflow-wrap: break-word;
          overflow-x: clip;
        }
        /* globals.css forces h1-h4 to var(--font-display); re-scope the book faces here. */
        .ms-root :is(h1, h2, h3, h4, h5) {
          font-family: 'Spectral', Georgia, serif;
          font-weight: 400;
          letter-spacing: 0;
          text-wrap: balance;
          overflow-wrap: anywhere;
        }
        .ms-root .ms-sc { font-family: 'Spectral SC', 'Spectral', Georgia, serif; font-weight: 500; letter-spacing: 0.06em; }
        .ms-root a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 3px; }
        .ms-root :is(a, button):focus-visible { outline: 3px solid var(--ms-ribbon); outline-offset: 3px; }
        .ms-footer :is(a, button):focus-visible { outline-color: #F4F0E8; }
        .ms-spread {
          position: relative;
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          background: var(--ms-page);
          box-shadow: 0 40px 80px -40px #000;
        }
        /* gutter shading where the two pages meet */
        .ms-spread::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: calc(50% - 30px);
          width: 60px;
          background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.08) 48%, rgba(0, 0, 0, 0.14) 50%, rgba(0, 0, 0, 0.08) 52%, transparent);
          pointer-events: none;
        }
        .ms-spread--solo { grid-template-columns: minmax(0, 1fr); }
        .ms-spread--solo::after { display: none; }
        .ms-ribbon {
          position: absolute;
          top: -8px;
          right: 28px;
          z-index: 2;
          width: 22px;
          height: calc(100% + 60px);
          background: var(--ms-ribbon);
          clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 14px), 0 100%);
          pointer-events: none;
        }
        .ms-page { min-width: 0; padding: 80px 72px 64px; }
        .ms-title {
          position: sticky;
          top: 0;
          align-self: start;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 40px;
          min-height: min(760px, 100vh);
          text-align: center;
        }
        .ms-kicker { margin: 0; }
        .ms-title h1 { margin: 0; font-weight: 300; font-size: clamp(3rem, 6.5vw, 4.5rem); line-height: 1; letter-spacing: -0.01em; }
        .ms-avatar { display: block; width: 88px; height: 88px; margin: 0 auto 24px; border-radius: 50%; object-fit: cover; }
        .ms-by { margin: 20px 0 0; font-size: 22px; font-style: italic; line-height: 1.4; color: var(--ms-muted); }
        .ms-orn { width: 64px; height: 1px; margin: 40px auto; background: var(--ms-ink); }
        .ms-summary { max-width: 34ch; margin: 0 auto; font-size: 20px; font-style: italic; line-height: 1.6; white-space: pre-line; }
        .ms-colophon { font-size: 14px; line-height: 1.7; color: var(--ms-muted); }
        .ms-colophon-loc { margin: 0; overflow-wrap: anywhere; }
        .ms-colophon-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 0 10px; margin: 4px 0 0; padding: 0; list-style: none; }
        .ms-colophon-links li { max-width: 100%; overflow-wrap: anywhere; }
        .ms-colophon-links li + li::before { content: "/"; margin-right: 10px; color: var(--ms-muted); }
        .ms-colophon a { color: var(--ms-ink); }
        .ms-contents { margin: 0; }
        .ms-root .ms-contents h2 { margin: 0 0 40px; font-size: 15px; text-align: center; }
        .ms-toc { margin: 0; padding: 0; list-style: none; }
        .ms-toc li { padding: 6px 0; }
        .ms-toc a { text-decoration: none; }
        .ms-toc a:hover { color: var(--ms-ribbon); text-decoration: underline; }
        .ms-toc .ms-k { margin-right: 4px; font-style: italic; color: var(--ms-muted); }
        .ms-chapter { margin-top: 56px; }
        .ms-root .ms-chapter h3 { margin: 0; font-size: 15px; text-align: center; color: var(--ms-muted); }
        .ms-root .ms-chapter h4 { margin: 8px 0 28px; font-size: 30px; font-weight: 400; line-height: 1.2; text-align: center; }
        .ms-entry + .ms-entry { margin-top: 26px; }
        .ms-root .ms-entry h5 { margin: 0; font-size: 21px; font-weight: 600; line-height: 1.3; }
        .ms-entry-meta { margin: 4px 0 0; font-size: 16px; font-style: italic; color: var(--ms-muted); overflow-wrap: anywhere; }
        .ms-text { margin: 12px 0 0; text-align: justify; hyphens: auto; white-space: pre-line; }
        .ms-first::first-letter { float: left; padding: 8px 10px 0 0; font-size: 74px; line-height: 0.8; font-weight: 400; color: var(--ms-ribbon); }
        .ms-highlights { margin: 12px 0 0; padding: 0; list-style: none; }
        .ms-highlights li { margin-top: 6px; padding-left: 1.5em; text-indent: -1.5em; }
        .ms-highlights li::before { content: "—"; display: inline-block; width: 1.5em; text-indent: 0; color: var(--ms-muted); }
        .ms-bib { margin: 0; padding: 0; list-style: none; }
        .ms-bib li { padding-left: 1.6em; text-indent: -1.6em; font-size: 17px; line-height: 1.6; }
        .ms-bib li + li { margin-top: 16px; }
        .ms-bib-note { margin: 6px 0 0; padding-left: 1.6em; line-height: 1.6; color: var(--ms-muted); text-indent: 0; text-align: justify; hyphens: auto; }
        .ms-skill { margin: 0; font-size: 17px; line-height: 1.6; }
        .ms-skill + .ms-skill { margin-top: 18px; }
        .ms-skill-cat { display: block; margin-bottom: 2px; font-size: 15px; color: var(--ms-muted); }
        .ms-folio { margin: 48px 0 0; font-size: 14px; text-align: center; color: var(--ms-muted); }
        .ms-footer { max-width: 1180px; margin: 0 auto; }
        .ms-share { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-top: clamp(4.5rem, 8vw, 6rem); font-size: 0.9rem; color: rgba(251, 250, 247, 0.72); overflow-wrap: anywhere; }
        @media (max-width: 900px) {
          .ms-spread { grid-template-columns: minmax(0, 1fr); }
          .ms-spread::after { display: none; }
          .ms-ribbon { right: 32px; height: 180px; }
          .ms-page { padding: 56px 28px 40px; }
          .ms-title { position: static; min-height: 0; gap: 48px; }
          .ms-title h1 { font-size: 52px; }
        }
      `}</style>
      <main id="main-content" className="ms-root">
        <div className={chapters.length > 0 ? "ms-spread" : "ms-spread ms-spread--solo"}>
          <div className="ms-ribbon" aria-hidden="true" />

          <header className="ms-page ms-title">
            <p className="ms-sc ms-kicker">A portfolio</p>
            <div>
              {profile.avatar_url && (
                <img src={profile.avatar_url} alt="" width={88} height={88} className="ms-avatar" />
              )}
              <h1>{full_name}</h1>
              {headline && <p className="ms-by">{headline}</p>}
              <div className="ms-orn" aria-hidden="true" />
              {summary && <blockquote className="ms-summary">{summary}</blockquote>}
            </div>
            <div className="ms-colophon">
              {location && <p className="ms-colophon-loc">{location}</p>}
              {links.length > 0 && (
                <ul className="ms-colophon-links" aria-label="Contact">
                  {links.map((link) => (
                    <li key={link.type}>
                      {link.href ? (
                        <a
                          href={link.href}
                          target={link.isExternal ? "_blank" : undefined}
                          rel={link.isExternal ? LINK_REL : undefined}
                        >
                          {link.label}
                        </a>
                      ) : (
                        <span>{link.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </header>

          {chapters.length > 0 && (
            <div className="ms-page">
              <nav className="ms-contents" aria-label="Contents">
                <h2 className="ms-sc">Contents</h2>
                <ol className="ms-toc">
                  {chapters.map((chapter) => (
                    <li key={chapter.id}>
                      <a href={`#${chapter.id}`}>
                        <span className="ms-k">{chapter.numeral}.</span> {chapter.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              {chapters.map((chapter) => (
                <section
                  key={chapter.id}
                  id={chapter.id}
                  className="ms-chapter"
                  aria-labelledby={`${chapter.id}-title`}
                >
                  <h3 className="ms-sc">Chapter {chapter.numeral}</h3>
                  <h4 id={`${chapter.id}-title`}>{chapter.title}</h4>
                  {chapter.body}
                </section>
              ))}

              {full_name && <p className="ms-sc ms-folio">{full_name}</p>}
            </div>
          )}
        </div>

        <footer className="ms-footer">
          <div className="ms-share">
            <span>@{profile.handle}</span>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="manuscript"
            />
          </div>
        </footer>
      </main>
    </>
  );
};
