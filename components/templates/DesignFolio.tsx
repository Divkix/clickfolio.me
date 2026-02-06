import { MapPin, Phone } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { type ContactLinkType, getContactLinks } from "@/lib/templates/contact-links";
import { formatDateRange } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const dfIconMap: Partial<Record<ContactLinkType, React.ReactNode>> = {
  phone: <Phone size={18} />,
  location: <MapPin size={18} />,
};

const DesignFolio: React.FC<TemplateProps> = ({ content, profile }) => {
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

  // Null-safe name parsing
  const nameParts = (full_name || "Unknown").split(" ");
  const firstName = nameParts[0] || "Unknown";
  const lastName = nameParts.slice(1).join(" ");
  const initials = nameParts.map((n) => n[0]).join("");

  // Helper to create the irregular grid rhythm
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
      {/* Font preloading */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap"
        rel="stylesheet"
      />

      <div className="min-h-screen bg-[#0f0f0f] text-[#e0e0e0] selection:bg-[#CCFF00] selection:text-black w-full overflow-x-hidden relative">
        {/* Custom font classes */}
        <style>{`
          .font-serif-df { font-family: 'Playfair Display', serif; }
          .font-mono-df { font-family: 'Space Mono', monospace; }
          .outline-text-df {
            -webkit-text-stroke: 1px #e0e0e0;
            color: transparent;
          }
        `}</style>

        {/* Navigation */}
        <nav className="flex justify-between items-center p-8 md:p-12 fixed top-0 w-full z-50 mix-blend-difference">
          <div className="text-xl font-bold tracking-tighter font-mono-df">{initials}.</div>
          <div className="text-xs border border-[#CCFF00] px-4 py-1 rounded-full text-[#CCFF00] uppercase tracking-widest">
            ● {headline?.split(" ")[0] || "Available"}
          </div>
        </nav>

        <main className="pt-32 px-5 md:px-12 pb-20">
          {/* Hero */}
          <header className="min-h-[70vh] flex flex-col justify-center relative mb-24">
            <h1 className="font-serif-df text-[clamp(3rem,8vw,7rem)] leading-[0.9] mb-8">
              <span className="outline-text-df block">Hello, I'm</span>
              <span className="text-white block">{firstName}</span>
              {lastName && <span className="italic text-[#CCFF00] block">{lastName}</span>}
            </h1>

            <div className="max-w-2xl mt-8 border-l-2 border-[#333] pl-6 ml-2">
              <p className="font-mono-df text-[#888] text-lg md:text-xl leading-relaxed">
                {headline}. {summary}
              </p>
            </div>

            <div
              className="absolute bottom-0 right-0 animate-bounce text-[#CCFF00] hidden md:block"
              style={{ writingMode: "vertical-rl" }}
            >
              Scroll to Explore
            </div>
          </header>

          {/* Experience */}
          {experience && experience.length > 0 && (
            <section className="mb-32">
              <div className="flex items-end gap-4 mb-12 border-b border-[#333] pb-4">
                <h2 className="font-serif-df text-4xl md:text-5xl">Experience</h2>
                <span className="font-mono-df text-[#888] mb-2">/ Chronology</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {experience.map((job, index) => (
                  <div
                    key={index}
                    className={`bg-[#1a1a1a] border border-[#333] p-8 flex flex-col justify-between transition-all duration-300 hover:border-[#CCFF00] hover:-translate-y-1 ${getSpanClass(index)}`}
                  >
                    <div className="mb-8">
                      <span className="text-[#CCFF00] text-xs font-bold tracking-widest uppercase border border-[#CCFF00]/30 px-2 py-1 rounded inline-block mb-4">
                        {formatDateRange(job.start_date, job.end_date)}
                      </span>
                      <h3 className="font-serif-df text-3xl text-white mb-2 leading-tight">
                        {job.title}
                      </h3>
                      <div className="font-mono-df text-[#888] uppercase tracking-wide text-sm">
                        @ {job.company}
                      </div>
                    </div>

                    <p className="font-mono-df text-[#ccc] text-sm leading-relaxed line-clamp-4">
                      {job.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Skills */}
          {skills && skills.length > 0 && (
            <section className="mb-32 border-t border-[#333] pt-20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                  <span className="text-[#CCFF00] block mb-4 font-mono-df">Capabilities</span>
                  <h2 className="font-serif-df text-5xl md:text-6xl mb-6">
                    Technical <br /> <span className="italic text-[#888]">Arsenal</span>
                  </h2>
                </div>

                <div className="space-y-8">
                  {skills.map((skillGroup, index) => (
                    <div key={index} className="border-b border-[#333] pb-6">
                      <h4 className="font-mono-df text-[#888] text-xs uppercase mb-3 tracking-widest">
                        {skillGroup.category}
                      </h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {skillGroup.items.map((item, i) => (
                          <span
                            key={i}
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

          {/* Projects */}
          {projects && projects.length > 0 && (
            <section className="mb-32">
              <div className="flex items-end gap-4 mb-12 border-b border-[#333] pb-4">
                <h2 className="font-serif-df text-4xl md:text-5xl">Projects</h2>
                <span className="font-mono-df text-[#888] mb-2">/ Selected Works</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.map((project, index) => (
                  <a
                    key={index}
                    href={project.url || "#"}
                    target={project.url ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className={`group block bg-[#1a1a1a] border border-[#333] overflow-hidden hover:border-[#CCFF00] transition-all duration-300 ${!project.url ? "pointer-events-none" : ""}`}
                  >
                    {project.image_url && (
                      <div className="relative overflow-hidden">
                        <img
                          src={project.image_url}
                          alt={project.title}
                          className="w-full aspect-video object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-[#1a1a1a] to-transparent opacity-60" />
                      </div>
                    )}
                    <div className="p-8 md:p-12">
                      <div className="flex flex-wrap gap-2 mb-6">
                        {project.technologies?.map((tech, t) => (
                          <span
                            key={t}
                            className="text-[10px] uppercase border border-[#444] text-[#888] px-2 py-1 rounded-full group-hover:border-[#CCFF00] group-hover:text-[#CCFF00] transition-colors"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                      <h3 className="font-serif-df text-3xl text-white mb-4 group-hover:text-[#CCFF00] transition-colors flex items-center gap-2">
                        {project.title}
                        {project.url && (
                          <span className="text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            ↗
                          </span>
                        )}
                      </h3>
                      <p className="font-mono-df text-[#888] text-sm leading-relaxed">
                        {project.description}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Education & Certifications */}
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
                      <li key={index} className="group">
                        <span className="block text-[#CCFF00] text-xs mb-1 font-mono-df">
                          {edu.graduation_date}
                        </span>
                        <div className="text-xl text-white group-hover:translate-x-2 transition-transform duration-300">
                          {edu.degree}
                        </div>
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
                      <li key={index} className="group">
                        <span className="block text-[#CCFF00] text-xs mb-1 font-mono-df">
                          {cert.date}
                        </span>
                        <div className="text-xl text-white group-hover:translate-x-2 transition-transform duration-300">
                          {cert.name}
                        </div>
                        <div className="text-[#888]">{cert.issuer}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Footer */}
          <footer className="border-t border-[#333] pt-20 pb-12">
            <h2 className="font-serif-df text-[clamp(2rem,5vw,4rem)] mb-12 leading-tight">
              Let's build something <br />
              <span className="text-[#CCFF00] italic">remarkable.</span>
            </h2>

            <div className="flex flex-col md:flex-row gap-8 md:gap-16 font-mono-df text-lg">
              {contactLinks.map((link) => {
                const icon = dfIconMap[link.type];
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
                        ? `transition-colors flex items-center gap-2 hover:text-[${brandColor}]`
                        : "text-[#888] hover:text-[#CCFF00] transition-colors flex items-center gap-2"
                    }
                    style={isBranded ? { color: brandColor } : undefined}
                  >
                    {icon}
                    {isBranded ? <span className="font-bold">{brandText}</span> : link.label}
                  </a>
                );
              })}
            </div>

            <div className="mt-20 text-[#444] text-xs font-mono-df flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <span>
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

export default DesignFolio;
