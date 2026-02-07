import { Folder, GitBranch, Globe, Mail, MapPin, Phone } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateRange } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const DevTerminal: React.FC<TemplateProps> = ({ content, profile }) => {
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

  // Build tab list from available sections
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
      {/* Font preloading */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] selection:bg-[#388bfd] selection:text-white w-full overflow-x-hidden">
        {/* Custom font classes + typing animation */}
        <style>{`
          .font-mono-term { font-family: 'JetBrains Mono', monospace; }
          .font-sans-term { font-family: 'Inter', sans-serif; }
          .typing-line {
            display: inline-block;
            overflow: hidden;
            white-space: nowrap;
            border-right: 2px solid transparent;
            max-width: 0;
          }
          @media (prefers-reduced-motion: no-preference) {
            .typing-line {
              animation: typing-reveal 2s steps(25) forwards, blink-cursor 0.75s step-end infinite;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .typing-line {
              max-width: none;
              border-right-color: transparent;
            }
          }
          @keyframes typing-reveal {
            from { max-width: 0; }
            to { max-width: 40ch; }
          }
          @keyframes blink-cursor {
            from, to { border-color: transparent; }
            50% { border-color: #7ee787; }
          }
        `}</style>

        {/* VS Code-style Tab Navigation */}
        <nav
          aria-label="Main navigation"
          className="sticky top-0 z-50 bg-[#161b22] border-b border-[#30363d]"
        >
          <div className="max-w-5xl mx-auto flex items-center">
            <div className="flex items-center overflow-x-auto no-scrollbar">
              {tabs.map((tab, idx) => (
                <a
                  key={tab.id}
                  href={`#${tab.id}`}
                  className={`px-4 py-3 font-mono-term text-xs whitespace-nowrap border-t-2 transition-colors ${
                    idx === 0
                      ? "border-[#58a6ff] text-white bg-[#0d1117]"
                      : "border-transparent text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#0d1117]/50"
                  }`}
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
          {/* Hero Section - README style */}
          <header
            id="readme"
            className="mb-12 bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden"
          >
            <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d] flex items-center gap-2">
              <Folder className="size-4 text-[#8b949e]" aria-hidden="true" />
              <span className="font-mono-term text-sm text-[#c9d1d9]">README.md</span>
            </div>
            <div className="p-6">
              <h1 className="font-sans-term text-3xl md:text-4xl font-bold text-white mb-2">
                {full_name}
              </h1>
              <p className="text-[#58a6ff] font-mono-term text-lg mb-4">{headline}</p>
              {summary && <p className="text-[#8b949e] leading-relaxed max-w-3xl">{summary}</p>}

              {/* Contact Links */}
              <div className="mt-6 flex flex-wrap gap-4 text-sm">
                {contact.location && (
                  <span className="flex items-center gap-1.5 text-[#8b949e]">
                    <MapPin className="size-4" aria-hidden="true" />
                    {contact.location}
                  </span>
                )}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1.5 text-[#58a6ff] hover:underline"
                  >
                    <Mail className="size-4" aria-hidden="true" />
                    {contact.email}
                  </a>
                )}
                {contact.website && (
                  <a
                    href={
                      contact.website.startsWith("http")
                        ? contact.website
                        : `https://${contact.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-[#58a6ff] hover:underline"
                  >
                    <Globe className="size-4" aria-hidden="true" />
                    {contact.website}
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex items-center gap-1.5 text-[#58a6ff] hover:underline"
                  >
                    <Phone className="size-4" aria-hidden="true" />
                    {contact.phone}
                  </a>
                )}
              </div>
            </div>
          </header>

          {/* Skills Section - System Configuration with line numbers */}
          {skills && skills.length > 0 && (
            <section id="skills" className="mb-8">
              <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
                <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d]">
                  <h2 className="font-mono-term text-sm text-[#c9d1d9] flex items-center gap-2">
                    <span className="text-[#238636]">#</span> System_Configuration
                  </h2>
                </div>
                <div className="p-4 font-mono-term text-xs md:text-sm">
                  {(() => {
                    let lineNum = 1;
                    return skills.map((skillGroup, index) => {
                      const echoText = `$ echo ${skillGroup.category.toUpperCase().replace(/\s+/g, "_")}`;
                      const echoLineNum = lineNum;
                      lineNum += 1;
                      return (
                        <div key={index} className="mb-4 last:mb-0">
                          <div className="text-[#7ee787] mb-2 flex items-start">
                            <span className="text-[#484f58] select-none mr-4 text-right inline-block w-8 shrink-0">
                              {echoLineNum}
                            </span>
                            <span
                              className="typing-line"
                              style={{ animationDelay: `${index * 2.5}s` }}
                            >
                              {echoText}
                            </span>
                          </div>
                          <div className="pl-12 flex flex-wrap gap-2">
                            {skillGroup.items.map((item, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-[#21262d] border border-[#30363d] rounded text-[#c9d1d9] hover:border-[#58a6ff] transition-colors"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </section>
          )}

          {/* Experience Section - Log History with git diff styling */}
          {experience && experience.length > 0 && (
            <section id="experience" className="mb-8">
              <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
                <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d]">
                  <h2 className="font-mono-term text-sm text-[#c9d1d9] flex items-center gap-2">
                    <span className="text-[#238636]">#</span> Log_History
                  </h2>
                </div>
                <div className="divide-y divide-[#21262d]">
                  {experience.map((job, index) => (
                    <div key={index} className="p-4 hover:bg-[#0d1117] transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-sans-term font-semibold text-white">{job.title}</h3>
                          <p className="text-[#58a6ff] text-sm">@ {job.company}</p>
                        </div>
                        <span className="font-mono-term text-xs text-[#8b949e] bg-[#21262d] px-2 py-1 rounded self-start">
                          {formatDateRange(job.start_date, job.end_date)}
                        </span>
                      </div>
                      <p className="text-[#8b949e] text-sm mb-2">{job.description}</p>
                      {job.highlights && job.highlights.length > 0 && (
                        <ul className="space-y-1">
                          {job.highlights.map((highlight, i) => (
                            <li
                              key={i}
                              className="font-mono-term text-xs text-[#7ee787] flex items-start gap-2"
                            >
                              <span className="text-[#7ee787] font-bold" aria-hidden="true">
                                +
                              </span>
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Projects Section - Public Repositories */}
          {projects && projects.length > 0 && (
            <section id="projects" className="mb-8">
              <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
                <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d]">
                  <h2 className="font-mono-term text-sm text-[#c9d1d9] flex items-center gap-2">
                    <span className="text-[#238636]">#</span> Public_Repositories
                  </h2>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((project, index) => (
                    <a
                      key={index}
                      href={
                        project.url
                          ? project.url.startsWith("http")
                            ? project.url
                            : `https://${project.url}`
                          : "#"
                      }
                      target={project.url ? "_blank" : "_self"}
                      rel="noopener noreferrer"
                      className={`block p-4 bg-[#0d1117] border border-[#30363d] rounded-md hover:border-[#58a6ff] transition-colors group ${!project.url ? "pointer-events-none" : ""}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-sans-term font-semibold text-[#58a6ff] group-hover:underline">
                          {project.title}
                        </h3>
                        {project.year && (
                          <span className="font-mono-term text-xs text-[#8b949e]">
                            {project.year}
                          </span>
                        )}
                      </div>
                      <p className="text-[#8b949e] text-sm mb-3">{project.description}</p>
                      {project.technologies && project.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {project.technologies.map((tech, i) => (
                            <span
                              key={i}
                              className="flex items-center gap-1 text-xs text-[#8b949e]"
                            >
                              <span
                                className="size-3 rounded-full bg-[#238636]"
                                aria-hidden="true"
                              />
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Education & Certifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Education */}
            {education && education.length > 0 && (
              <section
                id="education"
                className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden"
              >
                <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d]">
                  <h2 className="font-mono-term text-sm text-[#c9d1d9] flex items-center gap-2">
                    <span className="text-[#238636]">#</span> Education
                  </h2>
                </div>
                <div className="p-4 space-y-4">
                  {education.map((edu, index) => (
                    <div key={index}>
                      <h3 className="font-sans-term font-semibold text-white text-sm">
                        {edu.degree}
                      </h3>
                      <p className="text-[#58a6ff] text-sm">{edu.institution}</p>
                      <div className="flex items-center gap-2 text-xs text-[#8b949e] mt-1">
                        {edu.graduation_date && <span>{edu.graduation_date}</span>}
                        {edu.gpa && <span>• GPA: {edu.gpa}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Certifications with GitHub pink keywords */}
            {certifications && certifications.length > 0 && (
              <section
                id="certifications"
                className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden"
              >
                <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d]">
                  <h2 className="font-mono-term text-sm text-[#c9d1d9] flex items-center gap-2">
                    <span className="text-[#238636]">#</span> Certifications
                  </h2>
                </div>
                <div className="p-4 space-y-4">
                  {certifications.map((cert, index) => (
                    <div key={index}>
                      <h3 className="font-sans-term font-semibold text-[#F97583] text-sm">
                        {cert.name}
                      </h3>
                      <p className="text-[#8b949e] text-sm">{cert.issuer}</p>
                      {cert.date && <span className="text-xs text-[#8b949e]">{cert.date}</span>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Footer - Contact */}
          <footer
            id="contact"
            className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden"
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

export default DevTerminal;
