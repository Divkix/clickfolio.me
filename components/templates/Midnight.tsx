import { ArrowUpRight, MapPin } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateRange, formatShortDate, formatYear, getInitials } from "@/lib/templates/helpers";
import type { ResumeContent } from "@/lib/types/database";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Albert+Sans:wght@400;500;600&display=swap";

// Fixed coordinates (percent of the sky band) keep server and client output identical.
const STARS = [
  [4, 12, 1.2],
  [9, 58, 0.8],
  [13, 30, 1.6],
  [18, 78, 0.9],
  [22, 8, 0.8],
  [27, 46, 1.1],
  [31, 88, 0.7],
  [36, 20, 0.9],
  [41, 66, 1.4],
  [45, 4, 0.8],
  [52, 38, 0.8],
  [57, 84, 1.1],
  [61, 14, 1.7],
  [66, 54, 0.8],
  [70, 92, 0.9],
  [74, 28, 1],
  [79, 70, 0.8],
  [83, 6, 1.2],
  [87, 44, 0.9],
  [91, 80, 1.5],
  [95, 22, 0.8],
  [98, 60, 1],
  [7, 94, 0.8],
  [48, 74, 0.7],
] as const;

function Sky() {
  return (
    <div className="mn-sky absolute inset-x-0 top-0 h-[34rem]" aria-hidden="true">
      {STARS.map(([x, y, r]) => (
        <span
          key={`${x}-${y}`}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${r * 2}px`,
            height: `${r * 2}px`,
            background: r > 1.3 ? "#F3E3B8" : "#DCE2FF",
            opacity: r > 1.3 ? 0.95 : 0.55,
            boxShadow: r > 1.3 ? "0 0 6px rgba(243, 227, 184, 0.7)" : undefined,
          }}
        />
      ))}
    </div>
  );
}

// Four-point star used as the marker on the experience line.
function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M8 0 9.6 6.4 16 8 9.6 9.6 8 16 6.4 9.6 0 8 6.4 6.4Z" fill="currentColor" />
    </svg>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={`${id}-title`}
      className="font-display-mn text-4xl md:text-[2.75rem] font-medium text-[#EDE6D6] mb-10"
    >
      {children}
    </h2>
  );
}

function Header({ content, profile }: TemplateProps) {
  const links = getContactLinks(content.contact).filter((l) => l.type !== "location");

  return (
    <header className="relative flex flex-col items-center text-center pt-20 md:pt-28 pb-20">
      <div className="w-24 h-24 md:w-28 md:h-28 rounded-full p-[3px] bg-linear-to-b from-[#D4B26A] to-[#D4B26A]/10 mb-8">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={`Portrait of ${content.full_name}`}
            width={112}
            height={112}
            fetchPriority="high"
            decoding="async"
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full rounded-full bg-[#0B1026] flex items-center justify-center font-display-mn text-4xl text-[#D4B26A]"
            aria-hidden="true"
          >
            {getInitials(content.full_name)}
          </div>
        )}
      </div>

      <h1 className="font-display-mn font-medium text-6xl md:text-8xl leading-[0.95] tracking-[-0.01em] text-[#F5EFE1] break-words max-w-full">
        {content.full_name}
      </h1>

      {content.headline && (
        <p className="font-display-mn italic text-2xl md:text-3xl text-[#C9CEE4] mt-5 max-w-2xl">
          {content.headline}
        </p>
      )}

      {content.contact.location && (
        <p className="mt-5 flex items-center gap-2 text-sm text-[#9AA0BE]">
          <MapPin className="w-4 h-4 text-[#D4B26A]" aria-hidden="true" />
          {content.contact.location}
        </p>
      )}

      {links.length > 0 && (
        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3">
          {links.map((link) => (
            <li key={link.type}>
              <a
                href={link.href}
                target={link.isExternal ? "_blank" : undefined}
                rel={link.isExternal ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-2 text-sm text-[#C9CEE4] hover:text-[#D4B26A] underline decoration-[#D4B26A]/30 underline-offset-4 hover:decoration-[#D4B26A] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4B26A]"
              >
                {getContactIcon(link.type, {
                  className: "w-4 h-4",
                  size: 16,
                  variant: "white",
                  "aria-hidden": true,
                })}
                <span className="break-all">{link.label}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

function Experience({ experience }: { experience: ResumeContent["experience"] }) {
  if (!experience?.length) return null;

  return (
    <section aria-labelledby="experience-title">
      <SectionTitle id="experience">Experience</SectionTitle>
      <ol className="relative">
        {experience.map((job, i) => (
          <li
            key={`${job.title}-${job.company}-${job.start_date}`}
            className="relative grid md:grid-cols-[9rem_1fr] gap-x-10 pl-8 md:pl-0 pb-12 last:pb-0"
          >
            <p className="text-sm text-[#9AA0BE] md:text-right md:pt-1.5 mb-1 md:mb-0 tabular-nums">
              {formatDateRange(job.start_date, job.end_date)}
            </p>
            <div className="relative md:pl-10">
              {i < experience.length - 1 && (
                <span
                  className="absolute -left-[1.6rem] md:left-0 top-5 -bottom-12 w-px bg-linear-to-b from-[#D4B26A]/50 to-[#D4B26A]/10"
                  aria-hidden="true"
                />
              )}
              <StarMark
                className={`absolute -left-[2.1rem] md:-left-[0.55rem] top-0.5 w-[1.1rem] h-[1.1rem] ${
                  i === 0 ? "text-[#F3D88E]" : "text-[#D4B26A]"
                }`}
              />
              <h3 className="font-display-mn text-2xl md:text-[1.7rem] font-semibold leading-tight text-[#EDE6D6]">
                {job.title}
              </h3>
              <p className="mt-1 flex flex-wrap gap-x-3 text-[#C9CEE4]">
                <span className="font-medium">{job.company}</span>
                {job.location && <span className="text-[#9AA0BE]">{job.location}</span>}
              </p>
              {job.description && (
                <p className="mt-4 leading-[1.75] text-[#B7BCD4] max-w-[64ch]">{job.description}</p>
              )}
              {job.highlights && job.highlights.length > 0 && (
                <ul className="mt-4 space-y-2.5 max-w-[64ch]">
                  {job.highlights.map((item, j) => (
                    <li
                      key={`${job.title}-${item}-${j}`}
                      className="relative pl-5 leading-[1.7] text-[#B7BCD4]"
                    >
                      <span
                        className="absolute left-0 top-[0.72em] w-1.5 h-1.5 rotate-45 bg-[#D4B26A]/70"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Projects({ projects }: { projects: ResumeContent["projects"] }) {
  if (!projects?.length) return null;

  return (
    <section aria-labelledby="projects-title">
      <SectionTitle id="projects">Projects</SectionTitle>
      <ul className="divide-y divide-[#D4B26A]/15 border-y border-[#D4B26A]/15">
        {projects.map((project) => (
          <li
            key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
            className="py-7 grid md:grid-cols-[9rem_1fr] gap-x-10"
          >
            <p className="text-sm text-[#9AA0BE] md:text-right md:pt-1.5 mb-1 md:mb-0">
              {project.year}
            </p>
            <div className="md:pl-10">
              <h3 className="font-display-mn text-2xl font-semibold text-[#EDE6D6]">
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-[#D4B26A] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4B26A]"
                  >
                    {project.title}
                    <ArrowUpRight className="w-5 h-5 text-[#D4B26A]" aria-hidden="true" />
                  </a>
                ) : (
                  project.title
                )}
              </h3>
              {project.description && (
                <p className="mt-2 leading-[1.75] text-[#B7BCD4] max-w-[64ch]">
                  {project.description}
                </p>
              )}
              {project.technologies && project.technologies.length > 0 && (
                <p className="mt-3 text-sm text-[#9AA0BE]">{project.technologies.join(", ")}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Skills({ skills }: { skills: ResumeContent["skills"] }) {
  if (!skills?.length) return null;

  return (
    <section aria-labelledby="skills-title">
      <SectionTitle id="skills">Skills</SectionTitle>
      <dl className="grid sm:grid-cols-2 gap-x-12 gap-y-7">
        {skills.map((group) => (
          <div key={group.category}>
            <dt className="font-display-mn italic text-xl text-[#D4B26A]">{group.category}</dt>
            <dd className="mt-1.5 leading-[1.75] text-[#C9CEE4]">{group.items.join(", ")}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Credentials({
  education,
  certifications,
}: {
  education: ResumeContent["education"];
  certifications: ResumeContent["certifications"];
}) {
  const hasEducation = Boolean(education?.length);
  const hasCerts = Boolean(certifications?.length);

  if (!hasEducation && !hasCerts) return null;

  return (
    <div className={`grid gap-16 ${hasEducation && hasCerts ? "md:grid-cols-2 md:gap-12" : ""}`}>
      {hasEducation && (
        <section aria-labelledby="education-title">
          <SectionTitle id="education">Education</SectionTitle>
          <ul className="space-y-7">
            {education?.map((edu) => (
              <li key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}>
                <h3 className="font-display-mn text-xl font-semibold text-[#EDE6D6]">
                  {edu.degree}
                </h3>
                <p className="mt-0.5 text-[#C9CEE4]">{edu.institution}</p>
                {(edu.graduation_date || edu.location || edu.gpa) && (
                  <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-[#9AA0BE]">
                    {edu.graduation_date && <span>{formatYear(edu.graduation_date)}</span>}
                    {edu.location && <span>{edu.location}</span>}
                    {edu.gpa && <span>GPA {edu.gpa}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasCerts && (
        <section aria-labelledby="certifications-title">
          <SectionTitle id="certifications">Certifications</SectionTitle>
          <ul className="space-y-7">
            {certifications?.map((cert) => (
              <li key={`${cert.name}-${cert.issuer}-${cert.date ?? ""}`}>
                <h3 className="font-display-mn text-xl font-semibold text-[#EDE6D6]">
                  {cert.url ? (
                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-[#D4B26A] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4B26A]"
                    >
                      {cert.name}
                      <ArrowUpRight className="w-4 h-4 text-[#D4B26A]" aria-hidden="true" />
                    </a>
                  ) : (
                    cert.name
                  )}
                </h3>
                {(cert.issuer || cert.date) && (
                  <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-[#9AA0BE]">
                    {cert.issuer && <span>{cert.issuer}</span>}
                    {cert.date && <span>{formatShortDate(cert.date)}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const Midnight: React.FC<TemplateProps> = ({ content, profile }) => {
  return (
    <>
      <TemplateFontLinks href={FONT_URL} />

      <style>{`
        .midnight-root { font-family: 'Albert Sans', ui-sans-serif, system-ui, sans-serif; }
        .font-display-mn { font-family: 'Cormorant Garamond', ui-serif, Georgia, serif; }
        .midnight-root ::selection { background: rgba(212, 178, 106, 0.35); color: #F5EFE1; }
        @keyframes mn-sky-in { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: no-preference) {
          .mn-sky { animation: mn-sky-in 2.4s ease-out both; }
        }
      `}</style>

      <div className="midnight-root relative min-h-screen overflow-x-hidden bg-[#0B1026] bg-linear-to-b from-[#070B1E] via-[#0B1026] to-[#131B3D] text-[#B7BCD4]">
        <Sky />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(60%_70%_at_50%_0%,rgba(92,110,200,0.16),transparent_70%)]"
          aria-hidden="true"
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6">
          <main>
            <Header content={content} profile={profile} />

            {content.summary && (
              <p className="font-display-mn text-2xl md:text-[1.75rem] leading-[1.5] text-[#DDD8CC] max-w-[40ch] mx-auto text-center mb-24">
                {content.summary}
              </p>
            )}

            <div className="space-y-24">
              <Experience experience={content.experience} />
              <Projects projects={content.projects} />
              <Skills skills={content.skills} />
              <Credentials education={content.education} certifications={content.certifications} />
            </div>
          </main>

          <footer className="mt-28 py-14 border-t border-[#D4B26A]/15 flex flex-col items-center gap-6 text-sm text-[#9AA0BE]">
            {content.contact.email && (
              <a
                href={`mailto:${content.contact.email}`}
                className="font-display-mn text-3xl md:text-4xl text-[#EDE6D6] hover:text-[#D4B26A] underline decoration-[#D4B26A]/40 underline-offset-8 transition-colors break-all text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4B26A]"
              >
                {content.contact.email}
              </a>
            )}
            <ShareBar
              handle={profile.handle}
              title={`${content.full_name}'s portfolio`}
              name={content.full_name}
              variant="midnight"
            />
            <p suppressHydrationWarning>
              &copy; {new Date().getFullYear()} {content.full_name}
            </p>
          </footer>
        </div>
      </div>
    </>
  );
};
