"use client";

import { Github, Globe, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ShareBar } from "@/components/ShareBar";
import { type ContactLinkType, getContactLinks } from "@/lib/templates/contact-links";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const midnightIconMap: Partial<Record<ContactLinkType, ReactNode>> = {
  phone: <Phone className="w-4 h-4" aria-hidden="true" />,
  github: <Github className="w-4 h-4" aria-hidden="true" />,
  linkedin: <Linkedin className="w-4 h-4" aria-hidden="true" />,
  website: <Globe className="w-4 h-4" aria-hidden="true" />,
};

// Pseudo-random star field positions (seeded, deterministic)
const STAR_POSITIONS = [
  { x: 5, y: 8, size: 1, bright: false },
  { x: 12, y: 3, size: 1.5, bright: true },
  { x: 22, y: 15, size: 1, bright: false },
  { x: 35, y: 6, size: 1, bright: false },
  { x: 42, y: 22, size: 1.5, bright: true },
  { x: 55, y: 4, size: 1, bright: false },
  { x: 63, y: 18, size: 1, bright: false },
  { x: 70, y: 9, size: 1, bright: false },
  { x: 78, y: 25, size: 1.5, bright: true },
  { x: 85, y: 12, size: 1, bright: false },
  { x: 91, y: 5, size: 1, bright: false },
  { x: 96, y: 20, size: 1, bright: false },
  { x: 8, y: 35, size: 1, bright: false },
  { x: 18, y: 42, size: 1, bright: false },
  { x: 28, y: 38, size: 1.5, bright: true },
  { x: 38, y: 45, size: 1, bright: false },
  { x: 48, y: 33, size: 1, bright: false },
  { x: 58, y: 48, size: 1, bright: false },
  { x: 68, y: 40, size: 1.5, bright: true },
  { x: 80, y: 37, size: 1, bright: false },
  { x: 88, y: 44, size: 1, bright: false },
  { x: 95, y: 32, size: 1, bright: false },
  { x: 3, y: 55, size: 1, bright: false },
  { x: 15, y: 60, size: 1, bright: false },
  { x: 25, y: 52, size: 1.5, bright: true },
  { x: 33, y: 65, size: 1, bright: false },
  { x: 45, y: 58, size: 1, bright: false },
  { x: 52, y: 70, size: 1, bright: false },
  { x: 65, y: 55, size: 1, bright: false },
  { x: 75, y: 62, size: 1.5, bright: true },
  { x: 82, y: 72, size: 1, bright: false },
  { x: 93, y: 58, size: 1, bright: false },
  { x: 10, y: 78, size: 1, bright: false },
  { x: 20, y: 85, size: 1.5, bright: true },
  { x: 30, y: 75, size: 1, bright: false },
  { x: 40, y: 82, size: 1, bright: false },
  { x: 50, y: 90, size: 1, bright: false },
  { x: 60, y: 80, size: 1, bright: false },
  { x: 72, y: 88, size: 1.5, bright: true },
  { x: 85, y: 82, size: 1, bright: false },
  { x: 92, y: 92, size: 1, bright: false },
  { x: 97, y: 75, size: 1, bright: false },
];

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 mb-12">
      <div className="flex-1 h-px bg-white/10" aria-hidden="true" />
      <span className="text-[#C9A96E] text-sm tracking-[0.3em] uppercase font-body-mn">
        ◆ {label}
      </span>
      <div className="flex-1 h-px bg-white/10" aria-hidden="true" />
    </div>
  );
}

const Midnight: React.FC<TemplateProps> = ({ content, profile }) => {
  const [expandedJobs, setExpandedJobs] = useState<number[]>([]);
  const flatSkills = content.skills ? flattenSkills(content.skills) : [];
  const contactLinks = getContactLinks(content.contact);
  const emailLink = contactLinks.find((l) => l.type === "email");

  const toggleJob = (index: number) => {
    setExpandedJobs((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  return (
    <>
      {/* Font preloading */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <div className="min-h-screen bg-[#0a0a0a] text-neutral-200 selection:bg-[#C9A96E]/30 selection:text-[#C9A96E] relative overflow-x-hidden">
        {/* Custom font classes + animations */}
        <style>{`
          .font-display-mn { font-family: 'Cormorant Garamond', serif; }
          .font-body-mn { font-family: 'DM Sans', sans-serif; }
          @keyframes twinkle {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.8; }
          }
        `}</style>

        {/* Star field background */}
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          {/* Subtle grid lines */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, #80808008 1px, transparent 1px), linear-gradient(to bottom, #80808008 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* Stars */}
          {STAR_POSITIONS.map((star, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: star.bright ? 0.6 : 0.2,
                animation: star.bright ? `twinkle ${3 + (i % 4)}s ease-in-out infinite` : "none",
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 md:py-28">
          <main>
            {/* Header Section */}
            <header className="flex flex-col items-center text-center mb-32 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-700">
              <div className="relative mb-8 group">
                <div className="absolute -inset-1 bg-[#C9A96E]/20 rounded-full blur opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full border border-[#C9A96E]/30 overflow-hidden bg-neutral-900 shadow-2xl">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={content.full_name}
                      width={112}
                      height={112}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-3xl font-display-mn text-[#C9A96E]">
                      {getInitials(content.full_name)}
                    </div>
                  )}
                </div>
              </div>

              <h1 className="text-5xl md:text-6xl font-display-mn font-semibold tracking-tight mb-4 text-white">
                {content.full_name}
              </h1>

              <p className="text-lg md:text-xl text-neutral-400 font-body-mn max-w-xl mx-auto mb-6 leading-relaxed">
                {content.headline}
              </p>

              <div className="flex items-center gap-4 text-sm text-neutral-500 font-body-mn border border-white/5 bg-white/5 px-4 py-1.5 rounded-full">
                {content.contact.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#C9A96E]/80" aria-hidden="true" />
                    <span>{content.contact.location}</span>
                  </div>
                )}
                {content.contact.location && (
                  <div className="w-1 h-1 rounded-full bg-neutral-700" aria-hidden="true" />
                )}
                <div className="flex items-center gap-1.5 text-green-500/80">
                  <span className="relative flex h-2 w-2">
                    <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span>Available</span>
                </div>
              </div>
            </header>

            {/* About Section */}
            {content.summary && (
              <section className="mb-32 max-w-2xl mx-auto text-center">
                <SectionHeader label="About" />
                <p className="text-neutral-400 leading-8 text-lg font-body-mn">{content.summary}</p>
              </section>
            )}

            {/* Experience & Sidebar Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-16">
              {/* Main Column */}
              <div className="md:col-span-8 space-y-32">
                {/* Experience — Accordion Cards */}
                {content.experience && content.experience.length > 0 && (
                  <section>
                    <SectionHeader label="Experience" />
                    <div className="space-y-3">
                      {content.experience.map((job, index) => {
                        const isExpanded = expandedJobs.includes(index);
                        const limitedHighlights = job.highlights?.slice(0, 4) ?? [];

                        return (
                          <div
                            key={index}
                            className={`bg-white/2 border transition-colors duration-300 rounded-lg overflow-hidden ${
                              isExpanded
                                ? "border-l-2 border-l-[#C9A96E] border-t-white/5 border-r-white/5 border-b-white/5"
                                : "border-white/5 hover:border-white/10"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleJob(index)}
                              className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer group"
                              aria-expanded={isExpanded}
                            >
                              <span className="font-body-mn text-sm text-neutral-200 group-hover:text-white transition-colors">
                                <span className="font-medium">{job.title}</span>
                                <span className="text-neutral-500 mx-2">·</span>
                                <span className="text-[#C9A96E]/80">{job.company}</span>
                              </span>
                              <span className="text-xs font-body-mn text-neutral-500 shrink-0 ml-4">
                                {formatDateRange(job.start_date, job.end_date)}
                              </span>
                            </button>

                            <div
                              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                              style={{
                                gridTemplateRows: isExpanded ? "1fr" : "0fr",
                              }}
                            >
                              <div className="overflow-hidden">
                                <div className="px-6 pb-5 pt-1">
                                  {job.location && (
                                    <p className="text-neutral-500 text-xs font-body-mn mb-3 flex items-center gap-1.5">
                                      <MapPin className="w-3 h-3" aria-hidden="true" />
                                      {job.location}
                                    </p>
                                  )}

                                  {job.description && (
                                    <p className="text-neutral-400 text-sm leading-relaxed font-body-mn mb-4 max-w-prose">
                                      {job.description}
                                    </p>
                                  )}

                                  {limitedHighlights.length > 0 && (
                                    <ul className="space-y-2">
                                      {limitedHighlights.map((highlight, i) => (
                                        <li
                                          key={i}
                                          className="text-neutral-500 text-sm flex items-start gap-2.5 font-body-mn"
                                        >
                                          <span
                                            className="mt-1.5 w-1 h-1 rounded-full bg-[#C9A96E]/50 shrink-0"
                                            aria-hidden="true"
                                          />
                                          <span className="leading-relaxed">{highlight}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Projects Section */}
                {content.projects && content.projects.length > 0 && (
                  <section>
                    <SectionHeader label="Projects" />
                    <div className="grid grid-cols-1 gap-6">
                      {content.projects.map((project, index) => (
                        <div
                          key={index}
                          className="group relative bg-white/2 border border-white/5 hover:border-[#C9A96E]/30 rounded-lg p-6 transition-[border-color,box-shadow] duration-300 hover:shadow-[0_0_20px_rgba(201,169,110,0.05)] overflow-hidden"
                        >
                          <div className="flex flex-col md:flex-row gap-4 md:items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-base font-display-mn font-semibold text-white group-hover:text-[#DFC08A] transition-colors">
                                  {project.title}
                                </h3>
                              </div>
                              <p className="text-neutral-400 text-sm leading-relaxed font-body-mn mb-4 line-clamp-2">
                                {project.description}
                              </p>
                              {project.technologies && (
                                <div className="flex flex-wrap gap-2">
                                  {project.technologies.slice(0, 5).map((tech, i) => (
                                    <span
                                      key={i}
                                      className="text-[10px] uppercase tracking-wider text-neutral-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-md font-body-mn"
                                    >
                                      {tech}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {project.year && (
                              <div className="shrink-0 text-xs font-body-mn text-neutral-600 pt-1">
                                {project.year}
                              </div>
                            )}
                          </div>

                          {project.url && (
                            <a
                              href={project.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute inset-0 z-20"
                            >
                              <span className="sr-only">View {project.title}</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Sidebar Column */}
              <div className="md:col-span-4 space-y-16">
                {/* Skills — Constellation Nodes */}
                {flatSkills.length > 0 && (
                  <section>
                    <SectionHeader label="Skills" />
                    <div className="flex flex-wrap gap-2">
                      {flatSkills.map((skill, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-sm text-neutral-300 font-body-mn hover:border-[#C9A96E]/40 hover:text-[#DFC08A] hover:shadow-[0_0_12px_rgba(201,169,110,0.3)] transition-all duration-300 cursor-default"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-[#C9A96E]/50"
                            aria-hidden="true"
                          />
                          {skill}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/* Education */}
                {content.education && content.education.length > 0 && (
                  <section>
                    <SectionHeader label="Education" />
                    <div className="space-y-6">
                      {content.education.map((edu, index) => (
                        <div key={index} className="border-l border-[#C9A96E]/20 pl-4">
                          <div className="text-white font-display-mn font-medium text-sm">
                            {edu.institution}
                          </div>
                          <div className="text-neutral-400 text-xs font-body-mn mt-0.5 mb-1">
                            {edu.degree}
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-neutral-600 uppercase tracking-wider font-body-mn">
                            <span>
                              {edu.graduation_date ? formatYear(edu.graduation_date) : "Present"}
                            </span>
                            {edu.gpa && <span>GPA: {edu.gpa}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Certifications */}
                {content.certifications && content.certifications.length > 0 && (
                  <section>
                    <SectionHeader label="Certifications" />
                    <div className="space-y-5">
                      {content.certifications.map((cert, index) => (
                        <div key={index} className="group border-l border-[#C9A96E]/20 pl-4">
                          <h3 className="text-neutral-200 text-sm font-body-mn font-medium group-hover:text-[#DFC08A] transition-colors">
                            {cert.name}
                          </h3>
                          <div className="flex justify-between items-end mt-1">
                            <p className="text-neutral-500 text-xs font-body-mn">{cert.issuer}</p>
                            {cert.date && (
                              <p className="text-neutral-600 text-[10px] font-body-mn">
                                {cert.date}
                              </p>
                            )}
                          </div>
                          {cert.url && (
                            <a
                              href={cert.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block mt-2 text-[10px] text-[#C9A96E]/50 hover:text-[#C9A96E] transition-colors font-body-mn"
                            >
                              View Credential →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Contact Links (Sidebar) */}
                {contactLinks.filter((l) => l.type !== "email" && l.type !== "location").length >
                  0 && (
                  <section>
                    <SectionHeader label="Connect" />
                    <div className="flex flex-wrap gap-2">
                      {contactLinks
                        .filter((link) => link.type !== "email" && link.type !== "location")
                        .map((link) => {
                          const icon = midnightIconMap[link.type];
                          const isBranded = link.type === "behance" || link.type === "dribbble";
                          const brandColor =
                            link.type === "behance"
                              ? "#1769FF"
                              : link.type === "dribbble"
                                ? "#EA4C89"
                                : undefined;
                          const brandText =
                            link.type === "behance" ? "Bē" : link.type === "dribbble" ? "Dr" : null;

                          return (
                            <a
                              key={link.type}
                              href={link.href}
                              target={link.isExternal ? "_blank" : undefined}
                              rel={link.isExternal ? "noopener noreferrer" : undefined}
                              aria-label={link.label}
                              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-neutral-400 hover:text-[#DFC08A] hover:border-[#C9A96E]/40 hover:shadow-[0_0_12px_rgba(201,169,110,0.3)] transition-all duration-300"
                              style={isBranded ? { color: brandColor } : undefined}
                            >
                              {isBranded ? (
                                <span className="text-xs font-bold" aria-hidden="true">
                                  {brandText}
                                </span>
                              ) : (
                                icon
                              )}
                            </a>
                          );
                        })}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </main>

          {/* Footer / CTA */}
          <footer className="mt-32 pt-16 border-t border-white/5 text-center">
            <h2 className="font-display-mn text-3xl md:text-4xl text-white mb-8 font-medium">
              Let&apos;s discuss what&apos;s next.
            </h2>

            {emailLink && (
              <a
                href={emailLink.href}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full border-2 border-[#C9A96E] text-[#C9A96E] font-display-mn font-medium text-lg hover:bg-[#C9A96E]/10 hover:text-[#DFC08A] hover:border-[#DFC08A] transition-all duration-300"
              >
                <Mail className="w-5 h-5" aria-hidden="true" />
                <span>Get in touch</span>
              </a>
            )}

            <div className="flex justify-center mt-12 opacity-60">
              <ShareBar
                handle={profile.handle}
                title={`${content.full_name}'s Portfolio`}
                name={content.full_name}
                variant="midnight"
              />
            </div>
            <p className="text-neutral-600 text-xs mt-8 font-body-mn" suppressHydrationWarning>
              © {new Date().getFullYear()} {content.full_name}
            </p>
          </footer>
        </div>
      </div>
    </>
  );
};

export default Midnight;
