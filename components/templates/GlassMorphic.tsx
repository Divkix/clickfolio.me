import React from 'react';
import type { TemplateProps } from '@/lib/types/template';
import type { Project } from '@/lib/types/database';
import { getInitials, formatDateRange, flattenSkills } from '@/lib/templates/helpers';
import { Mail, MapPin, Linkedin, Github, Globe, ExternalLink, Command, Briefcase, GraduationCap, Award } from 'lucide-react';

const GlassMorphic: React.FC<TemplateProps> = ({ content, profile }) => {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans relative overflow-y-auto selection:bg-pink-500/30 scroll-smooth">

      {/* Background Gradients & Noise */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-fuchsia-600/20 rounded-full blur-[120px] animate-pulse-slow" style={{animationDelay: '2s'}}></div>
        {/* Noise Overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`}}></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-24">

        {/* Glass Nav */}
        <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex gap-8 shadow-2xl">
          <a href="#about" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
            About
          </a>
          <a href="#experience" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
            Experience
          </a>
          <a href="#projects" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
            Projects
          </a>
          <a href="#contact" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
            Contact
          </a>
        </nav>

        {/* Hero Section */}
        <section id="about" className="mb-32 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8 animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-emerald-200 tracking-wide uppercase">Available for hire</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/40">
            {content.full_name}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <p className="text-xl text-white/80 leading-relaxed font-light mb-4">
                {content.summary}
              </p>
              {content.contact.location && (
                <p className="text-white/70 font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Based in {content.contact.location}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {flattenSkills(content.skills).slice(0, 8).map((skill: string) => (
                  <span key={skill} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-xs text-white/80 cursor-default">
                    {skill}
                  </span>
                ))}
              </div>
              <div className="flex gap-4 mt-4 justify-center md:justify-start">
                {content.contact.email && (
                  <a href={`mailto:${content.contact.email}`} className="p-2 bg-white/5 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white">
                    <Mail size={20} />
                  </a>
                )}
                {content.contact.github && (
                  <a href={content.contact.github} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white">
                    <Github size={20} />
                  </a>
                )}
                {content.contact.linkedin && (
                  <a href={content.contact.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white">
                    <Linkedin size={20} />
                  </a>
                )}
                {content.contact.website && (
                  <a href={content.contact.website} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white">
                    <Globe size={20} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Experience Section */}
        {content.experience && content.experience.length > 0 && (
          <section id="experience" className="space-y-8 mb-20">
            <div className="flex items-center gap-3 mb-12">
              <Briefcase className="w-6 h-6 text-white/40" />
              <h2 className="text-2xl font-semibold text-white/90">Experience</h2>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {content.experience.map((job, index) => (
                <div
                  key={index}
                  className="group relative rounded-3xl overflow-hidden bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all duration-500 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)] p-8"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">{job.title}</h3>
                      <p className="text-white/70 font-medium">{job.company}</p>
                    </div>
                    <span className="text-xs font-mono text-fuchsia-300">
                      {formatDateRange(job.start_date, job.end_date)}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 line-clamp-3 leading-relaxed mb-4">
                    {job.description}
                  </p>
                  {job.highlights && job.highlights.length > 0 && (
                    <ul className="text-xs text-white/70 space-y-1">
                      {job.highlights.slice(0, 3).map((highlight, _i) => (
                        <li key={_i}>• {highlight}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects Section */}
        {content.projects && content.projects.length > 0 && (
          <section id="projects" className="space-y-8 mb-20">
            <div className="flex items-center gap-3 mb-12">
              <Command className="w-6 h-6 text-white/40" />
              <h2 className="text-2xl font-semibold text-white/90">Selected Projects</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {content.projects.map((project: Project, i: number) => (
                <div
                  key={i}
                  className="group relative rounded-3xl overflow-hidden bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all duration-500 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)]"
                >
                  <div className="aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-indigo-900/50 via-purple-900/50 to-fuchsia-900/50">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] to-transparent opacity-60 z-10"></div>
                    <div className="absolute bottom-4 left-4 z-20">
                      {project.year && (
                        <div className="text-xs font-mono text-fuchsia-300 mb-1">{project.year}</div>
                      )}
                      <h3 className="text-2xl font-bold text-white">{project.title}</h3>
                    </div>
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:bg-white hover:text-black"
                      >
                        <ExternalLink size={18} />
                      </a>
                    )}
                  </div>
                  <div className="p-6 bg-white/[0.02] backdrop-blur-sm">
                    <p className="text-sm text-white/80 line-clamp-2 leading-relaxed mb-4">
                      {project.description}
                    </p>
                    {project.technologies && project.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {project.technologies.map((tech: string) => (
                          <span key={tech} className="text-[10px] uppercase tracking-widest text-white/50">#{tech}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education Section */}
        {content.education && content.education.length > 0 && (
          <section className="space-y-8 mb-20">
            <div className="flex items-center gap-3 mb-12">
              <GraduationCap className="w-6 h-6 text-white/40" />
              <h2 className="text-2xl font-semibold text-white/90">Education</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {content.education.map((edu, index) => (
                <div
                  key={index}
                  className="relative rounded-3xl bg-white/[0.03] border border-white/10 p-6"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-bold text-white">{edu.degree}</h3>
                    {edu.graduation_date && (
                      <span className="text-xs font-mono text-fuchsia-300">
                        {new Date(edu.graduation_date).getFullYear()}
                      </span>
                    )}
                  </div>
                  <p className="text-white/70">{edu.institution}</p>
                  {edu.gpa && (
                    <p className="text-xs text-white/50 mt-2">GPA: {edu.gpa}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certifications Section */}
        {content.certifications && content.certifications.length > 0 && (
          <section className="space-y-8 mb-20">
            <div className="flex items-center gap-3 mb-12">
              <Award className="w-6 h-6 text-white/40" />
              <h2 className="text-2xl font-semibold text-white/90">Certifications</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.certifications.map((cert, index) => (
                <div
                  key={index}
                  className="relative rounded-2xl bg-white/[0.03] border border-white/10 p-4 hover:bg-white/[0.05] transition-colors"
                >
                  <h3 className="text-lg font-bold text-white mb-1">{cert.name}</h3>
                  <p className="text-sm text-white/70">{cert.issuer}</p>
                  {cert.date && (
                    <p className="text-xs text-white/50 mt-1">
                      {new Date(cert.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  {cert.url && (
                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-fuchsia-300 hover:underline mt-2 inline-block"
                    >
                      View credential →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <footer id="contact" className="mt-32 border-t border-white/10 pt-12 pb-6 text-center">
          <p className="text-white/40 text-sm">
            Built with <a href="https://webresume.now" className="hover:underline text-white/60">webresume.now</a>
          </p>
        </footer>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.1); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default GlassMorphic;
