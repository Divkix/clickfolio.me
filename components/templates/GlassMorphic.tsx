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
import { formatDateRange, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { ResumeContent } from "@/lib/types/database";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

const FONT_URL = "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap";

const NAV_SECTIONS = [
  { id: "about", label: "About", icon: User },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "projects", label: "Projects", icon: FolderGit2 },
  { id: "skills", label: "Skills", icon: Wrench },
  { id: "education", label: "Education", icon: GraduationCap },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: LucideIcon }>;

type NavSection = (typeof NAV_SECTIONS)[number];

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7FE3D4]";

/** Section heading set like lettering sandblasted into a pane: light, slightly recessed. */
function EtchedTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={`${id}-title`}
      className="gl-etched mb-5 text-[1.75rem] font-light leading-tight tracking-[-0.02em] md:mb-6 md:text-[2.25rem]"
    >
      {children}
    </h2>
  );
}

/** Sticky frosted bar: sits in document flow, so content scrolls under it instead of being covered. */
function GlassBar({
  name,
  sections,
  email,
}: {
  name: string;
  sections: NavSection[];
  email?: string;
}) {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <nav
        aria-label="Sections"
        className="gl-pane gl-bar mx-auto flex max-w-5xl items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-4"
      >
        <a
          href="#about"
          className={`min-w-0 flex-1 truncate text-sm font-medium text-[#F4F6FB] ${FOCUS_RING}`}
        >
          {name}
        </a>
        <ul className="no-scrollbar flex min-w-0 items-center overflow-x-auto">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-label={section.label}
                  className={`flex h-9 items-center gap-2 rounded-xl px-2.5 text-sm text-[#C4CBE0] transition-colors hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
                >
                  <Icon size={17} strokeWidth={1.75} aria-hidden="true" className="md:hidden" />
                  <span className="hidden md:inline">{section.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
        {email && (
          <a
            href={`mailto:${email}`}
            aria-label={`Email ${email}`}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF6F4] text-[#0B0F1A] transition-colors hover:bg-white ${FOCUS_RING}`}
          >
            <Mail size={16} strokeWidth={2} aria-hidden="true" />
          </a>
        )}
      </nav>
    </header>
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
    <section
      id="about"
      aria-labelledby="about-title"
      className="gl-pane gl-hero relative grid scroll-mt-24 overflow-hidden rounded-[28px] md:grid-cols-[minmax(0,1fr)_minmax(13rem,30%)]"
    >
      {/* Reeded insert: the backdrop's light shaft broken into flutes, as through ribbed glass. */}
      <div
        className="gl-reeded relative order-first flex min-h-16 items-center justify-center border-b border-white/10 p-6 md:order-none md:min-h-full md:border-b-0 md:border-l"
        aria-hidden={profile.avatar_url ? undefined : true}
      >
        {profile.avatar_url && (
          <div className="gl-bezel relative h-24 w-24 rounded-full p-1 md:h-40 md:w-40">
            <img
              src={profile.avatar_url}
              alt={`Portrait of ${content.full_name}`}
              width={160}
              height={160}
              fetchPriority="high"
              decoding="async"
              className="h-full w-full rounded-full object-cover"
            />
          </div>
        )}
      </div>

      <div className="min-w-0 p-7 sm:p-10 md:order-first md:p-14">
        <h1
          id="about-title"
          className="text-[2.75rem] leading-[1.02] font-light tracking-[-0.045em] break-words text-[#F7FAFF] sm:text-6xl md:text-[5.25rem]"
        >
          {content.full_name}
        </h1>
        {content.headline && (
          <p className="mt-5 max-w-2xl text-lg leading-snug font-normal text-[#DCE3F2] md:text-[1.4rem]">
            {content.headline}
          </p>
        )}
        {content.contact.location && (
          <p className="mt-4 flex items-center gap-2 text-sm text-[#AEB7CF]">
            <MapPin size={15} aria-hidden="true" />
            {content.contact.location}
          </p>
        )}

        {content.summary && (
          <p className="mt-9 max-w-[60ch] border-t border-white/10 pt-7 text-base leading-relaxed font-light text-[#CBD2E4] md:text-[1.075rem]">
            {content.summary}
          </p>
        )}

        {contactLinks.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {contactLinks.map((link) => (
              <li key={link.type} className="min-w-0">
                <a
                  href={link.href}
                  target={link.isExternal ? "_blank" : undefined}
                  rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                  className={`inline-flex items-center gap-2 border-b border-white/20 pb-0.5 text-sm text-[#E6EAF4] transition-colors hover:border-[#7FE3D4] hover:text-white ${FOCUS_RING}`}
                >
                  {getContactIcon(link.type, {
                    size: 15,
                    className: "w-[15px] h-[15px] shrink-0 opacity-80",
                    variant: "white",
                    "aria-hidden": true,
                  })}
                  <span className="break-all">{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function GlassExperience({ experience }: { experience: ResumeContent["experience"] }) {
  if (!experience?.length) return null;

  return (
    <section id="experience" aria-labelledby="experience-title" className="scroll-mt-24">
      <EtchedTitle id="experience">Experience</EtchedTitle>
      <ol className="gl-pane rounded-3xl">
        {experience.map((job) => (
          <li
            key={`${job.title}-${job.company}-${job.start_date}`}
            className="grid gap-x-8 gap-y-2 border-t border-white/[0.08] p-6 first:border-t-0 md:grid-cols-[10.5rem_minmax(0,1fr)] md:p-8"
          >
            <div className="text-sm text-[#A3ADC8] md:pt-1">
              <p className="tabular-nums">{formatDateRange(job.start_date, job.end_date)}</p>
              {job.location && <p className="mt-0.5 hidden md:block">{job.location}</p>}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg leading-snug font-medium break-words text-white md:text-xl">
                {job.title}
              </h3>
              <p className="mt-0.5 flex flex-wrap gap-x-3 break-words text-[#D7DCEC]">
                <span>{job.company}</span>
                {job.location && <span className="text-[#A3ADC8] md:hidden">{job.location}</span>}
              </p>
              {job.description && (
                <p className="mt-4 max-w-[66ch] leading-relaxed font-light text-[#C4CBE0]">
                  {job.description}
                </p>
              )}
              {job.highlights && job.highlights.length > 0 && (
                <ul className="mt-4 max-w-[66ch] space-y-2">
                  {job.highlights.map((item, i) => (
                    <li
                      key={`${job.title}-${item}-${i}`}
                      className="relative pl-5 text-[15px] leading-relaxed font-light break-words text-[#C4CBE0]"
                    >
                      <span
                        className="absolute top-[0.72em] left-0 h-px w-2.5 bg-[#7FE3D4]"
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

function GlassProjects({ projects }: { projects: ResumeContent["projects"] }) {
  if (!projects?.length) return null;
  const isOdd = projects.length % 2 === 1;

  return (
    <section id="projects" aria-labelledby="projects-title" className="scroll-mt-24">
      <EtchedTitle id="projects">Projects</EtchedTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {projects.map((project, i) => (
          <article
            key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
            className={`gl-pane gl-pane-thin flex min-w-0 flex-col rounded-[20px] p-6 ${
              isOdd && i === projects.length - 1 ? "md:col-span-2" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="min-w-0 text-lg font-medium break-words text-white">
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="ugc nofollow noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 transition-colors hover:text-[#7FE3D4] ${FOCUS_RING}`}
                  >
                    {project.title}
                    <ArrowUpRight size={17} aria-hidden="true" className="shrink-0" />
                  </a>
                ) : (
                  project.title
                )}
              </h3>
              {project.year && (
                <span className="shrink-0 text-sm text-[#A3ADC8] tabular-nums">{project.year}</span>
              )}
            </div>
            {project.description && (
              <p className="mt-3 text-[15px] leading-relaxed font-light break-words text-[#C4CBE0]">
                {project.description}
              </p>
            )}
            {project.technologies && project.technologies.length > 0 && (
              <ul
                className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-5 text-[13px] text-[#A9DCD5]"
                aria-label="Technologies"
              >
                {project.technologies.map((tech) => (
                  <li key={tech} className="break-words">
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
    <section id="skills" aria-labelledby="skills-title" className="scroll-mt-24">
      <EtchedTitle id="skills">Skills</EtchedTitle>
      <dl className="gl-pane rounded-3xl">
        {skills.map((group) => (
          <div
            key={group.category}
            className="grid gap-x-8 gap-y-2 border-t border-white/[0.08] px-6 py-5 first:border-t-0 md:grid-cols-[10.5rem_minmax(0,1fr)] md:px-8"
          >
            <dt className="text-sm break-words text-[#A3ADC8] md:pt-px">{group.category}</dt>
            <dd className="min-w-0">
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[15px] text-[#E6E9F4]">
                {group.items.map((item) => (
                  <li key={item} className="break-words">
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
    <section id="education" aria-labelledby="education-title" className="scroll-mt-24">
      <EtchedTitle id="education">{hasEducation ? "Education" : "Certifications"}</EtchedTitle>
      <div
        className={`gl-pane grid gap-8 rounded-3xl p-6 md:p-8 ${
          hasEducation && hasCerts ? "md:grid-cols-2 md:gap-12" : ""
        }`}
      >
        {hasEducation && (
          <ul className="space-y-6">
            {education?.map((edu) => (
              <li key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}>
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="min-w-0 font-medium break-words text-white">{edu.degree}</h3>
                  {edu.graduation_date && (
                    <span className="shrink-0 text-sm text-[#A3ADC8] tabular-nums">
                      {formatYear(edu.graduation_date)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 break-words text-[#C4CBE0]">{edu.institution}</p>
                {(edu.location || edu.gpa) && (
                  <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-[#A3ADC8]">
                    {edu.location && <span>{edu.location}</span>}
                    {edu.gpa && <span>GPA {edu.gpa}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {hasCerts && (
          <div className={hasEducation ? "md:border-l md:border-white/[0.08] md:pl-12" : ""}>
            {hasEducation && <h3 className="gl-etched mb-4 text-lg font-light">Certifications</h3>}
            <ul className="space-y-5">
              {certifications?.map((cert) => (
                <li key={`${cert.name}-${cert.issuer}-${cert.date ?? ""}`}>
                  <p className="font-medium break-words text-white">
                    {cert.url ? (
                      <a
                        href={cert.url}
                        target="_blank"
                        rel="ugc nofollow noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 transition-colors hover:text-[#7FE3D4] ${FOCUS_RING}`}
                      >
                        {cert.name}
                        <ArrowUpRight size={15} aria-hidden="true" className="shrink-0" />
                      </a>
                    ) : (
                      cert.name
                    )}
                  </p>
                  {(cert.issuer || cert.date) && (
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-[#A3ADC8]">
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
        .glass-root, .glass-root h1, .glass-root h2, .glass-root h3 {
          font-family: 'Sora', ui-sans-serif, system-ui, sans-serif;
        }
        /* One key light, high and to the left, falling across a deep ink room. */
        .glass-backdrop {
          background:
            radial-gradient(70vmax 48vmax at 6% -14%, rgba(196, 240, 236, 0.34), transparent 62%),
            linear-gradient(118deg, transparent 22%, rgba(127, 227, 212, 0.10) 34%, rgba(127, 227, 212, 0.035) 48%, transparent 60%),
            linear-gradient(172deg, #16203D 0%, #0D1326 46%, #090C18 100%);
        }
        /* Every pane is lit from the same corner: bright top-left edge, shade bottom-right, shadow cast down-right. */
        .gl-pane {
          position: relative;
          background: linear-gradient(135deg, rgba(255,255,255,0.11), rgba(255,255,255,0.04) 42%, rgba(255,255,255,0.025));
          border: 1px solid rgba(255,255,255,0.09);
          box-shadow:
            inset 1px 1px 0 rgba(255,255,255,0.20),
            inset -1px -1px 0 rgba(0,0,0,0.28),
            14px 26px 50px -30px rgba(2,4,10,0.85);
          -webkit-backdrop-filter: blur(24px) saturate(140%);
          backdrop-filter: blur(24px) saturate(140%);
        }
        .gl-hero {
          background: linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.03));
          border-color: rgba(255,255,255,0.13);
          box-shadow:
            inset 1px 1px 0 rgba(255,255,255,0.32),
            inset -1px -1px 0 rgba(0,0,0,0.32),
            24px 44px 80px -40px rgba(2,4,10,0.95);
          -webkit-backdrop-filter: blur(32px) saturate(150%);
          backdrop-filter: blur(32px) saturate(150%);
        }
        .gl-pane-thin {
          background: linear-gradient(135deg, rgba(255,255,255,0.075), rgba(255,255,255,0.02) 50%);
          box-shadow:
            inset 1px 1px 0 rgba(255,255,255,0.14),
            inset -1px -1px 0 rgba(0,0,0,0.22),
            8px 16px 32px -24px rgba(2,4,10,0.8);
        }
        .gl-bar {
          background: rgba(16, 22, 40, 0.62);
          box-shadow:
            inset 1px 1px 0 rgba(255,255,255,0.16),
            inset -1px -1px 0 rgba(0,0,0,0.3),
            0 14px 30px -20px rgba(2,4,10,0.9);
        }
        /* The light source itself: a tall window whose light falls across the room, mullions and all. */
        .glass-window {
          position: absolute;
          top: -12vh; left: 4vw;
          width: min(58vw, 760px); height: 92vh;
          transform: skewX(-22deg);
          transform-origin: top left;
          background:
            linear-gradient(90deg,
              transparent 0 calc(33.33% - 5px), rgba(9,12,24,0.85) calc(33.33% - 5px) calc(33.33% + 5px),
              transparent calc(33.33% + 5px) calc(66.66% - 5px), rgba(9,12,24,0.85) calc(66.66% - 5px) calc(66.66% + 5px),
              transparent calc(66.66% + 5px)),
            linear-gradient(180deg, transparent 0 calc(48% - 5px), rgba(9,12,24,0.85) calc(48% - 5px) calc(48% + 5px), transparent calc(48% + 5px)),
            linear-gradient(172deg, rgba(214,246,242,0.26), rgba(127,227,212,0.10) 55%, rgba(127,227,212,0) 100%);
          -webkit-mask-image: linear-gradient(180deg, #000 30%, transparent 100%);
          mask-image: linear-gradient(180deg, #000 30%, transparent 100%);
          filter: blur(3px);
        }
        .gl-reeded {
          background:
            repeating-linear-gradient(90deg,
              rgba(255,255,255,0) 0px,
              rgba(255,255,255,0.10) 5px,
              rgba(255,255,255,0.02) 9px,
              rgba(0,0,0,0.16) 12px,
              rgba(255,255,255,0) 13px),
            linear-gradient(118deg, rgba(255,255,255,0.04) 18%, rgba(214, 248, 243, 0.34) 34%, rgba(127, 227, 212, 0.16) 46%, rgba(60, 90, 140, 0.08) 66%, rgba(255,255,255,0.03));
        }
        .gl-bezel {
          background: linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.08) 45%, rgba(0,0,0,0.35));
          box-shadow: 10px 18px 36px -18px rgba(2,4,10,0.9);
        }
        .gl-etched {
          color: rgba(232, 240, 252, 0.88);
          text-shadow: 0 -1px 0 rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.10);
        }
        .glass-root ::selection { background: rgba(127, 227, 212, 0.35); color: #fff; }
      `}</style>

      <div className="glass-root relative min-h-screen overflow-x-clip bg-[#0B0F1A] text-[#C4CBE0]">
        <div
          className="glass-backdrop fixed inset-0 z-0 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <div className="glass-window" />
        </div>

        {!isPreview && (
          <GlassBar name={content.full_name} sections={navSections} email={content.contact.email} />
        )}

        <main className="relative z-10 mx-auto max-w-5xl space-y-16 px-4 pt-8 pb-16 sm:px-6 md:space-y-20 md:pt-14">
          <GlassHero content={content} profile={profile} />
          <GlassExperience experience={content.experience} />
          <GlassProjects projects={content.projects} />
          <GlassSkills skills={content.skills} />
          <GlassEducation education={content.education} certifications={content.certifications} />

          <footer className="flex flex-col items-center gap-5 pt-6 text-sm text-[#A3ADC8]">
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
