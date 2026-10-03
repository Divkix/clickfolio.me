import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// Dark executive ledger: a sticky identity column (name, contact, skills) beside a ruled ledger of
// roles with the dates set in a monospaced margin. One brass accent, used sparingly.

type Content = TemplateProps["content"];

function Label({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="bd-label">
      {children}
    </h2>
  );
}

function Mark({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`Photograph of ${name}`}
        width={52}
        height={52}
        fetchPriority="high"
        decoding="async"
        className="bd-mark bd-mark-img"
      />
    );
  }

  return (
    <div aria-hidden="true" className="bd-mark">
      {getInitials(name)}
    </div>
  );
}

function ExperienceSection({ experience }: { experience: Content["experience"] }) {
  return (
    <section id="experience" aria-labelledby="experience-title">
      <Label id="experience-title">Experience</Label>
      {experience.map((job) => {
        const highlights = job.highlights?.filter(Boolean) ?? [];
        const place = [job.company, job.location].filter(Boolean).join(" · ");

        return (
          <article key={`${job.company}-${job.title}-${job.start_date}`} className="bd-row">
            <p className="bd-dates">{formatDateSpan(job.start_date, job.end_date) ?? "Undated"}</p>
            <div className="bd-body">
              <h3 className="bd-title">{job.title}</h3>
              {place && <p className="bd-co">{place}</p>}
              {job.description && <p className="bd-desc">{job.description}</p>}
              {highlights.length > 0 && (
                <ul className="bd-bullets">
                  {highlights.map((highlight) => (
                    <li key={`${job.title}-${highlight}`}>{highlight}</li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ProjectsSection({ projects }: { projects: NonNullable<Content["projects"]> }) {
  return (
    <section id="projects" aria-labelledby="projects-title">
      <Label id="projects-title">Selected work</Label>
      {projects.map((project) => (
        <article key={`${project.title}-${project.year ?? ""}`} className="bd-row">
          <p className="bd-dates">{project.year ?? ""}</p>
          <div className="bd-body">
            <h3 className="bd-title">
              {project.url ? (
                <a
                  href={project.url}
                  target="_blank"
                  rel="ugc nofollow noopener noreferrer"
                  className="bd-link"
                >
                  {project.title}
                </a>
              ) : (
                project.title
              )}
            </h3>
            {project.description && <p className="bd-desc">{project.description}</p>}
            {project.technologies && project.technologies.length > 0 && (
              <p className="bd-co">{project.technologies.filter(Boolean).join(" · ")}</p>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

function EducationSection({ education }: { education: NonNullable<Content["education"]> }) {
  return (
    <section id="education" aria-labelledby="education-title">
      <Label id="education-title">Education</Label>
      {education.map((entry) => {
        const place = [entry.institution, entry.location].filter(Boolean).join(" · ");

        return (
          <article key={`${entry.institution}-${entry.degree}`} className="bd-row bd-row-tight">
            <p className="bd-dates">
              {entry.graduation_date ? formatShortDate(entry.graduation_date) : ""}
            </p>
            <div className="bd-body">
              <h3 className="bd-title bd-title-sm">{entry.degree}</h3>
              {place && <p className="bd-co">{place}</p>}
              {entry.gpa && <p className="bd-desc">GPA {entry.gpa}</p>}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function CertificationsSection({
  certifications,
}: {
  certifications: NonNullable<Content["certifications"]>;
}) {
  return (
    <section id="certifications" aria-labelledby="certifications-title">
      <Label id="certifications-title">Certifications</Label>
      {certifications.map((cert) => (
        <article key={`${cert.name}-${cert.issuer ?? ""}`} className="bd-row bd-row-tight">
          <p className="bd-dates">{cert.date ? formatShortDate(cert.date) : ""}</p>
          <div className="bd-body">
            <h3 className="bd-title bd-title-sm">
              {cert.url ? (
                <a
                  href={cert.url}
                  target="_blank"
                  rel="ugc nofollow noopener noreferrer"
                  className="bd-link"
                >
                  {cert.name}
                </a>
              ) : (
                cert.name
              )}
            </h3>
            {cert.issuer && <p className="bd-co">{cert.issuer}</p>}
          </div>
        </article>
      ))}
    </section>
  );
}

export const Boardroom: React.FC<TemplateProps> = ({ content, profile }) => {
  const { full_name, headline, summary, contact, experience, projects, education, certifications } =
    content;

  const skillGroups = content.skills?.filter((group) => group.items.some(Boolean)) ?? [];
  const links = getContactLinks(contact).filter((link) => link.type !== "location");

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&family=Schibsted+Grotesk:wght@500;600&family=Source+Serif+4:opsz,wght@8..60,400&display=swap" />
      <style>{`
        .bd-root { background: #0F1318; color: #ECE6D8; font-family: 'Source Serif 4', Georgia, serif; }
        .bd-root h1, .bd-root h2, .bd-root h3, .bd-root h4 { font-family: 'Schibsted Grotesk', 'Helvetica Neue', Arial, sans-serif; text-wrap: balance; }
        .bd-wrap { max-width: 76rem; margin: 0 auto; padding: clamp(2rem, 6vw, 5rem) 1rem; display: grid; grid-template-columns: minmax(0, 21rem) minmax(0, 1fr); gap: clamp(2rem, 6vw, 6rem); }
        .bd-id { position: sticky; top: 2rem; align-self: start; display: flex; flex-direction: column; gap: 2rem; min-width: 0; }
        .bd-mark { width: 3.25rem; height: 3.25rem; display: grid; place-items: center; border: 1px solid #C4A971; color: #C4A971; font: 600 0.95rem/1 'Schibsted Grotesk', Arial, sans-serif; letter-spacing: 0.08em; }
        .bd-mark-img { object-fit: cover; }
        .bd-root .bd-name { margin: 0; font-weight: 600; font-size: clamp(2.6rem, 6vw, 3.9rem); line-height: 0.98; letter-spacing: -0.035em; overflow-wrap: anywhere; }
        .bd-role { margin: 0.9rem 0 0; font: italic 400 1.2rem/1.4 'Newsreader', Georgia, serif; color: #98A0AB; }
        .bd-loc { margin: 1.1rem 0 0; font: 400 0.78rem/1 'Geist Mono', ui-monospace, monospace; letter-spacing: 0.06em; text-transform: uppercase; color: #98A0AB; }
        .bd-root .bd-label { display: flex; align-items: center; gap: 0.9rem; margin: 0 0 1.25rem; font: 500 0.72rem/1 'Geist Mono', ui-monospace, monospace; letter-spacing: 0.14em; text-transform: uppercase; color: #C4A971; }
        .bd-label::after { content: ""; flex: 1; height: 1px; background: #262D37; }
        .bd-contact { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.8rem; }
        .bd-contact li { display: grid; grid-template-columns: 4.5rem minmax(0, 1fr); gap: 0.5rem; align-items: baseline; }
        .bd-contact span { font: 400 0.72rem/1.2 'Geist Mono', ui-monospace, monospace; letter-spacing: 0.08em; text-transform: uppercase; color: #98A0AB; }
        .bd-contact a { font: 500 0.95rem/1.3 'Schibsted Grotesk', Arial, sans-serif; overflow-wrap: anywhere; color: #ECE6D8; text-decoration: none; border-bottom: 1px solid #262D37; transition: border-color 0.15s, color 0.15s; }
        .bd-contact a:hover, .bd-link:hover { color: #C4A971; border-color: #C4A971; }
        .bd-link { color: inherit; text-decoration: none; border-bottom: 1px solid #262D37; }
        .bd-root a:focus-visible { outline: 2px solid #C4A971; outline-offset: 3px; }
        .bd-skills { display: grid; gap: 1rem; }
        .bd-root .bd-skills h3 { margin: 0 0 0.25rem; font-weight: 600; font-size: 0.85rem; line-height: 1.3; letter-spacing: 0; }
        .bd-skills p { margin: 0; font-size: 0.92rem; line-height: 1.55; color: #98A0AB; }
        .bd-main { display: flex; flex-direction: column; gap: 3.5rem; min-width: 0; }
        .bd-lede { margin: 0; max-width: 40rem; font: 400 clamp(1.3rem, 2.4vw, 1.65rem)/1.5 'Newsreader', Georgia, serif; white-space: pre-line; }
        .bd-row { display: grid; grid-template-columns: 9.5rem minmax(0, 1fr); gap: 1.5rem; padding: 1.75rem 0; border-top: 1px solid #262D37; }
        .bd-row:last-child { border-bottom: 1px solid #262D37; }
        .bd-row-tight { padding: 1.1rem 0; }
        .bd-dates { margin: 0; font: 400 0.78rem/1.6 'Geist Mono', ui-monospace, monospace; color: #98A0AB; font-variant-numeric: tabular-nums; }
        .bd-body { min-width: 0; }
        .bd-root .bd-title { margin: 0; font-weight: 600; font-size: 1.35rem; line-height: 1.25; letter-spacing: -0.01em; overflow-wrap: anywhere; }
        .bd-root .bd-title-sm { font-size: 1.05rem; }
        .bd-co { margin: 0.25rem 0 0; font: 500 0.95rem/1.4 'Schibsted Grotesk', Arial, sans-serif; color: #C4A971; }
        .bd-desc { margin: 0.9rem 0 0; max-width: 42rem; font-size: 1.05rem; line-height: 1.55; color: #B9B5AA; }
        .bd-bullets { margin: 1.1rem 0 0; padding: 0; list-style: none; display: grid; gap: 0.6rem; max-width: 42rem; }
        .bd-bullets li { position: relative; padding-left: 1.4rem; font-size: 1.05rem; line-height: 1.55; color: #D4CFC3; }
        .bd-bullets li::before { content: ""; position: absolute; left: 0; top: 0.78em; width: 0.7rem; height: 1px; background: #C4A971; }
        .bd-foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding-top: 1.5rem; border-top: 1px solid #262D37; }
        @media (max-width: 52rem) {
          .bd-wrap { grid-template-columns: minmax(0, 1fr); }
          .bd-id { position: static; }
        }
        @media (max-width: 36rem) {
          .bd-row { grid-template-columns: minmax(0, 1fr); gap: 0.6rem; }
        }
        @media print {
          .bd-root { background: #fff !important; color: #111 !important; }
          .bd-id { position: static; }
          .bd-no-print { display: none !important; }
        }
      `}</style>
      <main id="main-content" className="bd-root min-h-screen w-full overflow-x-hidden">
        <div className="bd-wrap">
          <aside className="bd-id">
            <Mark name={full_name} avatarUrl={profile.avatar_url} />
            <div>
              <h1 className="bd-name">{full_name}</h1>
              {headline && <p className="bd-role">{headline}</p>}
              {contact.location && <p className="bd-loc">{contact.location}</p>}
            </div>
            {links.length > 0 && (
              <div>
                <Label>Contact</Label>
                <ul aria-label="Contact" className="bd-contact">
                  {links.map((link) => (
                    <li key={link.type}>
                      <span>{link.type}</span>
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
              </div>
            )}
            {skillGroups.length > 0 && (
              <div>
                <Label>Skills</Label>
                <div className="bd-skills">
                  {skillGroups.map((group) => (
                    <div key={group.category}>
                      <h3>{group.category}</h3>
                      <p>{group.items.filter(Boolean).join(", ")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div className="bd-main">
            {summary && <p className="bd-lede">{summary}</p>}
            {experience.length > 0 && <ExperienceSection experience={experience} />}
            {projects && projects.length > 0 && <ProjectsSection projects={projects} />}
            {education && education.length > 0 && <EducationSection education={education} />}
            {certifications && certifications.length > 0 && (
              <CertificationsSection certifications={certifications} />
            )}
            <footer className="bd-foot bd-no-print">
              <ShareBar
                handle={profile.handle}
                title={`${full_name}'s Portfolio`}
                name={full_name}
                variant="boardroom"
              />
            </footer>
          </div>
        </div>
      </main>
    </>
  );
};
