import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import type { ContactLinkDescriptor } from "@/lib/templates/contact-links";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A sales-floor closing board. Real figures written in the resume's highlights ("128% of
// quota", "$2.1M pipeline", "3x") are lifted onto the board; nothing is counted or invented.
// When the resume has no such figures the board simply doesn't render.

const ACCENT = "#E8491D";

// Darker accent for small text on paper (AA); ACCENT itself only for large numerals and on ink.
const ACCENT_TEXT = "#B8360E";
const INK = "#1F1C19";
const MUTED = "#5A5450";

const FIGURE_SOURCE = String.raw`(?:[$€£]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:[KMB]|bn|mm|million|billion)\b)?\+?|\d[\d,]*(?:\.\d+)?\s?%\+?|\d+(?:\.\d+)?x\b)`;
const BOARD_LIMIT = 5;

interface BoardEntry {
  figure: string;
  claim: string;
  source: string;
}

function findFigure(text: string): string | null {
  const match = new RegExp(FIGURE_SOURCE, "i").exec(text);

  return match ? match[0].replace(/\s+/g, "") : null;
}

/** Splits a highlight so its real figures can be set in the accent weight. */
function FigureText({ text }: { text: string }): React.ReactElement {
  const parts = text.split(new RegExp(`(${FIGURE_SOURCE})`, "i"));

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong
            key={`${i}-${part}`}
            className="qt-num font-bold text-[1.125em] tabular-nums"
            style={{ color: ACCENT_TEXT }}
          >
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

function ContactLinkLabel({ link }: { link: ContactLinkDescriptor }): React.ReactElement {
  if (link.type === "location") return <>{link.label}</>;

  return (
    <a
      href={link.href}
      target={link.isExternal ? "_blank" : undefined}
      rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
      className="underline decoration-[#1F1C19]/25 underline-offset-4 hover:decoration-[#E8491D]"
    >
      {link.label}
    </a>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <h2 className="qt-num text-[1.75rem] font-bold uppercase leading-none tracking-wide border-b-[3px] border-[#1F1C19] pb-2 mb-6">
      {children}
    </h2>
  );
}

export const Quota: React.FC<TemplateProps> = ({ content, profile }) => {
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

  const board: BoardEntry[] = [];

  for (const job of experience ?? []) {
    for (const highlight of job.highlights ?? []) {
      const figure = findFigure(highlight);

      if (figure && board.length < BOARD_LIMIT) {
        board.push({ figure, claim: highlight, source: job.company });
      }
    }
  }

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" />
      <style>{`
        .qt-root, .qt-root :is(p, li, dt, dd, a, span, button) { font-family: 'Inter', system-ui, sans-serif; }
        .qt-root :is(h1, h2, h3), .qt-root .qt-num { font-family: 'Barlow Condensed', system-ui, sans-serif; }
      `}</style>
      <div className="qt-root min-h-screen bg-[#FBFAF8] text-[#1F1C19] overflow-x-hidden">
        <div className="h-2" style={{ backgroundColor: ACCENT }} aria-hidden="true" />

        <main className="mx-auto max-w-[46rem] px-5 sm:px-8 pt-12 sm:pt-16 pb-24">
          <header>
            {profile.avatar_url && (
              <img
                src={profile.avatar_url}
                alt=""
                width={72}
                height={72}
                className="mb-5 w-[4.5rem] h-[4.5rem] object-cover grayscale contrast-125"
              />
            )}
            <h1 className="text-[clamp(2.75rem,11vw,5.5rem)] font-bold leading-[0.88] uppercase break-words [text-wrap:balance]">
              {full_name}
            </h1>
            {headline && (
              <p className="mt-3 text-lg sm:text-xl font-medium break-words">{headline}</p>
            )}
            {contactLinks.length > 0 && (
              <ul
                className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm"
                style={{ color: MUTED }}
              >
                {contactLinks.map((link) => (
                  <li key={link.type} className="min-w-0 break-all">
                    <ContactLinkLabel link={link} />
                  </li>
                ))}
              </ul>
            )}
          </header>

          {board.length > 0 && (
            <section
              aria-labelledby="qt-board"
              className="mt-10 text-[#F4EFEA] px-5 sm:px-7 pt-5 pb-2"
              style={{ backgroundColor: INK }}
            >
              <h2
                id="qt-board"
                className="text-[1.75rem] font-bold uppercase leading-none tracking-wide border-b border-white/20 pb-3"
                style={{ color: ACCENT }}
              >
                Closed-won board
              </h2>
              <ol>
                {board.map((entry) => (
                  <li
                    key={`${entry.source}-${entry.claim}`}
                    className="grid grid-cols-1 sm:grid-cols-[9.5rem_minmax(0,1fr)] gap-x-6 gap-y-1 py-4 border-b border-white/10 last:border-b-0"
                  >
                    <p
                      className="qt-num text-[3.25rem] font-bold leading-[0.9] tabular-nums break-all"
                      style={{ color: ACCENT }}
                    >
                      {entry.figure}
                    </p>
                    <div className="min-w-0 self-center">
                      <p className="text-[0.9375rem] leading-snug break-words">{entry.claim}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#B9B0A8] break-words">
                        {entry.source}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {summary && (
            <p className="mt-10 text-[1.0625rem] leading-relaxed break-words max-w-[38rem]">
              {summary}
            </p>
          )}

          {experience && experience.length > 0 && (
            <section className="mt-14">
              <SectionHeading>Track record</SectionHeading>
              <div>
                {experience.map((job) => {
                  const span = formatDateSpan(job.start_date, job.end_date);

                  return (
                    <article
                      key={`${job.company}-${job.title}-${job.start_date}`}
                      className="grid grid-cols-1 sm:grid-cols-[9.5rem_minmax(0,1fr)] gap-x-6 gap-y-1 py-6 border-b border-[#1F1C19]/15 first:pt-0 last:border-b-0"
                    >
                      <p
                        className="qt-num text-lg font-semibold uppercase tracking-wide tabular-nums leading-tight"
                        style={{ color: MUTED }}
                      >
                        {span}
                      </p>
                      <div className="min-w-0">
                        <h3 className="text-[1.5rem] font-bold leading-tight uppercase break-words">
                          {job.title}
                        </h3>
                        <p
                          className="text-sm font-semibold break-words"
                          style={{ color: ACCENT_TEXT }}
                        >
                          {job.company}
                          {job.location && (
                            <span className="font-normal" style={{ color: MUTED }}>
                              , {job.location}
                            </span>
                          )}
                        </p>
                        {job.description && (
                          <p className="mt-2 text-[0.9375rem] leading-relaxed break-words">
                            {job.description}
                          </p>
                        )}
                        {job.highlights && job.highlights.length > 0 && (
                          <ul className="mt-3 space-y-2">
                            {job.highlights.map((highlight) => (
                              <li
                                key={`${job.title}-${highlight}`}
                                className="relative pl-5 text-[0.9375rem] leading-snug break-words"
                              >
                                <span
                                  aria-hidden="true"
                                  className="absolute left-0 top-[0.55em] h-[3px] w-2.5"
                                  style={{ backgroundColor: ACCENT }}
                                />
                                <FigureText text={highlight} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section className="mt-14">
              <SectionHeading>Deals and projects</SectionHeading>
              <div className="space-y-5">
                {projects.map((project) => (
                  <article key={`${project.title}-${project.year ?? ""}`}>
                    <h3 className="text-[1.375rem] font-bold uppercase leading-tight break-words">
                      {project.url ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="ugc nofollow noopener noreferrer"
                          className="underline decoration-[#E8491D] decoration-2 underline-offset-4"
                        >
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                      {project.year && (
                        <span className="ml-3 text-base font-semibold" style={{ color: MUTED }}>
                          {project.year}
                        </span>
                      )}
                    </h3>
                    {project.description && (
                      <p className="mt-1 text-[0.9375rem] leading-relaxed break-words">
                        <FigureText text={project.description} />
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {skillGroups.length > 0 && (
            <section className="mt-14">
              <SectionHeading>Playbook</SectionHeading>
              <dl className="space-y-3">
                {skillGroups.map((group) => (
                  <div
                    key={group.category}
                    className="grid grid-cols-1 sm:grid-cols-[9.5rem_minmax(0,1fr)] gap-x-6"
                  >
                    <dt
                      className="qt-num text-lg font-semibold uppercase tracking-wide break-words"
                      style={{ color: MUTED }}
                    >
                      {group.category}
                    </dt>
                    <dd className="text-[0.9375rem] leading-relaxed break-words">
                      {group.items.join(", ")}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {((education && education.length > 0) ||
            (certifications && certifications.length > 0)) && (
            <div className="mt-14 grid sm:grid-cols-2 gap-x-10 gap-y-14">
              {education && education.length > 0 && (
                <section>
                  <SectionHeading>Education</SectionHeading>
                  <div className="space-y-4">
                    {education.map((edu) => (
                      <div key={`${edu.institution}-${edu.degree}`}>
                        <p className="font-semibold break-words">{edu.degree}</p>
                        <p className="text-sm break-words" style={{ color: MUTED }}>
                          {edu.institution}
                          {edu.graduation_date && `, ${formatShortDate(edu.graduation_date)}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {certifications && certifications.length > 0 && (
                <section>
                  <SectionHeading>Certifications</SectionHeading>
                  <div className="space-y-4">
                    {certifications.map((cert) => (
                      <div key={`${cert.name}-${cert.issuer ?? ""}`}>
                        <p className="font-semibold break-words">{cert.name}</p>
                        {(cert.issuer || cert.date) && (
                          <p className="text-sm break-words" style={{ color: MUTED }}>
                            {[cert.issuer, cert.date ? formatShortDate(cert.date) : ""]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          <footer className="mt-16 pt-5 border-t-[3px] border-[#1F1C19] flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm" style={{ color: MUTED }}>
              @{profile.handle}
            </p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="quota"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
