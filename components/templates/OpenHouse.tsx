import { MapPin } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// Styled like an MLS listing flyer: a "Featured Listing" hero band, a stats row like a
// property's beds/baths line, and skills as amenity tags. Warm terracotta and cream.

const TERRACOTTA = "#B5562B";

export const OpenHouse: React.FC<TemplateProps> = ({ content, profile }) => {
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

  const heroStat = experience?.length
    ? { value: experience.length, label: experience.length === 1 ? "role" : "roles" }
    : null;

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap" />
      <style>{`
        .oh-root, .oh-root :is(p, li, dt, dd, a, span, button) { font-family: 'Libre Franklin', system-ui, sans-serif; }
        .oh-root :is(h1, h2, h3) { font-family: 'Fraunces', Georgia, serif; }
      `}</style>
      <div className="oh-root min-h-screen bg-[#FCF7EF] text-[#2A2117] overflow-x-hidden">
        <div style={{ backgroundColor: TERRACOTTA }} className="text-white px-5 sm:px-8 py-3">
          <p className="mx-auto max-w-[42rem] text-xs font-bold uppercase tracking-[0.18em]">
            Featured Listing
          </p>
        </div>

        <main className="mx-auto max-w-[42rem] px-5 sm:px-8 pt-10 pb-24">
          <header className="flex flex-col sm:flex-row sm:items-center gap-5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                width={96}
                height={96}
                className="w-24 h-24 rounded-xl object-cover shrink-0 ring-1 ring-[#2A2117]/10"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-24 h-24 rounded-xl flex items-center justify-center text-2xl font-bold text-white shrink-0"
                style={{ backgroundColor: TERRACOTTA }}
              >
                {getInitials(full_name)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[clamp(1.75rem,5vw,2.5rem)] font-semibold leading-tight break-words [text-wrap:balance]">
                {full_name}
              </h1>
              {headline && <p className="mt-1 text-lg text-[#6B5A47] break-words">{headline}</p>}
              {contact.location && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-[#6B5A47]">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {contact.location}
                </p>
              )}
            </div>
          </header>

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-y border-[#2A2117]/10 py-4 text-sm">
            {heroStat && (
              <span>
                <span className="font-bold tabular-nums" style={{ color: TERRACOTTA }}>
                  {heroStat.value}
                </span>{" "}
                {heroStat.label}
              </span>
            )}
            {education && education.length > 0 && (
              <span>
                <span className="font-bold tabular-nums" style={{ color: TERRACOTTA }}>
                  {education.length}
                </span>{" "}
                {education.length === 1 ? "credential" : "credentials"}
              </span>
            )}
            {certifications && certifications.length > 0 && (
              <span>
                <span className="font-bold tabular-nums" style={{ color: TERRACOTTA }}>
                  {certifications.length}
                </span>{" "}
                {certifications.length === 1 ? "certification" : "certifications"}
              </span>
            )}
          </div>

          {summary && <p className="mt-6 text-[1.0625rem] leading-relaxed">{summary}</p>}

          {contactLinks.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {contactLinks.map((link) => (
                <li key={link.type} className="min-w-0 break-all">
                  {link.type === "phone" ? (
                    <a href={link.href} className="hover:underline" style={{ color: TERRACOTTA }}>
                      {link.label}
                    </a>
                  ) : (
                    <a
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                      className="hover:underline"
                      style={{ color: TERRACOTTA }}
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}

          {skillGroups.length > 0 && (
            <section className="mt-10">
              <h2
                className="text-sm font-bold uppercase tracking-[0.1em] mb-3"
                style={{ color: TERRACOTTA }}
              >
                Amenities
              </h2>
              <div className="flex flex-wrap gap-2">
                {skillGroups
                  .flatMap((g) => g.items)
                  .map((item) => (
                    <span
                      key={item}
                      className="rounded-full border px-3 py-1 text-sm"
                      style={{ borderColor: `${TERRACOTTA}55`, color: TERRACOTTA }}
                    >
                      {item}
                    </span>
                  ))}
              </div>
            </section>
          )}

          {experience && experience.length > 0 && (
            <section className="mt-10">
              <h2
                className="text-sm font-bold uppercase tracking-[0.1em] mb-5"
                style={{ color: TERRACOTTA }}
              >
                Listings on Record
              </h2>
              <div className="space-y-6">
                {experience.map((job) => (
                  <article
                    key={`${job.company}-${job.title}-${job.start_date}`}
                    className="rounded-xl border border-[#2A2117]/10 bg-white p-5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-[1.0625rem] font-semibold break-words">{job.title}</h3>
                      <p className="text-sm text-[#6B5A47] tabular-nums shrink-0">
                        {formatDateSpan(job.start_date, job.end_date)}
                      </p>
                    </div>
                    <p className="text-sm font-medium" style={{ color: TERRACOTTA }}>
                      {job.company}
                      {job.location && <span className="text-[#6B5A47]"> · {job.location}</span>}
                    </p>
                    {job.description && (
                      <p className="mt-2 text-[0.9375rem] leading-relaxed">{job.description}</p>
                    )}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-2 space-y-1 list-disc pl-5" style={{ color: "inherit" }}>
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
            <section className="mt-10">
              <h2
                className="text-sm font-bold uppercase tracking-[0.1em] mb-5"
                style={{ color: TERRACOTTA }}
              >
                Highlighted Wins
              </h2>
              <div className="space-y-4">
                {projects.map((project) => (
                  <article key={`${project.title}-${project.year ?? ""}`}>
                    <h3 className="font-semibold break-words">
                      {project.url ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="ugc nofollow noopener noreferrer"
                          className="hover:underline"
                        >
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                    </h3>
                    {project.description && (
                      <p className="text-[0.9375rem]">{project.description}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {education && education.length > 0 && (
            <section className="mt-10">
              <h2
                className="text-sm font-bold uppercase tracking-[0.1em] mb-5"
                style={{ color: TERRACOTTA }}
              >
                Credentials
              </h2>
              <div className="space-y-3">
                {education.map((edu) => (
                  <div key={`${edu.institution}-${edu.degree}`}>
                    <p className="font-semibold break-words">{edu.degree}</p>
                    <p className="text-sm text-[#6B5A47]">
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

          <footer className="mt-14 pt-6 border-t border-[#2A2117]/10 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[#6B5A47]">@{profile.handle}</p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="open-house"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
