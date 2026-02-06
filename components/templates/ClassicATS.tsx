"use client";

import { Github, Globe, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { type ContactLinkType, getContactLinks } from "@/lib/templates/contact-links";
import { flattenSkills, formatDateRange, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const atsIconMap: Partial<
  Record<ContactLinkType, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>>
> = {
  location: MapPin,
  phone: Phone,
  email: Mail,
  linkedin: Linkedin,
  github: Github,
  website: Globe,
};

/**
 * ClassicATS Template
 *
 * Single-column, ATS-optimized layout with "legal brief" typography.
 * Designed for traditional industries: finance, legal, healthcare, government.
 *
 * Features:
 * - Semantic HTML structure for ATS parsing
 * - Double border header with centered name
 * - Uppercase tracking on section titles with bullet markers
 * - Em-dash list markers for highlights
 * - Print-optimized with Tailwind print: classes
 */
const ClassicATS: React.FC<TemplateProps> = ({ content, profile }) => {
  const flatSkills = content.skills ? flattenSkills(content.skills) : [];
  const contactLinks = getContactLinks(content.contact);

  return (
    <main className="min-h-screen bg-white text-gray-900 font-serif selection:bg-gray-200 overflow-y-auto print:overflow-visible">
      <article className="max-w-[8.5in] mx-auto px-8 py-12 print:px-[0.75in] print:py-[0.5in]">
        {/* Header with Double Border */}
        <header className="border-y-4 border-double border-gray-900 py-6 mb-8 text-center print:break-inside-avoid">
          <h1 className="text-3xl font-bold tracking-wide uppercase mb-2">{content.full_name}</h1>
          {content.headline && (
            <p className="text-sm text-gray-600 italic mb-4">{content.headline}</p>
          )}

          {/* Contact Row */}
          <nav
            aria-label="Contact information"
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-gray-700"
          >
            {contactLinks.map((link) => {
              const IconComponent = atsIconMap[link.type];
              const isNonClickable = link.type === "location" || link.type === "phone";
              const showPrintUrl = link.isExternal;
              const isBranded = link.type === "behance" || link.type === "dribbble";
              const brandText =
                link.type === "behance" ? "Be" : link.type === "dribbble" ? "Dr" : null;

              if (isNonClickable) {
                return (
                  <span key={link.type} className="inline-flex items-center gap-1">
                    {IconComponent && (
                      <IconComponent className="w-3.5 h-3.5 print:hidden" aria-hidden={true} />
                    )}
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
                  className="inline-flex items-center gap-1 hover:text-gray-900 hover:underline"
                >
                  {IconComponent && (
                    <IconComponent className="w-3.5 h-3.5 print:hidden" aria-hidden={true} />
                  )}
                  {isBranded ? (
                    <>
                      <span className="print:hidden">{brandText}</span>
                      <span className="hidden print:inline">{link.href}</span>
                    </>
                  ) : showPrintUrl ? (
                    <>
                      <span className="print:hidden">{link.label}</span>
                      <span className="hidden print:inline">{link.href}</span>
                    </>
                  ) : (
                    link.label
                  )}
                </a>
              );
            })}
          </nav>
        </header>

        {/* Summary Section */}
        {content.summary && (
          <section className="mb-8 print:break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-900 mb-3 flex items-center gap-2">
              <span aria-hidden="true">&#9632;</span> Professional Summary
            </h2>
            <p className="text-sm leading-relaxed text-justify text-gray-700">{content.summary}</p>
          </section>
        )}

        {/* Experience Section */}
        {content.experience && content.experience.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-300 pb-1">
              <span aria-hidden="true">&#9632;</span> Professional Experience
            </h2>
            <div className="space-y-6">
              {content.experience.map((job, idx) => (
                <article key={idx} className="print:break-inside-avoid">
                  <div className="flex flex-wrap justify-between items-baseline gap-x-4 mb-1">
                    <h3 className="font-bold text-base">{job.title}</h3>
                    <span className="text-xs text-gray-600 shrink-0">
                      {formatDateRange(job.start_date, job.end_date)}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-between items-baseline gap-x-4 mb-2">
                    <p className="text-sm text-gray-700 italic">
                      {job.company}
                      {job.location && `, ${job.location}`}
                    </p>
                  </div>
                  {job.description && (
                    <p className="text-sm text-gray-700 mb-2 text-justify">{job.description}</p>
                  )}
                  {job.highlights && job.highlights.length > 0 && (
                    <ul className="text-sm text-gray-700 space-y-1 ml-4">
                      {job.highlights.map((highlight, i) => (
                        <li key={i} className="pl-4">
                          <span className="text-gray-400 mr-2" aria-hidden="true">
                            &mdash;
                          </span>
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

        {/* Education Section */}
        {content.education && content.education.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-300 pb-1">
              <span aria-hidden="true">&#9632;</span> Education
            </h2>
            <div className="space-y-4">
              {content.education.map((edu, idx) => (
                <article key={idx} className="print:break-inside-avoid">
                  <div className="flex flex-wrap justify-between items-baseline gap-x-4 mb-1">
                    <h3 className="font-bold text-base">{edu.degree}</h3>
                    {edu.graduation_date && (
                      <span className="text-xs text-gray-600 shrink-0">
                        {formatYear(edu.graduation_date)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 italic">
                    {edu.institution}
                    {edu.location && `, ${edu.location}`}
                    {edu.gpa && ` | GPA: ${edu.gpa}`}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Skills Section */}
        {flatSkills.length > 0 && (
          <section className="mb-8 print:break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-900 mb-3 flex items-center gap-2 border-b border-gray-300 pb-1">
              <span aria-hidden="true">&#9632;</span> Skills
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">{flatSkills.join(" | ")}</p>
          </section>
        )}

        {/* Certifications Section */}
        {content.certifications && content.certifications.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-900 mb-3 flex items-center gap-2 border-b border-gray-300 pb-1">
              <span aria-hidden="true">&#9632;</span> Certifications & Licenses
            </h2>
            <div className="space-y-2">
              {content.certifications.map((cert, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap justify-between items-baseline gap-x-4 text-sm print:break-inside-avoid"
                >
                  <p className="text-gray-700">
                    <span className="font-medium">
                      {cert.url ? (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {cert.name}
                        </a>
                      ) : (
                        cert.name
                      )}
                    </span>
                    {cert.issuer && <span className="text-gray-500"> — {cert.issuer}</span>}
                  </p>
                  {cert.date && (
                    <span className="text-xs text-gray-600 shrink-0">{formatYear(cert.date)}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects Section */}
        {content.projects && content.projects.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-300 pb-1">
              <span aria-hidden="true">&#9632;</span> Projects
            </h2>
            <div className="space-y-4">
              {content.projects.map((proj, idx) => (
                <article key={idx} className="print:break-inside-avoid">
                  <div className="flex flex-wrap justify-between items-baseline gap-x-4 mb-1">
                    <h3 className="font-bold text-base">
                      {proj.url ? (
                        <a
                          href={proj.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {proj.title}
                        </a>
                      ) : (
                        proj.title
                      )}
                    </h3>
                    {proj.year && (
                      <span className="text-xs text-gray-600 shrink-0">{proj.year}</span>
                    )}
                  </div>
                  {proj.description && (
                    <p className="text-sm text-gray-700 mb-1 text-justify">{proj.description}</p>
                  )}
                  {proj.technologies && proj.technologies.length > 0 && (
                    <p className="text-xs text-gray-500 italic">
                      Technologies: {proj.technologies.join(", ")}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Share Bar - Hidden on Print */}
        <footer className="mt-12 pt-6 border-t border-gray-200 print:hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400" suppressHydrationWarning>
              &copy; {new Date().getFullYear()} {content.full_name}
            </p>
            <ShareBar
              handle={profile.handle}
              title={`${content.full_name}'s Resume`}
              name={content.full_name}
              variant="classic-ats"
            />
          </div>
        </footer>
      </article>
    </main>
  );
};

export default ClassicATS;
