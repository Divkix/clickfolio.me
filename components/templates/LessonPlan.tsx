import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A teacher's planner: the resume is written on ruled paper clipped to a green desk, with index
// tabs on the page edge that jump to the sections that actually render. Every line box stays 32px
// tall, so wrapped text keeps landing on the rules (the mobile header scales by whole lines too).
// The avatar, contact buttons and section pills are sized in whole 32px lines for the same reason,
// and a contact label too long for its button clips with an ellipsis instead of wrapping mid-word.

const LINK_REL = "ugc nofollow noopener noreferrer";

const SECTION_TONES = ["t1", "t2", "t3", "t4"] as const;

type Tone = (typeof SECTION_TONES)[number];

interface Tab {
  id: string;
  label: string;
}

export const LessonPlan: React.FC<TemplateProps> = ({ content, profile }) => {
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

  // The current role is the entry with no end date, or an explicit "Present"; the sticky note
  // only shows when the resume actually says there is one.
  const currentJob = experience.find((job) => {
    const end = job.end_date?.trim();

    return !end || /^present$/i.test(end);
  });

  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];
  const certs = certifications ?? [];
  const schools = education ?? [];
  const work = projects ?? [];

  // Tabs are built from the sections that render, so no tab ever points at nothing.
  const tabs: Tab[] = [];

  if (summary.trim()) tabs.push({ id: "lp-about", label: "About" });

  if (experience.length > 0) tabs.push({ id: "lp-exp", label: "Experience" });

  if (work.length > 0) tabs.push({ id: "lp-projects", label: "Projects" });

  if (certs.length > 0) tabs.push({ id: "lp-certs", label: "Licenses" });

  if (schools.length > 0) tabs.push({ id: "lp-ed", label: "Education" });

  if (skillGroups.length > 0) tabs.push({ id: "lp-skills", label: "Skills" });

  // Tab order drives the colour cycle, so a heading pill always matches its own tab.
  const tones: Record<string, Tone> = {};
  tabs.forEach((tab, index) => {
    tones[tab.id] = SECTION_TONES[index % SECTION_TONES.length];
  });

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600;7..72,800&family=Caveat:wght@600&display=swap" />
      <style>{`
        .lp-root { min-height: 100vh; background: #3F6E5C; color: #24303A; padding: 48px clamp(20px, 7vw, 56px) 80px; overflow-x: hidden; }
        .lp-root ::selection { background: #FFE37A; }
        .lp-root h1, .lp-root h2, .lp-root h3, .lp-root h4 { font-family: 'Literata', Georgia, serif; letter-spacing: normal; text-wrap: unset; }
        .lp-root a { color: inherit; }
        .lp-root a:focus-visible { outline: 3px solid #E0675F; outline-offset: 3px; }
        .lp-book { max-width: 920px; margin: 0 auto; position: relative; }
        .lp-tabs { position: absolute; right: -46px; top: 120px; display: grid; gap: 6px; }
        .lp-tab { writing-mode: vertical-rl; text-decoration: none; font: 600 14px/1 'Literata', Georgia, serif; padding: 18px 12px; border-radius: 0 10px 10px 0; overflow-wrap: anywhere; }
        .lp-root .lp-tab-t1 { background: #F2B33D; color: #24303A; }
        .lp-root .lp-tab-t2 { background: #5BAA6A; color: #FFFFFF; }
        .lp-root .lp-tab-t3 { background: #4C9BD6; color: #FFFFFF; }
        .lp-root .lp-tab-t4 { background: #A77BC4; color: #FFFFFF; }
        .lp-page { position: relative; background-color: #FCFCF8; border-radius: 4px 14px 14px 4px; box-shadow: 0 30px 60px -30px rgba(0,0,0,.6), -8px 0 0 #2A4D40; background-image: linear-gradient(90deg, transparent 87px, #E0675F 87px 89px, transparent 89px), repeating-linear-gradient(transparent 0 31px, #B9D0E6 31px 32px); background-position: 0 0, 0 16px; padding: 48px 56px 64px 120px; font: 400 17px/32px 'Literata', Georgia, serif; overflow-wrap: anywhere; }
        .lp-page::before { content: ""; position: absolute; left: 30px; top: 0; bottom: 0; width: 22px; background: radial-gradient(circle, #3F6E5C 0 9px, transparent 10px) 0 60px / 22px 220px repeat-y; }
        .lp-page section { scroll-margin-top: 2rem; }
        .lp-page p, .lp-page li { max-width: 62ch; }
        .lp-sticky { position: absolute; right: 56px; top: 56px; width: 200px; padding: 16px 18px; transform: rotate(3deg); background: #FFE37A; font: 600 22px/26px 'Caveat', cursive; box-shadow: 0 10px 18px -10px rgba(0,0,0,.4); }
        .lp-head { padding-bottom: 32px; }
        .lp-hello { font: 600 28px/32px 'Caveat', cursive; color: #E0675F; }
        .lp-name-row { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 24px; }
        .lp-avatar { flex: none; width: 96px; height: 96px; object-fit: cover; border: 3px solid #24303A; border-radius: 4px; background: #FFFFFF; }
        .lp-root h1.lp-name { font-weight: 800; font-size: 56px; line-height: 64px; letter-spacing: -.02em; }
        .lp-sub { font-size: 20px; color: #5B6770; }
        .lp-cta { display: flex; flex-wrap: wrap; gap: 32px 12px; margin-top: 32px; }
        .lp-root .lp-btn { line-height: 32px; padding: 0 18px; border-radius: 8px; text-decoration: none; font-weight: 600; background: #24303A; color: #FCFCF8; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-root .lp-btn ~ .lp-btn { background: transparent; color: #24303A; box-shadow: inset 0 0 0 2px #24303A; }
        .lp-plain { padding: 0 2px; line-height: 32px; font-weight: 600; color: #5B6770; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-h2 { font-size: 15px; font-weight: 600; display: block; width: fit-content; padding: 0 12px; border-radius: 6px; line-height: 32px; margin-top: 32px; }
        .lp-entry { padding-top: 32px; }
        .lp-root .lp-entry h3 { font-size: 20px; line-height: 32px; font-weight: 600; }
        .lp-meta { color: #5B6770; }
        .lp-text { white-space: pre-line; }
        .lp-bullets { list-style: disc; padding-left: 20px; }
        .lp-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px; }
        .lp-root .lp-item h3 { font-size: 17px; line-height: 32px; font-weight: 600; }
        .lp-skills { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr)); gap: 0 32px; }
        .lp-root .lp-skill-group h3 { font-size: 17px; line-height: 32px; font-weight: 600; color: #3F6E5C; }
        .lp-foot { max-width: 920px; margin: 0 auto; padding-top: 40px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; color: rgba(252,252,248,.85); font-size: .95rem; overflow-wrap: anywhere; }
        @media (min-width: 761px) { .lp-head { padding-right: 216px; } }
        @media (max-width: 760px) {
          .lp-tabs, .lp-sticky { display: none; }
          .lp-page { padding: 32px 24px 48px 72px; background-image: linear-gradient(90deg, transparent 55px, #E0675F 55px 57px, transparent 57px), repeating-linear-gradient(transparent 0 31px, #B9D0E6 31px 32px); }
          .lp-page::before { left: 14px; }
          .lp-root h1.lp-name { font-size: 40px; line-height: 64px; }
          .lp-cta { flex-direction: column; align-items: stretch; gap: 32px; }
          .lp-plain { padding: 0 18px; }
          .lp-cols { grid-template-columns: 1fr; }
        }
      `}</style>
      <div className="lp-root">
        <div className="lp-book">
          {tabs.length > 0 && (
            <nav className="lp-tabs" aria-label="Sections">
              {tabs.map((tab) => (
                <a key={tab.id} href={`#${tab.id}`} className={`lp-tab lp-tab-${tones[tab.id]}`}>
                  {tab.label}
                </a>
              ))}
            </nav>
          )}

          <article className="lp-page">
            {currentJob && (
              <p className="lp-sticky">
                Currently: {currentJob.title} at {currentJob.company}
              </p>
            )}

            <header className="lp-head">
              <p className="lp-hello">Hello, I&apos;m</p>
              <div className="lp-name-row">
                {profile.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    width={96}
                    height={96}
                    className="lp-avatar"
                  />
                )}
                <div>
                  <h1 className="lp-name">{full_name}</h1>
                  {headline && <p className="lp-sub">{headline}</p>}
                </div>
              </div>
              {contactLinks.length > 0 && (
                <div className="lp-cta">
                  {contactLinks.map((link) =>
                    link.href ? (
                      <a
                        key={link.type}
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? LINK_REL : undefined}
                        className="lp-btn"
                        title={link.label}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span key={link.type} className="lp-plain" title={link.label}>
                        {link.label}
                      </span>
                    ),
                  )}
                </div>
              )}
            </header>

            {summary.trim().length > 0 && (
              <section id="lp-about">
                <h2 className={`lp-h2 lp-tab-${tones["lp-about"]}`}>About</h2>
                <p className="lp-text">{summary}</p>
              </section>
            )}

            {experience.length > 0 && (
              <section id="lp-exp">
                <h2 className={`lp-h2 lp-tab-${tones["lp-exp"]}`}>Experience</h2>
                {experience.map((job) => {
                  const highlights = job.highlights?.filter(Boolean) ?? [];
                  const span = formatDateSpan(job.start_date, job.end_date);
                  const org = [job.company, job.location].filter(Boolean).join(", ");

                  return (
                    <article
                      key={`${job.company}-${job.title}-${job.start_date}`}
                      className="lp-entry"
                    >
                      <h3>{job.title}</h3>
                      <p className="lp-meta">{[org, span].filter(Boolean).join(" · ")}</p>
                      {job.description && <p className="lp-text">{job.description}</p>}
                      {highlights.length > 0 && (
                        <ul className="lp-bullets">
                          {highlights.map((highlight) => (
                            <li key={`${job.title}-${highlight}`}>{highlight}</li>
                          ))}
                        </ul>
                      )}
                    </article>
                  );
                })}
              </section>
            )}

            {work.length > 0 && (
              <section id="lp-projects">
                <h2 className={`lp-h2 lp-tab-${tones["lp-projects"]}`}>Projects</h2>
                {work.map((project) => {
                  const tools = project.technologies?.filter(Boolean) ?? [];

                  const meta = [project.year ? formatYear(project.year) : null, tools.join(" · ")]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <article
                      key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                      className="lp-entry"
                    >
                      <h3>
                        {project.url ? (
                          <a href={project.url} target="_blank" rel={LINK_REL}>
                            {project.title}
                          </a>
                        ) : (
                          project.title
                        )}
                      </h3>
                      {meta && <p className="lp-meta">{meta}</p>}
                      {project.description && <p className="lp-text">{project.description}</p>}
                    </article>
                  );
                })}
              </section>
            )}

            {(certs.length > 0 || schools.length > 0) && (
              <div className="lp-cols">
                {certs.length > 0 && (
                  <section id="lp-certs">
                    <h2 className={`lp-h2 lp-tab-${tones["lp-certs"]}`}>Licenses</h2>
                    {certs.map((cert) => (
                      <div
                        key={`${cert.name}-${cert.issuer}-${cert.date ?? ""}`}
                        className="lp-item"
                      >
                        <h3>
                          {cert.url ? (
                            <a href={cert.url} target="_blank" rel={LINK_REL}>
                              {cert.name}
                            </a>
                          ) : (
                            cert.name
                          )}
                        </h3>
                        <p className="lp-meta">
                          {[cert.issuer, cert.date ? formatShortDate(cert.date) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </section>
                )}
                {schools.length > 0 && (
                  <section id="lp-ed">
                    <h2 className={`lp-h2 lp-tab-${tones["lp-ed"]}`}>Education</h2>
                    {schools.map((school) => (
                      <div key={`${school.institution}-${school.degree}`} className="lp-item">
                        <h3>{school.degree}</h3>
                        <p className="lp-meta">
                          {[
                            school.institution,
                            school.location,
                            school.graduation_date ? formatShortDate(school.graduation_date) : null,
                            school.gpa ? `GPA ${school.gpa}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </section>
                )}
              </div>
            )}

            {skillGroups.length > 0 && (
              <section id="lp-skills">
                <h2 className={`lp-h2 lp-tab-${tones["lp-skills"]}`}>Skills</h2>
                <div className="lp-skills">
                  {skillGroups.map((group) => (
                    <div key={group.category} className="lp-skill-group">
                      <h3>{group.category}</h3>
                      <p className="lp-meta">{group.items.join(" · ")}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </article>
        </div>

        <footer className="lp-foot">
          <span>@{profile.handle}</span>
          <ShareBar
            handle={profile.handle}
            title={`${full_name}'s Portfolio`}
            name={full_name}
            variant="lesson-plan"
          />
        </footer>
      </div>
    </>
  );
};
