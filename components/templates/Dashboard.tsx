import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// An analytics dashboard read on a career: KPI tiles up top, skills as mini bar-chart rows,
// experience as metric-tagged panels. Bar lengths are derived from a stable index, not
// Math.random, so server and client markup match.

const PALETTE = ["#3B6CE0", "#1FA679", "#D98A2B", "#8457E0"];

function colorFor(i: number): string {
  return PALETTE[i % PALETTE.length] ?? PALETTE[0];
}

function KpiTile({ value, label }: { value: string | number; label: string }): React.ReactElement {
  return (
    <div className="rounded-xl border border-[#E2E6F0] bg-white px-4 py-3.5 min-w-0">
      <p className="text-2xl font-bold tabular-nums text-[#1A2240]">{value}</p>
      <p className="mt-0.5 text-[0.75rem] text-[#6B7390] break-words">{label}</p>
    </div>
  );
}

export const Dashboard: React.FC<TemplateProps> = ({ content, profile }) => {
  const {
    full_name,
    summary,
    headline,
    contact,
    experience,
    education,
    skills,
    certifications,
    projects,
  } = content;

  const contactLinks = getContactLinks(contact);
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];
  const allSkillItems = skillGroups.flatMap((g) => g.items);

  const kpis: Array<{ value: string | number; label: string }> = [];

  if (experience && experience.length > 0) {
    kpis.push({ value: experience.length, label: "Roles held" });
  }

  const years = (experience ?? [])
    .map((j) => Number(/^(\d{4})/.exec(j.start_date)?.[1]))
    .filter((y) => !Number.isNaN(y));

  if (years.length > 0) {
    kpis.push({
      value: `${new Date().getFullYear() - Math.min(...years)}+`,
      label: "Years experience",
    });
  }

  if (certifications && certifications.length > 0) {
    kpis.push({ value: certifications.length, label: "Certifications" });
  }

  if (allSkillItems.length > 0) {
    kpis.push({ value: allSkillItems.length, label: "Core skills" });
  }

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" />
      <style>{`
        .font-db-body, .font-db-body :is(h1, h2, h3, p, li, dt, dd, a, span) { font-family: 'Inter', ui-sans-serif, sans-serif; }
      `}</style>
      <div className="font-db-body min-h-screen bg-[#F3F5FA] text-[#1A2240] overflow-x-hidden">
        <main className="mx-auto max-w-[52rem] px-5 sm:px-8 pt-14 pb-24">
          <header className="flex flex-wrap items-center gap-5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                width={76}
                height={76}
                className="w-[4.75rem] h-[4.75rem] rounded-xl object-cover shrink-0"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-[4.75rem] h-[4.75rem] rounded-xl bg-[#3B6CE0]/10 text-[#3B6CE0] flex items-center justify-center text-xl font-bold shrink-0"
              >
                {getInitials(full_name)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[clamp(1.75rem,5vw,2.5rem)] font-bold leading-tight break-words">
                {full_name}
              </h1>
              {headline && <p className="mt-1 text-[#6B7390] break-words">{headline}</p>}
            </div>
          </header>

          {contactLinks.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {contactLinks.map((link) => (
                <li key={link.type} className="min-w-0 break-all">
                  {link.href ? (
                    <a
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                      className="font-semibold text-[#3B6CE0] hover:underline"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <span className="text-[#6B7390]">{link.label}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {kpis.length > 0 && (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpis.map((kpi) => (
                <KpiTile key={kpi.label} value={kpi.value} label={kpi.label} />
              ))}
            </div>
          )}

          {summary && (
            <p className="mt-8 rounded-xl border border-[#E2E6F0] bg-white px-5 py-4 text-[1rem] leading-[1.7]">
              {summary}
            </p>
          )}

          <div className="mt-10 grid lg:grid-cols-[1fr_16rem] gap-8">
            <div className="min-w-0">
              {experience && experience.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[#6B7390] mb-4">
                    Experience
                  </h2>
                  <div className="space-y-4">
                    {experience.map((job, i) => (
                      <article
                        key={`${job.company}-${job.title}-${job.start_date}`}
                        className="rounded-xl border border-[#E2E6F0] bg-white p-5 min-w-0"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className="font-bold break-words">{job.title}</h3>
                          <p className="text-sm text-[#6B7390] tabular-nums shrink-0">
                            {formatDateSpan(job.start_date, job.end_date)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold" style={{ color: colorFor(i) }}>
                          {job.company}
                          {job.location && (
                            <span className="text-[#6B7390] font-normal">, {job.location}</span>
                          )}
                        </p>
                        {job.description && (
                          <p className="mt-2 text-[0.9375rem]">{job.description}</p>
                        )}
                        {job.highlights && job.highlights.length > 0 && (
                          <ul className="mt-2.5 flex flex-wrap gap-1.5">
                            {job.highlights.map((highlight) => (
                              <li
                                key={`${job.title}-${highlight}`}
                                className="text-[0.75rem] font-semibold rounded-full px-2.5 py-1"
                                style={{ backgroundColor: `${colorFor(i)}14`, color: colorFor(i) }}
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
                <section className="mt-8">
                  <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[#6B7390] mb-4">
                    Projects
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {projects.map((project, i) => (
                      <div
                        key={`${project.title}-${project.year ?? ""}`}
                        className="rounded-xl border border-[#E2E6F0] bg-white p-4 min-w-0"
                      >
                        <h3 className="font-bold break-words">
                          {project.url ? (
                            <a
                              href={project.url}
                              target="_blank"
                              rel="ugc nofollow noopener noreferrer"
                              className="hover:underline"
                              style={{ color: colorFor(i) }}
                            >
                              {project.title}
                            </a>
                          ) : (
                            project.title
                          )}
                        </h3>
                        {project.description && (
                          <p className="mt-1 text-sm text-[#44475E]">{project.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="min-w-0 space-y-6">
              {allSkillItems.length > 0 && (
                <div className="rounded-xl border border-[#E2E6F0] bg-white p-4">
                  <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[#6B7390] mb-4">
                    Skills
                  </h2>
                  <div className="space-y-3">
                    {allSkillItems.slice(0, 8).map((item, i) => (
                      <div key={item} className="min-w-0">
                        <p className="text-[0.8125rem] font-medium mb-1 break-words">{item}</p>
                        <div className="h-1.5 rounded-full bg-[#EEF0F7] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${55 + ((i * 13) % 40)}%`,
                              backgroundColor: colorFor(i),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {education && education.length > 0 && (
                <div className="rounded-xl border border-[#E2E6F0] bg-white p-4">
                  <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[#6B7390] mb-3">
                    Education
                  </h2>
                  <div className="space-y-3">
                    {education.map((edu) => (
                      <div key={`${edu.institution}-${edu.degree}`} className="min-w-0">
                        <p className="text-[0.8125rem] font-bold break-words">{edu.degree}</p>
                        <p className="text-[0.75rem] text-[#6B7390]">
                          {edu.institution}
                          {edu.graduation_date && (
                            <span> · {formatShortDate(edu.graduation_date)}</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {certifications && certifications.length > 0 && (
                <div className="rounded-xl border border-[#E2E6F0] bg-white p-4">
                  <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[#6B7390] mb-3">
                    Certifications
                  </h2>
                  <ul className="space-y-2">
                    {certifications.map((cert) => (
                      <li key={`${cert.name}-${cert.issuer ?? ""}`} className="text-[0.8125rem]">
                        <p className="font-bold break-words">{cert.name}</p>
                        {cert.issuer && <p className="text-[#6B7390]">{cert.issuer}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>

          <footer className="mt-10 pt-6 border-t border-[#E2E6F0] flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[#6B7390]">@{profile.handle}</p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="dashboard"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
