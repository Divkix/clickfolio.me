import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import type { ContactLinkDescriptor } from "@/lib/templates/contact-links";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A sales resume built around confidence: big condensed numerals, a hero stat row pulled
// straight from the data (never fabricated), and highlights read as bold call-outs.

const ACCENT = "#E8491D";

function ContactLinkLabel({ link }: { link: ContactLinkDescriptor }): React.ReactElement {
  if (link.type === "location") return <>{link.label}</>;

  if (link.type === "phone") {
    return (
      <a href={link.href} className="hover:text-[#1F1C19]">
        {link.label}
      </a>
    );
  }

  return (
    <a
      href={link.href}
      target={link.isExternal ? "_blank" : undefined}
      rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
      className="hover:text-[#1F1C19]"
    >
      {link.label}
    </a>
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
  const totalHighlights = experience?.reduce((n, job) => n + (job.highlights?.length ?? 0), 0) ?? 0;

  const stats = [
    { value: experience?.length ?? 0, label: experience?.length === 1 ? "Role" : "Roles" },
    { value: totalHighlights, label: "Wins logged" },
    { value: skillGroups.flatMap((g) => g.items).length, label: "Core skills" },
  ].filter((stat) => stat.value > 0);

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" />
      <style>{`
        .qt-root, .qt-root :is(p, li, dt, dd, a, span, button) { font-family: 'Inter', system-ui, sans-serif; }
        .qt-root :is(h1, h2, h3), .qt-num { font-family: 'Barlow Condensed', system-ui, sans-serif; }
      `}</style>
      <div className="qt-root min-h-screen bg-[#FBFAF8] text-[#1F1C19] overflow-x-hidden">
        <main className="mx-auto max-w-[42rem] px-5 sm:px-8 pt-16 pb-24">
          <header className="flex items-start gap-5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                width={80}
                height={80}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
                style={{ backgroundColor: ACCENT }}
              >
                {getInitials(full_name)}
              </div>
            )}
            <div className="min-w-0 pt-1">
              <h1 className="qt-num text-[clamp(2.25rem,7vw,3.5rem)] font-bold leading-[0.95] break-words [text-wrap:balance] uppercase">
                {full_name}
              </h1>
              {headline && <p className="mt-1.5 text-lg text-[#5A5450] break-words">{headline}</p>}
            </div>
          </header>

          {stats.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-6 sm:gap-10 border-y-2 border-[#1F1C19] py-5">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p
                    className="qt-num text-4xl font-bold tabular-nums leading-none"
                    style={{ color: ACCENT }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-xs uppercase tracking-[0.08em] text-[#5A5450] mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          {summary && <p className="mt-6 text-[1.0625rem] leading-relaxed">{summary}</p>}

          {contactLinks.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[#5A5450]">
              {contactLinks.map((link) => (
                <li key={link.type} className="min-w-0 break-all">
                  <ContactLinkLabel link={link} />
                </li>
              ))}
            </ul>
          )}

          {experience && experience.length > 0 && (
            <section className="mt-12">
              <h2 className="qt-num text-2xl font-bold uppercase tracking-wide mb-6">Experience</h2>
              <div className="space-y-8">
                {experience.map((job) => (
                  <article
                    key={`${job.company}-${job.title}-${job.start_date}`}
                    className="border-l-4 pl-5"
                    style={{ borderColor: ACCENT }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-[1.125rem] font-bold break-words">{job.title}</h3>
                      <p className="text-sm text-[#5A5450] tabular-nums shrink-0">
                        {formatDateSpan(job.start_date, job.end_date)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: ACCENT }}>
                      {job.company}
                      {job.location && <span className="text-[#5A5450]"> · {job.location}</span>}
                    </p>
                    {job.description && (
                      <p className="mt-2 text-[0.9375rem] leading-relaxed">{job.description}</p>
                    )}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {job.highlights.map((highlight) => (
                          <li
                            key={`${job.title}-${highlight}`}
                            className="text-[0.9375rem] font-medium"
                          >
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section className="mt-12">
              <h2 className="qt-num text-2xl font-bold uppercase tracking-wide mb-6">Projects</h2>
              <div className="space-y-5">
                {projects.map((project) => (
                  <article key={`${project.title}-${project.year ?? ""}`}>
                    <h3 className="text-[1.0625rem] font-bold break-words">
                      {project.url ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="ugc nofollow noopener noreferrer"
                          className="hover:underline"
                          style={{ color: ACCENT }}
                        >
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                    </h3>
                    {project.description && (
                      <p className="mt-1 text-[0.9375rem] leading-relaxed">{project.description}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="mt-12 grid sm:grid-cols-2 gap-10">
            {education && education.length > 0 && (
              <section>
                <h2 className="qt-num text-2xl font-bold uppercase tracking-wide mb-5">
                  Education
                </h2>
                <div className="space-y-4">
                  {education.map((edu) => (
                    <div key={`${edu.institution}-${edu.degree}`}>
                      <p className="font-bold break-words">{edu.degree}</p>
                      <p className="text-sm text-[#5A5450]">
                        {edu.institution}
                        {edu.graduation_date && (
                          <span> · {formatShortDate(edu.graduation_date)}</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {skillGroups.length > 0 && (
              <section>
                <h2 className="qt-num text-2xl font-bold uppercase tracking-wide mb-5">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {skillGroups
                    .flatMap((g) => g.items)
                    .map((item) => (
                      <span
                        key={item}
                        className="rounded px-2.5 py-1 text-sm font-semibold"
                        style={{ backgroundColor: `${ACCENT}1A`, color: ACCENT }}
                      >
                        {item}
                      </span>
                    ))}
                </div>
              </section>
            )}
          </div>

          {certifications && certifications.length > 0 && (
            <section className="mt-12">
              <h2 className="qt-num text-2xl font-bold uppercase tracking-wide mb-5">
                Certifications
              </h2>
              <ul className="space-y-2">
                {certifications.map((cert) => (
                  <li key={`${cert.name}-${cert.issuer ?? ""}`} className="break-words">
                    <span className="font-semibold">{cert.name}</span>
                    {cert.issuer && <span className="text-[#5A5450]"> — {cert.issuer}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="mt-16 pt-6 border-t-2 border-[#1F1C19] flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[#5A5450]">@{profile.handle}</p>
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
