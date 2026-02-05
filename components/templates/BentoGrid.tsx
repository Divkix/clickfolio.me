import {
  ArrowUpRight,
  Award,
  Briefcase,
  Code,
  Crown,
  Github,
  Globe,
  GraduationCap,
  Layers,
  Linkedin,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const BentoGrid: React.FC<TemplateProps> = ({ content, profile }) => {
  const skills = flattenSkills(content.skills);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased selection:bg-gray-200 selection:text-gray-900 p-4 md:p-8">
      {/* Background Pattern */}
      <div className="fixed inset-0 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none z-0" />

      <div className="max-w-6xl mx-auto relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-[150px] sm:auto-rows-[180px] gap-4">
          {/* 1. Profile Card (Large) - 2x2 */}
          <div className="col-span-1 sm:col-span-2 row-span-2 bg-white rounded-4xl p-8 shadow-sm border border-gray-200/80 flex flex-col justify-between group hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-linear-to-br from-gray-100 to-gray-50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none opacity-50 group-hover:scale-110 transition-transform duration-700"></div>

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gray-900 shadow-xl flex items-center justify-center text-white font-medium text-3xl transform group-hover:rotate-3 transition-transform duration-300">
                  {getInitials(content.full_name)}
                </div>
                <div className="hidden sm:flex gap-2">
                  {/* Socials moved to top right for cleaner layout on desktop */}
                  {[
                    {
                      icon: Mail,
                      link: content.contact?.email ? `mailto:${content.contact.email}` : null,
                    },
                    {
                      icon: Phone,
                      link: content.contact?.phone ? `tel:${content.contact.phone}` : null,
                    },
                    { icon: Github, link: content.contact?.github },
                    { icon: Linkedin, link: content.contact?.linkedin },
                    { icon: Globe, link: content.contact?.website },
                    {
                      custom: "Bē",
                      link: content.contact?.behance,
                      color: "#1769FF",
                    },
                    {
                      custom: "Dr",
                      link: content.contact?.dribbble,
                      color: "#EA4C89",
                    },
                  ].map((item, idx) => {
                    const hasCustom = "custom" in item;
                    if (!item.link) return null;

                    if (hasCustom) {
                      const itemCustom = item as {
                        custom: string;
                        color: string;
                        link: string;
                      };
                      return (
                        <a
                          key={idx}
                          href={itemCustom.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 bg-gray-50 rounded-full hover:bg-gray-100 border border-gray-100 hover:border-gray-200 transition-all text-gray-500 hover:text-gray-900 hover:scale-105 flex items-center justify-center"
                          style={{ color: itemCustom.color }}
                        >
                          <span className="text-xs font-bold">{itemCustom.custom}</span>
                        </a>
                      );
                    }

                    const itemIcon = item as {
                      icon: typeof Mail;
                      link: string;
                    };
                    const IconComponent = itemIcon.icon;

                    return (
                      <a
                        key={idx}
                        href={itemIcon.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-gray-50 rounded-full hover:bg-gray-100 border border-gray-100 hover:border-gray-200 transition-all text-gray-500 hover:text-gray-900 hover:scale-105"
                      >
                        <IconComponent size={18} strokeWidth={1.5} />
                      </a>
                    );
                  })}
                </div>
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-2">
                {content.full_name}
              </h1>
              <p className="text-lg text-gray-500 font-medium tracking-tight mb-1">
                {content.headline}
              </p>
              {content.contact?.location && (
                <div className="flex items-center gap-1.5 text-gray-400 text-sm font-medium mt-1">
                  <MapPin size={14} />
                  <span>{content.contact.location}</span>
                </div>
              )}
            </div>

            <div className="relative z-10 mt-auto">
              <p className="text-gray-600 leading-relaxed max-w-lg mb-6 text-sm sm:text-base">
                {content.summary}
              </p>

              <div className="sm:hidden flex gap-3 mb-4 flex-wrap">
                {/* Mobile Socials */}
                {content.contact?.email && (
                  <a
                    href={`mailto:${content.contact.email}`}
                    className="p-2 bg-gray-100 rounded-full text-gray-600"
                  >
                    <Mail size={18} />
                  </a>
                )}
                {content.contact?.phone && (
                  <a
                    href={`tel:${content.contact.phone}`}
                    className="p-2 bg-gray-100 rounded-full text-gray-600"
                  >
                    <Phone size={18} />
                  </a>
                )}
                {content.contact?.github && (
                  <a
                    href={content.contact.github}
                    className="p-2 bg-gray-100 rounded-full text-gray-600"
                  >
                    <Github size={18} />
                  </a>
                )}
                {content.contact?.behance && (
                  <a
                    href={content.contact.behance}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-100 rounded-full flex items-center justify-center w-10 h-10"
                    style={{ color: "#1769FF" }}
                  >
                    <span className="text-xs font-bold">Bē</span>
                  </a>
                )}
                {content.contact?.dribbble && (
                  <a
                    href={content.contact.dribbble}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-100 rounded-full flex items-center justify-center w-10 h-10"
                    style={{ color: "#EA4C89" }}
                  >
                    <span className="text-xs font-bold">Dr</span>
                  </a>
                )}
              </div>

              <div className="w-fit">
                <ShareBar
                  handle={profile.handle}
                  title={`${content.full_name}'s Portfolio`}
                  name={content.full_name}
                  variant="bento-grid"
                />
              </div>
            </div>
          </div>

          {/* 2. Availability / Status - 1x1 */}
          <div className="col-span-1 row-span-1 bg-[#F1F9F3] rounded-4xl p-6 flex flex-col justify-between border border-[#E2F0E5] hover:border-green-200 transition-colors group">
            <div className="flex justify-between items-start">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </div>
              <Crown
                size={20}
                className="text-green-700/40 group-hover:text-green-700/60 transition-colors"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-700/70 mb-1">
                Status
              </p>
              <p className="text-lg font-semibold text-green-900 tracking-tight leading-tight">
                Available for new projects
              </p>
            </div>
          </div>

          {/* 3. Tech Stack - 1x2 */}
          {skills.length > 0 && (
            <div className="col-span-1 row-span-2 bg-white rounded-4xl p-6 border border-gray-200/80 flex flex-col hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-2 mb-6 text-gray-400">
                <div className="p-1.5 bg-gray-50 rounded-md">
                  <Layers size={16} strokeWidth={2} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Stack</span>
              </div>
              <div className="flex flex-wrap gap-2 content-start overflow-y-auto no-scrollbar mask-image-b">
                {skills.map((skill: string, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-gray-50 rounded-lg text-xs font-medium text-gray-600 border border-gray-100 hover:border-gray-300 hover:bg-gray-100 transition-colors cursor-default"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 4. Experience Cards - 1x2 each */}
          {content.experience?.slice(0, 2).map((job, index) => (
            <div
              key={index}
              className="col-span-1 row-span-2 bg-white rounded-4xl p-6 flex flex-col border border-gray-200/80 group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300">
                <ArrowUpRight size={20} />
              </div>

              <div className="flex-1">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-4 border border-gray-100 group-hover:scale-110 transition-transform">
                  <Briefcase size={18} className="text-gray-600" />
                </div>

                <span className="text-xs font-mono text-gray-400 mb-2 block">
                  {formatDateRange(job.start_date, job.end_date)}
                </span>

                <h3 className="text-lg font-bold leading-tight mb-1 text-gray-900">{job.title}</h3>
                <p className="text-gray-500 font-medium text-sm mb-4">{job.company}</p>
              </div>

              <div className="mt-auto">
                {job.description && job.description.trim() !== "" ? (
                  <p className="text-gray-500 text-xs leading-relaxed line-clamp-3 group-hover:text-gray-600 transition-colors">
                    {job.description}
                  </p>
                ) : job.highlights && job.highlights.length > 0 ? (
                  <ul className="text-xs text-gray-500 space-y-1.5 list-disc pl-4 line-clamp-3 group-hover:text-gray-600">
                    {job.highlights.map((highlight, i) => (
                      <li key={i}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}

          {/* 5. Education Cards - 1x1 */}
          {content.education?.slice(0, 2).map((edu, index) => (
            <div
              key={index}
              className="col-span-1 row-span-1 bg-white rounded-4xl p-6 border border-gray-200/80 flex flex-col justify-between hover:shadow-lg transition-all duration-300 group"
            >
              <div className="flex justify-between items-start">
                <GraduationCap
                  size={20}
                  className="text-gray-300 group-hover:text-gray-500 transition-colors"
                />
                {edu.graduation_date && (
                  <span className="text-[10px] font-bold bg-gray-50 px-2 py-1 rounded-full text-gray-400">
                    {formatYear(edu.graduation_date)}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight mb-1">{edu.degree}</h3>
                <p className="text-gray-500 text-xs">{edu.institution}</p>
              </div>
            </div>
          ))}

          {/* 6. Featured Project (Main) - 2x2 */}
          {content.projects && content.projects.length > 0 && (
            <div className="col-span-1 sm:col-span-2 row-span-2 bg-gray-900 rounded-4xl overflow-hidden border border-gray-800 group relative cursor-pointer shadow-2xl">
              {/* Aesthetic Gradient Background */}
              <div className="absolute inset-0 bg-linear-to-br from-coral via-coral to-pink-500 opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>

              <div className="absolute inset-0 p-8 flex flex-col justify-end text-white z-20">
                <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500 ease-out">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-white/10 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-white/90">
                      Featured Work
                    </span>
                  </div>

                  <div className="flex justify-between items-end">
                    <div className="max-w-md">
                      <h3 className="text-3xl font-bold mb-2 tracking-tight">
                        {content.projects[0].title}
                      </h3>
                      {content.projects[0].description && (
                        <p className="text-gray-300 text-sm line-clamp-2 leading-relaxed">
                          {content.projects[0].description}
                        </p>
                      )}
                      {content.projects[0].technologies &&
                        content.projects[0].technologies.length > 0 && (
                          <div className="flex gap-2 mt-4">
                            {content.projects[0].technologies
                              .slice(0, 3)
                              .map((tech: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-medium bg-white/10 border border-white/5 px-2.5 py-1 rounded-full text-gray-200"
                                >
                                  {tech}
                                </span>
                              ))}
                          </div>
                        )}
                    </div>
                    {content.projects[0].url && (
                      <div className="bg-white text-black w-12 h-12 rounded-full flex items-center justify-center transform scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 shadow-lg shadow-white/10">
                        <ArrowUpRight size={20} strokeWidth={2.5} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. Secondary Project - 1x2 */}
          {content.projects?.[1] && (
            <div className="col-span-1 row-span-2 bg-gray-50 rounded-4xl p-6 flex flex-col justify-between group cursor-pointer border border-gray-200/80 hover:bg-white hover:shadow-xl transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
                  <Code size={20} className="text-gray-700" />
                </div>
                {content.projects[1].url && (
                  <a href={content.projects[1].url} target="_blank" rel="noopener noreferrer">
                    <ArrowUpRight
                      size={20}
                      className="text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                    />
                  </a>
                )}
              </div>
              <div>
                {content.projects[1].year && (
                  <p className="text-gray-400 font-mono text-xs mb-2">{content.projects[1].year}</p>
                )}
                <h3 className="text-xl font-bold leading-tight mb-2 tracking-tight text-gray-900">
                  {content.projects[1].title}
                </h3>
                {content.projects[1].description && (
                  <p className="text-gray-500 text-xs line-clamp-4 leading-relaxed">
                    {content.projects[1].description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 8. Third Project - 1x1 */}
          {content.projects?.[2] && (
            <div className="col-span-1 row-span-1 bg-white rounded-4xl p-6 border border-gray-200/80 flex flex-col justify-between group cursor-pointer hover:shadow-lg transition-all relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-gray-50 rounded-full group-hover:bg-coral/10 transition-colors duration-500"></div>

              <div className="flex justify-between items-start relative z-10">
                <Code
                  size={16}
                  className="text-gray-400 group-hover:text-coral transition-colors"
                />
                {content.projects[2].url && (
                  <ArrowUpRight
                    size={16}
                    className="text-gray-300 group-hover:text-gray-900 transition-colors"
                  />
                )}
              </div>
              <div className="relative z-10">
                <h3 className="text-sm font-bold leading-tight mb-1 text-gray-900 line-clamp-1">
                  {content.projects[2].title}
                </h3>
                {content.projects[2].description && (
                  <p className="text-gray-500 text-[10px] leading-relaxed line-clamp-2">
                    {content.projects[2].description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 9. Certifications/Awards - 1x1 */}
          {content.certifications && content.certifications.length > 0 && (
            <div className="col-span-1 row-span-1 bg-white rounded-4xl p-6 border border-gray-200/80 flex flex-col justify-center items-center text-center hover:shadow-lg hover:border-yellow-200 transition-all duration-300 group">
              <div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Award size={20} className="text-yellow-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight mb-1 text-gray-900">
                  {content.certifications[0].name}
                </h3>
                {content.certifications[0].issuer && (
                  <p className="text-gray-500 text-[10px]">{content.certifications[0].issuer}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BentoGrid;
