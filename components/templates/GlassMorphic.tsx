import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Briefcase,
  FolderGit2,
  GraduationCap,
  Mail,
  MapPin,
  Wrench,
  User,
} from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateRange, formatShortDate, formatYear, getInitials } from "@/lib/templates/helpers";
import type { ResumeContent } from "@/lib/types/database";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap";

const NAV_SECTIONS = [
  { id: "about", label: "About", icon: User },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "projects", label: "Projects", icon: FolderGit2 },
  { id: "skills", label: "Skills", icon: Wrench },
  { id: "education", label: "Education", icon: GraduationCap },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: LucideIcon }>;

type NavSection = (typeof NAV_SECTIONS)[number];

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={`${id}-title`}
      className="text-2xl md:text-3xl font-semibold tracking-tight text-[#F4F6FB] mb-6"
    >
      {children}
    </h2>
  );
}

function GlassNav({ sections, email }: { sections: NavSection[]; email?: string }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-1.5rem)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="gl-pane flex items-center gap-1 p-1.5 rounded-full overflow-x-auto no-scrollbar">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-label={section.label}
              className="flex items-center gap-2 h-10 px-3 rounded-full text-sm text-[#B8C0D9] hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-[#3DD6C4]"
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden sm:inline">{section.label}</span>
            </a>
          );
        })}
        {email && (
          <a
            href={`mailto:${email}`}
            aria-label={`Email ${email}`}
            className="flex items-center justify-center w-10 h-10 ml-1 rounded-full bg-[#F4F6FB] text-[#0B0F1A] hover:bg-white transition-colors focus-visible:outline-2 focus-visible:outline-[#3DD6C4]"
          >
            <Mail size={17} strokeWidth={2} aria-hidden="true" />
          </a>
        )}
      </div>
    </nav>
  );
}

function GlassHero({
  content,
  profile,
}: {
  content: ResumeContent;
  profile: TemplateProps["profile"];
}) {
  const contactLinks = getContactLinks(content.contact).filter((l) => l.type !== "location");

  return (
    <div className="relative">
      <div className="gl-orb gl-orb-teal" aria-hidden="true" />
      <div className="gl-orb gl-orb-rose" aria-hidden="true" />
      <section
        id="about"
        aria-labelledby="about-title"
        className="relative gl-pane gl-hero rounded-[32px] p-7 sm:p-10 md:p-14"
      >
        <div className="flex flex-col-reverse gap-8 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1
              id="about-title"
              className="text-[2.75rem] leading-[1.02] sm:text-6xl md:text-7xl font-semibold tracking-[-0.035em] text-white break-words"
            >
              {content.full_name}
            </h1>
            {content.headline && (
              <p className="mt-4 text-lg md:text-2xl font-light text-[#D7DCEC] max-w-2xl">
                {content.headline}
              </p>
            )}
            {content.contact.location && (
              <p className="mt-4 flex items-center gap-2 text-sm text-[#8C95B3]">
                <MapPin size={15} aria-hidden="true" />
                {content.contact.location}
              </p>
            )}
          </div>

          <div className="gl-lens shrink-0 w-24 h-24 md:w-36 md:h-36 rounded-full p-1.5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`Portrait of ${content.full_name}`}
                width={144}
                height={144}
                fetchPriority="high"
                decoding="async"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full rounded-full bg-[#0B0F1A]/60 flex items-center justify-center text-2xl md:text-4xl font-semibold text-[#F4F6FB]"
                aria-hidden="true"
              >
                {getInitials(content.full_name)}
              </div>
            )}
          </div>
        </div>

        {content.summary && (
          <p className="mt-10 text-base md:text-lg leading-relaxed text-[#B8C0D9] max-w-[62ch]">
            {content.summary}
          </p>
        )}

        {contactLinks.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {contactLinks.map((link) => (
              <li key={link.type}>
                <a
                  href={link.href}
                  target={link.isExternal ? "_blank" : undefined}
                  rel={link.isExternal ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm text-[#D7DCEC] hover:bg-white/[0.12] hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-[#3DD6C4]"
                >
                  {getContactIcon(link.type, {
                    size: 15,
                    className: "w-[15px] h-[15px]",
                    variant: "white",
                    "aria-hidden": true,
                  })}
                  <span className="break-all">{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GlassExperience({ experience }: { experience: ResumeContent["experience"] }) {
  if (!experience?.length) return null;

  return (
    <section id="experience" aria-labelledby="experience-title">
      <SectionTitle id="experience">Experience</SectionTitle>
      <ol className="gl-pane rounded-3xl divide-y divide-white/10">
        {experience.map((job) => (
          <li key={`${job.title}-${job.company}-${job.start_date}`} className="p-6 md:p-8">
            <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-6">
              <h3 className="text-lg md:text-xl font-semibold text-white">{job.title}</h3>
              <p className="text-sm text-[#8C95B3] shrink-0 tabular-nums">
                {formatDateRange(job.start_date, job.end_date)}
              </p>
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 text-[#D7DCEC]">
              <span className="font-medium">{job.company}</span>
              {job.location && <span className="text-[#8C95B3]">{job.location}</span>}
            </p>
            {job.description && (
              <p className="mt-4 leading-relaxed text-[#B8C0D9] max-w-[68ch]">{job.description}</p>
            )}
            {job.highlights && job.highlights.length > 0 && (
              <ul className="mt-4 space-y-2 max-w-[68ch]">
                {job.highlights.map((item, i) => (
                  <li
                    key={`${job.title}-${item}-${i}`}
                    className="relative pl-5 text-[15px] leading-relaxed text-[#B8C0D9]"
                  >
                    <span
                      className="absolute left-0 top-[0.6em] w-2 h-2 rounded-full bg-linear-to-br from-[#3DD6C4] to-[#8B7CF6]"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function GlassProjects({ projects }: { projects: ResumeContent["projects"] }) {
  if (!projects?.length) return null;
  const isOdd = projects.length % 2 === 1;

  return (
    <section id="projects" aria-labelledby="projects-title">
      <SectionTitle id="projects">Projects</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((project, i) => (
          <article
            key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
            className={`gl-pane gl-pane-soft rounded-[20px] p-6 flex flex-col ${
              isOdd && i === projects.length - 1 ? "md:col-span-2" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-lg font-semibold text-white">
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-[#3DD6C4] transition-colors focus-visible:outline-2 focus-visible:outline-[#3DD6C4]"
                  >
                    {project.title}
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </a>
                ) : (
                  project.title
                )}
              </h3>
              {project.year && (
                <span className="text-sm text-[#8C95B3] shrink-0">{project.year}</span>
              )}
            </div>
            {project.description && (
              <p className="mt-3 text-[15px] leading-relaxed text-[#B8C0D9]">
                {project.description}
              </p>
            )}
            {project.technologies && project.technologies.length > 0 && (
              <ul
                className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-1.5"
                aria-label="Technologies"
              >
                {project.technologies.map((tech) => (
                  <li
                    key={tech}
                    className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-[#D7DCEC]"
                  >
                    {tech}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function GlassSkills({ skills }: { skills: ResumeContent["skills"] }) {
  if (!skills?.length) return null;

  return (
    <section id="skills" aria-labelledby="skills-title">
      <SectionTitle id="skills">Skills</SectionTitle>
      <dl className="gl-pane rounded-3xl p-6 md:p-8 space-y-5">
        {skills.map((group) => (
          <div key={group.category} className="grid gap-2 md:grid-cols-[12rem_1fr] md:gap-6">
            <dt className="text-sm font-medium text-[#8C95B3] md:pt-1.5">{group.category}</dt>
            <dd>
              <ul className="flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-sm text-[#E6E9F4]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GlassEducation({
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
    <section id="education" aria-labelledby="education-title">
      <SectionTitle id="education">{hasEducation ? "Education" : "Certifications"}</SectionTitle>
      <div
        className={`gl-pane rounded-3xl p-6 md:p-8 grid gap-8 ${
          hasEducation && hasCerts ? "md:grid-cols-2 md:gap-12" : ""
        }`}
      >
        {hasEducation && (
          <ul className="space-y-6">
            {education?.map((edu) => (
              <li key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}>
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-semibold text-white">{edu.degree}</h3>
                  {edu.graduation_date && (
                    <span className="text-sm text-[#8C95B3] shrink-0">
                      {formatYear(edu.graduation_date)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[#B8C0D9]">{edu.institution}</p>
                {(edu.location || edu.gpa) && (
                  <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-[#8C95B3]">
                    {edu.location && <span>{edu.location}</span>}
                    {edu.gpa && <span>GPA {edu.gpa}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {hasCerts && (
          <div>
            {hasEducation && (
              <h3 className="text-sm font-medium text-[#8C95B3] mb-4">Certifications</h3>
            )}
            <ul className="space-y-5">
              {certifications?.map((cert) => (
                <li key={`${cert.name}-${cert.issuer}-${cert.date ?? ""}`}>
                  <p className="font-semibold text-white">
                    {cert.url ? (
                      <a
                        href={cert.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:text-[#3DD6C4] transition-colors focus-visible:outline-2 focus-visible:outline-[#3DD6C4]"
                      >
                        {cert.name}
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    ) : (
                      cert.name
                    )}
                  </p>
                  {(cert.issuer || cert.date) && (
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-[#8C95B3]">
                      {cert.issuer && <span>{cert.issuer}</span>}
                      {cert.date && <span>{formatShortDate(cert.date)}</span>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export const GlassMorphic: React.FC<TemplateProps> = ({ content, profile, isPreview }) => {
  const visible = {
    about: true,
    experience: Boolean(content.experience?.length),
    projects: Boolean(content.projects?.length),
    skills: Boolean(content.skills?.length),
    education: Boolean(content.education?.length || content.certifications?.length),
  } satisfies Record<NavSection["id"], boolean>;

  const navSections = NAV_SECTIONS.filter((section) => visible[section.id]);

  return (
    <>
      <TemplateFontLinks href={FONT_URL} />

      <style>{`
        .glass-root { font-family: 'Sora', ui-sans-serif, system-ui, sans-serif; }
        .glass-aurora {
          background:
            radial-gradient(60vmax 45vmax at 12% -8%, rgba(61, 214, 196, 0.42), transparent 62%),
            radial-gradient(55vmax 50vmax at 96% 28%, rgba(139, 124, 246, 0.45), transparent 60%),
            radial-gradient(50vmax 40vmax at 18% 108%, rgba(242, 140, 184, 0.30), transparent 62%),
            #0B0F1A;
        }
        .gl-pane {
          background: linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035) 60%);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 24px 48px -28px rgba(3,5,12,0.7);
          -webkit-backdrop-filter: blur(22px) saturate(150%);
          backdrop-filter: blur(22px) saturate(150%);
        }
        .gl-pane-soft {
          background: rgba(255,255,255,0.05);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
        }
        .gl-hero {
          background: linear-gradient(150deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04) 55%, rgba(139,124,246,0.10));
          border-color: rgba(255,255,255,0.2);
        }
        .gl-orb { position: absolute; border-radius: 9999px; pointer-events: none; }
        .gl-orb-teal {
          width: clamp(180px, 30vw, 300px); aspect-ratio: 1;
          top: -60px; right: clamp(-40px, 4vw, 90px);
          background: radial-gradient(circle at 35% 30%, #7FF0E2, #3DD6C4 45%, #1E7F95);
        }
        .gl-orb-rose {
          width: clamp(120px, 18vw, 190px); aspect-ratio: 1;
          bottom: -70px; right: clamp(24px, 14vw, 220px);
          opacity: 0.6;
          background: radial-gradient(circle at 35% 30%, #FFC2DA, #F28CB8 50%, #8B7CF6);
        }
        .gl-lens {
          background: conic-gradient(from 200deg, #3DD6C4, #8B7CF6, #F28CB8, #3DD6C4);
        }
        .glass-root ::selection { background: rgba(61, 214, 196, 0.35); color: #fff; }
      `}</style>

      <div className="glass-root relative min-h-screen bg-[#0B0F1A] text-[#B8C0D9] overflow-x-hidden">
        <div className="glass-aurora fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />

        {!isPreview && <GlassNav sections={navSections} email={content.contact.email} />}

        <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 md:pt-20 pb-32 space-y-16 md:space-y-20">
          <GlassHero content={content} profile={profile} />
          <GlassExperience experience={content.experience} />
          <GlassProjects projects={content.projects} />
          <GlassSkills skills={content.skills} />
          <GlassEducation education={content.education} certifications={content.certifications} />

          <footer className="flex flex-col items-center gap-5 pt-6 text-sm text-[#8C95B3]">
            <ShareBar
              handle={profile.handle}
              title={`${content.full_name}'s portfolio`}
              name={content.full_name}
              variant="glass-morphic"
            />
            <p suppressHydrationWarning>
              &copy; {new Date().getFullYear()} {content.full_name}
            </p>
          </footer>
        </main>
      </div>
    </>
  );
};
