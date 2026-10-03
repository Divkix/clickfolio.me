import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A newspaper front page: dateline strip, double-ruled masthead name, a lede (headline + summary),
// then roles set as short stories in ruled columns beside an index rail. The page never prints a
// date, so server and client markup always match.

type Content = TemplateProps["content"];

function ExperienceStories({ experience }: { experience: Content["experience"] }) {
  return (
    <>
      {experience.map((job) => {
        const highlights = job.highlights?.filter(Boolean) ?? [];

        const byline = [formatDateSpan(job.start_date, job.end_date), job.location]
          .filter(Boolean)
          .join(" · ");

        return (
          <article key={`${job.company}-${job.title}-${job.start_date}`} className="bs-story">
            {job.company && <p className="bs-kicker">{job.company}</p>}
            <h3>{job.title}</h3>
            {byline && <p className="bs-by">{byline}</p>}
            {job.description && <p>{job.description}</p>}
            {highlights.map((highlight) => (
              <p key={`${job.title}-${highlight}`}>{highlight}</p>
            ))}
          </article>
        );
      })}
    </>
  );
}

function ProjectStories({ projects }: { projects: NonNullable<Content["projects"]> }) {
  return (
    <>
      {projects.map((project) => {
        const technologies = project.technologies?.filter(Boolean) ?? [];

        return (
          <article key={`${project.title}-${project.year ?? ""}`} className="bs-story">
            <p className="bs-kicker">{project.year ? `Project · ${project.year}` : "Project"}</p>
            <h3>
              {project.url ? (
                <a
                  href={project.url}
                  target="_blank"
                  rel="ugc nofollow noopener noreferrer"
                  className="bs-link"
                >
                  {project.title}
                </a>
              ) : (
                project.title
              )}
            </h3>
            {technologies.length > 0 && <p className="bs-by">{technologies.join(" · ")}</p>}
            {project.description && <p>{project.description}</p>}
          </article>
        );
      })}
    </>
  );
}

function Box({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="bs-box">
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  );
}

export const Broadsheet: React.FC<TemplateProps> = ({ content, profile }) => {
  const { full_name, headline, summary, contact, experience, projects, education, certifications } =
    content;

  const skillGroups = content.skills?.filter((group) => group.items.some(Boolean)) ?? [];
  const links = getContactLinks(contact).filter((link) => link.type !== "location");
  const hasStories = experience.length > 0 || (projects?.length ?? 0) > 0;

  const hasRail =
    links.length > 0 ||
    skillGroups.length > 0 ||
    (education?.length ?? 0) > 0 ||
    (certifications?.length ?? 0) > 0;

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600&display=swap" />
      <style>{`
        .bs-root { background: #F3E5D9; color: #1B1613; font-family: 'Source Serif 4', Georgia, serif; }
        .bs-root h1, .bs-root h2, .bs-root h3, .bs-root h4 { font-family: 'Newsreader', Georgia, serif; text-wrap: balance; font-weight: 500; }
        .bs-wrap { max-width: 76rem; margin: 0 auto; padding: clamp(1.25rem, 4vw, 2.5rem) 1rem 4rem; }
        .bs-strip { display: flex; justify-content: space-between; gap: 0.5rem 1.5rem; flex-wrap: wrap; padding-bottom: 0.55rem; font: 600 0.74rem/1.2 'Archivo Narrow', 'Arial Narrow', Arial, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; }
        .bs-mast { border-top: 4px solid #1B1613; border-bottom: 1px solid #1B1613; padding: clamp(0.75rem, 2vw, 1.25rem) 0 clamp(0.5rem, 1.5vw, 1rem); text-align: center; position: relative; }
        .bs-mast::after { content: ""; position: absolute; left: 0; right: 0; bottom: -5px; border-bottom: 1px solid #1B1613; }
        .bs-root .bs-name { margin: 0; font-size: clamp(2.9rem, 10.5vw, 8rem); line-height: 0.95; font-variation-settings: "opsz" 72; letter-spacing: -0.025em; overflow-wrap: anywhere; }
        .bs-lede { padding: 2rem 0 2.25rem; border-bottom: 1px solid #1B1613; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: clamp(1.5rem, 4vw, 3.5rem); }
        .bs-lede-solo { grid-template-columns: minmax(0, 1fr); }
        .bs-kicker { margin: 0 0 0.8rem; font: 600 0.75rem/1.2 'Archivo Narrow', 'Arial Narrow', Arial, sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: #8A2C27; }
        .bs-root .bs-hed { margin: 0; font-size: clamp(1.9rem, 3.8vw, 3rem); line-height: 1.06; font-variation-settings: "opsz" 60; letter-spacing: -0.015em; overflow-wrap: anywhere; }
        .bs-sum { margin: 0; font-size: 1.12rem; line-height: 1.6; column-count: 2; column-gap: 2rem; column-rule: 1px solid #D9C5B5; text-align: justify; hyphens: auto; white-space: pre-line; }
        .bs-sum::first-letter { float: left; font: 500 4.1rem/0.8 'Newsreader', Georgia, serif; padding: 0.3rem 0.5rem 0 0; }
        .bs-body { display: grid; grid-template-columns: minmax(0, 1fr) 17.5rem; }
        .bs-body-solo { grid-template-columns: minmax(0, 1fr); }
        .bs-stories { columns: 2; column-gap: 2.25rem; column-rule: 1px solid #D9C5B5; padding: 1.75rem 2.25rem 0 0; }
        .bs-story { break-inside: avoid; margin: 0 0 2rem; min-width: 0; }
        .bs-story .bs-kicker { margin-bottom: 0.45rem; }
        .bs-root .bs-story h3 { margin: 0; font-size: 1.6rem; line-height: 1.12; font-variation-settings: "opsz" 36; letter-spacing: -0.01em; overflow-wrap: anywhere; }
        .bs-by { margin: 0.5rem 0 0.8rem; padding-bottom: 0.6rem; border-bottom: 1px solid #D9C5B5; font: 600 0.72rem/1.3 'Archivo Narrow', 'Arial Narrow', Arial, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: #66584F; font-variant-numeric: tabular-nums; }
        .bs-story p:not(.bs-kicker):not(.bs-by) { margin: 0 0 0.65rem; font-size: 1rem; line-height: 1.58; hyphens: manual; overflow-wrap: break-word; }
        .bs-rail { border-left: 1px solid #1B1613; padding: 1.75rem 0 0 1.5rem; display: flex; flex-direction: column; gap: 2rem; min-width: 0; }
        .bs-rail-solo { border-left: 0; padding-left: 0; }
        .bs-root .bs-box h2 { margin: 0 0 0.75rem; padding-bottom: 0.4rem; border-bottom: 3px double #1B1613; font: 600 0.78rem/1 'Archivo Narrow', 'Arial Narrow', Arial, sans-serif; letter-spacing: 0.16em; text-transform: uppercase; }
        .bs-box p, .bs-box li { margin: 0; font-size: 0.95rem; line-height: 1.5; overflow-wrap: anywhere; }
        .bs-box p + p { margin-top: 0.55rem; }
        .bs-box ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.55rem; }
        .bs-sm { color: #66584F; font-size: 0.85rem; }
        .bs-box strong { font-weight: 600; }
        .bs-link, .bs-box a { color: inherit; text-decoration: underline; text-decoration-color: #D9C5B5; text-underline-offset: 3px; text-decoration-thickness: 2px; }
        .bs-link:hover, .bs-box a:hover { text-decoration-color: #8A2C27; }
        .bs-root a:focus-visible { outline: 2px solid #8A2C27; outline-offset: 3px; }
        .bs-foot { margin-top: 2.5rem; padding-top: 1rem; border-top: 3px double #1B1613; }
        @media (max-width: 62rem) {
          .bs-body { grid-template-columns: minmax(0, 1fr); }
          .bs-stories { padding-right: 0; }
          .bs-rail { border-left: 0; border-top: 1px solid #1B1613; padding: 1.75rem 0 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 2rem; }
        }
        @media (max-width: 52rem) {
          .bs-lede { grid-template-columns: minmax(0, 1fr); }
          .bs-stories { columns: 1; }
        }
        @media (max-width: 36rem) {
          .bs-sum { column-count: 1; }
        }
        @media print {
          .bs-root { background: #fff !important; }
          .bs-no-print { display: none !important; }
        }
      `}</style>
      <main id="main-content" className="bs-root min-h-screen w-full overflow-x-hidden">
        <div className="bs-wrap">
          <div className="bs-strip" aria-hidden="true">
            <span>Résumé</span>
            {contact.location && <span>{contact.location}</span>}
            <span>@{profile.handle}</span>
          </div>
          <header className="bs-mast">
            <h1 className="bs-name">{full_name}</h1>
          </header>

          {(headline || summary) && (
            <section
              aria-label="Profile"
              className={headline && summary ? "bs-lede" : "bs-lede bs-lede-solo"}
            >
              {headline && (
                <div>
                  <p className="bs-kicker">Profile</p>
                  <h2 className="bs-hed">{headline}</h2>
                </div>
              )}
              {summary && <p className="bs-sum">{summary}</p>}
            </section>
          )}

          {(hasStories || hasRail) && (
            <div className={hasStories && hasRail ? "bs-body" : "bs-body bs-body-solo"}>
              {hasStories && (
                <div className="bs-stories">
                  {experience.length > 0 && <ExperienceStories experience={experience} />}
                  {projects && projects.length > 0 && <ProjectStories projects={projects} />}
                </div>
              )}

              {hasRail && (
                <aside className={hasStories ? "bs-rail" : "bs-rail bs-rail-solo"}>
                  {education && education.length > 0 && (
                    <Box id="education" title="Education">
                      <ul>
                        {education.map((entry) => (
                          <li key={`${entry.institution}-${entry.degree}`}>
                            <strong>{entry.degree}</strong>
                            <br />
                            <span className="bs-sm">
                              {[
                                entry.institution,
                                entry.graduation_date ? formatShortDate(entry.graduation_date) : "",
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  )}
                  {skillGroups.length > 0 && (
                    <Box id="skills" title="Index of Skills">
                      {skillGroups.map((group) => (
                        <p key={group.category}>
                          <strong>{group.category}:</strong>{" "}
                          {group.items.filter(Boolean).join(", ")}.
                        </p>
                      ))}
                    </Box>
                  )}
                  {certifications && certifications.length > 0 && (
                    <Box id="certifications" title="Certifications">
                      <ul>
                        {certifications.map((cert) => (
                          <li key={`${cert.name}-${cert.issuer ?? ""}`}>
                            <strong>
                              {cert.url ? (
                                <a
                                  href={cert.url}
                                  target="_blank"
                                  rel="ugc nofollow noopener noreferrer"
                                >
                                  {cert.name}
                                </a>
                              ) : (
                                cert.name
                              )}
                            </strong>
                            {(cert.issuer || cert.date) && (
                              <>
                                <br />
                                <span className="bs-sm">
                                  {[cert.issuer, cert.date ? formatShortDate(cert.date) : ""]
                                    .filter(Boolean)
                                    .join(", ")}
                                </span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </Box>
                  )}
                  {links.length > 0 && (
                    <Box id="contact" title="Correspondence">
                      <ul aria-label="Contact">
                        {links.map((link) => (
                          <li key={link.type}>
                            <a
                              href={link.href}
                              target={link.isExternal ? "_blank" : undefined}
                              rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                            >
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  )}
                </aside>
              )}
            </div>
          )}

          <footer className="bs-foot bs-no-print">
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="broadsheet"
            />
          </footer>
        </div>
      </main>
    </>
  );
};
