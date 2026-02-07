"use client";

import { Github, Globe, Linkedin, Mail, MapPin } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { type ContactLinkType, getContactLinks } from "@/lib/templates/contact-links";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const corporateIconMap: Partial<
  Record<ContactLinkType, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>>
> = {
  location: MapPin,
  email: Mail,
  linkedin: Linkedin,
  github: Github,
  website: Globe,
};

const BoldCorporate: React.FC<TemplateProps> = ({ content, profile }) => {
  const nameParts = content.full_name.split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const flatSkills = content.skills ? flattenSkills(content.skills) : [];
  const contactLinks = getContactLinks(content.contact);
  const safeHeadline =
    content.headline && content.headline.trim() !== "" ? content.headline : "Professional";

  /**
   * Bold the first word of each sentence in the summary.
   * Splits on sentence boundaries (`. `, `! `, `? `, or start of string).
   */
  const renderBoldedSummary = (text: string) => {
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.map((sentence, i) => {
      const firstSpaceIdx = sentence.indexOf(" ");
      if (firstSpaceIdx === -1) {
        return (
          <span key={i}>
            <strong>{sentence}</strong>{" "}
          </span>
        );
      }
      const firstWord = sentence.slice(0, firstSpaceIdx);
      const rest = sentence.slice(firstSpaceIdx);
      return (
        <span key={i}>
          <strong>{firstWord}</strong>
          {rest}{" "}
        </span>
      );
    });
  };

  return (
    <>
      {/* Font preloading */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap"
        rel="stylesheet"
      />

      <main className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-[#0055FF] selection:text-white overflow-y-auto scroll-smooth">
        <style>{`
          .font-heading-bc { font-family: 'Plus Jakarta Sans', sans-serif; }
          .typewriter-animate {
            animation: typing 3.5s steps(40, end) forwards, blink-caret 0.75s step-end infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .typewriter-animate {
              animation: none;
              border-right-color: transparent;
            }
          }
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes marquee-reverse {
            0% { transform: translateX(-50%); }
            100% { transform: translateX(0); }
          }
          @keyframes typing {
            from { width: 0; }
            to { width: 100%; }
          }
          @keyframes blink-caret {
            from, to { border-color: transparent; }
            50% { border-color: currentColor; }
          }
        `}</style>

        <div className="max-w-6xl mx-auto px-6 md:px-12 pt-16 pb-0">
          {/* Hero Section */}
          <header className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end mb-20 md:mb-32">
            <div className="md:col-span-8">
              <h1 className="font-heading-bc text-7xl md:text-9xl font-black tracking-tighter leading-[0.9]">
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
                    alt={content.full_name}
                    width={128}
                    height={128}
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

          {/* About Section */}
          {content.summary && (
            <section className="mb-20 md:mb-32">
              <div className="border-l-4 border-neutral-900 pl-6 max-w-2xl">
                <p className="text-lg leading-relaxed text-neutral-600">{content.summary}</p>
              </div>
            </section>
          )}

          {/* Bio Card */}
          <section className="mb-20 md:mb-32 bg-neutral-50 rounded-2xl p-8 md:p-12">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-16 h-16 rounded-full bg-neutral-200 overflow-hidden flex items-center justify-center shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={content.full_name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-black text-neutral-500">
                    {getInitials(content.full_name)}
                  </span>
                )}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm text-neutral-500 mb-1">I am a</p>
                <p className="font-heading-bc font-black text-2xl whitespace-nowrap overflow-hidden border-r-2 border-current typewriter-animate max-w-fit">
                  {safeHeadline}
                </p>
              </div>
            </div>
            {content.summary && (
              <p className="text-neutral-600 leading-relaxed mb-6 max-w-2xl">
                {renderBoldedSummary(content.summary)}
              </p>
            )}
            <nav aria-label="Contact information" className="flex flex-wrap items-center gap-4">
              {contactLinks.map((link) => {
                const IconComponent = corporateIconMap[link.type];
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
                    className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-[#0055FF] transition-colors"
                  >
                    {isBehance ? (
                      <span className="text-xs font-bold">Be</span>
                    ) : isDribbble ? (
                      <span className="text-xs font-bold">Dr</span>
                    ) : IconComponent ? (
                      <IconComponent className="w-4 h-4" aria-hidden={true} />
                    ) : null}
                    {link.label}
                  </a>
                );
              })}
            </nav>
            <div className="mt-4">
              <ShareBar
                handle={profile.handle}
                title={`${content.full_name}'s Portfolio`}
                name={content.full_name}
                variant="bold-corporate"
              />
            </div>
          </section>

          {/* Experience Section */}
          {content.experience && content.experience.length > 0 && (
            <section className="mb-20 md:mb-32">
              <div className="flex items-center gap-4 mb-12">
                <h2 className="font-heading-bc text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                  Experience
                </h2>
                <div className="h-px bg-neutral-200 flex-1" />
              </div>
              <div className="space-y-16">
                {content.experience.map((job, idx) => {
                  const number = String(idx + 1).padStart(2, "0");
                  const limitedHighlights = job.highlights?.slice(0, 4) ?? [];
                  return (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-6 group">
                      <div className="md:col-span-2">
                        <span
                          className="text-6xl font-black leading-none select-none"
                          style={{
                            WebkitTextStroke: "2px #D4D4D4",
                            color: "transparent",
                          }}
                        >
                          {number}
                        </span>
                      </div>
                      <div className="md:col-span-10">
                        <div className="flex items-start gap-4 mb-3">
                          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-neutral-500">
                              {getInitials(job.company)}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-heading-bc text-2xl font-bold">{job.title}</h3>
                            <p className="text-neutral-500 text-sm">
                              {job.company}
                              {job.location ? ` \u00B7 ${job.location}` : ""}
                            </p>
                          </div>
                          <span className="text-xs text-neutral-400 font-medium shrink-0 mt-1">
                            {formatDateRange(job.start_date, job.end_date)}
                          </span>
                        </div>
                        {job.description && job.description.trim() !== "" && (
                          <p className="text-neutral-600 text-sm leading-relaxed mb-4 max-w-xl">
                            {job.description}
                          </p>
                        )}
                        {limitedHighlights.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {limitedHighlights.map((highlight, i) => (
                              <span
                                key={i}
                                className="bg-neutral-100 rounded-full px-3 py-1 text-xs text-neutral-600"
                              >
                                {highlight}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Education Section */}
          {content.education && content.education.length > 0 && (
            <section className="mb-20 md:mb-32">
              <div className="flex items-center gap-4 mb-12">
                <h2 className="font-heading-bc text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                  Education
                </h2>
                <div className="h-px bg-neutral-200 flex-1" />
              </div>
              <div className="space-y-12">
                {content.education.map((edu, idx) => {
                  const number = String(idx + 1).padStart(2, "0");
                  return (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      <div className="md:col-span-2">
                        <span
                          className="text-6xl font-black leading-none select-none"
                          style={{
                            WebkitTextStroke: "2px #D4D4D4",
                            color: "transparent",
                          }}
                        >
                          {number}
                        </span>
                      </div>
                      <div className="md:col-span-10">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-neutral-500">
                              {getInitials(edu.institution)}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-heading-bc text-xl font-bold">{edu.degree}</h3>
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
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Awards Section (Certifications) */}
          {content.certifications && content.certifications.length > 0 && (
            <section className="mb-20 md:mb-32">
              <div className="flex items-center gap-4 mb-12">
                <h2 className="font-heading-bc text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                  Awards
                </h2>
                <div className="h-px bg-neutral-200 flex-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {content.certifications.map((cert, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-neutral-900 mt-2 shrink-0" />
                    <div>
                      <h3 className="font-heading-bc font-bold text-lg">
                        {cert.url ? (
                          <a
                            href={cert.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline hover:text-[#0055FF] transition-colors"
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
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Projects Section */}
          {content.projects && content.projects.length > 0 && (
            <section className="mb-20 md:mb-32">
              <div className="flex items-center gap-4 mb-12">
                <h2 className="font-heading-bc text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                  Projects
                </h2>
                <div className="h-px bg-neutral-200 flex-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {content.projects.map((project, idx) => (
                  <div key={idx} className="group">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-heading-bc text-xl font-bold group-hover:underline group-hover:text-[#0055FF] transition-colors">
                        {project.url ? (
                          <a href={project.url} target="_blank" rel="noopener noreferrer">
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
                            key={i}
                            className="border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-500"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Skills Marquee */}
          {flatSkills.length > 0 && (
            <section className="mb-20 md:mb-32 overflow-hidden" aria-label="Skills">
              <div className="flex items-center gap-4 mb-12">
                <h2 className="font-heading-bc text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                  Skills
                </h2>
                <div className="h-px bg-neutral-200 flex-1" />
              </div>
              <div className="space-y-4">
                {/* Row 1 - normal direction */}
                <div className="overflow-hidden whitespace-nowrap">
                  <div className="inline-block motion-safe:animate-[marquee_30s_linear_infinite]">
                    {flatSkills.map((skill, i) => (
                      <span
                        key={i}
                        className="inline-block border border-neutral-200 rounded-full px-4 py-2 text-sm font-medium mx-1.5"
                      >
                        {skill}
                      </span>
                    ))}
                    {flatSkills.map((skill, i) => (
                      <span
                        key={`dup-${i}`}
                        className="inline-block border border-neutral-200 rounded-full px-4 py-2 text-sm font-medium mx-1.5"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Row 2 - reverse direction */}
                <div className="overflow-hidden whitespace-nowrap">
                  <div className="inline-block motion-safe:animate-[marquee-reverse_35s_linear_infinite]">
                    {flatSkills.map((skill, i) => (
                      <span
                        key={i}
                        className="inline-block border border-neutral-200 rounded-full px-4 py-2 text-sm font-medium mx-1.5"
                      >
                        {skill}
                      </span>
                    ))}
                    {flatSkills.map((skill, i) => (
                      <span
                        key={`dup-${i}`}
                        className="inline-block border border-neutral-200 rounded-full px-4 py-2 text-sm font-medium mx-1.5"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Row 3 - normal direction, faster */}
                <div className="overflow-hidden whitespace-nowrap">
                  <div className="inline-block motion-safe:animate-[marquee_25s_linear_infinite]">
                    {flatSkills.map((skill, i) => (
                      <span
                        key={i}
                        className="inline-block border border-neutral-200 rounded-full px-4 py-2 text-sm font-medium mx-1.5"
                      >
                        {skill}
                      </span>
                    ))}
                    {flatSkills.map((skill, i) => (
                      <span
                        key={`dup-${i}`}
                        className="inline-block border border-neutral-200 rounded-full px-4 py-2 text-sm font-medium mx-1.5"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="border-t border-neutral-200 pt-16 pb-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
              {/* Column 1: Contact */}
              <div>
                <h3 className="font-heading-bc text-xs font-black uppercase tracking-widest mb-4">
                  Contact
                </h3>
                <div className="space-y-2">
                  {content.contact.email && (
                    <a
                      href={`mailto:${content.contact.email}`}
                      className="block text-sm text-neutral-500 hover:text-[#0055FF] transition-colors"
                    >
                      {content.contact.email}
                    </a>
                  )}
                  {content.contact.phone && (
                    <p className="text-sm text-neutral-500">{content.contact.phone}</p>
                  )}
                </div>
              </div>
              {/* Column 2: Location */}
              <div>
                <h3 className="font-heading-bc text-xs font-black uppercase tracking-widest mb-4">
                  Location
                </h3>
                {content.contact.location && (
                  <p className="text-sm text-neutral-500">{content.contact.location}</p>
                )}
              </div>
              {/* Column 3: Social */}
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
              {/* Column 4: Navigation */}
              <nav aria-label="Page navigation">
                <h3 className="font-heading-bc text-xs font-black uppercase tracking-widest mb-4">
                  Navigate
                </h3>
                <div className="space-y-2">
                  <button
                    type="button"
                    className="block text-sm text-neutral-500 hover:text-[#0055FF] transition-colors cursor-pointer"
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Back to Top
                  </button>
                </div>
              </nav>
            </div>

            {/* Decorative Name - Marquee */}
            <div className="overflow-hidden mb-8">
              <div
                className="inline-flex whitespace-nowrap motion-safe:animate-[marquee_60s_linear_infinite]"
                aria-hidden="true"
              >
                <span className="font-heading-bc text-8xl md:text-[10rem] font-black text-neutral-100 leading-none tracking-tighter select-none uppercase shrink-0 pr-12">
                  {content.full_name}
                </span>
                <span className="font-heading-bc text-8xl md:text-[10rem] font-black text-neutral-100 leading-none tracking-tighter select-none uppercase shrink-0 pr-12">
                  {content.full_name}
                </span>
              </div>
            </div>

            {/* Copyright + Badge */}
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

export default BoldCorporate;
