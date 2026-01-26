import { Github, Globe, Linkedin, Mail, MapPin } from "lucide-react";
import type React from "react";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const Midnight: React.FC<TemplateProps> = ({ content, profile }) => {
  const flatSkills = content.skills ? flattenSkills(content.skills) : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-y-auto scroll-smooth selection:bg-amber-400/30 selection:text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <header className="flex flex-col items-center text-center mb-16">
          <div className="w-24 h-24 rounded-full border-2 border-amber-400/30 overflow-hidden flex items-center justify-center bg-amber-400/10 mb-6">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={content.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-serif font-bold text-amber-400">
                {getInitials(content.full_name)}
              </span>
            )}
          </div>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight mb-3">
            {content.full_name}
          </h1>
          <p className="text-amber-400/70 text-lg font-light mb-3">{content.headline}</p>
          {content.contact.location && (
            <p className="text-neutral-500 text-sm flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {content.contact.location}
            </p>
          )}
        </header>

        {/* Skills Marquee */}
        {flatSkills.length > 0 && (
          <div className="mb-16 overflow-hidden whitespace-nowrap border-y border-neutral-800 py-4">
            <div className="inline-block animate-[marquee_25s_linear_infinite]">
              {flatSkills.map((skill: string, i: number) => (
                <span
                  key={i}
                  className="inline-block mx-2 px-4 py-1.5 border border-amber-400/20 text-amber-400/80 text-xs uppercase tracking-wider rounded-full"
                >
                  {skill}
                </span>
              ))}
              {flatSkills.map((skill: string, i: number) => (
                <span
                  key={`dup-${i}`}
                  className="inline-block mx-2 px-4 py-1.5 border border-amber-400/20 text-amber-400/80 text-xs uppercase tracking-wider rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* About Section */}
        {content.summary && (
          <section className="mb-16">
            <h2 className="font-serif italic text-2xl text-white mb-4">About Me</h2>
            <p className="text-neutral-300 leading-relaxed">{content.summary}</p>
          </section>
        )}

        {/* Experience Section */}
        {content.experience && content.experience.length > 0 && (
          <section className="mb-16">
            <h2 className="font-serif italic text-2xl text-white mb-8">Experience</h2>
            <div className="space-y-5">
              {content.experience.map((job, index) => {
                const limitedHighlights = job.highlights?.slice(0, 4) ?? [];
                return (
                  <div
                    key={index}
                    className="bg-white/5 border border-neutral-800 rounded-xl p-6 hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center shrink-0">
                        <span className="text-amber-400 text-xs font-bold">
                          {getInitials(job.company)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">
                          {job.company}
                        </p>
                        <h3 className="text-white font-semibold text-lg mb-1">{job.title}</h3>
                        <p className="text-amber-400/60 text-xs mb-3">
                          {formatDateRange(job.start_date, job.end_date)}
                        </p>
                        {job.description && job.description.trim() !== "" ? (
                          <p className="text-neutral-400 text-sm leading-relaxed">
                            {job.description}
                          </p>
                        ) : limitedHighlights.length > 0 ? (
                          <ul className="text-neutral-400 text-sm space-y-1.5 list-disc pl-4">
                            {limitedHighlights.map((highlight: string, i: number) => (
                              <li key={i}>{highlight}</li>
                            ))}
                          </ul>
                        ) : null}
                        {job.description &&
                          job.description.trim() !== "" &&
                          limitedHighlights.length > 0 && (
                            <ul className="mt-3 text-neutral-500 text-xs space-y-1 list-disc pl-4">
                              {limitedHighlights.map((highlight: string, i: number) => (
                                <li key={i}>{highlight}</li>
                              ))}
                            </ul>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Education Section */}
        {content.education && content.education.length > 0 && (
          <section className="mb-16">
            <h2 className="font-serif italic text-2xl text-white mb-8">Education</h2>
            <div className="space-y-5">
              {content.education.map((edu, index) => (
                <div
                  key={index}
                  className="bg-white/5 border border-neutral-800 rounded-xl p-6 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center shrink-0">
                      <span className="text-amber-400 text-xs font-bold">
                        {getInitials(edu.institution)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">
                        {edu.institution}
                      </p>
                      <h3 className="text-white font-semibold text-lg mb-1">{edu.degree}</h3>
                      {edu.graduation_date && (
                        <p className="text-amber-400/60 text-xs mb-1">
                          {formatYear(edu.graduation_date)}
                        </p>
                      )}
                      {edu.location && <p className="text-neutral-500 text-xs">{edu.location}</p>}
                      {edu.gpa && <p className="text-neutral-500 text-xs mt-1">GPA: {edu.gpa}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certifications Section */}
        {content.certifications && content.certifications.length > 0 && (
          <section className="mb-16">
            <h2 className="font-serif italic text-2xl text-white mb-8">Certifications</h2>
            <div className="space-y-4">
              {content.certifications.map((cert, index) => (
                <div
                  key={index}
                  className="bg-white/5 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-colors"
                >
                  <h3 className="text-white font-semibold mb-1">{cert.name}</h3>
                  <p className="text-neutral-500 text-sm">{cert.issuer}</p>
                  {cert.date && <p className="text-amber-400/60 text-xs mt-1">{cert.date}</p>}
                  {cert.url && (
                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400/70 text-xs hover:text-amber-400 hover:underline mt-2 inline-block"
                    >
                      View credential
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects Section */}
        {content.projects && content.projects.length > 0 && (
          <section className="mb-16">
            <h2 className="font-serif italic text-2xl text-white mb-8">Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {content.projects.map((project, index) => (
                <div
                  key={index}
                  className="bg-white/5 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-white font-semibold">{project.title}</h3>
                    {project.year && (
                      <span className="text-amber-400/60 text-xs shrink-0 ml-2">
                        {project.year}
                      </span>
                    )}
                  </div>
                  <p className="text-neutral-400 text-sm leading-relaxed mb-3">
                    {project.description}
                  </p>
                  {project.technologies && project.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {project.technologies.map((tech: string, i: number) => (
                        <span
                          key={i}
                          className="text-[10px] uppercase tracking-wider text-amber-400/60 border border-amber-400/15 rounded-full px-2 py-0.5"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                  {project.url && (
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400/70 text-xs hover:text-amber-400 hover:underline"
                    >
                      View project
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contact Section */}
        <section className="mb-16 text-center">
          <h2 className="font-serif italic text-2xl text-white mb-6">Contact Me</h2>
          {content.contact.email && (
            <a
              href={`mailto:${content.contact.email}`}
              className="inline-block border border-amber-400 text-amber-400 px-8 py-3 rounded-full text-sm font-medium hover:bg-amber-400 hover:text-black transition-colors mb-8"
            >
              Shoot email
            </a>
          )}
          <div className="flex items-center justify-center gap-4">
            {content.contact.email && (
              <a
                href={`mailto:${content.contact.email}`}
                className="w-10 h-10 rounded-full border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-amber-400 hover:border-amber-400/40 transition-colors"
              >
                <Mail className="w-4 h-4" />
              </a>
            )}
            {content.contact.linkedin && (
              <a
                href={content.contact.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-amber-400 hover:border-amber-400/40 transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            )}
            {content.contact.github && (
              <a
                href={content.contact.github}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-amber-400 hover:border-amber-400/40 transition-colors"
              >
                <Github className="w-4 h-4" />
              </a>
            )}
            {content.contact.website && (
              <a
                href={content.contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-amber-400 hover:border-amber-400/40 transition-colors"
              >
                <Globe className="w-4 h-4" />
              </a>
            )}
          </div>
        </section>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default Midnight;
