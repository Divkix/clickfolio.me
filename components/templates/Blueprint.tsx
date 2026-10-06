import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A drawing sheet on cyanotype blue: grid paper, lettered section callouts, dates drawn as
// dimension lines, and a title block at the foot. The sheet never prints a date or revision
// number that the resume does not contain.

type Content = TemplateProps["content"];

const LINK_REL = "ugc nofollow noopener noreferrer";

function callout(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

function Section({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bp-section" aria-label={title}>
      <h2>
        <span className="bp-callout" aria-hidden="true">
          {callout(index)}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Jobs({ experience }: { experience: Content["experience"] }) {
  return (
    <>
      {experience.map((job) => {
        const highlights = job.highlights?.filter(Boolean) ?? [];
        const when = formatDateSpan(job.start_date, job.end_date);

        return (
          <article key={`${job.company}-${job.title}-${job.start_date}`} className="bp-job">
            <p className="bp-dim bp-mono">{when}</p>
            <div className="bp-job-main">
              <h3>{job.title}</h3>
              <p className="bp-co">{[job.company, job.location].filter(Boolean).join(" / ")}</p>
              {job.description && <p className="bp-text">{job.description}</p>}
              {highlights.length > 0 && (
                <ul className="bp-notes">
                  {highlights.map((highlight) => (
                    <li key={`${job.title}-${highlight}`}>{highlight}</li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}

export const Blueprint: React.FC<TemplateProps> = ({ content, profile }) => {
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
  const hasProjects = !!projects && projects.length > 0;
  const hasEducation = !!education && education.length > 0;
  const hasStamps = !!certifications && certifications.length > 0;

  let sectionIndex = 0;
  const nextIndex = () => sectionIndex++;

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" />
      <style>{`
        .bp-root { min-height: 100vh; color: #EAF3FF; font-family: 'IBM Plex Sans', system-ui, sans-serif; font-size: 1rem; line-height: 1.6; overflow-x: hidden; background-color: #0E3A66; background-image: linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px); background-size: 7.5rem 7.5rem, 7.5rem 7.5rem, 1.5rem 1.5rem, 1.5rem 1.5rem; }
        .bp-root h1, .bp-root h2, .bp-root h3 { font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; text-wrap: unset; overflow-wrap: anywhere; color: #fff; text-transform: uppercase; letter-spacing: 0.03em; }
        .bp-root ::selection { background: #FFD966; color: #0E3A66; }
        .bp-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; }
        .bp-frame { max-width: 70rem; margin: 0 auto; padding: clamp(0.75rem, 3vw, 2rem); }
        .bp-sheet { border: 2px solid #EAF3FF; padding: 5px; background: rgba(14, 58, 102, 0.82); }
        .bp-sheet-in { border: 1px solid rgba(234, 243, 255, 0.7); padding: clamp(1.1rem, 3.5vw, 2.5rem); }
        .bp-head { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.25rem; padding-bottom: 1.75rem; border-bottom: 2px solid #EAF3FF; }
        @media (min-width: 52rem) { .bp-head { grid-template-columns: minmax(0, 1fr) 15rem; gap: 2.5rem; } }
        .bp-kicker { margin: 0; color: #FFD966; }
        .bp-root .bp-name { margin: 0.4rem 0 0; font-size: clamp(2.8rem, 9vw, 6rem); line-height: 0.92; font-weight: 700; letter-spacing: 0.01em; }
        .bp-headline { margin: 0.9rem 0 0; font-size: 1.15rem; color: #BFD9F6; overflow-wrap: anywhere; }
        .bp-ident { align-self: end; display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
        .bp-avatar { width: 6rem; height: 6rem; object-fit: cover; border: 1px solid #EAF3FF; padding: 3px; }
        .bp-contact { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.25rem; color: #BFD9F6; }
        .bp-contact li { min-width: 0; overflow-wrap: anywhere; }
        .bp-contact a, .bp-link { color: #EAF3FF; text-decoration: underline; text-decoration-color: rgba(255, 217, 102, 0.7); text-underline-offset: 3px; }
        .bp-contact a:hover, .bp-link:hover { color: #FFD966; }
        .bp-contact a:focus-visible, .bp-link:focus-visible { outline: 2px solid #FFD966; outline-offset: 2px; }
        .bp-summary { margin: 1.75rem 0 0; max-width: 64ch; white-space: pre-line; color: #DCEBFB; }
        .bp-section { margin-top: clamp(2.25rem, 6vw, 3.5rem); }
        .bp-root .bp-section > h2 { margin: 0 0 1.25rem; display: flex; align-items: center; gap: 0.8rem; padding-bottom: 0.55rem; border-bottom: 1px solid rgba(234, 243, 255, 0.55); font-size: 1.5rem; font-weight: 600; }
        .bp-callout { flex: none; width: 1.9rem; height: 1.9rem; display: inline-flex; align-items: center; justify-content: center; border: 1.5px solid #FFD966; border-radius: 50%; color: #FFD966; font-family: 'IBM Plex Mono', monospace; font-size: 0.85rem; letter-spacing: 0; }
        .bp-job { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.4rem; margin-bottom: 1.75rem; }
        @media (min-width: 44rem) { .bp-job { grid-template-columns: 10.5rem minmax(0, 1fr); gap: 1.5rem; } }
        .bp-dim { margin: 0; position: relative; color: #BFD9F6; padding-top: 0.2rem; }
        @media (min-width: 44rem) { .bp-dim { padding: 0.2rem 1rem 0.2rem 0; text-align: right; border-right: 1px solid rgba(234, 243, 255, 0.55); } .bp-dim::before, .bp-dim::after { content: ""; position: absolute; right: -4px; width: 7px; height: 1px; background: #EAF3FF; } .bp-dim::before { top: 0; } .bp-dim::after { bottom: 0; } }
        .bp-dim:empty { display: none; }
        .bp-job-main { min-width: 0; }
        .bp-root .bp-job-main h3 { margin: 0; font-size: 1.55rem; line-height: 1.1; font-weight: 600; }
        .bp-co { margin: 0.2rem 0 0; color: #FFD966; font-family: 'IBM Plex Mono', monospace; font-size: 0.85rem; letter-spacing: 0.04em; overflow-wrap: anywhere; }
        .bp-text { margin: 0.6rem 0 0; white-space: pre-line; color: #DCEBFB; max-width: 64ch; }
        .bp-notes { margin: 0.6rem 0 0; padding: 0; list-style: none; max-width: 64ch; counter-reset: note; }
        .bp-notes li { position: relative; padding-left: 2.1rem; margin: 0.35rem 0; color: #DCEBFB; counter-increment: note; }
        .bp-notes li::before { content: "N" counter(note); position: absolute; left: 0; top: 0.2rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; color: #FFD966; }
        .bp-details { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.25rem; }
        @media (min-width: 44rem) { .bp-details { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .bp-detail { position: relative; min-width: 0; padding: 1.1rem 1.15rem 1.2rem; border: 1px dashed rgba(234, 243, 255, 0.55); }
        .bp-detail::before, .bp-detail::after { content: ""; position: absolute; width: 10px; height: 10px; border: 2px solid #FFD966; }
        .bp-detail::before { top: -2px; left: -2px; border-right: 0; border-bottom: 0; }
        .bp-detail::after { right: -2px; bottom: -2px; border-left: 0; border-top: 0; }
        .bp-detail-no { margin: 0; color: #FFD966; }
        .bp-root .bp-detail h3 { margin: 0.35rem 0 0; font-size: 1.4rem; line-height: 1.1; font-weight: 600; }
        .bp-detail .bp-text { font-size: 0.95rem; }
        .bp-spec { margin: 0.8rem 0 0; color: #BFD9F6; overflow-wrap: anywhere; }
        .bp-table { width: 100%; border-collapse: collapse; }
        .bp-table th, .bp-table td { padding: 0.6rem 0.8rem; border: 1px solid rgba(234, 243, 255, 0.45); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
        .bp-table th { width: 32%; font-weight: 500; color: #FFD966; background: rgba(255, 255, 255, 0.05); }
        .bp-table .bp-sub { display: block; color: #BFD9F6; font-size: 0.88rem; }
        .bp-title-block { margin-top: clamp(2.5rem, 7vw, 4rem); border: 2px solid #EAF3FF; display: grid; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 44rem) { .bp-title-block { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr); } }
        .bp-cell { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(234, 243, 255, 0.55); min-width: 0; overflow-wrap: anywhere; }
        @media (min-width: 44rem) { .bp-cell { border-bottom: 0; border-right: 1px solid rgba(234, 243, 255, 0.55); } .bp-cell:last-child { border-right: 0; } }
        .bp-cell:last-child { border-bottom: 0; }
        .bp-cell-k { margin: 0 0 0.2rem; color: #9CC0E6; }
        .bp-cell-v { margin: 0; font-family: 'Barlow Condensed', sans-serif; font-size: 1.35rem; line-height: 1.15; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
        .bp-foot { margin-top: 1.25rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
      `}</style>
      <div className="bp-root">
        <div className="bp-frame">
          <div className="bp-sheet">
            <div className="bp-sheet-in">
              <header className="bp-head">
                <div style={{ minWidth: 0 }}>
                  <p className="bp-kicker bp-mono">Drawing set / Professional profile</p>
                  <h1 className="bp-name">{full_name}</h1>
                  {headline && <p className="bp-headline">{headline}</p>}
                  {summary && <p className="bp-summary">{summary}</p>}
                </div>
                <div className="bp-ident">
                  {profile.avatar_url && (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      width={96}
                      height={96}
                      className="bp-avatar"
                    />
                  )}
                  {contactLinks.length > 0 && (
                    <ul className="bp-contact bp-mono" aria-label="Contact">
                      {contactLinks.map((link) => (
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
                            link.label
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </header>

              <main>
                {experience.length > 0 && (
                  <Section index={nextIndex()} title="Experience">
                    <Jobs experience={experience} />
                  </Section>
                )}

                {hasProjects && (
                  <Section index={nextIndex()} title="Details">
                    <div className="bp-details">
                      {projects.map((project, index) => {
                        const spec = project.technologies?.filter(Boolean) ?? [];

                        return (
                          <article
                            key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                            className="bp-detail"
                          >
                            <p className="bp-detail-no bp-mono">
                              Detail {String(index + 1).padStart(2, "0")}
                              {project.year ? ` / ${formatYear(project.year)}` : ""}
                            </p>
                            <h3>
                              {project.url ? (
                                <a
                                  href={project.url}
                                  target="_blank"
                                  rel={LINK_REL}
                                  className="bp-link"
                                >
                                  {project.title}
                                </a>
                              ) : (
                                project.title
                              )}
                            </h3>
                            {project.description && (
                              <p className="bp-text">{project.description}</p>
                            )}
                            {spec.length > 0 && (
                              <p className="bp-spec bp-mono">Spec: {spec.join(" · ")}</p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {skillGroups.length > 0 && (
                  <Section index={nextIndex()} title="Legend">
                    <table className="bp-table">
                      <tbody>
                        {skillGroups.map((group) => (
                          <tr key={group.category}>
                            <th scope="row" className="bp-mono">
                              {group.category}
                            </th>
                            <td>{group.items.join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Section>
                )}

                {hasEducation && (
                  <Section index={nextIndex()} title="Education">
                    <table className="bp-table">
                      <tbody>
                        {education.map((edu) => (
                          <tr key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}>
                            <th scope="row" className="bp-mono">
                              {edu.graduation_date ? formatShortDate(edu.graduation_date) : "—"}
                            </th>
                            <td>
                              {edu.degree}
                              <span className="bp-sub">
                                {[edu.institution, edu.location, edu.gpa ? `GPA ${edu.gpa}` : null]
                                  .filter(Boolean)
                                  .join(" / ")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Section>
                )}

                {hasStamps && (
                  <Section index={nextIndex()} title="Approvals">
                    <table className="bp-table">
                      <tbody>
                        {certifications.map((cert) => (
                          <tr key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}>
                            <th scope="row" className="bp-mono">
                              {cert.date ? formatShortDate(cert.date) : "—"}
                            </th>
                            <td>
                              {cert.url ? (
                                <a
                                  href={cert.url}
                                  target="_blank"
                                  rel={LINK_REL}
                                  className="bp-link"
                                >
                                  {cert.name}
                                </a>
                              ) : (
                                cert.name
                              )}
                              {cert.issuer && <span className="bp-sub">{cert.issuer}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Section>
                )}
              </main>

              <footer>
                <div className="bp-title-block">
                  <div className="bp-cell">
                    <p className="bp-cell-k bp-mono">Drawn by</p>
                    <p className="bp-cell-v">{full_name}</p>
                  </div>
                  <div className="bp-cell">
                    <p className="bp-cell-k bp-mono">Handle</p>
                    <p className="bp-cell-v">@{profile.handle}</p>
                  </div>
                  <div className="bp-cell">
                    <p className="bp-cell-k bp-mono">Scale</p>
                    <p className="bp-cell-v">1:1</p>
                  </div>
                </div>
                <div className="bp-foot">
                  <span className="bp-mono">Sheet 1 of 1</span>
                  <ShareBar
                    handle={profile.handle}
                    title={`${full_name}'s Portfolio`}
                    name={full_name}
                    variant="blueprint"
                  />
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
