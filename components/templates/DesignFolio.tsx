import { MapPin, Phone } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { type ContactLinkType, getContactLinks } from "@/lib/templates/contact-links";
import { formatDateRange, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

const dfIconMap = {
  phone: <Phone size={18} aria-hidden="true" />,
  location: <MapPin size={18} aria-hidden="true" />,
} as const satisfies Partial<Record<ContactLinkType, React.ReactNode>>;

export const DesignFolio: React.FC<TemplateProps> = ({ content, profile, isPreview }) => {
  const {
    full_name,
    headline,
    summary,
    contact,
    experience,
    education,
    skills,
    projects,
    certifications,
  } = content;

  const contactLinks = getContactLinks(contact);

  const nameParts = (full_name || "Unknown").split(" ");
  const firstName = nameParts[0] || "Unknown";
  const lastName = nameParts.slice(1).join(" ");
  const initials = nameParts.map((n) => n[0]).join("");

  const getSpanClass = (index: number) => {
    const pattern = [
      "md:col-span-8",
      "md:col-span-4",
      "md:col-span-4",
      "md:col-span-8",
      "md:col-span-6",
      "md:col-span-6",
    ];
    return pattern[index % pattern.length];
  };

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" />

      <div className="min-h-screen bg-[#0f0f0f] text-[#e0e0e0] selection:bg-[#CCFF00] selection:text-black w-full overflow-x-hidden relative">
        <style>{`
          .font-serif-df { font-family: 'Playfair Display', serif; }
          .font-mono-df { font-family: 'Space Mono', monospace; }
        `}</style>

        {!isPreview && (
          <nav
            aria-label="Main navigation"
            className="flex justify-between items-center p-6 md:p-8 fixed top-0 w-full z-50 bg-[#0f0f0f]/85 backdrop-blur-md border-b border-[#2a2a2a]"
          >
            <div className="text-xl font-bold tracking-tighter font-mono-df text-white">
              {initials}.
            </div>
            <div className="text-xs border border-[#CCFF00] px-4 py-1 rounded-full text-[#CCFF00] uppercase tracking-widest">
              <span aria-hidden="true">● </span>
              Available
            </div>
          </nav>
        )}

        <main
          className={isPreview ? "pt-12 px-5 md:px-12 pb-20" : "pt-28 md:pt-32 px-5 md:px-12 pb-20"}
        >
          <header className="min-h-[62vh] flex flex-col justify-center relative mb-20 md:mb-28">
            <h1 className="font-serif-df text-[clamp(3rem,8vw,7rem)] leading-[0.9] mb-8 [text-wrap:unset]">
              <span className="text-[#555] block">Hello, I&apos;m</span>
              <span className="text-white block break-words">{firstName}</span>
              {lastName && (
                <span className="italic text-[#CCFF00] block break-words">{lastName}</span>
              )}
            </h1>

            <div className="max-w-2xl mt-8 border-l-2 border-[#333] pl-6 ml-2">
              <p className="font-mono-df text-[#888] text-lg md:text-xl leading-relaxed">
                {headline}
                {headline && summary ? ". " : ""}
                {summary}
              </p>
            </div>

            <p className="mt-16 font-mono-df text-xs uppercase tracking-[0.3em] text-[#555] hidden md:block">
              Scroll to explore ↓
            </p>
          </header>

          {experience && experience.length > 0 && (
            <section className="mb-32">
              <div className="flex items-end gap-4 mb-12 border-b border-[#333] pb-4">
                <h2 className="font-serif-df text-4xl md:text-5xl">Experience</h2>
                <span className="font-mono-df text-[#888] mb-2">/ Chronology</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {experience.map((job, index) => (
                  <article
                    key={`${job.title}-${index}`}
                    className={`bg-[#1a1a1a] border border-[#333] p-8 flex flex-col justify-between transition-[border-color] duration-300 hover:border-[#CCFF00] min-w-0 ${getSpanClass(index)}`}
                  >
                    <div className="mb-6">
                      <span className="text-[#CCFF00] text-xs font-bold tracking-widest uppercase border border-[#CCFF00]/30 px-2 py-1 rounded inline-block mb-4">
                        {formatDateRange(job.start_date, job.end_date)}
                      </span>
                      <h3 className="font-serif-df text-2xl md:text-3xl text-white mb-2 leading-tight [text-wrap:unset] break-words">
                        {job.title}
                      </h3>
                      <div className="font-mono-df text-[#888] uppercase tracking-wide text-sm">
                        @ {job.company}
                      </div>
                    </div>

                    {job.description && (
                      <p className="font-mono-df text-[#ccc] text-sm leading-relaxed mb-4">
                        {job.description}
                      </p>
                    )}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="font-mono-df text-[#aaa] text-sm space-y-2 list-disc pl-4">
                        {job.highlights.slice(0, 3).map((highlight, i) => (
                          <li key={`${job.title}-${i}`}>{highlight}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {skills && skills.length > 0 && (
            <section className="mb-32 border-t border-[#333] pt-20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                <div>
                  <span className="text-[#CCFF00] block mb-4 font-mono-df">Capabilities</span>
                  <h2 className="font-serif-df text-5xl md:text-6xl mb-6">
                    Technical <br /> <span className="italic text-[#888]">Arsenal</span>
                  </h2>
                </div>

                <div className="space-y-8">
                  {skills.map((skillGroup, index) => (
                    <div
                      key={`${skillGroup.category}-${index}`}
                      className="border-b border-[#333] pb-6"
                    >
                      <h4 className="font-mono-df text-[#888] text-xs uppercase mb-3 tracking-widest">
                        {skillGroup.category}
                      </h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {skillGroup.items.map((item, i) => (
                          <span
                            key={`${skillGroup.category}-${item}-${i}`}
                            className="text-lg md:text-xl text-[#e0e0e0] hover:text-[#CCFF00] transition-colors cursor-default"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section className="mb-32">
              <div className="flex items-end gap-4 mb-12 border-b border-[#333] pb-4">
                <h2 className="font-serif-df text-4xl md:text-5xl">Projects</h2>
                <span className="font-mono-df text-[#888] mb-2">/ Selected Works</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.map((project, index) => {
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
                      className="group block bg-[#1a1a1a] border border-[#333] overflow-hidden hover:border-[#CCFF00] transition-colors duration-300 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CCFF00]"
                    >
                      {project.image_url && (
                        <div className="relative overflow-hidden">
                          <img
                            src={project.image_url}
                            alt={project.title}
                            width={800}
                            height={450}
                            loading="lazy"
                            decoding="async"
                            className="w-full aspect-video object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-linear-to-t from-[#1a1a1a] to-transparent opacity-60" />
                        </div>
                      )}
                      <div className="p-8 md:p-10">
                        <div className="flex flex-wrap gap-2 mb-6">
                          {project.technologies?.map((tech, t) => (
                            <span
                              key={`${tech}-${t}`}
                              className="text-[10px] uppercase border border-[#555] text-[#a0a0a0] px-2 py-1 rounded-full group-hover:border-[#CCFF00] group-hover:text-[#CCFF00] transition-colors"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                        <h3 className="font-serif-df text-3xl text-white mb-4 group-hover:text-[#CCFF00] transition-colors flex items-center gap-2 [text-wrap:unset] break-words">
                          {project.title}
                          {project.url && (
                            <span
                              className="text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-hidden="true"
                            >
                              ↗
                            </span>
                          )}
                        </h3>
                        <p className="font-mono-df text-[#888] text-sm leading-relaxed">
                          {project.description}
                        </p>
                      </div>
                    </Wrapper>
                  );
                })}
              </div>
            </section>
          )}

          {((education && education.length > 0) ||
            (certifications && certifications.length > 0)) && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-32">
              {education && education.length > 0 && (
                <div>
                  <h3 className="font-serif-df text-2xl mb-8 border-b border-[#333] pb-4">
                    Education
                  </h3>
                  <ul className="space-y-6">
                    {education.map((edu, index) => (
                      <li key={`${edu.institution}-${index}`}>
                        <span className="block text-[#CCFF00] text-xs mb-1 font-mono-df">
                          {edu.graduation_date ? formatYear(edu.graduation_date) : ""}
                        </span>
                        <div className="text-xl text-white">{edu.degree}</div>
                        <div className="text-[#888]">{edu.institution}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {certifications && certifications.length > 0 && (
                <div>
                  <h3 className="font-serif-df text-2xl mb-8 border-b border-[#333] pb-4">
                    Certifications
                  </h3>
                  <ul className="space-y-6">
                    {certifications.map((cert, index) => (
                      <li key={`${cert.name}-${index}`}>
                        <span className="block text-[#CCFF00] text-xs mb-1 font-mono-df">
                          {cert.date ? formatShortDate(cert.date) : ""}
                        </span>
                        <div className="text-xl text-white">
                          {cert.url ? (
                            <a
                              href={cert.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#CCFF00] transition-colors"
                            >
                              {cert.name}
                            </a>
                          ) : (
                            cert.name
                          )}
                        </div>
                        <div className="text-[#888]">{cert.issuer}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <footer className="border-t border-[#333] pt-20 pb-12">
            <h2 className="font-serif-df text-[clamp(2rem,5vw,4rem)] mb-12 leading-tight">
              Let&apos;s build something <br />
              <span className="text-[#CCFF00] italic">remarkable.</span>
            </h2>

            <div className="flex flex-col md:flex-row flex-wrap gap-8 md:gap-16 font-mono-df text-lg">
              {contactLinks.map((link) => {
                // SAFETY: link.type is a ContactLinkType; dfIconMap covers phone/location
                // with undefined fallback for others.
                const icon = dfIconMap[link.type as keyof typeof dfIconMap];
                const isBranded = link.type === "behance" || link.type === "dribbble";
                const brandColor =
                  link.type === "behance"
                    ? "#1769FF"
                    : link.type === "dribbble"
                      ? "#EA4C89"
                      : undefined;
                const brandText =
                  link.type === "behance" ? "Bē" : link.type === "dribbble" ? "Dr" : null;

                if (link.type === "location") {
                  return (
                    <div key={link.type} className="text-[#888] flex items-center gap-2">
                      {icon}
                      {link.label}
                    </div>
                  );
                }

                return (
                  <a
                    key={link.type}
                    href={link.href}
                    target={link.isExternal ? "_blank" : undefined}
                    rel={link.isExternal ? "noreferrer" : undefined}
                    className={
                      isBranded
                        ? "transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CCFF00]"
                        : "text-[#888] hover:text-[#CCFF00] transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CCFF00]"
                    }
                    style={isBranded ? { color: brandColor } : undefined}
                  >
                    {icon}
                    {isBranded ? <span className="font-bold">{brandText}</span> : link.label}
                  </a>
                );
              })}
            </div>

            <div className="mt-20 text-[#666] text-xs font-mono-df flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <span suppressHydrationWarning>
                © {new Date().getFullYear()} {full_name}.
              </span>
              <ShareBar
                handle={profile.handle}
                title={`${full_name}'s Portfolio`}
                name={full_name}
                variant="design-folio"
              />
            </div>
          </footer>
        </main>
      </div>
    </>
  );
};
