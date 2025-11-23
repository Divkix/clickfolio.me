import React from "react";
import type { TemplateProps } from "@/lib/types/template";
import type { Project } from "@/lib/types/database";
import {
  getInitials,
  formatDateRange,
  flattenSkills,
} from "@/lib/templates/helpers";
import {
  Globe,
  ArrowUpRight,
  Star,
  Briefcase,
  GraduationCap,
  Award,
} from "lucide-react";
import { siteConfig } from "@/lib/config/site";

const NeoBrutalist: React.FC<TemplateProps> = ({ content, profile }) => {
  return (
    <div className="min-h-screen bg-[#FFFDF5] font-mono p-4 md:p-6 overflow-y-auto selection:bg-[#FF90E8] selection:text-black">
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        {/* Navigation Bar */}
        <nav className="flex justify-between items-center bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="font-black text-xl uppercase tracking-tighter flex items-center gap-2">
            <div className="w-6 h-6 bg-[#FFDE00] border-2 border-black rounded-full"></div>
            {content.full_name}
          </div>
          <div className="hidden md:flex gap-6 font-bold text-sm uppercase">
            {content.experience && content.experience.length > 0 && (
              <a
                href="#experience"
                className="hover:bg-[#FF90E8] px-2 transition-colors"
              >
                Experience
              </a>
            )}
            {content.projects && content.projects.length > 0 && (
              <a
                href="#work"
                className="hover:bg-[#22CCEE] px-2 transition-colors"
              >
                Work
              </a>
            )}
            {content.education && content.education.length > 0 && (
              <a
                href="#education"
                className="hover:bg-[#FFDE00] px-2 transition-colors"
              >
                Education
              </a>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <header className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-[#FF90E8] border-4 border-black p-8 md:p-16 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Globe size={200} strokeWidth={1.5} />
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase leading-[0.85] tracking-tighter relative z-10">
              {content.headline.split(" ").slice(0, 2).join(" ")}
              <br />
              {content.headline.split(" ").slice(2).join(" ")}
              <br />
              <span
                className="text-white"
                style={{ WebkitTextStroke: "2px black" }}
              >
                Portfolio
              </span>
            </h1>
            {content.summary && (
              <p className="mt-8 font-bold text-xl md:text-2xl max-w-lg border-l-4 border-black pl-6">
                {content.summary}
              </p>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-[#22CCEE] border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col justify-center items-center text-center hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer">
              <div className="w-24 h-24 bg-white border-4 border-black rounded-full mb-4 overflow-hidden flex items-center justify-center">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-black">
                    {getInitials(content.full_name)}
                  </span>
                )}
              </div>
              <h2 className="font-black text-2xl uppercase">
                {content.full_name}
              </h2>
              <div className="mt-2 inline-block bg-green-400 border-2 border-black px-3 py-1 text-xs font-bold uppercase rounded-full animate-pulse">
                Open for Work
              </div>
            </div>

            <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black text-lg uppercase mb-4 underline decoration-4 decoration-[#FFDE00]">
                Connect
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {content.contact.email && (
                  <a
                    href={`mailto:${content.contact.email}`}
                    className="flex items-center justify-center p-3 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors font-bold text-xs uppercase gap-2"
                  >
                    Email
                  </a>
                )}
                {content.contact.linkedin && (
                  <a
                    href={content.contact.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center p-3 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors font-bold text-xs uppercase gap-2"
                  >
                    LinkedIn
                  </a>
                )}
                {content.contact.github && (
                  <a
                    href={content.contact.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center p-3 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors font-bold text-xs uppercase gap-2"
                  >
                    GitHub
                  </a>
                )}
                {content.contact.website && (
                  <a
                    href={content.contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center p-3 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors font-bold text-xs uppercase gap-2"
                  >
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Skills Marquee */}
        {content.skills && flattenSkills(content.skills).length > 0 && (
          <div className="bg-[#FFDE00] border-4 border-black py-4 overflow-hidden whitespace-nowrap shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-1 my-12">
            <div className="inline-block animate-[marquee_20s_linear_infinite] font-black text-2xl md:text-4xl uppercase">
              {flattenSkills(content.skills).map((skill: string, i: number) => (
                <span key={i} className="mx-6 inline-flex items-center">
                  {skill} <Star className="w-6 h-6 ml-6 fill-black" />
                </span>
              ))}
              {flattenSkills(content.skills).map((skill: string, i: number) => (
                <span
                  key={`dup-${i}`}
                  className="mx-6 inline-flex items-center"
                >
                  {skill} <Star className="w-6 h-6 ml-6 fill-black" />
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Experience Section */}
        {content.experience && content.experience.length > 0 && (
          <div id="experience" className="space-y-6 mb-16">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-1 bg-black flex-1"></div>
              <h2 className="text-4xl font-black uppercase bg-white border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform rotate-1">
                Experience
              </h2>
              <div className="h-1 bg-black flex-1"></div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {content.experience.map((job, _idx: number) => (
                <div
                  key={_idx}
                  className="group bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all duration-200"
                >
                  <div className="border-b-4 border-black p-3 flex justify-between items-center bg-neutral-100">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full border-2 border-black bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full border-2 border-black bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full border-2 border-black bg-green-400"></div>
                    </div>
                    <span className="font-bold text-xs uppercase">
                      {formatDateRange(job.start_date, job.end_date)}
                    </span>
                  </div>

                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-3xl font-black uppercase mb-1">
                          {job.title}
                        </h3>
                        <p className="font-bold text-lg text-neutral-600">
                          {job.company}
                        </p>
                      </div>
                      <Briefcase className="w-8 h-8 border-2 border-black p-1 bg-white" />
                    </div>
                    {job.description && job.description.trim() !== "" ? (
                      <p className="font-medium text-sm mb-4 border-l-2 border-black pl-3">
                        {job.description}
                      </p>
                    ) : job.highlights && job.highlights.length > 0 ? (
                      <ul className="font-medium text-sm mb-4 border-l-4 border-black pl-5 space-y-2 list-disc">
                        {job.highlights
                          .slice(0, 3)
                          .map((highlight: string, i: number) => (
                            <li key={i} className="font-bold">
                              {highlight}
                            </li>
                          ))}
                      </ul>
                    ) : null}
                    {job.description &&
                      job.description.trim() !== "" &&
                      job.highlights &&
                      job.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {job.highlights
                            .slice(0, 3)
                            .map((highlight: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-[#22CCEE] border-2 border-black text-xs font-bold uppercase"
                              >
                                • {highlight}
                              </span>
                            ))}
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {content.projects && content.projects.length > 0 && (
          <div id="work" className="space-y-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-1 bg-black flex-1"></div>
              <h2 className="text-4xl font-black uppercase bg-white border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform rotate-1">
                Selected Projects
              </h2>
              <div className="h-1 bg-black flex-1"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {content.projects.map((project: Project, _idx: number) => (
                <div
                  key={_idx}
                  className="group bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all duration-200 flex flex-col"
                >
                  <div className="border-b-4 border-black p-3 flex justify-between items-center bg-neutral-100">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full border-2 border-black bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full border-2 border-black bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full border-2 border-black bg-green-400"></div>
                    </div>
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-xs uppercase hover:underline"
                      >
                        View →
                      </a>
                    )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-3xl font-black uppercase mb-2 flex items-start justify-between">
                      {project.title}
                      {project.url && (
                        <ArrowUpRight className="w-8 h-8 border-2 border-black p-1 bg-white hover:bg-black hover:text-white transition-colors" />
                      )}
                    </h3>
                    {project.description && (
                      <p className="font-medium text-sm mb-6 border-l-2 border-black pl-3">
                        {project.description}
                      </p>
                    )}
                    {project.technologies &&
                      project.technologies.length > 0 && (
                        <div className="mt-auto flex flex-wrap gap-2">
                          {project.technologies.map(
                            (tech: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-[#FF90E8] border-2 border-black text-xs font-bold uppercase"
                              >
                                {tech}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education Section */}
        {content.education && content.education.length > 0 && (
          <div id="education" className="space-y-6 my-16">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-1 bg-black flex-1"></div>
              <h2 className="text-4xl font-black uppercase bg-white border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-1">
                Education
              </h2>
              <div className="h-1 bg-black flex-1"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {content.education.map((edu, index) => (
                <div
                  key={index}
                  className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <GraduationCap className="w-8 h-8 border-2 border-black p-1 bg-[#FFDE00]" />
                    {edu.graduation_date && (
                      <span className="font-bold text-xs uppercase">
                        {new Date(edu.graduation_date).getFullYear()}
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-black uppercase mb-2">
                    {edu.degree}
                  </h3>
                  <p className="font-bold text-sm">{edu.institution}</p>
                  {edu.gpa && (
                    <p className="text-xs font-bold mt-2 bg-green-300 border-2 border-black inline-block px-2 py-1">
                      GPA: {edu.gpa}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications Section */}
        {content.certifications && content.certifications.length > 0 && (
          <div className="space-y-6 my-16">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-1 bg-black flex-1"></div>
              <h2 className="text-4xl font-black uppercase bg-white border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                Certifications
              </h2>
              <div className="h-1 bg-black flex-1"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.certifications.map((cert, index) => (
                <div
                  key={index}
                  className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  <div className="flex items-start gap-3">
                    <Award className="w-6 h-6 border-2 border-black p-1 bg-[#FF90E8]" />
                    <div className="flex-1">
                      <h3 className="font-black text-lg uppercase">
                        {cert.name}
                      </h3>
                      <p className="font-bold text-sm text-neutral-600">
                        {cert.issuer}
                      </p>
                      {cert.date && (
                        <p className="text-xs font-bold mt-1">
                          {new Date(cert.date).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                      {cert.url && (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold underline mt-1 inline-block"
                        >
                          View →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center pb-8">
          <p className="font-bold text-sm">
            Built with{" "}
            <a
              href={siteConfig.url}
              className="underline decoration-4 decoration-[#FFDE00]"
            >
              {siteConfig.fullName}
            </a>
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

export default NeoBrutalist;
