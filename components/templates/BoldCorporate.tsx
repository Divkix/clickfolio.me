"use client";

import { MapPin } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

export const BoldCorporate: React.FC<TemplateProps> = ({ content, profile }) => {
  const nameParts = content.full_name.split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const flatSkills = content.skills ? flattenSkills(content.skills) : [];
  const contactLinks = getContactLinks(content.contact);
  const safeHeadline =
    content.headline && content.headline.trim() !== "" ? content.headline : "Professional";

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap" />

      <main className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-[#0055FF] selection:text-white overflow-x-hidden scroll-smooth">
        <style>{`
          .font-heading-bc { font-family: 'Plus Jakarta Sans', sans-serif; }
        `}</style>

        <div className="max-w-6xl mx-auto px-6 md:px-12 pt-16 pb-0">
          <header className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end mb-16 md:mb-24">
            <div className="md:col-span-8 min-w-0">
              <h1 className="font-heading-bc text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter leading-[0.9] break-words [text-wrap:unset]">
                {firstName}
                {lastName && (
                  <>
                    <br />
                    {lastName}
                  </>
                )}
              </h1>
              <p className="text-xl text-neutral-500 mt-6 max-w-md">{safeHeadline}</p>
            </div>
            <div className="md:col-span-4 flex justify-start md:justify-end">
              <div className="w-20 h-20 md:w-32 md:h-32 rounded-full bg-neutral-100 overflow-hidden flex items-center justify-center">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={`Portrait of ${content.full_name}`}
                    width={128}
                    height={128}
                    fetchPriority="high"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-black text-neutral-400">
                    {getInitials(content.full_name)}
                  </span>
                )}
              </div>
            </div>
          </header>

          <section className="mb-20 md:mb-28 bg-neutral-50 rounded-2xl p-8 md:p-12">
            {content.summary && (
              <p className="text-neutral-600 leading-relaxed mb-8 max-w-2xl text-lg">
                {content.summary}
              </p>
            )}
            <nav aria-label="Contact information" className="flex flex-wrap items-center gap-4">
              {contactLinks.map((link) => {
                const isLocation = link.type === "location";
                const isBehance = link.type === "behance";
                const isDribbble = link.type === "dribbble";

                if (isLocation) {
                  return (
                    <span
                      key={link.type}
                      className="inline-flex items-center gap-1.5 text-sm text-neutral-500"
                    >
                      <MapPin className="w-4 h-4" aria-hidden="true" />
                      {link.label}
                    </span>
                  );
                }

                return (
                  <a
                    key={link.type}
                    href={link.href}
                    target={link.isExternal ? "_blank" : undefined}
                    rel={link.isExternal ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-[#0055FF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF] rounded-sm"
                  >
                    {isBehance ? (
                      <span className="text-xs font-bold">Be</span>
                    ) : isDribbble ? (
                      <span className="text-xs font-bold">Dr</span>
                    ) : (
                      getContactIcon(link.type, { className: "w-4 h-4", "aria-hidden": true })
                    )}
                    {link.label}
                  </a>
                );
              })}
            </nav>
            <div className="mt-6">
              <ShareBar
                handle={profile.handle}
                title={`${content.full_name}'s Portfolio`}
                name={content.full_name}
                variant="bold-corporate"
              />
            </div>
          </section>

          {content.experience && content.experience.length > 0 && (
            <section className="mb-20 md:mb-28">
              <div className="flex items-center gap-4 mb-12">
                <h2 className="font-heading-bc text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                  Experience
                </h2>
                <div className="h-px bg-neutral-200 flex-1" />
              </div>
              <div className="space-y-14">
                {content.experience.map((job, idx) => {
                  const number = String(idx + 1).padStart(2, "0");
                  const limitedHighlights = job.highlights?.slice(0, 4) ?? [];
                  return (
                    <article
                      key={`${job.title}-${idx}`}
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6"
                    >
                      <div className="md:col-span-2">
                        <span className="font-heading-bc text-sm font-black tracking-widest text-[#0055FF]">
                          {number}
                        </span>
                      </div>
                      <div className="md:col-span-10 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-3">
                          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-neutral-500">
                              {getInitials(job.company)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-heading-bc text-2xl font-bold [text-wrap:unset] break-words">
                              {job.title}
                            </h3>
                            <p className="text-neutral-500 text-sm">
                              {job.company}
                              {job.location ? ` \u00B7 ${job.location}` : ""}
                            </p>
                          </div>
                          <span className="text-xs text-neutral-400 font-medium shrink-0 sm:mt-1">
                            {formatDateRange(job.start_date, job.end_date)}
                          </span>
                        </div>
                        {job.description && job.description.trim() !== "" && (
                          <p className="text-neutral-600 text-sm leading-relaxed mb-4 max-w-xl">
                            {job.description}
                          </p>
                        )}
                        {limitedHighlights.length > 0 && (
                          <ul className="space-y-2 text-sm text-neutral-600 list-disc pl-5 max-w-2xl">
                            {limitedHighlights.map((highlight, i) => (
                              <li key={`${job.title}-${highlight}-${i}`}>{highlight}</li>
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

          {content.education && content.education.length > 0 && (
            <section className="mb-20 md:mb-28">
              <div className="flex items-center gap-4 mb-12">
                <h2 className="font-heading-bc text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                  Education
                </h2>
                <div className="h-px bg-neutral-200 flex-1" />
              </div>
              <div className="space-y-10">
                {content.education.map((edu, idx) => {
                  const number = String(idx + 1).padStart(2, "0");
                  return (
                    <article
                      key={`${edu.institution}-${idx}`}
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6"
                    >
                      <div className="md:col-span-2">
                        <span className="font-heading-bc text-sm font-black tracking-widest text-[#0055FF]">
                          {number}
                        </span>
                      </div>
                      <div className="md:col-span-10 min-w-0">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-neutral-500">
                              {getInitials(edu.institution)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-heading-bc text-xl font-bold [text-wrap:unset] break-words">
                              {edu.degree}
                            </h3>
                            <p className="text-neutral-500 text-sm">{edu.institution}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {edu.graduation_date && (
                                <span className="text-xs text-neutral-400">
                                  {formatYear(edu.graduation_date)}
                                </span>
                              )}
                              {edu.gpa && (
                                <span className="text-xs text-neutral-400">GPA: {edu.gpa}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {content.certifications && content.certifications.length > 0 && (
            <section className="mb-20 md:mb-28">
              <div className="flex items-center gap-4 mb-12">
                <h2 className="font-heading-bc text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                  Awards
                </h2>
                <div className="h-px bg-neutral-200 flex-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {content.certifications.map((cert, idx) => (
                  <article key={`${cert.name}-${idx}`} className="flex items-start gap-4 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-neutral-900 mt-2 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-heading-bc font-bold text-lg [text-wrap:unset] break-words">
                        {cert.url ? (
                          <a
                            href={cert.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline hover:text-[#0055FF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]"
                          >
                            {cert.name}
                          </a>
                        ) : (
                          cert.name
                        )}
                      </h3>
                      <p className="text-sm text-neutral-500">
                        {cert.issuer}
                        {cert.date ? ` \u00B7 ${formatYear(cert.date)}` : ""}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {content.projects && content.projects.length > 0 && (
            <section className="mb-20 md:mb-28">
              <div className="flex items-center gap-4 mb-12">
                <h2 className="font-heading-bc text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                  Projects
                </h2>
                <div className="h-px bg-neutral-200 flex-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {content.projects.map((project, idx) => (
                  <article key={`${project.title}-${idx}`} className="min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-heading-bc text-xl font-bold [text-wrap:unset] break-words">
                        {project.url ? (
                          <a
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline hover:text-[#0055FF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]"
                          >
                            {project.title}
                          </a>
                        ) : (
                          project.title
                        )}
                      </h3>
                      {project.year && (
                        <span className="text-xs text-neutral-400 mt-1 shrink-0">
                          {project.year}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 mb-3">{project.description}</p>
                    {project.technologies && project.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {project.technologies.map((tech, i) => (
                          <span
                            key={`${project.title}-${tech}-${i}`}
                            className="border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-500"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {flatSkills.length > 0 && (
            <section className="mb-20 md:mb-28" aria-label="Skills">
              <div className="flex items-center gap-4 mb-8">
                <h2 className="font-heading-bc text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                  Skills
                </h2>
                <div className="h-px bg-neutral-200 flex-1" />
              </div>
              <div className="flex flex-wrap gap-2">
                {flatSkills.map((skill, i) => (
                  <span
                    key={`${skill}-${i}`}
                    className="inline-block border border-neutral-200 rounded-full px-4 py-2 text-sm font-medium text-neutral-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          <footer className="border-t border-neutral-200 pt-16 pb-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-16">
              <div>
                <h3 className="font-heading-bc text-xs font-black uppercase tracking-widest mb-4">
                  Contact
                </h3>
                <div className="space-y-2">
                  {content.contact.email && (
                    <a
                      href={`mailto:${content.contact.email}`}
                      className="block text-sm text-neutral-500 hover:text-[#0055FF] transition-colors break-all"
                    >
                      {content.contact.email}
                    </a>
                  )}
                  {content.contact.phone && (
                    <p className="text-sm text-neutral-500">{content.contact.phone}</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-heading-bc text-xs font-black uppercase tracking-widest mb-4">
                  Location
                </h3>
                {content.contact.location && (
                  <p className="text-sm text-neutral-500">{content.contact.location}</p>
                )}
              </div>
              <div>
                <h3 className="font-heading-bc text-xs font-black uppercase tracking-widest mb-4">
                  Social
                </h3>
                <div className="space-y-2">
                  {contactLinks
                    .filter((link) => link.isExternal)
                    .map((link) => (
                      <a
                        key={link.type}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-neutral-500 hover:text-[#0055FF] transition-colors"
                      >
                        {link.label}
                      </a>
                    ))}
                </div>
              </div>
              <nav aria-label="Page navigation">
                <h3 className="font-heading-bc text-xs font-black uppercase tracking-widest mb-4">
                  Navigate
                </h3>
                <button
                  type="button"
                  className="block text-sm text-neutral-500 hover:text-[#0055FF] transition-colors cursor-pointer"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Back to Top
                </button>
              </nav>
            </div>

            <p
              className="font-heading-bc text-[clamp(2.5rem,8vw,6rem)] font-black text-neutral-100 leading-none tracking-tighter select-none uppercase truncate mb-8"
              aria-hidden="true"
            >
              {content.full_name}
            </p>

            <div className="pt-4 border-t border-neutral-100">
              <p className="text-xs text-neutral-400" suppressHydrationWarning>
                &copy; {new Date().getFullYear()} {content.full_name}. All rights reserved.
              </p>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
};
