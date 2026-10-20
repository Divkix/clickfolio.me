import { Award, Briefcase, GraduationCap, Sparkles } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// Icon-led and chip-driven rather than paragraph-first. Every number shown (role count, skill
// breadth rings) is counted straight from the resume's own arrays — nothing here is a fabricated
// "90% proficient" style score, since no template can actually know that.

const CORAL = "#E8604C";

const TEAL = "#1D7A74";

const AMBER = "#D99A2B";

const INK = "#1D2026";

const MUTED = "#686F7A";

function StatChip({ value, label, color }: { value: number; label: string; color: string }) {
  if (value === 0) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[#E7E4DC] bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(20,20,20,0.04)]">
      <span className="font-head-ig text-2xl font-extrabold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[13px] font-medium leading-tight text-[#454B55]">{label}</span>
    </div>
  );
}

const RING_COLORS = [CORAL, TEAL, AMBER];

function SkillRing({
  category,
  count,
  max,
  colorIndex,
}: {
  category: string;
  count: number;
  max: number;
  colorIndex: number;
}) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const fraction = max > 0 ? count / max : 0;
  const color = RING_COLORS[colorIndex % RING_COLORS.length] ?? CORAL;

  return (
    <div className="flex items-center gap-3">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="shrink-0">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#ECEAE3" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${circumference * Math.max(fraction, 0.08)} ${circumference}`}
          transform="rotate(-90 28 28)"
        />
        <text
          x="28"
          y="32"
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill={INK}
          className="font-head-ig"
        >
          {count}
        </text>
      </svg>
      <span className="text-sm font-semibold leading-tight text-[#2A2E35]">{category}</span>
    </div>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="font-head-ig mb-6 flex items-center gap-2.5 text-[1.375rem] font-extrabold tracking-[-0.01em]" style={{ color: INK }}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${TEAL}1A`, color: TEAL }}>
        {icon}
      </span>
      {children}
    </h2>
  );
}

export const Infographic: React.FC<TemplateProps> = ({ content, profile }) => {
  const experience = content.experience ?? [];
  const education = content.education ?? [];
  const certifications = content.certifications ?? [];
  const projects = content.projects ?? [];
  const skills = content.skills?.filter((group) => group.items.length > 0) ?? [];
  const maxSkillCount = Math.max(1, ...skills.map((group) => group.items.length));
  const contactLinks = getContactLinks(content.contact);

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Lexend:wght@500;700;800&display=swap" />
      <style>{`.font-head-ig { font-family: 'Lexend', ui-sans-serif, system-ui, sans-serif; }`}</style>

      <main className="min-h-screen bg-[#FAF9F5] text-[15.5px] leading-relaxed text-[#2A2E35] antialiased">
        <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
          <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`Portrait of ${content.full_name}`}
                width={88}
                height={88}
                className="h-20 w-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-24"
              />
            ) : (
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-2xl font-extrabold text-white sm:h-24 sm:w-24"
                style={{ backgroundColor: CORAL }}
                aria-hidden="true"
              >
                {getInitials(content.full_name)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-head-ig text-[clamp(2rem,5.5vw,2.75rem)] font-extrabold leading-tight tracking-[-0.01em] break-words [text-wrap:unset]" style={{ color: INK }}>
                {content.full_name}
              </h1>
              {content.headline && (
                <p className="mt-1.5 text-lg leading-snug" style={{ color: MUTED }}>
                  {content.headline}
                </p>
              )}
            </div>
          </header>

          {(experience.length > 0 || skills.length > 0 || projects.length > 0 || certifications.length > 0) && (
            <div className="mt-8 flex flex-wrap gap-3">
              <StatChip value={experience.length} label={experience.length === 1 ? "role" : "roles"} color={CORAL} />
              <StatChip value={skills.length} label={skills.length === 1 ? "skill area" : "skill areas"} color={TEAL} />
              <StatChip value={projects.length} label={projects.length === 1 ? "project" : "projects"} color={AMBER} />
              <StatChip
                value={certifications.length}
                label={certifications.length === 1 ? "certification" : "certifications"}
                color={CORAL}
              />
            </div>
          )}

          {content.summary && (
            <p className="mt-8 max-w-[62ch] text-[1.0625rem] leading-[1.65]">{content.summary}</p>
          )}

          {contactLinks.length > 0 && (
            <ul aria-label="Contact" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {contactLinks.map((link) => (
                <li key={link.type} className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0" style={{ color: TEAL }}>
                    {getContactIcon(link.type, { className: "h-4 w-4", "aria-hidden": true })}
                  </span>
                  {link.href ? (
                    <a
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                      className="truncate underline decoration-[#1D7A74]/30 underline-offset-2 hover:decoration-[#1D7A74] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D7A74] rounded-sm"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <span className="truncate">{link.label}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {skills.length > 0 && (
            <section aria-labelledby="ig-skills" className="mt-14">
              <h2 id="ig-skills" className="sr-only">
                Skills
              </h2>
              <div className="flex flex-wrap gap-x-8 gap-y-6 rounded-2xl border border-[#E7E4DC] bg-white p-6">
                {skills.map((group, i) => (
                  <SkillRing
                    key={group.category}
                    category={group.category}
                    count={group.items.length}
                    max={maxSkillCount}
                    colorIndex={i}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {skills.map((group) =>
                  group.items.map((item) => (
                    <span
                      key={`${group.category}-${item}`}
                      className="rounded-full bg-[#1D7A74]/8 px-3 py-1 text-[13px] font-medium text-[#1D7A74]"
                    >
                      {item}
                    </span>
                  )),
                )}
              </div>
            </section>
          )}

          {experience.length > 0 && (
            <section aria-labelledby="ig-experience" className="mt-14">
              <SectionLabel icon={<Briefcase className="h-4 w-4" aria-hidden="true" />}>Experience</SectionLabel>
              <ol className="space-y-7">
                {experience.map((job) => (
                  <li
                    key={`${job.title}-${job.company}-${job.start_date}`}
                    className="min-w-0 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-lg font-bold leading-snug break-words">{job.title}</h3>
                      <p className="shrink-0 text-sm font-medium tabular-nums" style={{ color: CORAL }}>
                        {formatDateSpan(job.start_date, job.end_date)}
                      </p>
                    </div>
                    <p className="text-sm" style={{ color: MUTED }}>
                      {job.company}
                      {job.location && <span>, {job.location}</span>}
                    </p>
                    {job.description && <p className="mt-3 leading-relaxed">{job.description}</p>}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {job.highlights.map((highlight, i) => (
                          <li key={`${job.title}-${i}`} className="relative pl-5 leading-relaxed">
                            <span
                              className="absolute left-0 top-[0.65em] h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: TEAL }}
                              aria-hidden="true"
                            />
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {projects.length > 0 && (
            <section aria-labelledby="ig-projects" className="mt-14">
              <SectionLabel icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}>Projects</SectionLabel>
              <div className="grid gap-5 sm:grid-cols-2">
                {projects.map((project) => (
                  <article
                    key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
                    className="min-w-0 rounded-2xl border border-[#E7E4DC] bg-white p-5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-bold leading-snug break-words">
                        {project.url ? (
                          <a
                            href={project.url}
                            target="_blank"
                            rel="ugc nofollow noopener noreferrer"
                            className="underline decoration-[#D99A2B]/40 underline-offset-2 hover:decoration-[#D99A2B] rounded-sm"
                          >
                            {project.title}
                          </a>
                        ) : (
                          project.title
                        )}
                      </h3>
                      {project.year && (
                        <span className="shrink-0 text-xs tabular-nums" style={{ color: MUTED }}>
                          {project.year}
                        </span>
                      )}
                    </div>
                    {project.description && <p className="mt-1.5 text-sm leading-relaxed">{project.description}</p>}
                    {project.technologies && project.technologies.length > 0 && (
                      <p className="mt-2.5 text-xs" style={{ color: AMBER }}>
                        {project.technologies.join(" · ")}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {education.length > 0 && (
            <section aria-labelledby="ig-education" className="mt-14">
              <SectionLabel icon={<GraduationCap className="h-4 w-4" aria-hidden="true" />}>Education</SectionLabel>
              <ul className="space-y-4">
                {education.map((edu) => (
                  <li
                    key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-xl border border-[#E7E4DC] bg-white px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <h3 className="font-bold leading-snug break-words">{edu.degree}</h3>
                      <p className="text-sm" style={{ color: MUTED }}>
                        {edu.institution}
                        {edu.gpa && ` · GPA ${edu.gpa}`}
                      </p>
                    </div>
                    {edu.graduation_date && (
                      <p className="shrink-0 text-sm tabular-nums" style={{ color: MUTED }}>
                        {formatYear(edu.graduation_date)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {certifications.length > 0 && (
            <section aria-labelledby="ig-certifications" className="mt-14">
              <SectionLabel icon={<Award className="h-4 w-4" aria-hidden="true" />}>Certifications</SectionLabel>
              <div className="flex flex-wrap gap-3">
                {certifications.map((cert) => (
                  <div
                    key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}
                    className="rounded-xl border border-[#E7E4DC] bg-white px-4 py-3"
                  >
                    <p className="font-bold leading-snug">
                      {cert.url ? (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="ugc nofollow noopener noreferrer"
                          className="underline decoration-[#1D7A74]/40 underline-offset-2 hover:decoration-[#1D7A74] rounded-sm"
                        >
                          {cert.name}
                        </a>
                      ) : (
                        cert.name
                      )}
                    </p>
                    {(cert.issuer || cert.date) && (
                      <p className="text-xs" style={{ color: MUTED }}>
                        {[cert.issuer, cert.date ? formatYear(cert.date) : null].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-16 border-t border-[#E7E4DC] pt-8">
            <ShareBar
              handle={profile.handle}
              title={`${content.full_name}'s Portfolio`}
              name={content.full_name}
              variant="infographic"
            />
          </div>
        </div>
      </main>
    </>
  );
};
