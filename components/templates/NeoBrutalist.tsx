import {
  ArrowUpRight,
  Award,
  Briefcase,
  Globe,
  GraduationCap,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import {
  flattenSkills,
  formatDateRange,
  formatShortDate,
  formatYear,
  getInitials,
} from "@/lib/templates/helpers";
import type { Project } from "@/lib/types/database";
import type { TemplateProps } from "@/lib/types/template";
import { NeoBrutalistMobileNav } from "./NeoBrutalistMobileNav";

const NeoBrutalist: React.FC<TemplateProps> = ({ content, profile }) => {
  const safeHeadline =
    content.headline && content.headline.trim() !== "" ? content.headline : content.full_name;
  const headlineWords = safeHeadline.split(/\s+/);
  const heroFirstLine = headlineWords.slice(0, 2).join(" ");
  const heroSecondLine = headlineWords.slice(2).join(" ");
  const projectsHook =
    content.projects && content.projects.length > 0
      ? `${content.projects[0]?.title ?? "Featured projects"}${
          content.projects.length > 1 ? ` + ${content.projects.length - 1} more` : ""
        }`
      : null;

  // Cache flattened skills to avoid triple computation in marquee
  const flatSkills = content.skills ? flattenSkills(content.skills) : [];
  const contactLinks = getContactLinks(content.contact);

  return (
    <div className="min-h-screen bg-[#FFFDF5] font-mono p-4 md:p-6 overflow-y-auto selection:bg-[#FF90E8] selection:text-black">
      <main className="max-w-6xl mx-auto space-y-8 pb-20">
        {/* Navigation Bar */}
        <nav
          className="flex justify-between items-center bg-white border-2 md:border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          aria-label="Main navigation"
        >
          <div className="font-black text-xl uppercase tracking-tighter flex items-center gap-2">
            <div className="w-6 h-6 bg-[#FFDE00] border-2 border-black rounded-full" />
            {content.full_name}
          </div>
          <div className="hidden md:flex gap-6 font-bold text-sm uppercase">
            {content.experience && content.experience.length > 0 && (
              <a href="#experience" className="hover:bg-[#FF90E8] px-2 transition-colors">
                Experience
              </a>
            )}
            {content.projects && content.projects.length > 0 && (
              <a href="#work" className="hover:bg-[#22CCEE] px-2 transition-colors">
                Work
              </a>
            )}
            {content.education && content.education.length > 0 && (
              <a href="#education" className="hover:bg-[#FFDE00] px-2 transition-colors">
                Education
              </a>
            )}
          </div>
          <NeoBrutalistMobileNav
            links={[
              ...(content.experience && content.experience.length > 0
                ? [{ href: "#experience", label: "Experience" }]
                : []),
              ...(content.projects && content.projects.length > 0
                ? [{ href: "#work", label: "Work" }]
                : []),
              ...(content.education && content.education.length > 0
                ? [{ href: "#education", label: "Education" }]
                : []),
            ]}
          />
        </nav>

        {/* Hero Section */}
        <header className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-[#FF90E8] border-2 md:border-4 border-black p-8 md:p-16 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Globe size={200} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase leading-[0.85] tracking-tighter relative z-10">
              {heroFirstLine}
              {heroSecondLine && (
                <>
                  <br />
                  {heroSecondLine}
                </>
              )}
              <br />
              <span className="text-white" style={{ WebkitTextStroke: "2px black" }}>
                Featured Projects
              </span>
            </h1>
            {projectsHook && (
              <a
                href="#work"
                className="mt-6 inline-block bg-black text-white border-2 md:border-4 border-black px-4 py-2 text-sm md:text-base font-black uppercase tracking-tight shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform"
              >
                See {projectsHook}
              </a>
            )}
            {content.summary && (
              <p className="mt-8 font-bold text-xl md:text-2xl max-w-lg border-l-2 md:border-l-4 border-black pl-6">
                {content.summary}
              </p>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-[#22CCEE] border-2 md:border-4 border-black p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col justify-center items-center text-center hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] md:hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-[transform,box-shadow]">
              <div className="w-24 h-24 bg-white border-2 md:border-4 border-black rounded-full mb-4 overflow-hidden flex items-center justify-center">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-black">{getInitials(content.full_name)}</span>
                )}
              </div>
              <h2 className="font-black text-2xl uppercase">{content.full_name}</h2>
              <div className="mt-2 inline-block bg-green-400 border-2 border-black px-3 py-1 text-xs font-bold uppercase rounded-full motion-safe:animate-pulse">
                Open for Work
              </div>
            </div>

            <div className="bg-white border-2 md:border-4 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black text-lg uppercase mb-4 underline decoration-4 decoration-[#FFDE00]">
                Connect
              </h3>
              {content.contact.location && (
                <div className="flex items-center gap-2 mb-3 font-bold text-sm">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  {content.contact.location}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {contactLinks
                  .filter((link) => link.type !== "location")
                  .map((link) => {
                    const isBranded = link.type === "behance" || link.type === "dribbble";
                    const brandBg =
                      link.type === "behance"
                        ? "bg-[#1769FF] text-white"
                        : link.type === "dribbble"
                          ? "bg-[#EA4C89] text-white"
                          : "bg-white";
                    return (
                      <a
                        key={link.type}
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? "noopener noreferrer" : undefined}
                        className={`flex items-center justify-center p-3 border-2 border-black hover:bg-black hover:text-white transition-colors font-bold text-xs uppercase gap-2 ${isBranded ? brandBg : "bg-white"}`}
                      >
                        {link.type === "phone" && <Phone className="w-3 h-3" aria-hidden="true" />}
                        {link.label}
                      </a>
                    );
                  })}
              </div>
              <div className="mt-4 pt-4 border-t-2 border-black">
                <ShareBar
                  handle={profile.handle}
                  title={`${content.full_name}'s Portfolio`}
                  name={content.full_name}
                  variant="neo-brutalist"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Skills Marquee */}
        {flatSkills.length > 0 && (
          <div className="bg-[#FFDE00] border-2 md:border-4 border-black py-4 overflow-hidden whitespace-nowrap shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-1 my-12">
            <div className="inline-block motion-safe:animate-[marquee_20s_linear_infinite] font-black text-2xl md:text-4xl uppercase">
              {flatSkills.map((skill: string, i: number) => (
                <span key={i} className="mx-6 inline-flex items-center">
                  {skill} <Star className="w-6 h-6 ml-6 fill-black" aria-hidden="true" />
                </span>
              ))}
              {flatSkills.map((skill: string, i: number) => (
                <span key={`dup-${i}`} className="mx-6 inline-flex items-center">
                  {skill} <Star className="w-6 h-6 ml-6 fill-black" aria-hidden="true" />
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Experience Section */}
        {content.experience && content.experience.length > 0 && (
          <section id="experience" className="space-y-6 mb-16" aria-label="Work experience">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-1 bg-black flex-1" />
              <h2 className="text-4xl font-black uppercase bg-white border-2 md:border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform rotate-1">
                Experience
              </h2>
              <div className="h-1 bg-black flex-1" />
            </div>

            <div className="grid grid-cols-1 gap-8">
              {content.experience.map((job, _idx: number) => {
                const limitedHighlights = job.highlights?.slice(0, 3) ?? [];
                return (
                  <div
                    key={_idx}
                    className="group bg-white border-2 md:border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-[transform,box-shadow] duration-200"
                  >
                    <div className="border-b-2 md:border-b-4 border-black p-3 flex justify-between items-center bg-neutral-100">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full border-2 border-black bg-red-400" />
                        <div className="w-3 h-3 rounded-full border-2 border-black bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full border-2 border-black bg-green-400" />
                      </div>
                      <span className="font-bold text-xs uppercase">
                        {formatDateRange(job.start_date, job.end_date)}
                      </span>
                    </div>

                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-3xl font-black uppercase mb-1">{job.title}</h3>
                          <p className="font-bold text-lg text-neutral-600">{job.company}</p>
                        </div>
                        <Briefcase
                          className="w-8 h-8 border-2 border-black p-1 bg-white"
                          aria-hidden="true"
                        />
                      </div>
                      {job.description && job.description.trim() !== "" ? (
                        <p className="font-medium text-sm mb-4 border-l-2 border-black pl-3">
                          {job.description}
                        </p>
                      ) : limitedHighlights.length > 0 ? (
                        <ul className="font-medium text-sm mb-4 border-l-2 md:border-l-4 border-black pl-5 space-y-2 list-disc">
                          {limitedHighlights.map((highlight: string, i: number) => (
                            <li key={i} className="font-bold">
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {job.description &&
                        job.description.trim() !== "" &&
                        limitedHighlights.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {limitedHighlights.map((highlight: string, i: number) => (
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
                );
              })}
            </div>
          </section>
        )}

        {/* Projects Grid */}
        {content.projects && content.projects.length > 0 && (
          <section id="work" className="space-y-6" aria-label="Selected projects">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-1 bg-black flex-1" />
              <h2 className="text-4xl font-black uppercase bg-white border-2 md:border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform rotate-1">
                Selected Projects
              </h2>
              <div className="h-1 bg-black flex-1" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {content.projects.map((project: Project, _idx: number) => (
                <div
                  key={_idx}
                  className="group bg-white border-2 md:border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-[transform,box-shadow] duration-200 flex flex-col"
                >
                  <div className="border-b-2 md:border-b-4 border-black p-3 flex justify-between items-center bg-neutral-100">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full border-2 border-black bg-red-400" />
                      <div className="w-3 h-3 rounded-full border-2 border-black bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full border-2 border-black bg-green-400" />
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
                        <ArrowUpRight
                          className="w-8 h-8 border-2 border-black p-1 bg-white hover:bg-black hover:text-white transition-colors"
                          aria-hidden="true"
                        />
                      )}
                    </h3>
                    {project.description && (
                      <p className="font-medium text-sm mb-6 border-l-2 border-black pl-3">
                        {project.description}
                      </p>
                    )}
                    {project.technologies && project.technologies.length > 0 && (
                      <div className="mt-auto flex flex-wrap gap-2">
                        {project.technologies.map((tech: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-[#FF90E8] border-2 border-black text-xs font-bold uppercase"
                          >
                            {tech}
                          </span>
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
          <section id="education" className="space-y-6 my-16" aria-label="Education">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-1 bg-black flex-1" />
              <h2 className="text-4xl font-black uppercase bg-white border-2 md:border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-1">
                Education
              </h2>
              <div className="h-1 bg-black flex-1" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {content.education.map((edu, index) => (
                <div
                  key={index}
                  className="bg-white border-2 md:border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <GraduationCap
                      className="w-8 h-8 border-2 border-black p-1 bg-[#FFDE00]"
                      aria-hidden="true"
                    />
                    {edu.graduation_date && (
                      <span className="font-bold text-xs uppercase">
                        {formatYear(edu.graduation_date)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-black uppercase mb-2">{edu.degree}</h3>
                  <p className="font-bold text-sm">{edu.institution}</p>
                  {edu.gpa && (
                    <p className="text-xs font-bold mt-2 bg-green-300 border-2 border-black inline-block px-2 py-1">
                      GPA: {edu.gpa}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certifications Section */}
        {content.certifications && content.certifications.length > 0 && (
          <section className="space-y-6 my-16" aria-label="Certifications">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-1 bg-black flex-1" />
              <h2 className="text-4xl font-black uppercase bg-white border-2 md:border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                Certifications
              </h2>
              <div className="h-1 bg-black flex-1" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.certifications.map((cert, index) => (
                <div
                  key={index}
                  className="bg-white border-2 md:border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-[transform,box-shadow]"
                >
                  <div className="flex items-start gap-3">
                    <Award
                      className="w-6 h-6 border-2 border-black p-1 bg-[#FF90E8]"
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <h3 className="font-black text-lg uppercase">{cert.name}</h3>
                      <p className="font-bold text-sm text-neutral-600">{cert.issuer}</p>
                      {cert.date && (
                        <p className="text-xs font-bold mt-1">{formatShortDate(cert.date)}</p>
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
          </section>
        )}
      </main>

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
