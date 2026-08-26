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
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

export const NeoBrutalist: React.FC<TemplateProps> = ({ content, profile }) => {
  const projectsHook =
    content.projects && content.projects.length > 0
      ? `${content.projects[0]?.title ?? "Featured projects"}${
          content.projects.length > 1 ? ` + ${content.projects.length - 1} more` : ""
        }`
      : null;

  const flatSkills = content.skills ? flattenSkills(content.skills) : [];
  const contactLinks = getContactLinks(content.contact);

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap" />
      <div className="min-h-screen bg-[#FFFDF5] text-black font-mono p-4 md:p-6 overflow-x-hidden selection:bg-[#FF90E8] selection:text-black">
        <main className="max-w-6xl mx-auto space-y-8 pb-12">
          <nav
            className="flex justify-between items-center gap-3 bg-white border-2 md:border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            aria-label="Main navigation"
          >
            <div className="font-heading-nb font-black text-xl uppercase tracking-tighter flex items-center gap-2 min-w-0">
              <div
                className="w-6 h-6 bg-[#FFDE00] border-2 border-black rounded-full shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">{content.full_name}</span>
            </div>
            <div className="hidden md:flex gap-2 font-bold text-sm uppercase shrink-0">
              {content.experience && content.experience.length > 0 && (
                <a
                  href="#experience"
                  className="hover:bg-[#FF90E8] px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                >
                  Experience
                </a>
              )}
              {content.projects && content.projects.length > 0 && (
                <a
                  href="#work"
                  className="hover:bg-[#22CCEE] px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                >
                  Work
                </a>
              )}
              {content.education && content.education.length > 0 && (
                <a
                  href="#education"
                  className="hover:bg-[#FFDE00] px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                >
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

          <header className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 bg-[#FF90E8] border-2 md:border-4 border-black p-8 md:p-16 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
              <div
                className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none"
                aria-hidden="true"
              >
                <Globe size={200} strokeWidth={1.5} />
              </div>
              <h1 className="font-heading-nb text-4xl sm:text-6xl md:text-7xl font-black uppercase leading-[0.9] tracking-tighter relative z-10 [text-wrap:unset] break-words">
                {content.full_name}
              </h1>
              {content.headline && (
                <p className="mt-5 font-heading-nb text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight relative z-10 [text-wrap:unset] break-words">
                  {content.headline}
                </p>
              )}
              {projectsHook && (
                <a
                  href="#work"
                  className="mt-6 inline-block bg-black text-white border-2 md:border-4 border-black px-4 py-2 text-sm md:text-base font-black uppercase tracking-tight shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                >
                  See {projectsHook}
                </a>
              )}
              {content.summary && (
                <p className="mt-8 font-bold text-lg md:text-xl max-w-lg border-l-2 md:border-l-4 border-black pl-6 relative z-10">
                  {content.summary}
                </p>
              )}
            </div>

            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-[#22CCEE] border-2 md:border-4 border-black p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col justify-center items-center text-center">
                <div className="w-24 h-24 bg-white border-2 md:border-4 border-black rounded-full mb-4 overflow-hidden flex items-center justify-center">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={`Portrait of ${content.full_name}`}
                      width={96}
                      height={96}
                      fetchPriority="high"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-black">{getInitials(content.full_name)}</span>
                  )}
                </div>
                <h2 className="font-heading-nb font-black text-2xl uppercase [text-wrap:unset] break-words">
                  {content.full_name}
                </h2>
                <div className="mt-2 inline-block bg-[#7CFF6B] border-2 border-black px-3 py-1 text-xs font-bold uppercase rounded-full">
                  Open for Work
                </div>
              </div>

              <div className="bg-white border-2 md:border-4 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-heading-nb font-black text-lg uppercase mb-4 underline decoration-4 decoration-[#FFDE00]">
                  Connect
                </h3>
                {content.contact.location && (
                  <div className="flex items-center gap-2 mb-3 font-bold text-sm">
                    <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 break-words">{content.contact.location}</span>
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
                          className={`flex items-center justify-center p-3 border-2 border-black hover:bg-black hover:text-white transition-colors font-bold text-xs uppercase gap-2 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black ${isBranded ? brandBg : "bg-white"}`}
                        >
                          {link.type === "phone" && (
                            <Phone className="w-3 h-3 shrink-0" aria-hidden="true" />
                          )}
                          <span className="truncate">{link.label}</span>
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

          {flatSkills.length > 0 && (
            <div className="bg-[#FFDE00] border-2 md:border-4 border-black py-4 overflow-hidden whitespace-nowrap shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-1 my-12 max-w-full">
              <div className="inline-block motion-safe:animate-[marquee_20s_linear_infinite] font-black text-2xl md:text-4xl uppercase">
                {flatSkills.map((skill: string, i: number) => (
                  <span key={`skill-${skill}-${i}`} className="mx-6 inline-flex items-center">
                    {skill} <Star className="w-6 h-6 ml-6 fill-black" aria-hidden="true" />
                  </span>
                ))}
                {flatSkills.map((skill: string, i: number) => (
                  <span key={`dup-skill-${skill}-${i}`} className="mx-6 inline-flex items-center">
                    {skill} <Star className="w-6 h-6 ml-6 fill-black" aria-hidden="true" />
                  </span>
                ))}
              </div>
            </div>
          )}

          {content.experience && content.experience.length > 0 && (
            <section id="experience" className="space-y-6 mb-16" aria-label="Work experience">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-1 bg-black flex-1" />
                <h2 className="font-heading-nb text-3xl md:text-4xl font-black uppercase bg-white border-2 md:border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform rotate-1 cursor-default shrink-0">
                  Experience
                </h2>
                <div className="h-1 bg-black flex-1" />
              </div>

              <div className="grid grid-cols-1 gap-8">
                {content.experience.map((job, idx) => {
                  const limitedHighlights = job.highlights?.slice(0, 4) ?? [];
                  return (
                    <article
                      key={`${job.title}-${idx}`}
                      className="group nb-sticker-peel bg-white border-2 md:border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-[transform,box-shadow] duration-200"
                    >
                      <div className="border-b-2 md:border-b-4 border-black p-3 flex justify-between items-center gap-3 bg-neutral-100">
                        <div className="flex gap-2 shrink-0" aria-hidden="true">
                          <div className="w-3 h-3 rounded-full border-2 border-black bg-red-400" />
                          <div className="w-3 h-3 rounded-full border-2 border-black bg-yellow-400" />
                          <div className="w-3 h-3 rounded-full border-2 border-black bg-green-400" />
                        </div>
                        <span className="font-bold text-xs uppercase truncate min-w-0">
                          {formatDateRange(job.start_date, job.end_date)}
                        </span>
                      </div>

                      <div className="p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-heading-nb text-2xl md:text-3xl font-black uppercase mb-1 [text-wrap:unset] break-words">
                              {job.title}
                            </h3>
                            <p className="font-bold text-lg text-neutral-600 break-words">
                              {job.company}
                            </p>
                          </div>
                          <Briefcase
                            className="w-8 h-8 border-2 border-black p-1 bg-white shrink-0"
                            aria-hidden="true"
                          />
                        </div>
                        {job.description && job.description.trim() !== "" && (
                          <p className="font-medium text-sm mb-4 border-l-2 border-black pl-3">
                            {job.description}
                          </p>
                        )}
                        {limitedHighlights.length > 0 && (
                          <ul className="font-medium text-sm space-y-2 list-disc pl-5">
                            {limitedHighlights.map((highlight: string, i: number) => (
                              <li key={`${job.title}-${highlight}-${i}`} className="font-bold">
                                {highlight}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {content.projects && content.projects.length > 0 && (
            <section id="work" className="space-y-6" aria-label="Selected projects">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-1 bg-black flex-1" />
                <h2 className="font-heading-nb text-3xl md:text-4xl font-black uppercase bg-white border-2 md:border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform rotate-1 cursor-default shrink-0">
                  Selected Projects
                </h2>
                <div className="h-1 bg-black flex-1" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {content.projects.map((project: Project, idx: number) => (
                  <article
                    key={`${project.title}-${idx}`}
                    className="group nb-sticker-peel bg-white border-2 md:border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-[transform,box-shadow] duration-200 flex flex-col min-w-0"
                  >
                    <div className="border-b-2 md:border-b-4 border-black p-3 flex justify-between items-center bg-neutral-100">
                      <div className="flex gap-2" aria-hidden="true">
                        <div className="w-3 h-3 rounded-full border-2 border-black bg-red-400" />
                        <div className="w-3 h-3 rounded-full border-2 border-black bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full border-2 border-black bg-green-400" />
                      </div>
                      {project.url && (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-xs uppercase hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                        >
                          View →
                        </a>
                      )}
                    </div>

                    <div className="p-6 flex-1 flex flex-col min-w-0">
                      <h3 className="font-heading-nb text-2xl md:text-3xl font-black uppercase mb-2 flex items-start justify-between gap-3 [text-wrap:unset] break-words">
                        <span className="min-w-0">{project.title}</span>
                        {project.url && (
                          <ArrowUpRight
                            className="w-8 h-8 border-2 border-black p-1 bg-white group-hover:bg-black group-hover:text-white transition-colors shrink-0"
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
                              key={`${project.title}-${tech}-${i}`}
                              className="px-2 py-1 bg-[#FF90E8] border-2 border-black text-xs font-bold uppercase"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {content.education && content.education.length > 0 && (
            <section id="education" className="space-y-6 my-16" aria-label="Education">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-1 bg-black flex-1" />
                <h2 className="font-heading-nb text-3xl md:text-4xl font-black uppercase bg-white border-2 md:border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-1 cursor-default shrink-0">
                  Education
                </h2>
                <div className="h-1 bg-black flex-1" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {content.education.map((edu, index) => (
                  <article
                    key={`${edu.institution}-${index}`}
                    className="bg-white border-2 md:border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] min-w-0"
                  >
                    <div className="flex justify-between items-start mb-3 gap-3">
                      <GraduationCap
                        className="w-8 h-8 border-2 border-black p-1 bg-[#7B61FF] text-white shrink-0"
                        aria-hidden="true"
                      />
                      {edu.graduation_date && (
                        <span className="font-bold text-xs uppercase">
                          {formatYear(edu.graduation_date)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading-nb text-2xl font-black uppercase mb-2 [text-wrap:unset] break-words">
                      {edu.degree}
                    </h3>
                    <p className="font-bold text-sm break-words">{edu.institution}</p>
                    {edu.gpa && (
                      <p className="text-xs font-bold mt-2 bg-green-300 border-2 border-black inline-block px-2 py-1">
                        GPA: {edu.gpa}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {content.certifications && content.certifications.length > 0 && (
            <section className="space-y-6 my-16" aria-label="Certifications">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-1 bg-black flex-1" />
                <h2 className="font-heading-nb text-3xl md:text-4xl font-black uppercase bg-white border-2 md:border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-default shrink-0">
                  Certifications
                </h2>
                <div className="h-1 bg-black flex-1" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {content.certifications.map((cert, index) => (
                  <article
                    key={`${cert.name}-${index}`}
                    className="bg-white border-2 md:border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-w-0"
                  >
                    <div className="flex items-start gap-3">
                      <Award
                        className="w-6 h-6 border-2 border-black p-1 bg-[#7B61FF] text-white shrink-0"
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-heading-nb font-black text-lg uppercase [text-wrap:unset] break-words">
                          {cert.name}
                        </h3>
                        <p className="font-bold text-sm text-neutral-600">{cert.issuer}</p>
                        {cert.date && (
                          <p className="text-xs font-bold mt-1">{formatShortDate(cert.date)}</p>
                        )}
                        {cert.url && (
                          <a
                            href={cert.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold underline mt-1 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                          >
                            View →
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>

        <footer className="max-w-6xl mx-auto">
          <div className="bg-white border-2 md:border-4 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="font-bold text-sm uppercase" suppressHydrationWarning>
              © {new Date().getFullYear()} {content.full_name}
            </p>
            <p className="text-xs font-bold uppercase text-neutral-500">Built loud on purpose</p>
          </div>
        </footer>

        <style>{`
        .font-heading-nb { font-family: 'Archivo Black', sans-serif; }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .nb-sticker-peel:hover {
            transform: perspective(600px) rotateY(-2deg) rotateX(1deg);
          }
        }
      `}</style>
      </div>
    </>
  );
};
