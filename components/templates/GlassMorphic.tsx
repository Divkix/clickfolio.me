"use client";

import {
  ArrowUpRight,
  Award,
  Briefcase,
  ExternalLink,
  Github,
  Globe,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Menu,
  Phone,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { ShareBar } from "@/components/ShareBar";
import { type ContactLinkType, getContactLinks } from "@/lib/templates/contact-links";
import {
  flattenSkills,
  formatDateRange,
  formatShortDate,
  formatYear,
} from "@/lib/templates/helpers";
import type { Project } from "@/lib/types/database";
import type { TemplateProps } from "@/lib/types/template";

const glassIconMap: Partial<
  Record<ContactLinkType, React.ComponentType<{ size: number; className?: string }>>
> = {
  github: Github,
  linkedin: Linkedin,
  email: Mail,
  phone: Phone,
  website: Globe,
};

const GlassMorphic: React.FC<TemplateProps> = ({ content, profile }) => {
  const flatSkills = content.skills ? flattenSkills(content.skills).slice(0, 10) : [];
  const contactLinks = getContactLinks(content.contact);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-slate-200 font-sans relative overflow-x-hidden selection:bg-coral/30 selection:text-coral">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-coral/20 rounded-full blur-[100px] animate-blob mix-blend-screen"></div>
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-screen"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-coral/10 rounded-full blur-[120px] animate-blob animation-delay-4000 mix-blend-screen"></div>
        {/* Grain Overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        ></div>
      </div>

      {/* Main Content Container */}
      <div
        className={`relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-20 transition-opacity duration-1000 ${mounted ? "opacity-100" : "opacity-0"}`}
      >
        {/* Floating Navigation */}
        <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full p-1.5 shadow-xl shadow-black/20">
            {/* Mobile Menu Icon */}
            <a
              href="#about"
              className="sm:hidden p-2 rounded-full hover:bg-white/10 text-white/70 transition-colors"
            >
              <Menu size={18} />
            </a>

            {/* Desktop Links */}
            <div className="hidden sm:flex items-center">
              {["About", "Experience", "Projects"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="px-4 py-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-full transition-all duration-300"
                >
                  {item}
                </a>
              ))}
            </div>

            {/* CTA Button */}
            <a
              href="#contact"
              className="px-4 py-2 bg-white text-black text-xs font-semibold rounded-full hover:scale-105 transition-transform"
            >
              Hire Me
            </a>
          </div>
        </nav>

        {/* Hero Section */}
        <section id="about" className="pt-20 mb-32">
          <div className="flex flex-col md:flex-row gap-12 items-start justify-between">
            <div className="flex-1 space-y-8">
              {/* Status Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-200 uppercase tracking-widest">
                  Available for work
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]">
                  {content.full_name}
                </h1>
                <p className="text-xl text-slate-400 font-light leading-relaxed max-w-2xl">
                  {content.summary}
                </p>
              </div>

              {/* Location */}
              {content.contact.location && (
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin size={16} />
                  <span className="text-sm">{content.contact.location}</span>
                </div>
              )}

              {/* Social Links Row */}
              <div className="flex flex-wrap gap-3">
                {contactLinks
                  .filter((link) => link.type !== "location")
                  .map((link) => {
                    const isBehance = link.type === "behance";
                    const isDribbble = link.type === "dribbble";
                    const isBranded = isBehance || isDribbble;
                    const IconComponent = glassIconMap[link.type];

                    if (isBranded) {
                      const color = isBehance ? "#1769FF" : "#EA4C89";
                      const text = isBehance ? "Be" : "Dr";
                      return (
                        <a
                          key={link.type}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`group flex items-center gap-2 px-4 py-2 bg-[${color}]/10 hover:bg-[${color}]/20 border border-[${color}]/20 hover:border-[${color}]/40 rounded-lg transition-all duration-300`}
                        >
                          <span className="text-sm font-bold" style={{ color }}>
                            {text}
                          </span>
                          <span className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors">
                            {link.label}
                          </span>
                        </a>
                      );
                    }

                    return (
                      <a
                        key={link.type}
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className="group flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-lg transition-all duration-300"
                      >
                        {IconComponent && (
                          <IconComponent
                            size={16}
                            className="text-slate-400 group-hover:text-white transition-colors"
                          />
                        )}
                        <span className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors">
                          {link.label}
                        </span>
                      </a>
                    );
                  })}
              </div>

              {/* Share Bar */}
              <div className="opacity-60 hover:opacity-100 transition-opacity">
                <ShareBar
                  handle={profile.handle}
                  title={`${content.full_name}'s Portfolio`}
                  name={content.full_name}
                  variant="glass-morphic"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Experience Section - Timeline Style */}
        {content.experience && content.experience.length > 0 && (
          <section id="experience" className="mb-32">
            <h2 className="text-2xl font-semibold text-white mb-10 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-coral" />
              <span>Work Experience</span>
            </h2>

            <div className="relative border-l border-white/10 ml-2 md:ml-4 lg:ml-6 space-y-12">
              {content.experience.map((job, index) => (
                <div key={index} className="relative pl-8 md:pl-12 group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[5px] top-2 w-[10px] h-[10px] rounded-full bg-neutral-950 border border-white/30 group-hover:border-coral group-hover:scale-125 transition-all duration-300"></div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-2">
                    <h3 className="text-xl font-bold text-slate-100 group-hover:text-coral transition-colors">
                      {job.title}
                    </h3>
                    <span className="text-xs font-mono text-slate-500 whitespace-nowrap">
                      {formatDateRange(job.start_date, job.end_date)}
                    </span>
                  </div>

                  <div className="text-base text-slate-300 font-medium mb-4">{job.company}</div>

                  {job.description && (
                    <p className="text-sm text-slate-400 leading-relaxed mb-4 max-w-2xl">
                      {job.description}
                    </p>
                  )}

                  {job.highlights && job.highlights.length > 0 && (
                    <ul className="space-y-2">
                      {job.highlights.slice(0, 4).map((highlight, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-slate-400">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-600 shrink-0"></span>
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills Marquee / Badges */}
        {flatSkills.length > 0 && (
          <section className="mb-32">
            <div className="p-6 rounded-2xl bg-white/2 border border-white/5">
              <p className="text-xs font-mono text-slate-500 mb-4 uppercase tracking-widest">
                Technologies
              </p>
              <div className="flex flex-wrap gap-2">
                {flatSkills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1.5 text-sm text-slate-300 bg-white/5 border border-white/5 rounded-md hover:bg-white/10 hover:border-white/20 hover:text-white transition-all cursor-default"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Projects Grid */}
        {content.projects && content.projects.length > 0 && (
          <section id="projects" className="mb-32">
            <h2 className="text-2xl font-semibold text-white mb-10 flex items-center gap-2">
              <Award className="w-5 h-5 text-coral" />
              <span>Selected Projects</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {content.projects.map((project: Project, i: number) => (
                <div
                  key={i}
                  className="group relative flex flex-col justify-between rounded-2xl bg-white/3 border border-white/5 p-6 hover:bg-white/5 hover:border-white/10 transition-all duration-300"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-linear-to-br from-coral/20 to-coral/20 flex items-center justify-center text-coral font-bold border border-white/5">
                          {project.title.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white group-hover:text-coral transition-colors">
                            {project.title}
                          </h3>
                          {project.year && (
                            <span className="text-xs text-slate-500 font-mono">{project.year}</span>
                          )}
                        </div>
                      </div>
                      {project.url && (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-white transition-colors"
                        >
                          <ArrowUpRight size={20} />
                        </a>
                      )}
                    </div>

                    <p className="text-sm text-slate-400 leading-relaxed mb-6">
                      {project.description}
                    </p>
                  </div>

                  {project.technologies && (
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                      {project.technologies.slice(0, 4).map((tech) => (
                        <span
                          key={tech}
                          className="text-[10px] font-medium text-slate-500 uppercase tracking-wider"
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

        {/* Combined Education & Certification (Bento Style) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          {/* Education */}
          {content.education && content.education.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-linear-to-br from-white/3 to-transparent p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-6">
                <GraduationCap className="w-4 h-4 text-slate-400" />
                Education
              </h3>
              <div className="space-y-6">
                {content.education.map((edu, idx) => (
                  <div key={idx} className="relative pl-4 border-l-2 border-white/10">
                    <h4 className="text-base font-medium text-slate-200">{edu.institution}</h4>
                    <p className="text-sm text-slate-400">{edu.degree}</p>
                    <div className="flex justify-between mt-1 text-xs text-slate-500 font-mono">
                      {edu.graduation_date && <span>{formatYear(edu.graduation_date)}</span>}
                      {edu.gpa && <span>GPA: {edu.gpa}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {content.certifications && content.certifications.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-linear-to-br from-white/3 to-transparent p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-6">
                <Award className="w-4 h-4 text-slate-400" />
                Certifications
              </h3>
              <div className="space-y-4">
                {content.certifications.map((cert, idx) => (
                  <a
                    key={idx}
                    href={cert.url || "#"}
                    target={cert.url ? "_blank" : undefined}
                    className={`block p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ${!cert.url && "pointer-events-none"}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-200">{cert.name}</span>
                      {cert.url && <ExternalLink size={12} className="text-slate-500" />}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex justify-between">
                      <span>{cert.issuer}</span>
                      {cert.date && <span>{formatShortDate(cert.date)}</span>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Contact Section */}
        {content.contact.email && (
          <section
            id="contact"
            className="mb-20 rounded-2xl border border-white/10 bg-white/3 backdrop-blur-sm p-10 md:p-16 text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Let's work together</h2>
            <p className="text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
              Currently open to new opportunities. If you have a project in mind or just want to
              connect, I'd love to hear from you.
            </p>
            <a
              href={`mailto:${content.contact.email}`}
              className="inline-flex items-center gap-2 px-8 py-3 bg-coral text-white font-semibold rounded-full hover:scale-105 transition-transform shadow-lg shadow-coral/20"
            >
              <Mail size={18} />
              Say Hello
            </a>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center pt-20 pb-10 border-t border-white/5">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} {content.full_name}. Crafted with precision.
          </p>
        </footer>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default GlassMorphic;
