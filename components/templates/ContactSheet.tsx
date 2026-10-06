import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A photographer's contact sheet: projects are film frames numbered in order, the first one
// circled in grease pencil. Resume projects rarely carry an image, so a frame without one
// shows its title as the picture instead of an empty box.

type Content = TemplateProps["content"];

type Project = NonNullable<Content["projects"]>[number];

const LINK_REL = "ugc nofollow noopener noreferrer";

function frameNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function FrameBody({ project, index }: { project: Project; index: number }) {
  const keywords = project.technologies?.filter(Boolean) ?? [];
  const hasImage = !!project.image_url;

  return (
    <>
      <div className="cs-holes" aria-hidden="true" />
      <div className="cs-photo">
        {hasImage ? (
          <img
            src={project.image_url}
            alt=""
            width={900}
            height={600}
            loading="lazy"
            decoding="async"
            className="cs-img"
          />
        ) : (
          <div className="cs-tile">
            <span className="cs-tile-no" aria-hidden="true">
              {frameNumber(index)}
            </span>
            <h3 className="cs-tile-title">{project.title}</h3>
          </div>
        )}
      </div>
      <div className="cs-holes" aria-hidden="true" />
      <figcaption className="cs-cap">
        <p className="cs-label">
          <span className={index === 0 ? "cs-no cs-pick" : "cs-no"}>{frameNumber(index)}</span>
          {project.year && <span>{formatYear(project.year)}</span>}
        </p>
        {hasImage && <h3 className="cs-cap-title">{project.title}</h3>}
        {project.description && <p className="cs-cap-text">{project.description}</p>}
        {keywords.length > 0 && <p className="cs-label cs-kw">{keywords.join(" / ")}</p>}
      </figcaption>
    </>
  );
}

function Frames({ projects }: { projects: NonNullable<Content["projects"]> }) {
  return (
    <div className="cs-grid">
      {projects.map((project, index) => (
        <figure
          key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
          className="cs-frame"
        >
          {project.url ? (
            <a href={project.url} target="_blank" rel={LINK_REL} className="cs-frame-link">
              <FrameBody project={project} index={index} />
            </a>
          ) : (
            <FrameBody project={project} index={index} />
          )}
        </figure>
      ))}
    </div>
  );
}

function Assignments({ experience }: { experience: Content["experience"] }) {
  return (
    <ol className="cs-jobs">
      {experience.map((job, index) => {
        const highlights = job.highlights?.filter(Boolean) ?? [];

        return (
          <li key={`${job.company}-${job.title}-${job.start_date}`} className="cs-job">
            <span className="cs-label cs-job-no">{frameNumber(index)}</span>
            <div className="cs-job-main">
              <h3>{job.title}</h3>
              <p className="cs-job-co">{[job.company, job.location].filter(Boolean).join(" · ")}</p>
              {job.description && <p className="cs-job-text">{job.description}</p>}
              {highlights.length > 0 && (
                <ul className="cs-dash">
                  {highlights.map((highlight) => (
                    <li key={`${job.title}-${highlight}`}>{highlight}</li>
                  ))}
                </ul>
              )}
            </div>
            <span className="cs-label cs-job-when">
              {formatDateSpan(job.start_date, job.end_date)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export const ContactSheet: React.FC<TemplateProps> = ({ content, profile }) => {
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
  const hasProjects = !!projects && projects.length > 0;
  const hasEducation = !!education && education.length > 0;
  const hasAwards = !!certifications && certifications.length > 0;
  const frameCount = hasProjects ? projects.length : experience.length;
  const frameWord = hasProjects ? "frames" : "assignments";

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter+Tight:wght@400;500;700;800&display=swap" />
      <style>{`
        .cs-root { min-height: 100vh; background: #0F0F10; color: #ECE8DF; font-family: 'Inter Tight', system-ui, sans-serif; font-size: 1.0625rem; line-height: 1.6; overflow-x: hidden; }
        .cs-root h1, .cs-root h2, .cs-root h3 { font-family: 'Inter Tight', system-ui, sans-serif; text-wrap: unset; overflow-wrap: anywhere; }
        .cs-root ::selection { background: #FF6B2C; color: #0F0F10; }
        .cs-wrap { max-width: 80rem; margin: 0 auto; padding: 1.5rem 1.25rem 5rem; }
        @media (min-width: 48rem) { .cs-wrap { padding: 2.5rem 2.5rem 6rem; } }
        .cs-label { margin: 0; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 0.75rem; line-height: 1.4; letter-spacing: 0.12em; text-transform: uppercase; color: #9A968D; font-variant-numeric: tabular-nums; }
        .cs-bar { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.4rem 1.5rem; padding-bottom: 0.9rem; border-bottom: 1px solid #2A2A2D; }
        .cs-root .cs-name { margin: clamp(1.5rem, 5vw, 3rem) 0 0; font-size: clamp(3rem, 12.5vw, 10rem); line-height: 0.88; font-weight: 800; letter-spacing: -0.045em; color: #F4F0E6; }
        .cs-intro { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; margin-top: clamp(1.5rem, 4vw, 2.5rem); }
        @media (min-width: 56rem) { .cs-intro { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 3rem; } }
        .cs-headline { margin: 0; font-size: clamp(1.25rem, 2.4vw, 1.75rem); line-height: 1.2; font-weight: 500; color: #FF6B2C; overflow-wrap: anywhere; }
        .cs-summary { margin: 0; white-space: pre-line; color: #CFCABF; max-width: 62ch; }
        .cs-me { display: flex; gap: 1.25rem; align-items: flex-start; }
        .cs-avatar { width: 5.5rem; height: 6.875rem; flex: none; object-fit: cover; border: 1px solid #2A2A2D; }
        .cs-contact { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; margin: 1.75rem 0 0; padding: 0; list-style: none; }
        .cs-contact li { min-width: 0; overflow-wrap: anywhere; }
        .cs-contact a, .cs-foot a { color: #ECE8DF; text-decoration: none; border-bottom: 1px solid #FF6B2C; padding-bottom: 1px; }
        .cs-contact a:hover, .cs-foot a:hover { color: #FF6B2C; }
        .cs-contact a:focus-visible, .cs-foot a:focus-visible, .cs-frame-link:focus-visible { outline: 2px solid #FF6B2C; outline-offset: 3px; }
        .cs-section { margin-top: clamp(3rem, 8vw, 5.5rem); }
        .cs-root .cs-section > h2 { margin: 0 0 1.5rem; display: flex; align-items: baseline; gap: 1rem; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 0.8rem; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: #9A968D; }
        .cs-section > h2::after { content: ""; flex: 1; height: 1px; background: #2A2A2D; }
        .cs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 17.5rem), 1fr)); gap: 1.5rem; }
        .cs-frame { margin: 0; min-width: 0; background: #1A1A1C; border: 1px solid #2A2A2D; }
        .cs-frame-link { display: block; color: inherit; text-decoration: none; }
        .cs-frame-link:hover .cs-tile-title, .cs-frame-link:hover .cs-cap-title { color: #FF6B2C; }
        .cs-holes { height: 0.9rem; background: repeating-linear-gradient(90deg, #0F0F10 0 0.55rem, transparent 0.55rem 1.15rem); background-size: 100% 0.4rem; background-position: 0 50%; background-repeat: no-repeat; }
        .cs-photo { aspect-ratio: 3 / 2; background: #121214; overflow: hidden; }
        .cs-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cs-tile { height: 100%; padding: 1rem 1.1rem; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(135deg, #1F1F22, #131315); }
        .cs-tile-no { font-family: 'Inter Tight', sans-serif; font-size: 3.2rem; line-height: 1; font-weight: 800; color: transparent; -webkit-text-stroke: 1px #4A4A50; letter-spacing: -0.02em; }
        .cs-root .cs-tile-title { margin: 0; font-size: clamp(1.1rem, 2vw, 1.4rem); line-height: 1.15; font-weight: 700; letter-spacing: -0.01em; color: #F4F0E6; }
        .cs-cap { padding: 0.9rem 1rem 1.1rem; }
        .cs-cap .cs-label:first-child { display: flex; gap: 0.9rem; align-items: center; }
        .cs-no { position: relative; }
        .cs-pick { color: #FF6B2C; }
        .cs-pick::before { content: ""; position: absolute; inset: -0.35rem -0.55rem; border: 2px solid #FF6B2C; border-radius: 55% 45% 50% 50% / 60% 50% 50% 40%; transform: rotate(-4deg); }
        .cs-root .cs-cap-title { margin: 0.6rem 0 0; font-size: 1.15rem; line-height: 1.25; font-weight: 700; color: #F4F0E6; }
        .cs-cap-text { margin: 0.55rem 0 0; font-size: 0.97rem; line-height: 1.5; color: #CFCABF; white-space: pre-line; }
        .cs-kw { margin-top: 0.7rem; }
        .cs-jobs { margin: 0; padding: 0; list-style: none; }
        .cs-job { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.4rem; padding: 1.5rem 0; border-top: 1px solid #2A2A2D; }
        .cs-job:last-child { border-bottom: 1px solid #2A2A2D; }
        @media (min-width: 48rem) { .cs-job { grid-template-columns: 3.5rem minmax(0, 1fr) 11rem; gap: 1.5rem; } .cs-job-when { text-align: right; } }
        .cs-job-no, .cs-job-when { padding-top: 0.45rem; }
        .cs-job-main { min-width: 0; }
        .cs-root .cs-job-main h3 { margin: 0; font-size: 1.4rem; line-height: 1.2; font-weight: 700; color: #F4F0E6; }
        .cs-job-co { margin: 0.2rem 0 0; color: #FF6B2C; font-weight: 500; }
        .cs-job-text { margin: 0.6rem 0 0; color: #CFCABF; white-space: pre-line; max-width: 62ch; }
        .cs-dash { margin: 0.6rem 0 0; padding: 0; list-style: none; max-width: 62ch; }
        .cs-dash li { position: relative; padding-left: 1.4rem; margin: 0.3rem 0; color: #CFCABF; }
        .cs-dash li::before { content: "—"; position: absolute; left: 0; color: #FF6B2C; }
        .cs-cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2.5rem; }
        @media (min-width: 56rem) { .cs-cols { grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 3rem; } }
        .cs-box { min-width: 0; }
        .cs-box > .cs-label { padding-bottom: 0.7rem; margin-bottom: 1rem; border-bottom: 1px solid #2A2A2D; }
        .cs-box ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.9rem; }
        .cs-root .cs-box h3 { margin: 0; font-size: 1.05rem; line-height: 1.3; font-weight: 700; color: #F4F0E6; }
        .cs-box p { margin: 0.1rem 0 0; font-size: 0.95rem; color: #CFCABF; overflow-wrap: anywhere; }
        .cs-box a { color: inherit; text-decoration: underline; text-decoration-color: #FF6B2C; text-underline-offset: 3px; }
        .cs-box a:hover { color: #FF6B2C; }
        .cs-foot { margin-top: clamp(3.5rem, 9vw, 6rem); padding-top: 1.5rem; border-top: 1px solid #2A2A2D; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
        .cs-cta { font-size: clamp(1.4rem, 3.5vw, 2.4rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; overflow-wrap: anywhere; }
      `}</style>
      <div className="cs-root">
        <div className="cs-wrap">
          <header>
            <div className="cs-bar">
              <span className="cs-label">Contact sheet</span>
              <span className="cs-label">@{profile.handle}</span>
              <span className="cs-label">
                {frameCount} {frameWord}
              </span>
            </div>
            <h1 className="cs-name">{full_name}</h1>
            <div className="cs-intro">
              <div className="cs-me">
                {profile.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    width={88}
                    height={110}
                    className="cs-avatar"
                  />
                )}
                {headline && <p className="cs-headline">{headline}</p>}
              </div>
              {summary && <p className="cs-summary">{summary}</p>}
            </div>
            {contactLinks.length > 0 && (
              <ul className="cs-contact" aria-label="Contact">
                {contactLinks.map((link) => (
                  <li key={link.type} className="cs-label">
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
          </header>

          <main>
            {hasProjects && (
              <section className="cs-section" aria-labelledby="cs-frames">
                <h2 id="cs-frames">Selected frames</h2>
                <Frames projects={projects} />
              </section>
            )}

            {experience.length > 0 && (
              <section className="cs-section" aria-labelledby="cs-assignments">
                <h2 id="cs-assignments">Assignments</h2>
                <Assignments experience={experience} />
              </section>
            )}

            {(hasEducation || skillGroups.length > 0 || hasAwards) && (
              <section className="cs-section cs-cols" aria-label="Background">
                {hasEducation && (
                  <div className="cs-box">
                    <p className="cs-label">Training</p>
                    <ul>
                      {education.map((edu) => (
                        <li key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}>
                          <h3>{edu.degree}</h3>
                          <p>{[edu.institution, edu.location].filter(Boolean).join(", ")}</p>
                          {(edu.graduation_date || edu.gpa) && (
                            <p className="cs-label">
                              {[
                                edu.graduation_date ? formatShortDate(edu.graduation_date) : null,
                                edu.gpa ? `GPA ${edu.gpa}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {skillGroups.length > 0 && (
                  <div className="cs-box">
                    <p className="cs-label">Kit &amp; technique</p>
                    <ul>
                      {skillGroups.map((group) => (
                        <li key={group.category}>
                          <h3>{group.category}</h3>
                          <p>{group.items.join(", ")}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {hasAwards && (
                  <div className="cs-box">
                    <p className="cs-label">Awards &amp; credentials</p>
                    <ul>
                      {certifications.map((cert) => (
                        <li key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}>
                          <h3>
                            {cert.url ? (
                              <a href={cert.url} target="_blank" rel={LINK_REL}>
                                {cert.name}
                              </a>
                            ) : (
                              cert.name
                            )}
                          </h3>
                          {(cert.issuer || cert.date) && (
                            <p>
                              {[cert.issuer, cert.date ? formatShortDate(cert.date) : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </main>

          <footer className="cs-foot">
            {emailLink ? (
              <a href={emailLink.href} className="cs-cta">
                {emailLink.label}
              </a>
            ) : (
              <span className="cs-label">@{profile.handle}</span>
            )}
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="contact-sheet"
            />
          </footer>
        </div>
      </div>
    </>
  );
};
