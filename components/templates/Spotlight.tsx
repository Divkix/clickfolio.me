import {
  ArrowUpRight,
  Briefcase,
  Github,
  Globe,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const ModernSpotlight: React.FC<TemplateProps> = ({ content, profile }) => {
  const firstName = content.full_name.split(" ")[0] || content.full_name;
  const allSkills = flattenSkills(content.skills);

  const navLinks = [
    { label: "About", href: "#about" },
    { label: "Work", href: "#work" },
    { label: "Projects", href: "#projects" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white relative">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 z-0 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[24px_24px]"></div>

      {/* CSS for animations */}
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .mask-linear-fade { mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }
      `}</style>

      {/* Floating Glass Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-auto max-w-[90vw]">
        <div className="flex items-center gap-1 p-1.5 rounded-full border border-zinc-200 bg-white/80 backdrop-blur-md shadow-sm">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all duration-300"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            className="hidden sm:flex ml-2 px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-full hover:bg-zinc-700 transition-all items-center gap-2"
          >
            <Mail className="w-3.5 h-3.5" />
            Hire Me
          </a>
        </div>
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-6 pt-32 md:pt-40 pb-20">
        {/* Hero Section */}
        <section id="about" className="mb-24 md:mb-32">
          <div className="flex flex-col-reverse md:flex-row gap-8 items-start md:items-center justify-between">
            <div className="flex-1 space-y-6">
              <div className="space-y-2">
                <span className="inline-block px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-600">
                  Available for work
                </span>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-zinc-900">
                  I&apos;m {firstName}.
                </h1>
                <h2 className="text-2xl md:text-3xl text-zinc-500 font-medium tracking-tight">
                  {content.headline}
                </h2>
              </div>

              <p className="text-lg text-zinc-600 leading-relaxed max-w-xl">{content.summary}</p>

              <div className="flex gap-4 pt-4">
                {content.contact.github && (
                  <a
                    href={content.contact.github}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all"
                  >
                    <Github className="w-6 h-6" />
                  </a>
                )}
                {content.contact.linkedin && (
                  <a
                    href={content.contact.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all"
                  >
                    <Linkedin className="w-6 h-6" />
                  </a>
                )}
                {content.contact.email && (
                  <a
                    href={`mailto:${content.contact.email}`}
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all"
                  >
                    <Mail className="w-6 h-6" />
                  </a>
                )}
                {content.contact.website && (
                  <a
                    href={content.contact.website}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all"
                  >
                    <Globe className="w-6 h-6" />
                  </a>
                )}
                {content.contact.phone && (
                  <a
                    href={`tel:${content.contact.phone}`}
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all"
                  >
                    <Phone className="w-6 h-6" />
                  </a>
                )}
                {content.contact.location && (
                  <div className="p-2 text-zinc-500 rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6" />
                  </div>
                )}
                {content.contact.behance && (
                  <a
                    href={content.contact.behance}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all flex items-center justify-center"
                    style={{ color: "#1769FF" }}
                  >
                    <span className="font-bold text-sm">Bē</span>
                  </a>
                )}
                {content.contact.dribbble && (
                  <a
                    href={content.contact.dribbble}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all flex items-center justify-center"
                    style={{ color: "#EA4C89" }}
                  >
                    <span className="font-bold text-sm">Dr</span>
                  </a>
                )}
              </div>
            </div>

            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-linear-to-tr from-zinc-200 to-zinc-100 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000"></div>
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={content.full_name}
                  className="relative w-32 h-32 md:w-48 md:h-48 rounded-full object-cover border-4 border-white shadow-xl grayscale hover:grayscale-0 transition-all duration-500"
                />
              ) : (
                <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full bg-zinc-100 flex items-center justify-center text-3xl font-bold text-zinc-300 border-4 border-white shadow-xl">
                  {getInitials(content.full_name)}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Minimal Skills Marquee */}
        {allSkills.length > 0 && (
          <section className="mb-24 py-10 border-y border-zinc-100 relative overflow-hidden mask-linear-fade">
            <div
              className="flex whitespace-nowrap"
              style={{ animation: "marquee 40s linear infinite" }}
            >
              {[...allSkills, ...allSkills, ...allSkills].map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center text-4xl md:text-6xl font-bold text-zinc-200 mx-8 uppercase tracking-tighter"
                >
                  {skill}
                  <span className="text-zinc-200 ml-8 text-2xl">•</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Experience Timeline */}
        {content.experience?.length > 0 && (
          <section id="work" className="mb-24">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-10 flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> Work History
            </h3>

            <div className="space-y-0 relative border-l border-zinc-200 ml-3">
              {content.experience.map((job, index) => (
                <div key={index} className="relative pl-8 pb-12 last:pb-0 group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[5px] top-2 w-2.5 h-2.5 rounded-full bg-zinc-200 border border-white group-hover:bg-zinc-900 group-hover:scale-125 transition-all duration-300"></div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
                    <h4 className="text-xl font-bold text-zinc-900">{job.company}</h4>
                    <span className="text-sm font-mono text-zinc-500 bg-zinc-50 px-2 py-0.5 rounded">
                      {formatDateRange(job.start_date, job.end_date)}
                    </span>
                  </div>

                  <div className="text-zinc-800 font-medium mb-2">{job.title}</div>

                  {job.description && (
                    <p className="text-zinc-600 leading-relaxed mb-4 text-sm max-w-2xl">
                      {job.description}
                    </p>
                  )}

                  {job.highlights && job.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {job.highlights.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs text-zinc-600 bg-zinc-100 rounded border border-zinc-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects Grid */}
        {content.projects && content.projects.length > 0 && (
          <section id="projects" className="mb-24">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-10 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Selected Projects
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {content.projects.map((project, index) => (
                <div
                  key={index}
                  className="group bg-zinc-50 border border-zinc-100 rounded-2xl p-6 hover:shadow-lg hover:border-zinc-200 transition-all duration-300 flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-900 shadow-sm group-hover:scale-110 transition-transform">
                      {getInitials(project.title)}
                    </div>
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-400 hover:text-zinc-900 transition-colors"
                      >
                        <ArrowUpRight className="w-5 h-5" />
                      </a>
                    )}
                  </div>

                  <h4 className="text-lg font-bold text-zinc-900 mb-2 group-hover:text-coral transition-colors">
                    {project.title}
                  </h4>

                  <p className="text-sm text-zinc-600 leading-relaxed mb-6 grow">
                    {project.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-auto">
                    {project.technologies?.slice(0, 4).map((tech, i) => (
                      <span
                        key={i}
                        className="text-xs font-medium text-zinc-500 px-2 py-1 bg-white rounded-md border border-zinc-200 shadow-sm"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education & Certs */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
          {content.education && content.education.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-8 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" /> Education
              </h3>
              <div className="space-y-6">
                {content.education.map((edu, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-col items-center hidden sm:flex">
                      <div className="w-px h-full bg-zinc-200 relative">
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-zinc-300"></div>
                      </div>
                    </div>
                    <div className="pb-2">
                      <h4 className="font-semibold text-zinc-900">{edu.institution}</h4>
                      <p className="text-sm text-zinc-600">{edu.degree}</p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {edu.graduation_date ? formatYear(edu.graduation_date) : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {content.certifications && content.certifications.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-8 flex items-center gap-2">
                <AwardIcon className="w-4 h-4" /> Certifications
              </h3>
              <div className="space-y-4">
                {content.certifications.map((cert, index) => (
                  <a
                    key={index}
                    href={cert.url || "#"}
                    target={cert.url ? "_blank" : undefined}
                    className="flex items-center justify-between p-4 bg-white border border-zinc-100 rounded-xl hover:border-zinc-300 transition-all group"
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-zinc-900 group-hover:text-coral transition-colors">
                        {cert.name}
                      </h4>
                      <p className="text-xs text-zinc-500">{cert.issuer}</p>
                    </div>
                    {cert.url && (
                      <ArrowUpRight className="w-3 h-3 text-zinc-300 group-hover:text-zinc-600" />
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Contact Footer */}
        <section id="contact" className="py-20 border-t border-zinc-100">
          <div className="flex flex-col items-center text-center space-y-6">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
              Ready to build something?
            </h2>
            <p className="text-zinc-500 max-w-md">
              Currently open for new opportunities. Whether you have a question or just want to say
              hi, I'll try my best to get back to you!
            </p>

            <a
              href={`mailto:${content.contact.email}`}
              className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-8 text-sm font-medium text-white shadow transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950"
            >
              Say Hello
            </a>

            <div className="pt-10 w-full max-w-sm">
              <ShareBar
                handle={profile.handle}
                title={`${content.full_name}'s Portfolio`}
                name={content.full_name}
                variant="spotlight"
              />
            </div>

            <div className="pt-8 text-xs text-zinc-400">
              © {new Date().getFullYear()} {content.full_name}. All rights reserved.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

// Helper Icon for Certs since it wasn't in original imports
const AwardIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);

export default ModernSpotlight;
