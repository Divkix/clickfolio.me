import { BadgeCheck } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// Deliberately reads like a professional-network profile: a banner band, an avatar
// overlapping its bottom edge, stat pills, and skills as rounded "endorsement" chips.

const BANNER = "#0B5FA8";

const BANNER_STYLE: React.CSSProperties = {
  backgroundImage: `
    radial-gradient(circle at 15% 15%, rgba(255,255,255,0.16) 0, transparent 45%),
    radial-gradient(circle at 85% 85%, rgba(255,255,255,0.12) 0, transparent 50%),
    linear-gradient(135deg, ${BANNER}, #0A3F70)
  `,
};

export const Networked: React.FC<TemplateProps> = ({ content, profile }) => {
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

  const contactLinks = getContactLinks(contact).filter((link) => link.type !== "location");
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];
  const flatSkills = skillGroups.flatMap((g) => g.items);

  const stats = [
    { value: experience?.length ?? 0, label: experience?.length === 1 ? "Role" : "Roles" },
    { value: flatSkills.length, label: "Skills" },
    { value: education?.length ?? 0, label: education?.length === 1 ? "Degree" : "Degrees" },
  ].filter((stat) => stat.value > 0);

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" />
      <style>{`
        .nw-root, .nw-root :is(h1, h2, h3, p, li, dt, dd, a, span, button) { font-family: 'Figtree', system-ui, sans-serif; }
      `}</style>
      <div className="nw-root min-h-screen bg-white text-[#15202B] overflow-x-hidden">
        <div aria-hidden="true" className="h-28 sm:h-36" style={BANNER_STYLE} />
        <main className="mx-auto max-w-[42rem] px-5 sm:px-8 pb-24">
          <header className="relative -mt-12 sm:-mt-14 pb-6">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                width={104}
                height={104}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-white"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-2xl font-bold text-white ring-4 ring-white"
                style={{ backgroundColor: BANNER }}
              >
                {getInitials(full_name)}
              </div>
            )}

            <h1 className="mt-4 text-[clamp(1.875rem,5.5vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.015em] break-words [text-wrap:balance]">
              {full_name}
            </h1>
            {headline && <p className="mt-1 text-lg text-[#536471] break-words">{headline}</p>}
            {contact.location && <p className="mt-1 text-sm text-[#536471]">{contact.location}</p>}

            {stats.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {stats.map((stat) => (
                  <span
                    key={stat.label}
                    className="inline-flex items-baseline gap-1.5 rounded-full px-3.5 py-1.5 text-sm"
                    style={{ backgroundColor: `${BANNER}0F` }}
                  >
                    <span className="font-bold tabular-nums" style={{ color: BANNER }}>
                      {stat.value}
                    </span>
                    <span className="text-[#536471]">{stat.label}</span>
                  </span>
                ))}
              </div>
            )}

            {contactLinks.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {contactLinks.map((link) => (
                  <li key={link.type} className="min-w-0 break-all">
                    {link.type === "phone" ? (
                      <a href={link.href} className="hover:underline" style={{ color: BANNER }}>
                        {link.label}
                      </a>
                    ) : (
                      <a
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                        className="hover:underline"
                        style={{ color: BANNER }}
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </header>

          {summary && (
            <section className="pt-6 border-t border-[#E1E8ED]">
              <h2 className="text-base font-bold mb-2">About</h2>
              <p className="text-[0.9375rem] leading-relaxed">{summary}</p>
            </section>
          )}

          {flatSkills.length > 0 && (
            <section className="mt-8 pt-6 border-t border-[#E1E8ED]">
              <h2 className="text-base font-bold mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {flatSkills.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E1E8ED] bg-[#F7F9FA] px-3 py-1.5 text-sm font-medium"
                  >
                    <BadgeCheck className="size-3.5" style={{ color: BANNER }} aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
            </section>
          )}

          {experience && experience.length > 0 && (
            <section className="mt-8 pt-6 border-t border-[#E1E8ED]">
              <h2 className="text-base font-bold mb-5">Experience</h2>
              <div className="space-y-6">
                {experience.map((job) => (
                  <article key={`${job.company}-${job.title}-${job.start_date}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-[1.0625rem] font-bold break-words">{job.title}</h3>
                      <p className="text-sm text-[#536471] tabular-nums shrink-0">
                        {formatDateSpan(job.start_date, job.end_date)}
                      </p>
                    </div>
                    <p className="text-sm font-medium" style={{ color: BANNER }}>
                      {job.company}
                      {job.location && <span className="text-[#536471]"> · {job.location}</span>}
                    </p>
                    {job.description && (
                      <p className="mt-2 text-[0.9375rem] leading-relaxed">{job.description}</p>
                    )}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-2 space-y-1 list-disc pl-5 marker:text-[#0B5FA8]/40">
                        {job.highlights.map((highlight) => (
                          <li key={`${job.title}-${highlight}`} className="text-[0.9375rem]">
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
            <section className="mt-8 pt-6 border-t border-[#E1E8ED]">
              <h2 className="text-base font-bold mb-5">Projects</h2>
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
                          style={{ color: BANNER }}
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
                    {project.technologies && project.technologies.length > 0 && (
                      <p className="mt-1 text-sm text-[#536471]">
                        {project.technologies.join(", ")}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {education && education.length > 0 && (
            <section className="mt-8 pt-6 border-t border-[#E1E8ED]">
              <h2 className="text-base font-bold mb-5">Education</h2>
              <div className="space-y-4">
                {education.map((edu) => (
                  <article key={`${edu.institution}-${edu.degree}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-[1.0625rem] font-bold break-words">{edu.degree}</h3>
                      {edu.graduation_date && (
                        <p className="text-sm text-[#536471] tabular-nums shrink-0">
                          {formatShortDate(edu.graduation_date)}
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-[#536471]">
                      {edu.institution}
                      {edu.location && <span> · {edu.location}</span>}
                    </p>
                    {edu.gpa && <p className="text-sm mt-0.5">GPA {edu.gpa}</p>}
                  </article>
                ))}
              </div>
            </section>
          )}

          {certifications && certifications.length > 0 && (
            <section className="mt-8 pt-6 border-t border-[#E1E8ED]">
              <h2 className="text-base font-bold mb-5">Certifications</h2>
              <ul className="space-y-3">
                {certifications.map((cert) => (
                  <li key={`${cert.name}-${cert.issuer ?? ""}`}>
                    <p className="font-medium break-words">{cert.name}</p>
                    {cert.issuer && <p className="text-sm text-[#536471]">{cert.issuer}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="mt-10 pt-6 border-t border-[#E1E8ED] flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[#536471]">@{profile.handle}</p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="networked"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
