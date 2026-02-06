import { ArrowUpRight, Award, Github, Globe, Mail, MapPin, Phone } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { type ContactLinkType, getContactLinks } from "@/lib/templates/contact-links";
import { formatDateRange, formatShortDate } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const navIconMap: Record<ContactLinkType, React.ReactNode> = {
  email: <Mail className="w-4 h-4 text-neutral-600 group-hover:text-black" />,
  phone: <Phone className="w-4 h-4 text-neutral-600 group-hover:text-black" />,
  linkedin: <ArrowUpRight className="w-4 h-4 text-neutral-600 group-hover:text-black" />,
  github: <Github className="w-4 h-4 text-neutral-600 group-hover:text-black" />,
  website: <Globe className="w-4 h-4 text-neutral-600 group-hover:text-black" />,
  location: <MapPin className="w-4 h-4 text-neutral-600 group-hover:text-black" />,
  behance: <span className="text-xs font-bold text-neutral-600 group-hover:text-black">Be</span>,
  dribbble: <span className="text-xs font-bold text-neutral-600 group-hover:text-black">Dr</span>,
};

// Noise texture via inline SVG
const noiseBg = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`,
};

// Helper Component for section headers
const SectionTitle = ({ title, count }: { title: string; count?: number }) => (
  <div className="flex items-baseline gap-3 mb-12 pb-4 border-b border-black">
    <h2 className="text-sm font-bold uppercase tracking-[0.2em]">{title}</h2>
    {count !== undefined && (
      <span className="text-xs font-mono text-neutral-400">
        ({count.toString().padStart(2, "0")})
      </span>
    )}
  </div>
);

const MinimalistEditorial: React.FC<TemplateProps> = ({ content, profile }) => {
  const {
    full_name,
    summary,
    headline,
    contact,
    experience,
    projects,
    education,
    skills,
    certifications,
  } = content;

  const [firstName, ...rest] = full_name.split(" ");
  const lastName = rest.join(" ");
  const contactLinks = getContactLinks(contact);

  return (
    <div className="relative min-h-screen bg-[#FDFCF8] text-[#1a1a1a] font-sans selection:bg-[#1a1a1a] selection:text-white overflow-x-hidden">
      {/* Texture Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-40 mix-blend-overlay"
        style={noiseBg}
      />

      {/* Floating Navigation */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-6 px-6 py-3 bg-white/80 backdrop-blur-md border border-black/5 rounded-full shadow-2xl shadow-black/5 transition-transform hover:scale-105">
          <span className="text-xs font-bold tracking-widest uppercase opacity-40 hover:opacity-100 transition-opacity cursor-default">
            {profile.handle}
          </span>
          {contactLinks
            .filter((link) => link.type !== "location")
            .map((link) => (
              <a
                key={link.type}
                href={link.href}
                target={link.isExternal ? "_blank" : undefined}
                rel={link.isExternal ? "noreferrer" : undefined}
                className="group relative p-2 rounded-full hover:bg-neutral-100 transition-colors"
              >
                {navIconMap[link.type]}
                <span className="sr-only">{link.label}</span>
              </a>
            ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 md:px-12 pt-24 pb-40">
        {/* Header Section */}
        <header className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-32 lg:mb-48 border-b border-black/10 pb-24">
          <div className="lg:col-span-8">
            <h1 className="flex flex-col font-serif text-[clamp(4rem,10vw,8rem)] leading-[0.9] tracking-tighter text-black">
              <span className="block">{firstName}</span>
              <span className="block italic font-light text-neutral-400 ml-[1.5ch] -mt-2 lg:-mt-6">
                {lastName}
              </span>
            </h1>
          </div>

          <div className="lg:col-span-4 flex flex-col justify-end lg:pl-8 space-y-8">
            <div className="space-y-4">
              <p className="text-lg leading-relaxed text-neutral-600 font-medium max-w-md">
                {summary}
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center px-3 py-1 bg-black/5 rounded-full text-xs font-bold uppercase tracking-widest">
                  {headline}
                </span>
                {contact.location && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 border border-black/10 rounded-full text-xs font-medium uppercase tracking-widest text-neutral-500">
                    <MapPin className="w-3 h-3" /> {contact.location}
                  </span>
                )}
              </div>
            </div>
            <div className="pt-8 border-t border-black/5">
              <ShareBar
                handle={profile.handle}
                title={`${full_name}'s Portfolio`}
                name={full_name}
                variant="minimalist-editorial"
              />
            </div>
          </div>
        </header>

        {/* Experience - Grid Style */}
        {experience && experience.length > 0 && (
          <section className="mb-32">
            <SectionTitle title="Experience" count={experience.length} />
            <div className="group/list">
              {experience.map((job, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-12 gap-y-4 py-8 border-b border-black/5 transition-all duration-500 hover:bg-neutral-50/50 hover:pl-4 group-hover/list:opacity-40 group-hover/list:hover:opacity-100"
                >
                  <div className="md:col-span-3">
                    <span className="font-mono text-xs text-neutral-400 block mb-1">
                      {formatDateRange(job.start_date, job.end_date)}
                    </span>
                    <span className="text-sm font-semibold tracking-wide text-neutral-900">
                      {job.company}
                    </span>
                  </div>

                  <div className="md:col-span-5">
                    <h3 className="text-2xl font-serif italic text-neutral-800 mb-2">
                      {job.title}
                    </h3>
                    {job.location && (
                      <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">
                        {job.location}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {job.highlights?.slice(0, 3).map((highlight, i) => (
                        <li key={i} className="text-sm text-neutral-500 leading-relaxed">
                          • {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="md:col-span-4 flex md:justify-end items-start">
                    <div className="h-px w-12 bg-neutral-200 mt-3 md:hidden" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Selected Works - Interactive Rows */}
        {projects && projects.length > 0 && (
          <section className="mb-32">
            <SectionTitle title="Selected Works" count={projects.length} />
            <div className="flex flex-col">
              {projects.map((project, index) => (
                <a
                  key={index}
                  href={project.url || "#"}
                  target={project.url ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="group relative flex flex-col md:flex-row md:items-center justify-between border-t border-black/10 py-10 hover:bg-[#1a1a1a] hover:text-white transition-colors duration-500 px-2 -mx-2 rounded-sm"
                >
                  <div className="md:w-1/2">
                    <h3 className="text-4xl md:text-5xl font-serif font-light tracking-tight mb-2 group-hover:italic transition-all">
                      {project.title}
                    </h3>
                    <div className="flex gap-3 opacity-60 group-hover:opacity-80">
                      {project.technologies?.slice(0, 3).map((tech, i) => (
                        <span key={i} className="text-xs uppercase tracking-widest">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="md:w-1/3 mt-4 md:mt-0 opacity-60 group-hover:opacity-90 font-light leading-relaxed text-sm">
                    {project.description}
                  </div>

                  <div className="mt-6 md:mt-0">
                    <ArrowUpRight className="w-8 h-8 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500" />
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Two Column Layout for Skills & Education */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 mb-32">
          {/* Education */}
          {education && education.length > 0 && (
            <section>
              <SectionTitle title="Education" />
              <div className="space-y-8">
                {education.map((edu, index) => (
                  <div
                    key={index}
                    className="border-l-2 border-neutral-100 pl-6 py-1 hover:border-black transition-colors duration-300"
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-bold text-lg">{edu.institution}</h3>
                      {edu.graduation_date && (
                        <span className="text-xs font-mono text-neutral-400">
                          {formatShortDate(edu.graduation_date)}
                        </span>
                      )}
                    </div>
                    <p className="font-serif italic text-neutral-600 mb-2">{edu.degree}</p>
                    {edu.gpa && (
                      <p className="text-xs bg-neutral-100 inline-block px-2 py-1 rounded">
                        GPA {edu.gpa}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Skills */}
          {skills && skills.length > 0 && (
            <section>
              <SectionTitle title="Technical Skills" />
              <div className="flex flex-wrap content-start gap-2">
                {skills
                  .flatMap((s) => s.items)
                  .map((skill, i) => (
                    <span
                      key={i}
                      className="px-4 py-2 bg-white border border-black/10 text-sm hover:bg-black hover:text-white hover:border-black transition-colors duration-300 cursor-default"
                    >
                      {skill}
                    </span>
                  ))}
              </div>
            </section>
          )}
        </div>

        {/* Certifications */}
        {certifications && certifications.length > 0 && (
          <section className="mb-32">
            <SectionTitle title="Certifications" count={certifications.length} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certifications.map((cert, index) => (
                <div
                  key={index}
                  className="border border-black/10 p-6 hover:bg-neutral-50/50 transition-colors duration-300"
                >
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-neutral-400 mt-1 shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-serif text-lg italic mb-1">{cert.name}</h3>
                      <p className="text-sm text-neutral-600 font-medium">{cert.issuer}</p>
                      {cert.date && (
                        <p className="text-xs text-neutral-400 mt-2">
                          {formatShortDate(cert.date)}
                        </p>
                      )}
                      {cert.url && (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-black mt-2 transition-colors"
                        >
                          View credential <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="flex flex-col items-center justify-center pt-20 border-t border-black/10 opacity-50 hover:opacity-100 transition-opacity">
          <p className="font-serif italic text-xl mb-4">"Designed to endure."</p>
          <div className="text-xs font-bold uppercase tracking-[0.2em] flex gap-4">
            <span>{new Date().getFullYear()}</span>
            <span>•</span>
            <span>{profile.handle}</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default MinimalistEditorial;
