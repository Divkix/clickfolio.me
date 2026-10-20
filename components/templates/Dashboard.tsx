import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A real analytics-tool read on a career: dark canvas, monospace numerals, a dotted grid, and
// bar chart that is actually a chart. Bar lengths derive from a stable index, never
// Math.random, so server and client markup match.

const PALETTE = ["#4C8DFF", "#2DD4BF", "#F5A623", "#A78BFA"];

function colorFor(i: number): string {
  return PALETTE[i % PALETTE.length] ?? PALETTE[0];
}

function Sparkbars({ seed, color }: { seed: number; color: string }): React.ReactElement {
  const bars = Array.from({ length: 7 }, (_, i) => 22 + ((seed * 7 + i * 11) % 68));

  return (
    <div className="mt-2.5 flex items-end gap-[3px] h-5" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={`${seed}-${i}`}
          className="w-[3px] rounded-full"
          style={{
            height: `${h}%`,
            backgroundColor: color,
            opacity: 0.35 + (i / bars.length) * 0.65,
          }}
        />
      ))}
    </div>
  );
}

function KpiTile({
  value,
  label,
  index,
}: {
  value: string | number;
  label: string;
  index: number;
}): React.ReactElement {
  const color = colorFor(index);

  return (
    <div className="rounded-lg border border-[#1F2530] bg-[#10141C] px-4 py-3.5 min-w-0">
      <p className="font-db-mono text-[1.625rem] font-semibold tabular-nums text-[#E8EBF3] leading-none">
        {value}
      </p>
      <p className="mt-1.5 text-[0.75rem] text-[#7A8296] break-words">{label}</p>
      <Sparkbars seed={index + 1} color={color} />
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
  const maxSkillBar = Math.min(allSkillItems.length, 8);

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
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600;700&display=swap" />
      <style>{`
        .font-db-body, .font-db-body :is(p, li, dt, dd, a, span, button) { font-family: 'Inter', ui-sans-serif, sans-serif; }
        .font-db-body :is(h1, h2, h3), .font-db-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
      `}</style>
      <div
        className="font-db-body min-h-screen bg-[#0A0D12] text-[#E8EBF3] overflow-x-hidden"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <main className="mx-auto max-w-[52rem] px-5 sm:px-8 pt-14 pb-24">
          <header className="flex flex-wrap items-center gap-5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                width={76}
                height={76}
                className="w-[4.75rem] h-[4.75rem] rounded-lg object-cover shrink-0 ring-1 ring-[#1F2530]"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-[4.75rem] h-[4.75rem] rounded-lg bg-[#4C8DFF]/10 text-[#4C8DFF] flex items-center justify-center text-xl font-bold shrink-0 ring-1 ring-[#1F2530]"
              >
                {getInitials(full_name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-[0.12em] text-[#4C8DFF] font-db-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2DD4BF]" aria-hidden="true" />
                live profile
              </div>
              <h1 className="mt-1 text-[clamp(1.75rem,5vw,2.5rem)] font-bold leading-tight break-words text-white">
                {full_name}
              </h1>
              {headline && <p className="mt-1 text-[#9099AD] break-words">{headline}</p>}
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
                      className="font-semibold text-[#4C8DFF] hover:text-[#7AABFF]"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <span className="text-[#7A8296]">{link.label}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {kpis.length > 0 && (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpis.map((kpi, i) => (
                <KpiTile key={kpi.label} value={kpi.value} label={kpi.label} index={i} />
              ))}
            </div>
          )}

          {summary && (
            <p className="mt-6 rounded-lg border border-[#1F2530] bg-[#10141C] px-5 py-4 text-[1rem] leading-[1.7] text-[#CBD1E0]">
              {summary}
            </p>
          )}

          <div className="mt-10 grid lg:grid-cols-[1fr_17rem] gap-8">
            <div className="min-w-0">
              {experience && experience.length > 0 && (
                <section>
                  <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#7A8296] mb-4 flex items-center gap-2">
                    <span className="h-px flex-1 bg-[#1F2530]" aria-hidden="true" />
                    Experience
                  </h2>
                  <div className="space-y-3">
                    {experience.map((job, i) => (
                      <article
                        key={`${job.company}-${job.title}-${job.start_date}`}
                        className="rounded-lg border border-[#1F2530] bg-[#10141C] p-5 min-w-0 border-l-[3px]"
                        style={{ borderLeftColor: colorFor(i) }}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className="font-bold break-words text-white">{job.title}</h3>
                          <p className="font-db-mono text-[0.8125rem] text-[#7A8296] tabular-nums shrink-0">
                            {formatDateSpan(job.start_date, job.end_date)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold" style={{ color: colorFor(i) }}>
                          {job.company}
                          {job.location && (
                            <span className="text-[#7A8296] font-normal">, {job.location}</span>
                          )}
                        </p>
                        {job.description && (
                          <p className="mt-2 text-[0.9375rem] text-[#CBD1E0]">{job.description}</p>
                        )}
                        {job.highlights && job.highlights.length > 0 && (
                          <ul className="mt-3 space-y-1.5">
                            {job.highlights.map((highlight) => (
                              <li
                                key={`${job.title}-${highlight}`}
                                className="text-[0.8125rem] text-[#CBD1E0] flex items-start gap-2"
                              >
                                <span
                                  className="mt-1.5 h-1 w-1 rounded-full shrink-0"
                                  style={{ backgroundColor: colorFor(i) }}
                                  aria-hidden="true"
                                />
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
                  <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#7A8296] mb-4 flex items-center gap-2">
                    <span className="h-px flex-1 bg-[#1F2530]" aria-hidden="true" />
                    Projects
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {projects.map((project, i) => (
                      <div
                        key={`${project.title}-${project.year ?? ""}`}
                        className="rounded-lg border border-[#1F2530] bg-[#10141C] p-4 min-w-0"
                      >
                        <h3 className="font-bold break-words text-white">
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
                          <p className="mt-1 text-sm text-[#9099AD]">{project.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="min-w-0 space-y-4">
              {allSkillItems.length > 0 && (
                <div className="rounded-lg border border-[#1F2530] bg-[#10141C] p-4">
                  <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#7A8296] mb-4">
                    Skills
                  </h2>
                  <div className="space-y-2.5">
                    {allSkillItems.slice(0, 8).map((item, i) => (
                      <div key={item} className="min-w-0 flex items-center gap-2.5">
                        <div className="h-1.5 flex-1 rounded-full bg-[#1A1F2A] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${48 + ((i * 13) % 45)}%`,
                              backgroundColor: colorFor(i),
                            }}
                          />
                        </div>
                        <p className="text-[0.75rem] text-[#CBD1E0] shrink-0 text-right w-20 truncate">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[0.625rem] font-db-mono text-[#4A5062] tabular-nums">
                    {String(maxSkillBar).padStart(2, "0")} tracked
                  </p>
                </div>
              )}

              {education && education.length > 0 && (
                <div className="rounded-lg border border-[#1F2530] bg-[#10141C] p-4">
                  <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#7A8296] mb-3">
                    Education
                  </h2>
                  <div className="space-y-3">
                    {education.map((edu) => (
                      <div key={`${edu.institution}-${edu.degree}`} className="min-w-0">
                        <p className="text-[0.8125rem] font-bold break-words text-white">
                          {edu.degree}
                        </p>
                        <p className="text-[0.75rem] text-[#7A8296]">
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
                <div className="rounded-lg border border-[#1F2530] bg-[#10141C] p-4">
                  <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#7A8296] mb-3">
                    Certifications
                  </h2>
                  <ul className="space-y-2">
                    {certifications.map((cert) => (
                      <li key={`${cert.name}-${cert.issuer ?? ""}`} className="text-[0.8125rem]">
                        <p className="font-bold break-words text-white">{cert.name}</p>
                        {cert.issuer && <p className="text-[#7A8296]">{cert.issuer}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>

          <footer className="mt-10 pt-6 border-t border-[#1F2530] flex flex-wrap items-center justify-between gap-4">
            <p className="font-db-mono text-sm text-[#7A8296]">@{profile.handle}</p>
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
