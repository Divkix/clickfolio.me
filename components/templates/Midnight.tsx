import { Calendar, ExternalLink, Github, Globe, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const Midnight: React.FC<TemplateProps> = ({ content, profile }) => {
  const flatSkills = content.skills ? flattenSkills(content.skills) : [];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-amber-500/30 selection:text-amber-200 relative overflow-x-hidden">
      {/* Background Ambience & Noise */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[100px] opacity-50"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 md:py-28">
        {/* Header Section */}
        <header className="flex flex-col items-center text-center mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="relative mb-8 group">
            <div className="absolute -inset-1 bg-linear-to-br from-amber-500/40 to-purple-600/0 rounded-full blur opacity-40 group-hover:opacity-70 transition duration-500"></div>
            <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full border border-white/10 overflow-hidden bg-neutral-900 shadow-2xl">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={content.full_name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-3xl font-serif text-amber-500">
                  {getInitials(content.full_name)}
                </div>
              )}
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-linear-to-b from-white via-white to-neutral-500 font-serif">
            {content.full_name}
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 font-light max-w-xl mx-auto mb-6 leading-relaxed">
            {content.headline}
          </p>

          <div className="flex items-center gap-4 text-sm text-neutral-500 border border-white/5 bg-white/5 px-4 py-1.5 rounded-full backdrop-blur-sm">
            {content.contact.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500/80" />
                <span>{content.contact.location}</span>
              </div>
            )}
            <div className="w-1 h-1 rounded-full bg-neutral-700"></div>
            <div className="flex items-center gap-1.5 text-green-500/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span>Available for work</span>
            </div>
          </div>
        </header>

        {/* Skills Marquee with Gradient Mask */}
        {flatSkills.length > 0 && (
          <div className="mb-24 relative">
            <div className="absolute left-0 top-0 bottom-0 w-20 z-10 bg-linear-to-r from-neutral-950 to-transparent"></div>
            <div className="absolute right-0 top-0 bottom-0 w-20 z-10 bg-linear-to-l from-neutral-950 to-transparent"></div>

            <div className="overflow-hidden flex py-4 border-y border-white/5 bg-white/2">
              <div className="flex animate-[marquee_40s_linear_infinite] gap-8 px-4">
                {[...flatSkills, ...flatSkills, ...flatSkills].map((skill: string, i: number) => (
                  <span
                    key={i}
                    className="shrink-0 text-sm text-neutral-400 font-medium tracking-wide hover:text-amber-400 transition-colors cursor-default"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* About Section */}
        {content.summary && (
          <section className="mb-24 max-w-2xl mx-auto">
            <h2 className="text-xl md:text-2xl font-serif text-white mb-6 flex items-center gap-3">
              <span className="w-8 h-px bg-amber-500/50"></span>
              About
            </h2>
            <p className="text-neutral-400 leading-8 text-lg font-light">{content.summary}</p>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Main Content Column (Experience & Projects) */}
          <div className="md:col-span-8 space-y-24">
            {/* Experience Section */}
            {content.experience && content.experience.length > 0 && (
              <section>
                <h2 className="text-xl md:text-2xl font-serif text-white mb-8 flex items-center gap-3">
                  <span className="w-8 h-px bg-amber-500/50"></span>
                  Experience
                </h2>
                <div className="relative border-l border-white/10 ml-3 md:ml-6 space-y-12 pb-4">
                  {content.experience.map((job, index) => {
                    const limitedHighlights = job.highlights?.slice(0, 3) ?? [];
                    return (
                      <div key={index} className="relative pl-8 md:pl-12 group">
                        {/* Timeline Dot */}
                        <div className="absolute -left-[5px] top-2 w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-600 group-hover:bg-amber-500 group-hover:border-amber-400 transition-colors duration-300"></div>

                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-2">
                          <h3 className="text-white font-medium text-lg tracking-wide">
                            {job.title}
                          </h3>
                          <span className="text-xs font-mono text-neutral-500 mt-1 sm:mt-0 bg-white/5 px-2 py-1 rounded">
                            {formatDateRange(job.start_date, job.end_date)}
                          </span>
                        </div>

                        <div className="text-amber-500/80 text-sm mb-4 font-medium">
                          {job.company}
                        </div>

                        {job.description && (
                          <p className="text-neutral-400 text-sm leading-relaxed mb-4 max-w-prose">
                            {job.description}
                          </p>
                        )}

                        {limitedHighlights.length > 0 && (
                          <ul className="space-y-2">
                            {limitedHighlights.map((highlight, i) => (
                              <li
                                key={i}
                                className="text-neutral-500 text-sm flex items-start gap-2.5"
                              >
                                <span className="mt-1.5 w-1 h-1 rounded-full bg-neutral-700 shrink-0" />
                                <span className="leading-relaxed">{highlight}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Projects Section */}
            {content.projects && content.projects.length > 0 && (
              <section>
                <h2 className="text-xl md:text-2xl font-serif text-white mb-8 flex items-center gap-3">
                  <span className="w-8 h-px bg-amber-500/50"></span>
                  Selected Projects
                </h2>
                <div className="grid grid-cols-1 gap-6">
                  {content.projects.map((project, index) => (
                    <div
                      key={index}
                      className="group relative bg-neutral-900/40 border border-white/5 hover:border-white/10 rounded-2xl p-6 md:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-linear-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                      <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white group-hover:text-amber-100 transition-colors">
                              {project.title}
                            </h3>
                            {project.url && (
                              <ExternalLink className="w-3.5 h-3.5 text-neutral-600 group-hover:text-amber-500 transition-colors" />
                            )}
                          </div>
                          <p className="text-neutral-400 text-sm leading-relaxed mb-4 line-clamp-2">
                            {project.description}
                          </p>
                          {project.technologies && (
                            <div className="flex flex-wrap gap-2">
                              {project.technologies.slice(0, 4).map((tech, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] uppercase tracking-wider text-neutral-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-md"
                                >
                                  {tech}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {project.year && (
                          <div className="shrink-0 text-xs font-mono text-neutral-600 pt-1">
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

          {/* Sidebar Column (Education & Certs) */}
          <div className="md:col-span-4 space-y-12">
            {/* Education */}
            {content.education && content.education.length > 0 && (
              <section className="bg-neutral-900/20 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
                <h2 className="text-lg font-serif text-white mb-6 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  Education
                </h2>
                <div className="space-y-6">
                  {content.education.map((edu, index) => (
                    <div key={index} className="relative">
                      <div className="text-white font-medium text-sm">{edu.institution}</div>
                      <div className="text-neutral-400 text-xs mt-0.5 mb-1">{edu.degree}</div>
                      <div className="flex justify-between items-center text-[10px] text-neutral-600 uppercase tracking-wider font-mono">
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
              <section className="bg-neutral-900/20 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
                <h2 className="text-lg font-serif text-white mb-6 flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border border-amber-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                  </div>
                  Certifications
                </h2>
                <div className="space-y-5">
                  {content.certifications.map((cert, index) => (
                    <div key={index} className="group">
                      <h3 className="text-neutral-200 text-sm font-medium group-hover:text-amber-400 transition-colors">
                        {cert.name}
                      </h3>
                      <div className="flex justify-between items-end mt-1">
                        <p className="text-neutral-500 text-xs">{cert.issuer}</p>
                        {cert.date && (
                          <p className="text-neutral-600 text-[10px] font-mono">{cert.date}</p>
                        )}
                      </div>
                      {cert.url && (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mt-2 text-[10px] text-amber-500/50 hover:text-amber-500 transition-colors"
                        >
                          View Credential →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Footer / Contact */}
        <footer className="mt-32 pt-16 border-t border-white/5 text-center">
          <h2 className="font-serif text-3xl md:text-4xl text-white mb-8">Let's work together.</h2>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {content.contact.email && (
              <a
                href={`mailto:${content.contact.email}`}
                className="group flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-medium text-sm hover:bg-amber-400 transition-colors duration-300"
              >
                <Mail className="w-4 h-4" />
                <span>Get in touch</span>
              </a>
            )}
            <div className="flex gap-2">
              {[
                { link: content.contact.phone, Icon: Phone, isPhone: true },
                { link: content.contact.github, Icon: Github },
                { link: content.contact.linkedin, Icon: Linkedin },
                { link: content.contact.website, Icon: Globe },
                { link: content.contact.behance, text: "Bē", color: "#1769FF" },
                { link: content.contact.dribbble, text: "Dr", color: "#EA4C89" },
              ].map(
                (item, i) =>
                  item.link && (
                    <a
                      key={i}
                      href={item.isPhone ? `tel:${item.link}` : item.link}
                      target={item.isPhone ? undefined : "_blank"}
                      rel={item.isPhone ? undefined : "noopener noreferrer"}
                      className="w-11 h-11 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:border-amber-500/50 hover:scale-110 transition-all duration-300"
                      style={item.text ? { color: item.color } : undefined}
                    >
                      {item.Icon ? (
                        <item.Icon className="w-4 h-4" />
                      ) : (
                        <span className="text-xs font-bold">{item.text}</span>
                      )}
                    </a>
                  ),
              )}
            </div>
          </div>

          <div className="flex justify-center opacity-60">
            <ShareBar
              handle={profile.handle}
              title={`${content.full_name}'s Portfolio`}
              name={content.full_name}
              variant="midnight"
            />
          </div>
          <p className="text-neutral-600 text-xs mt-8">
            © {new Date().getFullYear()} {content.full_name}. All rights reserved.
          </p>
        </footer>
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
