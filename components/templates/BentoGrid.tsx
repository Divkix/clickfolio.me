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
} from "lucide-react";
import type React from "react";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BentoGrid: React.FC<TemplateProps> = ({ content, profile: _profile }) => {
  const skills = flattenSkills(content.skills);

  return (
    <div className="min-h-screen bg-neutral-100 text-gray-900 font-sans p-4 md:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto animate-in fade-in duration-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-[180px] gap-4">
          {/* 1. Profile Card (Large) - 2x2 */}
          <div className="col-span-1 sm:col-span-2 row-span-2 bg-white rounded-3xl p-8 shadow-sm border border-neutral-200/60 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-br from-blue-50 to-purple-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="relative z-10">
              <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-neutral-900 to-neutral-700 mb-6 shadow-lg flex items-center justify-center text-white font-bold text-3xl">
                {getInitials(content.full_name)}
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-2">
                {content.full_name}
              </h1>
              <p className="text-lg text-neutral-500 font-medium">{content.headline}</p>
            </div>
            <div className="relative z-10">
              <p className="text-neutral-600 leading-relaxed max-w-md mb-6">{content.summary}</p>
              <div className="flex gap-3">
                {content.contact?.email && (
                  <a
                    href={`mailto:${content.contact.email}`}
                    className="p-2 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-colors text-neutral-600"
                  >
                    <Mail size={18} />
                  </a>
                )}
                {content.contact?.linkedin && (
                  <a
                    href={content.contact.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-colors text-neutral-600"
                  >
                    <Linkedin size={18} />
                  </a>
                )}
                {content.contact?.github && (
                  <a
                    href={content.contact.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-colors text-neutral-600"
                  >
                    <Github size={18} />
                  </a>
                )}
                {content.contact?.website && (
                  <a
                    href={content.contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-colors text-neutral-600"
                  >
                    <Globe size={18} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* 2. Availability / Status - 1x1 */}
          <div className="col-span-1 row-span-1 bg-[#E3F6E7] rounded-3xl p-6 flex flex-col justify-between border border-[#c9ebcf]">
            <div className="flex justify-between items-start">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <Crown size={20} className="text-green-700 opacity-50" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-green-800 mb-1">
                Available
              </p>
              <p className="text-lg font-semibold text-green-900">Open to opportunities</p>
            </div>
          </div>

          {/* 3. Tech Stack - 1x2 (taller to show all skills) */}
          {skills.length > 0 && (
            <div className="col-span-1 row-span-2 bg-white rounded-3xl p-6 border border-neutral-200/60 overflow-y-auto flex flex-col">
              <div className="flex items-center gap-2 mb-4 text-neutral-400">
                <Layers size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Stack</span>
              </div>
              <div className="flex flex-wrap gap-2 content-start">
                {skills.map((skill: string, index: number) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-neutral-100 rounded-md text-[10px] font-semibold text-neutral-600 border border-neutral-200"
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
              className="col-span-1 row-span-2 bg-white rounded-3xl p-6 flex flex-col justify-between border border-neutral-200/60 group cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="p-2 bg-neutral-100 rounded-lg">
                  <Briefcase size={20} />
                </div>
                <span className="text-xs font-mono text-neutral-400">
                  {formatDateRange(job.start_date, job.end_date)}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold leading-tight mb-2">{job.title}</h3>
                <p className="text-neutral-600 font-medium mb-1">{job.company}</p>
                {job.description && job.description.trim() !== "" ? (
                  <p className="text-neutral-500 text-xs line-clamp-3">{job.description}</p>
                ) : job.highlights && job.highlights.length > 0 ? (
                  <ul className="text-xs text-neutral-500 space-y-1 list-disc pl-4 line-clamp-3">
                    {job.highlights.map((highlight, i) => (
                      <li key={i}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}

          {/* 5. Education Cards - 1x1 each */}
          {content.education?.slice(0, 2).map((edu, index) => (
            <div
              key={index}
              className="col-span-1 row-span-1 bg-white rounded-3xl p-6 border border-neutral-200/60 flex flex-col justify-between hover:shadow-lg transition-all"
            >
              <GraduationCap size={20} className="text-neutral-400 mb-2" />
              <div>
                {edu.graduation_date && (
                  <p className="text-neutral-400 text-xs mb-1">{formatYear(edu.graduation_date)}</p>
                )}
                <h3 className="text-lg font-bold leading-tight mb-1">{edu.degree}</h3>
                <p className="text-neutral-600 text-xs">{edu.institution}</p>
              </div>
            </div>
          ))}

          {/* 6. Featured Project (Main) - 2x2 */}
          {content.projects && content.projects.length > 0 && (
            <div className="col-span-1 sm:col-span-2 row-span-2 bg-linear-to-br from-purple-900 via-indigo-900 to-blue-900 rounded-3xl overflow-hidden border border-neutral-200/60 group relative cursor-pointer">
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent p-8 flex flex-col justify-end text-white">
                <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-xs font-bold uppercase bg-white/20 backdrop-blur-md px-2 py-1 rounded mb-3 inline-block">
                        Featured
                      </span>
                      <h3 className="text-2xl font-bold mb-1">{content.projects[0].title}</h3>
                      {content.projects[0].description && (
                        <p className="text-neutral-300 text-sm line-clamp-2 max-w-md">
                          {content.projects[0].description}
                        </p>
                      )}
                      {content.projects[0].technologies &&
                        content.projects[0].technologies.length > 0 && (
                          <div className="flex gap-2 mt-3">
                            {content.projects[0].technologies
                              .slice(0, 3)
                              .map((tech: string, idx: number) => (
                                <span key={idx} className="text-xs bg-white/10 px-2 py-1 rounded">
                                  {tech}
                                </span>
                              ))}
                          </div>
                        )}
                    </div>
                    {content.projects[0].url && (
                      <a
                        href={content.projects[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-black w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      >
                        <ArrowUpRight size={20} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. Secondary Project - 1x2 */}
          {content.projects?.[1] && (
            <div className="col-span-1 row-span-2 bg-neutral-900 rounded-3xl p-6 flex flex-col justify-between text-white group cursor-pointer overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1/2 bg-linear-to-b from-blue-500/20 to-transparent"></div>
              <div className="flex justify-between items-start relative z-10">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Code size={20} />
                </div>
                {content.projects[1].url && (
                  <a href={content.projects[1].url} target="_blank" rel="noopener noreferrer">
                    <ArrowUpRight
                      size={20}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </a>
                )}
              </div>
              <div className="relative z-10">
                {content.projects[1].year && (
                  <p className="text-neutral-400 text-xs mb-2">{content.projects[1].year}</p>
                )}
                <h3 className="text-xl font-bold leading-tight mb-2">
                  {content.projects[1].title}
                </h3>
                {content.projects[1].description && (
                  <p className="text-neutral-400 text-xs line-clamp-3">
                    {content.projects[1].description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 8. Third Project - 1x1 */}
          {content.projects?.[2] && (
            <div className="col-span-1 row-span-1 bg-white rounded-3xl p-6 border border-neutral-200/60 flex flex-col justify-between group cursor-pointer hover:shadow-lg transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-indigo-50 to-purple-50 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="flex justify-between items-start relative z-10">
                <div className="p-2 bg-neutral-100 rounded-lg">
                  <Code size={16} className="text-neutral-600" />
                </div>
                {content.projects[2].url && (
                  <a href={content.projects[2].url} target="_blank" rel="noopener noreferrer">
                    <ArrowUpRight
                      size={16}
                      className="text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </a>
                )}
              </div>
              <div className="relative z-10">
                {content.projects[2].year && (
                  <p className="text-neutral-400 text-xs mb-1">{content.projects[2].year}</p>
                )}
                <h3 className="text-lg font-bold leading-tight mb-1 line-clamp-2">
                  {content.projects[2].title}
                </h3>
                {content.projects[2].description && (
                  <p className="text-neutral-500 text-xs line-clamp-2">
                    {content.projects[2].description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 9. Certifications/Awards - 1x1 */}
          {content.certifications && content.certifications.length > 0 && (
            <div className="col-span-1 row-span-1 bg-white rounded-3xl p-6 border border-neutral-200/60 flex flex-col justify-between hover:shadow-lg transition-all">
              <Award size={20} className="text-neutral-400 mb-2" />
              <div>
                {content.certifications[0].date && (
                  <p className="text-neutral-400 text-xs mb-1">
                    {formatYear(content.certifications[0].date)}
                  </p>
                )}
                <h3 className="text-lg font-bold leading-tight mb-1">
                  {content.certifications[0].name}
                </h3>
                {content.certifications[0].issuer && (
                  <p className="text-neutral-600 text-xs">{content.certifications[0].issuer}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes music {
          0%, 100% { height: 40%; }
          50% { height: 100%; }
        }
      `}</style>
    </div>
  );
};

export default BentoGrid;
