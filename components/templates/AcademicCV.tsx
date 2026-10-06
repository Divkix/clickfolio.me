import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { PrintButton } from "./shared/PrintButton";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A scholarly CV: education leads, appointments follow, and projects are listed as numbered
// research outputs, newest first. Dates sit in a left column; a sticky index lists the sections
// that exist. The resume schema has no publications field, so projects stand in for them.

type Content = TemplateProps["content"];

const LINK_REL = "ugc nofollow noopener noreferrer";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section id={id} className="ac-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Row({
  when,
  children,
}: {
  when?: string | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="ac-row">
      <p className="ac-when">{when}</p>
      <div className="ac-what">{children}</div>
    </div>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <a href={href} target="_blank" rel={LINK_REL} className="ac-link">
      {children}
    </a>
  );
}

function Appointments({ experience }: { experience: Content["experience"] }) {
  return (
    <>
      {experience.map((job) => {
        const highlights = job.highlights?.filter(Boolean) ?? [];

        return (
          <Row
            key={`${job.company}-${job.title}-${job.start_date}`}
            when={formatDateSpan(job.start_date, job.end_date)}
          >
            <h3>{job.title}</h3>
            <p className="ac-meta">{[job.company, job.location].filter(Boolean).join(", ")}</p>
            {job.description && <p className="ac-text">{job.description}</p>}
            {highlights.length > 0 && (
              <ul className="ac-list">
                {highlights.map((highlight) => (
                  <li key={`${job.title}-${highlight}`}>{highlight}</li>
                ))}
              </ul>
            )}
          </Row>
        );
      })}
    </>
  );
}

function Outputs({ projects }: { projects: NonNullable<Content["projects"]> }) {
  return (
    <ol className="ac-outputs">
      {projects.map((project, index) => {
        const keywords = project.technologies?.filter(Boolean) ?? [];

        return (
          <li key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}>
            <Row when={project.year ? formatYear(project.year) : null}>
              <h3>
                <span className="ac-num">[{projects.length - index}]</span>{" "}
                {project.url ? (
                  <ExternalLink href={project.url}>{project.title}</ExternalLink>
                ) : (
                  project.title
                )}
              </h3>
              {project.description && <p className="ac-text">{project.description}</p>}
              {keywords.length > 0 && (
                <p className="ac-meta">
                  <span className="ac-kw">Keywords:</span> {keywords.join(", ")}
                </p>
              )}
            </Row>
          </li>
        );
      })}
    </ol>
  );
}

export const AcademicCV: React.FC<TemplateProps> = ({ content, profile, isPreview }) => {
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
  const hasEducation = !!education && education.length > 0;
  const hasExperience = experience.length > 0;
  const hasProjects = !!projects && projects.length > 0;
  const hasHonors = !!certifications && certifications.length > 0;

  const index = [
    summary && { id: "ac-about", label: "About" },
    hasEducation && { id: "ac-education", label: "Education" },
    hasExperience && { id: "ac-appointments", label: "Appointments" },
    hasProjects && { id: "ac-research", label: "Research" },
    skillGroups.length > 0 && { id: "ac-methods", label: "Methods" },
    hasHonors && { id: "ac-honors", label: "Honors" },
  ].filter((item): item is { id: string; label: string } => !!item);

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&display=swap" />
      <style>{`
        .ac-root { min-height: 100vh; background: #FAFAF7; color: #1C2430; font-family: 'Source Sans 3', system-ui, sans-serif; font-size: 1.0625rem; line-height: 1.6; overflow-x: hidden; }
        .ac-root h1, .ac-root h2, .ac-root h3 { font-family: 'Crimson Pro', Georgia, serif; text-wrap: unset; overflow-wrap: anywhere; }
        .ac-root ::selection { background: #1D4E89; color: #fff; }
        .ac-wrap { max-width: 66rem; margin: 0 auto; padding: clamp(1.5rem, 5vw, 4rem) 1.25rem 5rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2rem; }
        @media (min-width: 60rem) { .ac-wrap { grid-template-columns: 9.5rem minmax(0, 1fr); gap: 3.5rem; } }
        .ac-index { display: flex; gap: 0.25rem 1rem; overflow-x: auto; padding-bottom: 0.25rem; border-bottom: 1px solid #DAD9D2; font-size: 0.9rem; }
        .ac-index a { color: #4D5766; text-decoration: none; padding: 0.35rem 0; white-space: nowrap; border-bottom: 2px solid transparent; }
        .ac-index a:hover, .ac-index a:focus-visible { color: #1D4E89; border-bottom-color: #1D4E89; outline: none; }
        @media (min-width: 60rem) { .ac-index { position: sticky; top: 2rem; align-self: start; flex-direction: column; gap: 0.15rem; overflow: visible; border-bottom: 0; border-right: 1px solid #DAD9D2; padding: 0.4rem 1rem 0.4rem 0; } .ac-index a { white-space: normal; } }
        .ac-main { min-width: 0; }
        .ac-head { display: flex; gap: 1.5rem; justify-content: space-between; align-items: flex-start; }
        .ac-head-text { min-width: 0; }
        .ac-root .ac-name { margin: 0; font-size: clamp(2.4rem, 7vw, 3.9rem); line-height: 1.02; font-weight: 600; letter-spacing: -0.015em; color: #14202F; }
        .ac-pos { margin: 0.6rem 0 0; font-size: 1.2rem; color: #1D4E89; font-weight: 600; }
        .ac-avatar { width: 6.5rem; height: 6.5rem; flex: none; border-radius: 0.25rem; object-fit: cover; border: 1px solid #DAD9D2; }
        @media (max-width: 36rem) { .ac-avatar { width: 4.5rem; height: 4.5rem; } }
        .ac-contact { display: flex; flex-wrap: wrap; gap: 0.3rem 1.25rem; margin: 1rem 0 0; padding: 0; list-style: none; font-size: 0.95rem; color: #4D5766; }
        .ac-contact li { min-width: 0; overflow-wrap: anywhere; }
        .ac-link, .ac-contact a { color: #1D4E89; text-decoration: underline; text-decoration-color: rgba(29, 78, 137, 0.35); text-underline-offset: 3px; }
        .ac-link:hover, .ac-contact a:hover { text-decoration-color: #1D4E89; }
        .ac-link:focus-visible, .ac-contact a:focus-visible { outline: 2px solid #1D4E89; outline-offset: 2px; }
        .ac-section { margin-top: 2.75rem; scroll-margin-top: 1.5rem; }
        .ac-root .ac-section h2 { margin: 0 0 1.1rem; padding-bottom: 0.4rem; border-bottom: 1px solid #14202F; font-size: 1.05rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #14202F; }
        .ac-about { margin: 0; white-space: pre-line; font-size: 1.12rem; line-height: 1.7; }
        .ac-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.1rem; margin-bottom: 1.5rem; }
        @media (min-width: 40rem) { .ac-row { grid-template-columns: 8.25rem minmax(0, 1fr); gap: 1.5rem; } }
        .ac-when { margin: 0.25rem 0 0; font-size: 0.9rem; color: #4D5766; font-variant-numeric: tabular-nums; }
        .ac-when:empty { display: none; }
        .ac-what { min-width: 0; }
        .ac-root .ac-what h3 { margin: 0; font-size: 1.3rem; line-height: 1.25; font-weight: 600; color: #14202F; }
        .ac-meta { margin: 0.1rem 0 0; color: #4D5766; font-size: 0.97rem; }
        .ac-text { margin: 0.5rem 0 0; white-space: pre-line; }
        .ac-list { margin: 0.5rem 0 0; padding-left: 1.2rem; list-style: disc; }
        .ac-list li { margin: 0.25rem 0; padding-left: 0.2rem; }
        .ac-list li::marker { color: #8A93A1; }
        .ac-outputs { margin: 0; padding: 0; list-style: none; }
        .ac-num { color: #4D5766; font-weight: 400; font-variant-numeric: tabular-nums; }
        .ac-kw { font-weight: 600; font-style: italic; }
        .ac-skills { margin: 0; display: grid; gap: 0.6rem; }
        .ac-skills div { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; }
        @media (min-width: 40rem) { .ac-skills div { grid-template-columns: 8.25rem minmax(0, 1fr); gap: 1.5rem; } }
        .ac-skills dt { font-weight: 600; color: #14202F; }
        .ac-skills dd { margin: 0; overflow-wrap: anywhere; }
        .ac-foot { margin-top: 4rem; padding-top: 1.25rem; border-top: 1px solid #DAD9D2; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; font-size: 0.92rem; color: #4D5766; }
        .ac-foot-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
        .ac-print { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.9rem; border: 1px solid #1D4E89; border-radius: 0.2rem; background: #fff; color: #1D4E89; font: inherit; font-size: 0.92rem; cursor: pointer; }
        .ac-print:hover { background: #1D4E89; color: #fff; }
        .ac-print:focus-visible { outline: 2px solid #1D4E89; outline-offset: 2px; }
        @media print {
          .ac-root { background: #fff; font-size: 10.5pt; }
          .ac-wrap { display: block; padding: 0; max-width: none; }
          .ac-index, .ac-foot-actions { display: none; }
          .ac-row { break-inside: avoid; }
        }
      `}</style>
      <div className="ac-root">
        <div className="ac-wrap">
          {index.length > 1 && (
            <nav className="ac-index" aria-label="Sections">
              {index.map((item) => (
                <a key={item.id} href={`#${item.id}`}>
                  {item.label}
                </a>
              ))}
            </nav>
          )}

          <main className="ac-main">
            <header className="ac-head">
              <div className="ac-head-text">
                <h1 className="ac-name">{full_name}</h1>
                {headline && <p className="ac-pos">{headline}</p>}
                {contactLinks.length > 0 && (
                  <ul className="ac-contact" aria-label="Contact">
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
              {profile.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt=""
                  width={104}
                  height={104}
                  className="ac-avatar"
                />
              )}
            </header>

            {summary && (
              <Section id="ac-about" title="About">
                <p className="ac-about">{summary}</p>
              </Section>
            )}

            {hasEducation && (
              <Section id="ac-education" title="Education">
                {education.map((edu) => (
                  <Row
                    key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
                    when={edu.graduation_date ? formatShortDate(edu.graduation_date) : null}
                  >
                    <h3>{edu.degree}</h3>
                    <p className="ac-meta">
                      {[edu.institution, edu.location].filter(Boolean).join(", ")}
                    </p>
                    {edu.gpa && <p className="ac-meta">GPA {edu.gpa}</p>}
                  </Row>
                ))}
              </Section>
            )}

            {hasExperience && (
              <Section id="ac-appointments" title="Appointments & Experience">
                <Appointments experience={experience} />
              </Section>
            )}

            {hasProjects && (
              <Section id="ac-research" title="Research & Selected Work">
                <Outputs projects={projects} />
              </Section>
            )}

            {skillGroups.length > 0 && (
              <Section id="ac-methods" title="Methods & Skills">
                <dl className="ac-skills">
                  {skillGroups.map((group) => (
                    <div key={group.category}>
                      <dt>{group.category}</dt>
                      <dd>{group.items.join(", ")}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            )}

            {hasHonors && (
              <Section id="ac-honors" title="Honors & Certifications">
                {certifications.map((cert) => (
                  <Row
                    key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}
                    when={cert.date ? formatShortDate(cert.date) : null}
                  >
                    <h3>
                      {cert.url ? (
                        <ExternalLink href={cert.url}>{cert.name}</ExternalLink>
                      ) : (
                        cert.name
                      )}
                    </h3>
                    {cert.issuer && <p className="ac-meta">{cert.issuer}</p>}
                  </Row>
                ))}
              </Section>
            )}

            <footer className="ac-foot">
              <span>
                @{profile.handle}
                {emailLink && (
                  <>
                    {" · "}
                    <a href={emailLink.href} className="ac-link">
                      {emailLink.label}
                    </a>
                  </>
                )}
              </span>
              <div className="ac-foot-actions">
                {!isPreview && <PrintButton className="ac-print" />}
                <ShareBar
                  handle={profile.handle}
                  title={`${full_name}'s CV`}
                  name={full_name}
                  variant="academic-cv"
                />
              </div>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
};
