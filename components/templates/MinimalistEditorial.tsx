import React from 'react'
import type { TemplateProps } from '@/lib/types/template'
import { formatDateRange } from '@/lib/templates/helpers'
import { Calendar, GraduationCap, Award, ArrowUpRight } from 'lucide-react'
import { siteConfig } from '@/lib/config/site'

const MinimalistEditorial: React.FC<TemplateProps> = ({ content, profile }) => {
  // Split name into first and last for editorial layout
  const nameParts = content.full_name.split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ') || ''

  return (
    <div className="min-h-screen bg-[#fdfbf9] text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white overflow-y-auto scroll-smooth">

      {/* Top Navigation / Brand */}
      <nav className="fixed top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none z-20 mix-blend-difference text-neutral-900 dark:text-white md:pl-24 lg:pl-8">
        <span className="uppercase tracking-widest text-xs font-bold pointer-events-auto cursor-pointer">
          {profile.handle} / {new Date().getFullYear().toString().slice(-2)}
        </span>
        {content.contact.email && (
          <a
            href={`mailto:${content.contact.email}`}
            className="uppercase tracking-widest text-xs font-bold hover:underline pointer-events-auto cursor-pointer"
          >
            Get in Touch
          </a>
        )}
      </nav>

      <div className="max-w-(--breakpoint-xl) mx-auto px-6 md:px-12 pt-32 pb-20">

        {/* Editorial Header */}
        <header className="mb-32 md:mb-48 grid grid-cols-1 md:grid-cols-12 gap-y-8">
          <div className="md:col-span-8">
            <h1 className="font-serif text-6xl md:text-9xl leading-[0.9] tracking-tighter mb-8">
              {firstName}
              {lastName && (
                <>
                  <br />
                  <span className="italic font-light ml-12 md:ml-24">{lastName}</span>
                </>
              )}
            </h1>
          </div>
          <div className="md:col-span-4 flex flex-col justify-end md:pl-12">
            {content.summary && (
              <p className="text-lg md:text-xl leading-relaxed font-light text-neutral-600">
                {content.summary}
              </p>
            )}
            <div className="mt-8 flex gap-4 flex-wrap">
              <span className="text-xs uppercase tracking-widest border border-neutral-200 px-3 py-1 rounded-full">
                {content.headline}
              </span>
              {content.contact.location && (
                <span className="text-xs uppercase tracking-widest border border-neutral-200 px-3 py-1 rounded-full">
                  {content.contact.location}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Experience Section */}
        {content.experience && content.experience.length > 0 && (
          <section className="mb-32">
            <div className="flex items-end justify-between mb-12 border-b border-neutral-200 pb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest">Experience</h2>
              <span className="text-xs font-bold uppercase tracking-widest">({content.experience.length})</span>
            </div>
            <div className="flex flex-col">
              {content.experience.map((job, index) => (
                <div
                  key={index}
                  className="group border-b border-neutral-200 py-12 flex flex-col md:flex-row md:items-baseline hover:bg-white transition-colors duration-500"
                >
                  <div className="md:w-1/12 text-xs font-mono text-neutral-400 mb-2 md:mb-0 group-hover:text-neutral-900 transition-colors">
                    {formatDateRange(job.start_date, job.end_date)}
                  </div>
                  <div className="md:w-5/12">
                    <h3 className="text-3xl md:text-4xl font-serif italic font-light group-hover:not-italic transition-all duration-300">
                      {job.title}
                    </h3>
                    <p className="text-amber-800 font-medium mt-1">{job.company}</p>
                    {job.location && (
                      <p className="text-xs text-neutral-500 mt-1">{job.location}</p>
                    )}
                  </div>
                  <div className="md:w-4/12 mt-2 md:mt-0">
                    {job.description && job.description.trim() !== '' ? (
                      <p className="text-sm text-neutral-500 group-hover:text-neutral-900 max-w-xs transition-colors">
                        {job.description}
                      </p>
                    ) : job.highlights && job.highlights.length > 0 ? (
                      <ul className="text-xs text-neutral-600 space-y-1 list-disc pl-5 font-serif">
                        {job.highlights.map((highlight, i) => (
                          <li key={i} className="text-neutral-500 group-hover:text-neutral-900 transition-colors">{highlight}</li>
                        ))}
                      </ul>
                    ) : null}
                    {job.description && job.description.trim() !== '' && job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-2 text-xs text-neutral-600 space-y-1">
                        {job.highlights.map((highlight, i) => (
                          <li key={i}>• {highlight}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="md:w-2/12 flex justify-end mt-4 md:mt-0">
                    <Calendar className="w-4 h-4 text-neutral-400" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects Section */}
        {content.projects && content.projects.length > 0 && (
          <section className="mb-32">
            <div className="flex items-end justify-between mb-12 border-b border-neutral-200 pb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest">Selected Works</h2>
              <span className="text-xs font-bold uppercase tracking-widest">({content.projects.length})</span>
            </div>
            <div className="flex flex-col">
              {content.projects.map((project, index) => (
                <a
                  key={index}
                  href={project.url || '#'}
                  target={project.url ? '_blank' : undefined}
                  rel={project.url ? 'noopener noreferrer' : undefined}
                  className="group border-b border-neutral-200 py-12 flex flex-col md:flex-row md:items-baseline hover:bg-white transition-colors duration-500"
                >
                  <div className="md:w-1/12 text-xs font-mono text-neutral-400 mb-2 md:mb-0 group-hover:text-neutral-900 transition-colors">
                    {project.year || '—'}
                  </div>
                  <div className="md:w-5/12">
                    <h3 className="text-3xl md:text-4xl font-serif italic font-light group-hover:not-italic transition-all duration-300">
                      {project.title}
                    </h3>
                  </div>
                  <div className="md:w-4/12 mt-2 md:mt-0">
                    <p className="text-sm text-neutral-500 group-hover:text-neutral-900 max-w-xs transition-colors">
                      {project.description}
                    </p>
                    {project.technologies && project.technologies.length > 0 && (
                      <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        {project.technologies.slice(0, 2).map((tech: string, i: number) => (
                          <span key={i} className="text-[10px] uppercase tracking-wider text-neutral-400">
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="md:w-2/12 flex justify-end mt-4 md:mt-0">
                    <div className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-300 transform group-hover:rotate-45">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Education Section */}
        {content.education && content.education.length > 0 && (
          <section className="mb-32">
            <div className="flex items-end justify-between mb-12 border-b border-neutral-200 pb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest">Education</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {content.education.map((edu, index) => (
                <div key={index} className="border border-neutral-200 p-6 hover:bg-white transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <GraduationCap className="w-5 h-5 text-neutral-400" />
                    {edu.graduation_date && (
                      <span className="text-xs font-mono text-neutral-400">
                        {new Date(edu.graduation_date).getFullYear()}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-serif italic mb-1">{edu.degree}</h3>
                  <p className="text-sm text-neutral-600 font-medium">{edu.institution}</p>
                  {edu.location && (
                    <p className="text-xs text-neutral-500 mt-1">{edu.location}</p>
                  )}
                  {edu.gpa && (
                    <p className="text-xs text-neutral-500 mt-2">GPA: {edu.gpa}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills Section */}
        {content.skills && content.skills.length > 0 && (
          <section className="mb-32">
            <div className="flex items-end justify-between mb-12 border-b border-neutral-200 pb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest">Skills</h2>
            </div>
            <div className="space-y-6">
              {content.skills.map((skillGroup, index) => (
                <div key={index}>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-600 mb-3">
                    {skillGroup.category}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {skillGroup.items.map((skill: string, i: number) => (
                      <span
                        key={i}
                        className="text-xs uppercase tracking-widest border border-neutral-200 px-3 py-1 rounded-full hover:bg-neutral-100 transition-colors"
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

        {/* Certifications Section */}
        {content.certifications && content.certifications.length > 0 && (
          <section className="mb-32">
            <div className="flex items-end justify-between mb-12 border-b border-neutral-200 pb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest">Certifications</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.certifications.map((cert, index) => (
                <div key={index} className="border border-neutral-200 p-4 hover:bg-white transition-colors">
                  <div className="flex items-start gap-3">
                    <Award className="w-4 h-4 text-neutral-400 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-serif text-lg italic">{cert.name}</h3>
                      <p className="text-sm text-neutral-600">{cert.issuer}</p>
                      {cert.date && (
                        <p className="text-xs text-neutral-500 mt-1">
                          {new Date(cert.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      {cert.url && (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-neutral-400 hover:underline mt-1 inline-block"
                        >
                          View credential →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer / Contact */}
        <footer className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-neutral-900 pt-12">
          <div>
            <p className="text-3xl font-serif italic">Professional portfolio<br/>powered by AI.</p>
          </div>
          <div className="flex flex-col items-start md:items-end justify-between h-full">
            <div className="flex gap-8 flex-wrap">
              {content.contact.email && (
                <a
                  href={`mailto:${content.contact.email}`}
                  className="text-sm uppercase tracking-widest hover:line-through decoration-1"
                >
                  Email
                </a>
              )}
              {content.contact.linkedin && (
                <a
                  href={content.contact.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm uppercase tracking-widest hover:line-through decoration-1"
                >
                  LinkedIn
                </a>
              )}
              {content.contact.github && (
                <a
                  href={content.contact.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm uppercase tracking-widest hover:line-through decoration-1"
                >
                  GitHub
                </a>
              )}
              {content.contact.website && (
                <a
                  href={content.contact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm uppercase tracking-widest hover:line-through decoration-1"
                >
                  Website
                </a>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-8 md:mt-0">
              Built with <a href={siteConfig.url} className="hover:underline">{siteConfig.fullName}</a>
            </p>
          </div>
        </footer>

      </div>
    </div>
  )
}

export default MinimalistEditorial
