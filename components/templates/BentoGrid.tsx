import { ArrowUpRight, Award, Briefcase, Code, GraduationCap, Layers, MapPin } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

function FeaturedWork({
  project,
}: {
  project: NonNullable<TemplateProps["content"]["projects"]>[number];
}) {
  const Wrapper = project.url ? "a" : "article";
  return (
    <Wrapper
      {...(project.url
        ? {
            href: project.url,
            target: "_blank" as const,
            rel: "noopener noreferrer",
          }
        : {})}
      className="col-span-1 sm:col-span-2 min-h-[240px] bg-[#2D2926] rounded-[28px] overflow-hidden border border-[#3D3530] group relative shadow-2xl min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <div
        className="absolute inset-0 opacity-30 group-hover:opacity-45 transition-opacity duration-500"
        style={{
          background:
            "radial-gradient(circle at 20% 30%, rgba(196,112,79,0.7) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(236,72,153,0.45) 0%, transparent 50%)",
        }}
        aria-hidden="true"
      />
      <div className="relative h-full p-7 md:p-8 flex flex-col justify-end text-white z-10">
        <span className="self-start text-[10px] font-bold uppercase tracking-widest bg-white/10 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-white/90 mb-3">
          Featured Work
        </span>
        <div className="flex justify-between items-end gap-4">
          <div className="min-w-0">
            <h3 className="font-heading-bg text-2xl md:text-3xl font-bold mb-2 tracking-tight break-words [text-wrap:unset]">
              {project.title}
            </h3>
            {project.description && (
              <p className="text-gray-300 text-sm leading-relaxed">{project.description}</p>
            )}
            {project.technologies && project.technologies.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {project.technologies.slice(0, 4).map((tech, idx) => (
                  <span
                    key={`${tech}-${idx}`}
                    className="text-[10px] font-medium bg-white/10 border border-white/5 px-2.5 py-1 rounded-full text-gray-200"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}
          </div>
          {project.url && (
            <div className="bg-white text-black w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-lg">
              <ArrowUpRight size={18} strokeWidth={2.5} aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

function ContactPills({ links }: { links: ReturnType<typeof getContactLinks> }) {
  const items = links.filter((link) => link.type !== "location");
  return (
    <nav aria-label="Contact links" className="flex gap-2 flex-wrap">
      {items.map((link) => {
        const isBranded = link.type === "behance" || link.type === "dribbble";
        const brandColor =
          link.type === "behance" ? "#1769FF" : link.type === "dribbble" ? "#EA4C89" : undefined;
        const brandText = link.type === "behance" ? "Be" : link.type === "dribbble" ? "Dr" : null;

        return (
          <a
            key={link.type}
            href={link.href}
            target={link.isExternal ? "_blank" : undefined}
            rel={link.isExternal ? "noopener noreferrer" : undefined}
            aria-label={link.label}
            className="p-2.5 bg-gray-50 rounded-full hover:bg-gray-100 border border-gray-100 hover:border-gray-200 transition-[color,background-color,border-color,transform] text-gray-500 hover:text-[#2D2926] hover:scale-105 flex items-center justify-center w-10 h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D2926]"
            style={isBranded ? { color: brandColor } : undefined}
          >
            {isBranded ? (
              <span className="text-xs font-bold">{brandText}</span>
            ) : (
              getContactIcon(link.type, { size: 18, strokeWidth: 1.5 })
            )}
          </a>
        );
      })}
    </nav>
  );
}

export const BentoGrid: React.FC<TemplateProps> = ({ content, profile }) => {
  const skills = flattenSkills(content.skills);
  const contactLinks = getContactLinks(content.contact);
  const extraProjects = content.projects?.slice(1) ?? [];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap" />
      <style>{`.font-heading-bg { font-family: 'Sora', sans-serif; }`}</style>

      <main className="min-h-screen bg-[#FAF8F5] text-[#2D2926] font-sans antialiased selection:bg-coral/30 p-4 md:p-8">
        <div
          className="fixed inset-0 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none z-0"
          aria-hidden="true"
        />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-auto gap-4">
            <div className="col-span-1 sm:col-span-2 lg:row-span-2 bg-white rounded-[28px] p-7 md:p-8 shadow-lg border border-gray-200/80 flex flex-col justify-between group hover:shadow-xl hover:shadow-gray-200/50 transition-shadow duration-300 relative overflow-hidden min-w-0">
              <div
                className="absolute top-0 right-0 w-56 h-56 bg-linear-to-br from-coral/15 to-amber-100/40 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none opacity-70 group-hover:scale-110 transition-transform duration-700"
                aria-hidden="true"
              />

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-[#2D2926] shadow-xl flex items-center justify-center text-white font-medium text-2xl md:text-3xl shrink-0">
                    {getInitials(content.full_name)}
                  </div>
                  <div className="hidden sm:block">
                    <ContactPills links={contactLinks} />
                  </div>
                </div>

                <h1 className="font-heading-bg text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#2D2926] mb-2 break-words [text-wrap:unset]">
                  {content.full_name}
                </h1>
                {content.headline && (
                  <p className="text-base sm:text-lg text-gray-500 font-medium tracking-tight mb-1">
                    {content.headline}
                  </p>
                )}
                {content.contact?.location && (
                  <div className="flex items-center gap-1.5 text-gray-400 text-sm font-medium mt-1">
                    <MapPin size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{content.contact.location}</span>
                  </div>
                )}
              </div>

              <div className="relative z-10 mt-6">
                {content.summary && (
                  <p className="text-gray-600 leading-relaxed max-w-lg mb-6 text-sm sm:text-base">
                    {content.summary}
                  </p>
                )}

                <div className="sm:hidden mb-4">
                  <ContactPills links={contactLinks} />
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

            <div className="col-span-1 bg-[#F1F9F3] rounded-[28px] p-6 shadow-sm flex flex-col justify-between border border-[#E2F0E5] min-h-[160px] min-w-0">
              <div className="flex justify-between items-start">
                <div className="relative flex h-3 w-3">
                  <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-700/70 mb-1">
                  Status
                </p>
                <p className="font-heading-bg text-lg font-semibold text-green-900 tracking-tight leading-tight">
                  Open to opportunities
                </p>
              </div>
            </div>

            {skills.length > 0 && (
              <div className="col-span-1 lg:row-span-2 bg-white rounded-[28px] p-6 shadow-md border border-gray-200/80 flex flex-col min-w-0 min-h-[200px]">
                <div className="flex items-center gap-2 mb-5 text-gray-400">
                  <div className="p-1.5 bg-gray-50 rounded-md">
                    <Layers size={16} strokeWidth={2} aria-hidden="true" />
                  </div>
                  <span className="font-heading-bg text-xs font-bold uppercase tracking-wider">
                    Stack
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 content-start">
                  {skills.map((skill: string, index: number) => (
                    <span
                      key={`${skill}-${index}`}
                      className="px-3 py-1.5 bg-gray-50 rounded-lg text-xs font-medium text-gray-700 border border-gray-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {content.experience?.map((job, index) => (
              <article
                key={`${job.company}-${job.title}-${index}`}
                className="col-span-1 sm:col-span-2 bg-white rounded-[28px] p-6 shadow-md flex flex-col border border-gray-200/80 min-w-0"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 shrink-0">
                    <Briefcase size={18} className="text-gray-600" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-mono text-gray-400 block mb-1">
                      {formatDateRange(job.start_date, job.end_date)}
                    </span>
                    <h3 className="font-heading-bg text-lg font-bold leading-tight text-[#2D2926] break-words [text-wrap:unset]">
                      {job.title}
                    </h3>
                    <p className="text-gray-500 font-medium text-sm">{job.company}</p>
                  </div>
                </div>
                {job.description && (
                  <p className="text-gray-500 text-sm leading-relaxed mb-3">{job.description}</p>
                )}
                {job.highlights && job.highlights.length > 0 && (
                  <ul className="text-sm text-gray-500 space-y-1.5 list-disc pl-4">
                    {job.highlights.slice(0, 3).map((highlight, i) => (
                      <li key={`${job.title}-${i}`}>{highlight}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}

            {content.education?.map((edu, index) => (
              <article
                key={`${edu.institution}-${index}`}
                className="col-span-1 bg-white rounded-[28px] p-6 shadow-sm border border-gray-200/80 flex flex-col justify-between min-h-[150px] min-w-0"
              >
                <div className="flex justify-between items-start gap-2">
                  <GraduationCap size={20} className="text-gray-300 shrink-0" aria-hidden="true" />
                  {edu.graduation_date && (
                    <span className="text-[10px] font-bold bg-gray-50 px-2 py-1 rounded-full text-gray-400 shrink-0">
                      {formatYear(edu.graduation_date)}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <h3 className="font-heading-bg text-sm font-bold leading-tight mb-1 break-words">
                    {edu.degree}
                  </h3>
                  <p className="text-gray-500 text-xs">{edu.institution}</p>
                </div>
              </article>
            ))}

            {content.projects && content.projects.length > 0 && (
              <FeaturedWork project={content.projects[0]} />
            )}

            {extraProjects.map((project, index) => {
              const Wrapper = project.url ? "a" : "article";
              return (
                <Wrapper
                  key={`${project.title}-${index}`}
                  {...(project.url
                    ? {
                        href: project.url,
                        target: "_blank" as const,
                        rel: "noopener noreferrer",
                      }
                    : {})}
                  className="col-span-1 bg-white rounded-[28px] p-6 shadow-md flex flex-col justify-between group border border-gray-200/80 hover:shadow-xl transition-shadow min-w-0 min-h-[180px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D2926]"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-gray-50 rounded-xl border border-gray-100">
                      <Code size={18} className="text-gray-700" aria-hidden="true" />
                    </div>
                    {project.url && (
                      <ArrowUpRight
                        size={18}
                        className="text-gray-400 group-hover:text-[#2D2926] transition-colors"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="mt-6">
                    {project.year && (
                      <p className="text-gray-400 font-mono text-xs mb-1">{project.year}</p>
                    )}
                    <h3 className="font-heading-bg text-lg font-bold leading-tight mb-2 tracking-tight text-[#2D2926] break-words">
                      {project.title}
                    </h3>
                    {project.description && (
                      <p className="text-gray-500 text-xs leading-relaxed">{project.description}</p>
                    )}
                  </div>
                </Wrapper>
              );
            })}

            {content.certifications && content.certifications.length > 0 && (
              <div className="col-span-1 sm:col-span-2 bg-white rounded-[28px] p-6 shadow-sm border border-gray-200/80 min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 bg-amber-50 rounded-full flex items-center justify-center">
                    <Award size={16} className="text-amber-600" aria-hidden="true" />
                  </div>
                  <h3 className="font-heading-bg text-sm font-bold uppercase tracking-wider text-gray-400">
                    Certifications
                  </h3>
                </div>
                <ul className="space-y-3">
                  {content.certifications.map((cert, index) => (
                    <li key={`${cert.name}-${index}`} className="min-w-0">
                      <p className="font-heading-bg text-sm font-bold text-[#2D2926] break-words">
                        {cert.name}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {cert.issuer}
                        {cert.date ? ` · ${formatYear(cert.date)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
};
