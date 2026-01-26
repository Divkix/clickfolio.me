"use client";

import { Github, Globe, Linkedin, Mail, MapPin } from "lucide-react";
import type React from "react";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const BoldCorporate: React.FC<TemplateProps> = ({ content, profile }) => {
  const nameParts = content.full_name.split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const flatSkills = content.skills ? flattenSkills(content.skills) : [];
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
    <div className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white overflow-y-auto scroll-smooth">
      <div className="max-w-6xl mx-auto px-6 md:px-12 pt-16 pb-0">
        {/* Hero Section */}
        <header className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end mb-20 md:mb-32">
          <div className="md:col-span-8">
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.9]">
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
            <div className="w-32 h-32 rounded-full bg-neutral-100 overflow-hidden flex items-center justify-center">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={content.full_name}
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
              <p className="font-black text-2xl whitespace-nowrap overflow-hidden border-r-2 border-current typewriter-animate max-w-fit">
                {safeHeadline}
              </p>
            </div>
          </div>
          {content.summary && (
            <p className="text-neutral-600 leading-relaxed mb-6 max-w-2xl">
              {renderBoldedSummary(content.summary)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            {content.contact.location && (
              <span className="inline-flex items-center gap-1.5 text-sm text-neutral-500">
                <MapPin className="w-4 h-4" />
                {content.contact.location}
              </span>
            )}
            {content.contact.email && (
              <a
                href={`mailto:${content.contact.email}`}
                className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Email
              </a>
            )}
            {content.contact.linkedin && (
              <a
                href={content.contact.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </a>
            )}
            {content.contact.github && (
              <a
                href={content.contact.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
            )}
            {content.contact.website && (
              <a
                href={content.contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <Globe className="w-4 h-4" />
                Website
              </a>
            )}
          </div>
        </section>

        {/* Experience Section */}
        {content.experience && content.experience.length > 0 && (
          <section className="mb-20 md:mb-32">
            <div className="flex items-center gap-4 mb-12">
              <h2 className="text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
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
                      <span className="text-6xl font-black text-neutral-200 leading-none select-none">
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
                          <h3 className="text-2xl font-bold">{job.title}</h3>
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
              <h2 className="text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
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
                      <span className="text-6xl font-black text-neutral-200 leading-none select-none">
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
                          <h3 className="text-xl font-bold">{edu.degree}</h3>
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
              <h2 className="text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                Awards
              </h2>
              <div className="h-px bg-neutral-200 flex-1" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {content.certifications.map((cert, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="w-2 h-2 rounded-full bg-neutral-900 mt-2 shrink-0" />
                  <div>
                    <h3 className="font-bold text-lg">
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
              <h2 className="text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                Projects
              </h2>
              <div className="h-px bg-neutral-200 flex-1" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {content.projects.map((project, idx) => (
                <div key={idx} className="group">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold group-hover:underline">
                      {project.url ? (
                        <a href={project.url} target="_blank" rel="noopener noreferrer">
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                    </h3>
                    {project.year && (
                      <span className="text-xs text-neutral-400 mt-1 shrink-0">{project.year}</span>
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
          <section className="mb-20 md:mb-32 overflow-hidden">
            <div className="flex items-center gap-4 mb-12">
              <h2 className="text-xs font-black uppercase tracking-widest text-neutral-900 shrink-0">
                Skills
              </h2>
              <div className="h-px bg-neutral-200 flex-1" />
            </div>
            <div className="space-y-4">
              {/* Row 1 - normal direction */}
              <div className="overflow-hidden whitespace-nowrap">
                <div className="inline-block animate-[marquee_30s_linear_infinite]">
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
                <div className="inline-block animate-[marquee-reverse_35s_linear_infinite]">
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
                <div className="inline-block animate-[marquee_25s_linear_infinite]">
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
              <h3 className="text-xs font-black uppercase tracking-widest mb-4">Contact</h3>
              <div className="space-y-2">
                {content.contact.email && (
                  <a
                    href={`mailto:${content.contact.email}`}
                    className="block text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
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
              <h3 className="text-xs font-black uppercase tracking-widest mb-4">Location</h3>
              {content.contact.location && (
                <p className="text-sm text-neutral-500">{content.contact.location}</p>
              )}
            </div>
            {/* Column 3: Social */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest mb-4">Social</h3>
              <div className="space-y-2">
                {content.contact.linkedin && (
                  <a
                    href={content.contact.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
                  >
                    LinkedIn
                  </a>
                )}
                {content.contact.github && (
                  <a
                    href={content.contact.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
                  >
                    GitHub
                  </a>
                )}
                {content.contact.website && (
                  <a
                    href={content.contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
                  >
                    Website
                  </a>
                )}
              </div>
            </div>
            {/* Column 4: Navigation */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest mb-4">Navigate</h3>
              <div className="space-y-2">
                <button
                  type="button"
                  className="block text-sm text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Back to Top
                </button>
              </div>
            </div>
          </div>

          {/* Decorative Name */}
          <div className="overflow-hidden mb-8">
            <p className="text-8xl md:text-[10rem] font-black text-neutral-100 leading-none tracking-tighter select-none whitespace-nowrap">
              {content.full_name}
            </p>
          </div>

          {/* Copyright + Badge */}
          <div className="pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-400">
              &copy; {new Date().getFullYear()} {content.full_name}. All rights reserved.
            </p>
          </div>
        </footer>
      </div>

      <style>{`
        .typewriter-animate {
          animation: typing 3.5s steps(40, end) forwards, blink-caret 0.75s step-end infinite;
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
    </div>
  );
};

export default BoldCorporate;
