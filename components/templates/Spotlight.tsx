import { Github, Globe, Linkedin, Mail, MapPin } from "lucide-react";
import type React from "react";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

const Spotlight: React.FC<TemplateProps> = ({ content, profile }) => {
  const firstName = content.full_name.split(" ")[0] || content.full_name;
  const allSkills = flattenSkills(content.skills);
  const summaryWords = content.summary ? content.summary.split(/\s+/) : [];
  const navLinks = [
    { label: "About", href: "#about" },
    { label: "Work", href: "#work" },
    { label: "Education", href: "#education" },
    { label: "Contact", href: "#contact" },
  ];

  const boldFirstWordPerSentence = (text: string): React.ReactNode[] => {
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.map((sentence, i) => {
      const words = sentence.split(/\s+/);
      if (words.length === 0) return null;
      return (
        <span key={i}>
          {i > 0 && " "}
          <strong className="font-semibold text-stone-900">{words[0]}</strong>
          {words.length > 1 ? ` ${words.slice(1).join(" ")}` : ""}
        </span>
      );
    });
  };

  const summaryExcerpt = content.summary
    ? content.summary.length > 120
      ? `${content.summary.slice(0, 120)}...`
      : content.summary
    : "";

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-stone-800 font-sans selection:bg-stone-800 selection:text-white overflow-y-auto scroll-smooth">
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Sticky Header Nav */}
      <nav className="sticky top-0 bg-[#fdfbf7]/95 backdrop-blur-sm z-40 border-b-2 border-orange-500">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={content.full_name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-semibold text-orange-600">
                {getInitials(content.full_name)}
              </div>
            )}
            <span className="text-sm font-medium text-stone-900">{content.full_name}</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6">
        {/* Hero Section */}
        <section id="about" className="pt-20 pb-16 md:pt-32 md:pb-24">
          <p className="text-sm text-stone-500 mb-4 tracking-wide">Hello, I&apos;m {firstName}</p>
          <h1 className="font-sans text-4xl md:text-6xl lg:text-7xl font-bold leading-tight text-stone-900 max-w-3xl">
            {content.headline}
          </h1>
          {content.contact.email && (
            <a
              href={`mailto:${content.contact.email}`}
              className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-orange-500 text-white text-sm font-medium rounded-full hover:bg-orange-600 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email me
            </a>
          )}
        </section>

        {/* About Section — word-by-word fade-in */}
        {content.summary && (
          <section className="pb-16 md:pb-24">
            <p className="text-xl md:text-2xl leading-relaxed text-stone-600 max-w-3xl">
              {summaryWords.map((word, i) => (
                <span
                  key={i}
                  className="inline-block mr-[0.3em]"
                  style={
                    i < 50
                      ? {
                          opacity: 0,
                          animation: "fadeInUp 0.4s ease forwards",
                          animationDelay: `${i * 0.03}s`,
                        }
                      : undefined
                  }
                >
                  {word}
                </span>
              ))}
            </p>
          </section>
        )}

        {/* Profile Card */}
        <section className="pb-16 md:pb-24">
          <div className="bg-white border border-stone-200 border-l-4 border-l-orange-500 rounded-2xl p-6 md:p-8 max-w-2xl">
            <div className="flex items-start gap-4 mb-5">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={content.full_name}
                  className="w-14 h-14 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-lg font-semibold text-orange-600 shrink-0">
                  {getInitials(content.full_name)}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-stone-900">{content.full_name}</h2>
                <p className="text-sm text-stone-500">I am a {content.headline}</p>
              </div>
            </div>
            {summaryExcerpt && (
              <p className="text-sm text-stone-600 leading-relaxed mb-5">
                {boldFirstWordPerSentence(summaryExcerpt)}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {content.contact.location && (
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {content.contact.location}
                </span>
              )}
              {content.contact.email && (
                <a
                  href={`mailto:${content.contact.email}`}
                  className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </a>
              )}
              {content.contact.linkedin && (
                <a
                  href={content.contact.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 transition-colors"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                  LinkedIn
                </a>
              )}
              {content.contact.github && (
                <a
                  href={content.contact.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 transition-colors"
                >
                  <Github className="w-3.5 h-3.5" />
                  GitHub
                </a>
              )}
              {content.contact.website && (
                <a
                  href={content.contact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Website
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Skills Marquee */}
        {allSkills.length > 0 && (
          <section className="pb-16 md:pb-24 -mx-6 overflow-hidden">
            <div
              className="flex whitespace-nowrap"
              style={{ animation: "marquee 30s linear infinite" }}
            >
              {[...allSkills, ...allSkills].map((skill, i) => (
                <span
                  key={i}
                  className="inline-block bg-orange-50 text-orange-700 border border-orange-200 text-sm rounded-full px-4 py-2 mx-1.5 shrink-0"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Career Section */}
        {content.experience?.length > 0 && (
          <section id="work" className="pb-16 md:pb-24">
            <h2 className="text-2xl md:text-3xl font-sans font-bold text-stone-900 mb-10">
              <span className="text-orange-500 mr-2">.</span>Career
            </h2>
            <div className="space-y-6">
              {content.experience.map((job, index) => (
                <div
                  key={index}
                  className="bg-white border border-stone-200 rounded-xl p-5 md:p-6 hover:border-orange-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-xs font-semibold text-orange-600 shrink-0">
                      {getInitials(job.company)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-stone-900">{job.title}</h3>
                      <p className="text-sm text-stone-600">{job.company}</p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {formatDateRange(job.start_date, job.end_date)}
                        {job.location && ` · ${job.location}`}
                      </p>
                      {job.description && job.description.trim() !== "" && (
                        <p className="text-sm text-stone-600 mt-3 leading-relaxed">
                          {job.description}
                        </p>
                      )}
                      {job.highlights && job.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {job.highlights.map((highlight, i) => (
                            <span
                              key={i}
                              className="text-xs bg-orange-50 text-orange-600 rounded-full px-3 py-1"
                            >
                              {highlight}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education Section */}
        {content.education && content.education.length > 0 && (
          <section id="education" className="pb-16 md:pb-24">
            <h2 className="text-2xl md:text-3xl font-sans font-bold text-stone-900 mb-10">
              <span className="text-orange-500 mr-2">.</span>Education
            </h2>
            <div className="space-y-4">
              {content.education.map((edu, index) => (
                <div
                  key={index}
                  className="bg-white border border-stone-200 rounded-xl p-5 md:p-6 hover:border-orange-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-xs font-semibold text-orange-600 shrink-0">
                      {getInitials(edu.institution)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-stone-900">{edu.degree}</h3>
                      <p className="text-sm text-stone-600">{edu.institution}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {edu.graduation_date && (
                          <span className="text-xs text-stone-400">
                            {formatYear(edu.graduation_date)}
                          </span>
                        )}
                        {edu.location && (
                          <span className="text-xs text-stone-400">· {edu.location}</span>
                        )}
                        {edu.gpa && (
                          <span className="text-xs text-stone-400">· GPA: {edu.gpa}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills Showcase */}
        {content.skills && content.skills.length > 0 && (
          <section className="pb-16 md:pb-24">
            <h2 className="text-2xl md:text-3xl font-sans font-bold text-stone-900 mb-10">
              <span className="text-orange-500 mr-2">.</span>Skills
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {content.skills.slice(0, 3).map((group, index) => (
                <div
                  key={index}
                  className="bg-white border border-stone-200 rounded-xl p-5 hover:border-orange-300 hover:shadow-sm transition-all"
                >
                  <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wider mb-3">
                    {group.category}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((skill, i) => (
                      <span
                        key={i}
                        className="text-xs bg-orange-50 text-orange-600 rounded-full px-3 py-1"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects Section */}
        {content.projects && content.projects.length > 0 && (
          <section className="pb-16 md:pb-24">
            <h2 className="text-2xl md:text-3xl font-sans font-bold text-stone-900 mb-10">
              <span className="text-orange-500 mr-2">.</span>Projects
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.projects.map((project, index) => (
                <div
                  key={index}
                  className="bg-white border border-stone-200 rounded-xl p-5 hover:border-orange-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-semibold text-stone-900">{project.title}</h3>
                    {project.year && (
                      <span className="text-xs text-stone-400 shrink-0 ml-2">{project.year}</span>
                    )}
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed mb-3">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {project.technologies?.map((tech, i) => (
                      <span
                        key={i}
                        className="text-xs bg-orange-50 text-orange-600 rounded-full px-2.5 py-0.5"
                      >
                        {tech}
                      </span>
                    ))}
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-stone-500 hover:text-stone-900 underline ml-auto transition-colors"
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certifications Section */}
        {content.certifications && content.certifications.length > 0 && (
          <section className="pb-16 md:pb-24">
            <h2 className="text-2xl md:text-3xl font-sans font-bold text-stone-900 mb-10">
              <span className="text-orange-500 mr-2">.</span>Certifications
            </h2>
            <div className="space-y-3">
              {content.certifications.map((cert, index) => (
                <div
                  key={index}
                  className="bg-white border border-stone-200 rounded-xl p-5 flex items-center justify-between gap-4 hover:border-orange-300 hover:shadow-sm transition-all"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-stone-900">{cert.name}</h3>
                    <p className="text-xs text-stone-500">{cert.issuer}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {cert.date && <span className="text-xs text-stone-400">{cert.date}</span>}
                    {cert.url && (
                      <a
                        href={cert.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-stone-500 hover:text-stone-900 underline transition-colors"
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contact Section */}
        <section id="contact" className="pb-16 md:pb-24">
          <div className="bg-orange-50/50 border border-orange-200 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-sans font-bold text-stone-900 mb-3">
              Let&apos;s Get in Touch
            </h2>
            <p className="text-sm text-stone-500 mb-6 max-w-md mx-auto">
              Interested in working together or have a question? Reach out and let&apos;s connect.
            </p>
            {content.contact.email && (
              <a
                href={`mailto:${content.contact.email}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white text-sm font-medium rounded-full hover:bg-orange-600 transition-colors mb-6"
              >
                <Mail className="w-4 h-4" />
                Email me
              </a>
            )}
            <div className="flex justify-center items-center gap-4 flex-wrap">
              {content.contact.linkedin && (
                <a
                  href={content.contact.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                </a>
              )}
              {content.contact.github && (
                <a
                  href={content.contact.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
              )}
              {content.contact.website && (
                <a
                  href={content.contact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  Website
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-orange-200 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-stone-900">{content.full_name}</p>
              <p className="text-xs text-stone-500">{content.headline}</p>
            </div>
            <div className="flex items-center gap-6">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Spotlight;
