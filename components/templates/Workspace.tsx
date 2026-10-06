import { Briefcase } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A document page: cover band, icon, a properties table built from the contact fields, and
// collapsible toggle sections. Tags are coloured by a hash of their text, so the same word
// always gets the same colour and server and client markup match.

type Content = TemplateProps["content"];

const LINK_REL = "ugc nofollow noopener noreferrer";

const PROPERTY_LABELS = {
  email: "Email",
  phone: "Phone",
  location: "Location",
  linkedin: "LinkedIn",
  github: "GitHub",
  website: "Website",
  behance: "Behance",
  dribbble: "Dribbble",
} as const;

const TONES = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];

function tone(text: string): string {
  let sum = 0;

  for (const char of text) sum += char.codePointAt(0) ?? 0;

  return TONES[sum % TONES.length] ?? "gray";
}

function displayUrl(href: string): string {
  return href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function Tag({ children }: { children: string }) {
  return <span className={`ws-tag ws-${tone(children)}`}>{children}</span>;
}

function Toggle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="ws-toggle" open>
      <summary>
        <h2>{title}</h2>
      </summary>
      <div className="ws-toggle-body">{children}</div>
    </details>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel={LINK_REL} className="ws-link">
      {children}
    </a>
  );
}

function Entries({ experience }: { experience: Content["experience"] }) {
  return (
    <>
      {experience.map((job) => {
        const highlights = job.highlights?.filter(Boolean) ?? [];
        const when = formatDateSpan(job.start_date, job.end_date);

        return (
          <article key={`${job.company}-${job.title}-${job.start_date}`} className="ws-entry">
            <h3>{job.title}</h3>
            <p className="ws-meta">
              {job.company && <Tag>{job.company}</Tag>}
              {job.location && <span>{job.location}</span>}
              {when && <span>{when}</span>}
            </p>
            {job.description && <p className="ws-text">{job.description}</p>}
            {highlights.length > 0 && (
              <ul className="ws-bullets">
                {highlights.map((highlight) => (
                  <li key={`${job.title}-${highlight}`}>{highlight}</li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </>
  );
}

export const Workspace: React.FC<TemplateProps> = ({ content, profile }) => {
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
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
      <style>{`
        .ws-root { min-height: 100vh; background: #fff; color: #37352F; font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 1rem; line-height: 1.6; overflow-x: hidden; }
        .ws-root h1, .ws-root h2, .ws-root h3 { font-family: inherit; text-wrap: unset; overflow-wrap: anywhere; color: #37352F; }
        .ws-root ::selection { background: #D3E5EF; }
        .ws-cover { height: clamp(7rem, 20vw, 11.5rem); background: linear-gradient(120deg, #D3E5EF 0%, #E8DEEE 52%, #FADEC9 100%); }
        .ws-page { max-width: 46rem; margin: 0 auto; padding: 0 1.25rem 5rem; }
        .ws-icon { width: 5rem; height: 5rem; margin-top: -2.5rem; border-radius: 0.5rem; border: 4px solid #fff; background: #F1F1EF; object-fit: cover; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 600; color: #787774; }
        .ws-root h1.ws-title { margin: 0.9rem 0 0; font-size: clamp(2.1rem, 6vw, 2.9rem); line-height: 1.12; font-weight: 700; letter-spacing: -0.025em; }
        .ws-props { margin: 1.25rem 0 0; padding: 0 0 1rem; border-bottom: 1px solid #E9E9E7; display: grid; gap: 0.1rem; }
        .ws-prop { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; padding: 0.3rem 0; font-size: 0.93rem; }
        @media (min-width: 36rem) { .ws-prop { grid-template-columns: 9rem minmax(0, 1fr); gap: 0.5rem; } }
        .ws-prop-k { display: flex; align-items: center; gap: 0.5rem; color: #787774; }
        .ws-prop-k svg { width: 1rem; height: 1rem; flex: none; }
        .ws-prop-v { min-width: 0; overflow-wrap: anywhere; }
        .ws-link { color: inherit; text-decoration: underline; text-decoration-color: rgba(55, 53, 47, 0.3); text-underline-offset: 3px; }
        .ws-link:hover { text-decoration-color: #37352F; background: #F7F7F5; }
        .ws-link:focus-visible { outline: 2px solid #2383E2; outline-offset: 2px; border-radius: 2px; }
        .ws-callout { margin: 1.5rem 0 0; padding: 1rem 1.15rem; border-radius: 0.25rem; background: #F7F7F5; white-space: pre-line; }
        .ws-toggle { margin-top: 2.25rem; }
        .ws-toggle > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; border-radius: 0.25rem; margin-left: -1.6rem; padding-left: 0.2rem; }
        .ws-toggle > summary::-webkit-details-marker { display: none; }
        .ws-toggle > summary::before { content: ""; flex: none; width: 1.2rem; height: 1.2rem; background: no-repeat center / 0.55rem url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M2 1l6 4-6 4z' fill='%23787774'/%3E%3C/svg%3E"); transition: transform 120ms ease; }
        .ws-toggle[open] > summary::before { transform: rotate(90deg); }
        .ws-toggle > summary:hover { background: #F7F7F5; }
        .ws-toggle > summary:focus-visible { outline: 2px solid #2383E2; outline-offset: 2px; }
        @media (max-width: 40rem) { .ws-toggle > summary { margin-left: 0; } }
        .ws-root .ws-toggle > summary h2 { margin: 0; font-size: 1.5rem; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; }
        .ws-toggle-body { margin-top: 0.75rem; }
        .ws-entry { padding: 0.9rem 0; border-bottom: 1px solid #E9E9E7; }
        .ws-entry:last-child { border-bottom: 0; }
        .ws-root .ws-entry h3 { margin: 0; font-size: 1.1rem; line-height: 1.35; font-weight: 600; }
        .ws-meta { margin: 0.35rem 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.75rem; font-size: 0.88rem; color: #787774; }
        .ws-text { margin: 0.6rem 0 0; white-space: pre-line; }
        .ws-bullets { margin: 0.5rem 0 0; padding-left: 1.4rem; list-style: disc; }
        .ws-bullets li { margin: 0.2rem 0; padding-left: 0.2rem; }
        .ws-bullets li::marker { color: #9B9A97; }
        .ws-tag { display: inline-block; max-width: 100%; padding: 0.05rem 0.5rem; border-radius: 0.25rem; font-size: 0.85rem; line-height: 1.5; color: #37352F; overflow-wrap: anywhere; }
        .ws-gray { background: #E3E2E0; } .ws-brown { background: #EEE0DA; } .ws-orange { background: #FADEC9; }
        .ws-yellow { background: #FDECC8; } .ws-green { background: #DBEDDB; } .ws-blue { background: #D3E5EF; }
        .ws-purple { background: #E8DEEE; } .ws-pink { background: #F5E0E9; } .ws-red { background: #FFE2DD; }
        .ws-tags { margin: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .ws-gallery { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.9rem; }
        @media (min-width: 36rem) { .ws-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .ws-card { min-width: 0; padding: 1rem; border: 1px solid #E9E9E7; border-radius: 0.5rem; box-shadow: rgba(15, 15, 15, 0.04) 0 1px 2px; }
        .ws-card:hover { background: #FBFBFA; }
        .ws-root .ws-card h3 { margin: 0; font-size: 1rem; line-height: 1.35; font-weight: 600; }
        .ws-card .ws-text { font-size: 0.93rem; color: #5F5E5B; }
        .ws-card .ws-tags { margin-top: 0.75rem; }
        .ws-year { margin: 0.2rem 0 0; font-size: 0.85rem; color: #787774; }
        .ws-skill { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.35rem; padding: 0.55rem 0; }
        @media (min-width: 36rem) { .ws-skill { grid-template-columns: 9rem minmax(0, 1fr); gap: 0.5rem; } }
        .ws-skill dt { color: #787774; font-size: 0.93rem; }
        .ws-skill dd { margin: 0; }
        .ws-list { margin: 0; padding: 0; list-style: none; }
        .ws-list li { padding: 0.45rem 0; }
        .ws-list .ws-sub { color: #787774; font-size: 0.9rem; }
        .ws-foot { margin-top: 4rem; padding-top: 1rem; border-top: 1px solid #E9E9E7; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; font-size: 0.88rem; color: #787774; }
      `}</style>
      <div className="ws-root">
        <div className="ws-cover" aria-hidden="true" />
        <main className="ws-page">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" width={80} height={80} className="ws-icon" />
          ) : (
            <div className="ws-icon" aria-hidden="true">
              {getInitials(full_name)}
            </div>
          )}
          <h1 className="ws-title">{full_name}</h1>

          <dl className="ws-props" aria-label="Properties">
            {headline && (
              <div className="ws-prop">
                <dt className="ws-prop-k">
                  <Briefcase size={16} aria-hidden="true" />
                  Role
                </dt>
                <dd className="ws-prop-v">{headline}</dd>
              </div>
            )}
            {contactLinks.map((link) => (
              <div key={link.type} className="ws-prop">
                <dt className="ws-prop-k">
                  {getContactIcon(link.type, { size: 16, variant: "black", "aria-hidden": true })}
                  {PROPERTY_LABELS[link.type]}
                </dt>
                <dd className="ws-prop-v">
                  {link.href ? (
                    <a
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? LINK_REL : undefined}
                      className="ws-link"
                    >
                      {link.isExternal ? displayUrl(link.href) : link.label}
                    </a>
                  ) : (
                    link.label
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {summary && <aside className="ws-callout">{summary}</aside>}

          {experience.length > 0 && (
            <Toggle title="Experience">
              <Entries experience={experience} />
            </Toggle>
          )}

          {projects && projects.length > 0 && (
            <Toggle title="Projects">
              <div className="ws-gallery">
                {projects.map((project) => {
                  const keywords = project.technologies?.filter(Boolean) ?? [];

                  return (
                    <article
                      key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                      className="ws-card"
                    >
                      <h3>
                        {project.url ? (
                          <ExternalLink href={project.url}>{project.title}</ExternalLink>
                        ) : (
                          project.title
                        )}
                      </h3>
                      {project.year && <p className="ws-year">{formatYear(project.year)}</p>}
                      {project.description && <p className="ws-text">{project.description}</p>}
                      {keywords.length > 0 && (
                        <p className="ws-tags">
                          {keywords.map((keyword) => (
                            <Tag key={keyword}>{keyword}</Tag>
                          ))}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </Toggle>
          )}

          {skillGroups.length > 0 && (
            <Toggle title="Skills">
              <dl>
                {skillGroups.map((group) => (
                  <div key={group.category} className="ws-skill">
                    <dt>{group.category}</dt>
                    <dd className="ws-tags">
                      {group.items.map((item) => (
                        <Tag key={item}>{item}</Tag>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </Toggle>
          )}

          {education && education.length > 0 && (
            <Toggle title="Education">
              <ul className="ws-list">
                {education.map((edu) => (
                  <li key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}>
                    <strong>{edu.degree}</strong>
                    <div className="ws-sub">
                      {[
                        edu.institution,
                        edu.location,
                        edu.graduation_date ? formatShortDate(edu.graduation_date) : null,
                        edu.gpa ? `GPA ${edu.gpa}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>
            </Toggle>
          )}

          {certifications && certifications.length > 0 && (
            <Toggle title="Certifications">
              <ul className="ws-list">
                {certifications.map((cert) => (
                  <li key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}>
                    <strong>
                      {cert.url ? (
                        <ExternalLink href={cert.url}>{cert.name}</ExternalLink>
                      ) : (
                        cert.name
                      )}
                    </strong>
                    <div className="ws-sub">
                      {[cert.issuer, cert.date ? formatShortDate(cert.date) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>
            </Toggle>
          )}

          <footer className="ws-foot">
            <span>@{profile.handle}</span>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="workspace"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
