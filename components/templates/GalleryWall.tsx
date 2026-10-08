import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A gallery wall: the name hangs as wall vinyl, selected work is framed at eye level with a
// museum label, and the CV is printed the way a gallery prints an artist's CV. Resumes rarely
// carry project images, so a frame without one hangs an abstract composition keyed to its
// position on the wall instead of showing an empty box.

type Content = TemplateProps["content"];

type Project = NonNullable<Content["projects"]>[number];

const LINK_REL = "ugc nofollow noopener noreferrer";

// Frames hang at mixed proportions, and an imageless frame cycles four compositions by position.
const ASPECTS = ["4 / 5", "3 / 4", "1 / 1"];

/** "2021–" for a current role, "2018–2021" for a finished one; "" when the resume has no start. */
function yearSpan(start?: string, end?: string | null): string {
  if (!start?.trim()) return "";

  return `${formatYear(start)}–${end?.trim() ? formatYear(end) : ""}`;
}

function Frame({ project, index, name }: { project: Project; index: number; name: string }) {
  const media = project.technologies?.filter(Boolean) ?? [];

  const title = project.url ? (
    <a href={project.url} target="_blank" rel={LINK_REL}>
      {project.title}
    </a>
  ) : (
    project.title
  );

  return (
    <figure className="gw-figure">
      <div
        className={`gw-work gw-work-${(index % 4) + 1}`}
        style={{ aspectRatio: ASPECTS[index % ASPECTS.length] }}
        aria-hidden={project.image_url ? undefined : true}
      >
        {project.image_url && (
          <img
            src={project.image_url}
            alt={project.title}
            loading="lazy"
            decoding="async"
            className="gw-img"
          />
        )}
      </div>
      <figcaption className="gw-label">
        <b>{name}</b>
        <i>{title}</i>
        {project.year?.trim() ? `, ${formatYear(project.year)}` : ""}
        {media.length > 0 && <span>{media.join(", ")}</span>}
        {project.description && <p>{project.description}</p>}
      </figcaption>
    </figure>
  );
}

export const GalleryWall: React.FC<TemplateProps> = ({ content, profile }) => {
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
  const works = projects?.filter((project) => project.title.trim()) ?? [];
  const schools = education ?? [];
  const certs = certifications ?? [];
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];

  const hasCv =
    experience.length > 0 || schools.length > 0 || certs.length > 0 || skillGroups.length > 0;

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,800;1,400&display=swap" />
      <style>{`
        .gw-root { min-height: 100vh; background: #F1F0EC; color: #2A2A2A; font-family: 'Schibsted Grotesk', system-ui, sans-serif; font-size: 1rem; line-height: 1.5; overflow-x: hidden; }
        .gw-root *, .gw-root *::before, .gw-root *::after { box-sizing: border-box; }
        .gw-root h1, .gw-root h2, .gw-root h3 { font-family: 'Schibsted Grotesk', system-ui, sans-serif; text-wrap: unset; overflow-wrap: anywhere; color: inherit; }
        .gw-root ::selection { background: #2A2A2A; color: #F1F0EC; }
        .gw-root a { color: inherit; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; overflow-wrap: anywhere; }
        .gw-root a:hover { text-decoration-thickness: 2px; }
        .gw-root a:focus-visible { outline: 3px solid #2A2A2A; outline-offset: 3px; }

        /* Exhibition title in wall vinyl, with the artist's statement set beside it. */
        .gw-entry { max-width: 75rem; margin: 0 auto; padding: clamp(3.5rem, 10vw, 6rem) clamp(1.25rem, 4vw, 2.5rem) 2.5rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2rem; align-items: end; }
        @media (min-width: 56.25rem) { .gw-entry { grid-template-columns: minmax(0, 1fr) 21.25rem; gap: 3rem; } }
        .gw-root h1.gw-name { margin: 0; min-width: 0; font-weight: 800; font-size: clamp(4rem, 11vw, 10.5rem); line-height: 0.86; letter-spacing: -0.045em; }
        .gw-statement { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 0.875rem; }
        .gw-avatar { width: 7rem; height: 7rem; object-fit: cover; border: 6px solid #FFFFFF; outline: 1px solid #D8D6CF; box-shadow: 0 2px 2px rgba(0, 0, 0, 0.08); }
        .gw-lede { margin: 0; color: #77756F; max-width: 40ch; }
        .gw-summary { margin: 0; max-width: 44ch; white-space: pre-line; }
        .gw-contact { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 0.4rem 1.1rem; }
        .gw-contact li { min-width: 0; }
        .gw-contact a { font-weight: 500; }

        /* The hang: works at eye level, each with its wall label under the frame. */
        .gw-hang { max-width: 75rem; margin: 0 auto; padding: clamp(2.5rem, 6vw, 4rem) clamp(1.25rem, 4vw, 2.5rem) clamp(4rem, 10vw, 7.5rem); display: grid; grid-template-columns: minmax(0, 1fr); gap: 4rem; align-items: end; }
        @media (min-width: 56.25rem) { .gw-hang { grid-template-columns: 5fr 3fr 4fr; gap: 3.5rem; } }
        .gw-figure { margin: 0; min-width: 0; display: grid; gap: 1.375rem; align-content: end; }
        .gw-work { width: 100%; border: 10px solid #FFFFFF; outline: 1px solid #D8D6CF; box-shadow: 0 2px 2px rgba(0, 0, 0, 0.08), 0 24px 30px -18px rgba(0, 0, 0, 0.35); overflow: hidden; }
        .gw-img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .gw-work-1 { background: radial-gradient(circle at 70% 28%, #F2C14E 0 12%, transparent 12.5%), linear-gradient(170deg, transparent 55%, #2F5D62 55.5%), linear-gradient(#E8604C, #D9453A); }
        .gw-work-2 { background: radial-gradient(ellipse at 50% 120%, #1E2A4A 0 48%, transparent 48.5%), repeating-linear-gradient(0deg, #E9E2CF 0 14px, #DDD3BB 14px 15px); }
        .gw-work-3 { background: conic-gradient(from 210deg at 40% 60%, #8FB9A8 0 25%, #F5E6C8 0 50%, #E5A39B 0 75%, #354F52 0); }
        .gw-work-4 { background: radial-gradient(circle at 26% 74%, #2A2A2A 0 16%, transparent 16.5%), linear-gradient(160deg, transparent 48%, #B8875A 48.5%), linear-gradient(#F6F5F1, #DCD9D1); }
        .gw-label { background: #FFFFFF; padding: 0.875rem 1rem; width: min(100%, 16.25rem); font-size: 0.8125rem; line-height: 1.45; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); overflow-wrap: anywhere; }
        .gw-label b { display: block; font-weight: 500; }
        .gw-label a { font-weight: 500; }
        .gw-label span { display: block; color: #77756F; }
        .gw-label p { margin: 0.5rem 0 0; color: #77756F; }
        .gw-floor { height: 3.5rem; background: linear-gradient(#B8875A, #9C6F47); box-shadow: inset 0 6px 8px -6px rgba(0, 0, 0, 0.35); }

        /* CV, set the way galleries print an artist's CV. */
        .gw-cv { background: #FFFFFF; }
        .gw-cv-in { max-width: 75rem; margin: 0 auto; padding: clamp(3rem, 7vw, 4.5rem) clamp(1.25rem, 4vw, 2.5rem) clamp(4rem, 9vw, 6rem); display: grid; grid-template-columns: minmax(0, 1fr); gap: 2.5rem; }
        @media (min-width: 56.25rem) { .gw-cv-in { grid-template-columns: 13.75rem minmax(0, 1fr) minmax(0, 1fr); gap: 2.5rem 3.5rem; } }
        .gw-cv-col { min-width: 0; }
        .gw-cv h2 { margin: 0; font-size: 1rem; font-weight: 500; letter-spacing: normal; }
        .gw-cv h2.gw-big { font-weight: 800; font-size: 1.75rem; letter-spacing: -0.02em; line-height: 1.1; }
        .gw-cv-col > div + div { margin-top: 2.25rem; }
        .gw-rows { margin: 0.875rem 0 0; display: grid; gap: 0.5rem; font-size: 0.9375rem; }
        .gw-row { display: grid; grid-template-columns: 4.5rem minmax(0, 1fr); gap: 1rem; }
        .gw-rows dt { min-width: 0; overflow-wrap: anywhere; }
        .gw-rows dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
        .gw-note { display: block; margin-top: 0.15rem; color: #77756F; }
        .gw-media { margin: 0.875rem 0 0; color: #77756F; font-size: 0.9375rem; overflow-wrap: anywhere; }
        .gw-media + .gw-media { margin-top: 0.375rem; }
        .gw-foot { background: #FFFFFF; padding: 0 clamp(1.25rem, 4vw, 2.5rem) clamp(2rem, 5vw, 2.5rem); }
        .gw-foot-in { max-width: 75rem; margin: 0 auto; padding-top: 1.5rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem 1.5rem; color: #77756F; font-size: 0.875rem; }
      `}</style>
      <div className="gw-root">
        <header className="gw-entry">
          <h1 className="gw-name">{full_name}</h1>
          <div className="gw-statement">
            {profile.avatar_url && (
              <img
                src={profile.avatar_url}
                alt=""
                width={112}
                height={112}
                loading="lazy"
                decoding="async"
                className="gw-avatar"
              />
            )}
            {headline && <p className="gw-lede">{headline}</p>}
            {summary && <p className="gw-summary">{summary}</p>}
            {contactLinks.length > 0 && (
              <ul className="gw-contact" aria-label="Contact">
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
                      <span>{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </header>

        {works.length > 0 && (
          <>
            <section className="gw-hang" aria-label="Selected work">
              {works.map((project, index) => (
                <Frame
                  key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                  project={project}
                  index={index}
                  name={full_name}
                />
              ))}
            </section>
            <div className="gw-floor" aria-hidden="true" />
          </>
        )}

        {hasCv && (
          <section className="gw-cv" aria-labelledby="gw-cv-title">
            <div className="gw-cv-in">
              <h2 id="gw-cv-title" className="gw-big">
                Curriculum vitae
              </h2>
              <div className="gw-cv-col">
                {experience.length > 0 && (
                  <div>
                    <h2>Experience</h2>
                    <dl className="gw-rows">
                      {experience.map((job) => (
                        <div
                          className="gw-row"
                          key={`${job.company}-${job.title}-${job.start_date}`}
                        >
                          <dt>{yearSpan(job.start_date, job.end_date)}</dt>
                          <dd>
                            {[job.title, job.company].filter(Boolean).join(", ")}
                            {job.description && <span className="gw-note">{job.description}</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                {certs.length > 0 && (
                  <div>
                    <h2>Awards and certifications</h2>
                    <dl className="gw-rows">
                      {certs.map((cert) => (
                        <div
                          className="gw-row"
                          key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}
                        >
                          <dt>{cert.date?.trim() ? formatYear(cert.date) : ""}</dt>
                          <dd>
                            {cert.url ? (
                              <a href={cert.url} target="_blank" rel={LINK_REL}>
                                {cert.name}
                              </a>
                            ) : (
                              cert.name
                            )}
                            {cert.issuer && <span className="gw-note">{cert.issuer}</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
              <div className="gw-cv-col">
                {schools.length > 0 && (
                  <div>
                    <h2>Education</h2>
                    <dl className="gw-rows">
                      {schools.map((edu) => (
                        <div
                          className="gw-row"
                          key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
                        >
                          <dt>
                            {edu.graduation_date?.trim() ? formatYear(edu.graduation_date) : ""}
                          </dt>
                          <dd>
                            {[
                              edu.degree,
                              edu.institution,
                              edu.location,
                              edu.gpa ? `GPA ${edu.gpa}` : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                {skillGroups.length > 0 && (
                  <div>
                    <h2>Media and tools</h2>
                    {skillGroups.map((group) => (
                      <p className="gw-media" key={group.category}>
                        {skillGroups.length > 1 ? `${group.category}: ` : ""}
                        {group.items.join(", ")}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <footer className="gw-foot">
          <div className="gw-foot-in">
            <span>@{profile.handle}</span>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="gallery-wall"
            />
          </div>
        </footer>
      </div>
    </>
  );
};
