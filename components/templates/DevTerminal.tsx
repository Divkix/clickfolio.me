import { Folder, GitBranch, Mail, MapPin, Phone } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateRange, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

function techDotColor(tech: string): string {
  const key = tech.toLowerCase();
  if (key.includes("typescript") || key === "ts") return "#3178c6";
  if (key.includes("javascript") || key === "js") return "#f1e05a";
  if (key.includes("python")) return "#3572A5";
  if (key.includes("go")) return "#00ADD8";
  if (key.includes("rust")) return "#dea584";
  if (key.includes("react")) return "#61dafb";
  if (key.includes("node")) return "#339933";
  if (key.includes("next")) return "#ffffff";
  if (key.includes("redis")) return "#dc382d";
  if (key.includes("vite")) return "#646cff";
  if (key.includes("cloudflare") || key.includes("worker")) return "#f38020";
  if (key.includes("websocket")) return "#8b949e";
  if (key.includes("timescale") || key.includes("postgres") || key.includes("sql")) {
    return "#336791";
  }
  return "#238636";
}

export const DevTerminal: React.FC<TemplateProps> = ({ content, profile }) => {
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

  const tabs: { id: string; label: string }[] = [
    { id: "readme", label: "README.md" },
    ...(skills && skills.length > 0 ? [{ id: "skills", label: "config.yml" }] : []),
    ...(experience && experience.length > 0 ? [{ id: "experience", label: "experience.log" }] : []),
    ...(projects && projects.length > 0 ? [{ id: "projects", label: "repos/" }] : []),
    ...(education && education.length > 0 ? [{ id: "education", label: "education/" }] : []),
    ...(certifications && certifications.length > 0
      ? [{ id: "certifications", label: "certs/" }]
      : []),
    { id: "contact", label: "contact.txt" },
  ];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" />

      <div className="term-root min-h-screen bg-[#0d1117] text-[#c9d1d9] selection:bg-[#388bfd] selection:text-white w-full overflow-x-hidden">
        <style>{`
          .font-mono-term { font-family: 'JetBrains Mono', monospace; }
          .font-sans-term { font-family: 'Inter', sans-serif; }
          .term-root:not(:has(:target)) a[href="#readme"],
          .term-root:has(#readme:target) a[href="#readme"],
          .term-root:has(#skills:target) a[href="#skills"],
          .term-root:has(#experience:target) a[href="#experience"],
          .term-root:has(#projects:target) a[href="#projects"],
          .term-root:has(#education:target) a[href="#education"],
          .term-root:has(#certifications:target) a[href="#certifications"],
          .term-root:has(#contact:target) a[href="#contact"] {
            color: #c9d1d9;
            background: #0d1117;
            border-top-color: #f78166;
          }
        `}</style>

        <nav
          aria-label="Main navigation"
          className="sticky top-0 z-50 bg-[#161b22] border-b border-[#30363d]"
        >
          <div className="max-w-5xl mx-auto flex items-center min-w-0">
            <div className="flex items-center overflow-x-auto no-scrollbar touch-pan-x min-w-0">
              {tabs.map((tab) => (
                <a
                  key={tab.id}
                  href={`#${tab.id}`}
                  className="px-4 py-3 font-mono-term text-xs whitespace-nowrap border-t-2 border-transparent text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#0d1117]/50 hover:border-[#58a6ff] transition-colors focus-visible:outline-none focus-visible:text-white"
                >
                  {tab.label}
                </a>
              ))}
            </div>
            <div className="ml-auto px-4 py-3 flex items-center gap-2 text-xs font-mono-term shrink-0">
              <span className="px-2 py-1 bg-[#238636] text-white rounded-md flex items-center gap-1">
                <GitBranch className="size-3" aria-hidden="true" />
                main
              </span>
            </div>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-4 py-8">
          <header
            id="readme"
            className="mb-12 scroll-mt-14 bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden"
          >
            <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d] flex items-center gap-2">
              <Folder className="size-4 text-[#8b949e]" aria-hidden="true" />
              <span className="font-mono-term text-sm text-[#c9d1d9]">README.md</span>
            </div>
            <div className="p-6">
              <h1 className="font-sans-term text-3xl md:text-4xl font-bold text-white mb-2 [text-wrap:unset] break-words">
                {full_name}
              </h1>
              {headline && <p className="text-[#58a6ff] font-mono-term text-lg mb-4">{headline}</p>}
              {summary && <p className="text-[#8b949e] leading-relaxed max-w-3xl">{summary}</p>}

              <div className="mt-6 flex flex-wrap gap-4 text-sm">
                {contactLinks.map((link) => {
                  if (link.type === "location") {
                    return (
                      <span key={link.type} className="flex items-center gap-1.5 text-[#8b949e]">
                        <MapPin className="size-4" aria-hidden="true" />
                        {link.label}
                      </span>
                    );
                  }
                  if (link.type === "email") {
                    return (
                      <a
                        key={link.type}
                        href={link.href}
                        className="flex items-center gap-1.5 text-[#58a6ff] hover:underline"
                      >
                        <Mail className="size-4" aria-hidden="true" />
                        {link.label}
                      </a>
                    );
                  }
                  if (link.type === "phone") {
                    return (
                      <a
                        key={link.type}
                        href={link.href}
                        className="flex items-center gap-1.5 text-[#58a6ff] hover:underline"
                      >
                        <Phone className="size-4" aria-hidden="true" />
                        {link.label}
                      </a>
                    );
                  }
                  return (
                    <a
                      key={link.type}
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "noreferrer" : undefined}
                      className="flex items-center gap-1.5 text-[#58a6ff] hover:underline"
                    >
                      {link.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </header>

          {skills && skills.length > 0 && (
            <section id="skills" className="mb-8 scroll-mt-14">
              <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
                <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d]">
                  <h2 className="font-mono-term text-sm text-[#c9d1d9] flex items-center gap-2">
                    <span className="text-[#238636]">#</span> System_Configuration
                  </h2>
                </div>
                <div className="p-4 font-mono-term text-xs md:text-sm">
                  {skills.map((skillGroup, index) => {
                    const echoText = `$ echo ${skillGroup.category.toUpperCase().replace(/\s+/g, "_")}`;
                    return (
                      <div key={`${skillGroup.category}-${index}`} className="mb-4 last:mb-0">
                        <div className="text-[#7ee787] mb-2 flex items-start">
                          <span className="text-[#484f58] select-none mr-4 text-right inline-block w-8 shrink-0">
                            {index + 1}
                          </span>
                          <span>{echoText}</span>
                        </div>
                        <div className="pl-12 flex flex-wrap gap-2">
                          {skillGroup.items.map((item, i) => (
                            <span
                              key={`${skillGroup.category}-${item}-${i}`}
                              className="px-2 py-1 bg-[#21262d] border border-[#30363d] rounded text-[#c9d1d9] hover:border-[#58a6ff] transition-colors"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {experience && experience.length > 0 && (
            <section id="experience" className="mb-8 scroll-mt-14">
              <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
                <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d]">
                  <h2 className="font-mono-term text-sm text-[#c9d1d9] flex items-center gap-2">
                    <span className="text-[#238636]">#</span> Log_History
                  </h2>
                </div>
                <div className="divide-y divide-[#21262d]">
                  {experience.map((job, index) => (
                    <article
                      key={`${job.title}-${index}`}
                      className="p-4 hover:bg-[#0d1117] transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <h3 className="font-sans-term font-semibold text-white">{job.title}</h3>
                          <p className="text-[#58a6ff] text-sm">@ {job.company}</p>
                        </div>
                        <span className="font-mono-term text-xs text-[#8b949e] bg-[#21262d] px-2 py-1 rounded self-start">
                          {formatDateRange(job.start_date, job.end_date)}
                        </span>
                      </div>
                      {job.description && (
                        <p className="text-[#8b949e] text-sm mb-2">{job.description}</p>
                      )}
                      {job.highlights && job.highlights.length > 0 && (
                        <ul className="space-y-1">
                          {job.highlights.map((highlight, i) => (
                            <li
                              key={`${job.title}-${highlight}-${i}`}
                              className="font-mono-term text-xs text-[#7ee787] flex items-start gap-2"
                            >
                              <span
                                className="text-[#7ee787] font-bold shrink-0"
                                aria-hidden="true"
                              >
                                +
                              </span>
                              <span className="min-w-0">{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section id="projects" className="mb-8 scroll-mt-14">
              <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
                <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d]">
                  <h2 className="font-mono-term text-sm text-[#c9d1d9] flex items-center gap-2">
                    <span className="text-[#238636]">#</span> Public_Repositories
                  </h2>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((project, index) => {
                    const href = project.url
                      ? project.url.startsWith("http")
                        ? project.url
                        : `https://${project.url}`
                      : undefined;
                    const Wrapper = href ? "a" : "article";
                    return (
                      <Wrapper
                        key={`${project.title}-${index}`}
                        {...(href
                          ? {
                              href,
                              target: "_blank" as const,
                              rel: "noopener noreferrer",
                            }
                          : {})}
                        className="block p-4 bg-[#0d1117] border border-[#30363d] rounded-md hover:border-[#58a6ff] transition-colors group min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]"
                      >
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <h3 className="font-sans-term font-semibold text-[#58a6ff] group-hover:underline [text-wrap:unset] break-words">
                            {project.title}
                          </h3>
                          {project.year && (
                            <span className="font-mono-term text-xs text-[#8b949e] shrink-0">
                              {project.year}
                            </span>
                          )}
                        </div>
                        <p className="text-[#8b949e] text-sm mb-3">{project.description}</p>
                        {project.technologies && project.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {project.technologies.map((tech, i) => (
                              <span
                                key={`${project.title}-${tech}-${i}`}
                                className="flex items-center gap-1 text-xs text-[#8b949e]"
                              >
                                <span
                                  className="size-3 rounded-full"
                                  style={{ backgroundColor: techDotColor(tech) }}
                                  aria-hidden="true"
                                />
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                      </Wrapper>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {education && education.length > 0 && (
              <section
                id="education"
                className="scroll-mt-14 bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden"
              >
                <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d]">
                  <h2 className="font-mono-term text-sm text-[#c9d1d9] flex items-center gap-2">
                    <span className="text-[#238636]">#</span> Education
                  </h2>
                </div>
                <div className="p-4 space-y-4">
                  {education.map((edu, index) => (
                    <div key={`${edu.institution}-${index}`}>
                      <h3 className="font-sans-term font-semibold text-white text-sm">
                        {edu.degree}
                      </h3>
                      <p className="text-[#58a6ff] text-sm">{edu.institution}</p>
                      <div className="flex items-center gap-2 text-xs text-[#8b949e] mt-1">
                        {edu.graduation_date && <span>{formatYear(edu.graduation_date)}</span>}
                        {edu.gpa && <span>• GPA: {edu.gpa}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {certifications && certifications.length > 0 && (
              <section
                id="certifications"
                className="scroll-mt-14 bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden"
              >
                <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d]">
                  <h2 className="font-mono-term text-sm text-[#c9d1d9] flex items-center gap-2">
                    <span className="text-[#238636]">#</span> Certifications
                  </h2>
                </div>
                <div className="p-4 space-y-4">
                  {certifications.map((cert, index) => (
                    <div key={`${cert.name}-${index}`}>
                      <h3 className="font-sans-term font-semibold text-[#F97583] text-sm">
                        {cert.url ? (
                          <a
                            href={cert.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {cert.name}
                          </a>
                        ) : (
                          cert.name
                        )}
                      </h3>
                      <p className="text-[#8b949e] text-sm">{cert.issuer}</p>
                      {cert.date && (
                        <span className="text-xs text-[#8b949e]">{formatShortDate(cert.date)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <footer
            id="contact"
            className="scroll-mt-14 bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden"
          >
            <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d]">
              <h2 className="font-mono-term text-sm text-[#c9d1d9] flex items-center gap-2">
                <span className="text-[#238636]">#</span> Contact
              </h2>
            </div>
            <div className="p-4">
              <div className="font-mono-term text-sm mb-4">
                <span className="text-[#7ee787]">$ </span>
                <span className="text-[#c9d1d9]">cat ./contact.txt</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm mb-6">
                {contactLinks
                  .filter((link) => link.type !== "location")
                  .map((link) => (
                    <a
                      key={link.type}
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "noreferrer" : undefined}
                      className="text-[#58a6ff] hover:underline"
                    >
                      {link.label}
                    </a>
                  ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-[#30363d]">
                <span className="text-xs text-[#8b949e] font-mono-term" suppressHydrationWarning>
                  &copy; {new Date().getFullYear()} {full_name}
                </span>
                <ShareBar
                  handle={profile.handle}
                  title={`${full_name}'s Portfolio`}
                  name={full_name}
                  variant="dev-terminal"
                />
              </div>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
};
