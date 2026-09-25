import { Award, BookMarked, GitCommitHorizontal, GraduationCap, MapPin } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateRange, formatShortDate, formatYear, getInitials } from "@/lib/templates/helpers";
import { techDotColor } from "@/lib/templates/tech-colors";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

type Content = TemplateProps["content"];

interface Tab {
  id: string;
  label: string;
  count?: number;
}

function buildTabs(content: Content): Tab[] {
  const { skills, experience, projects, education, certifications } = content;
  const hasEducation = (education?.length ?? 0) > 0;
  const hasCerts = (certifications?.length ?? 0) > 0;

  return [
    { id: "readme", label: "Overview" },
    ...(experience.length > 0
      ? [{ id: "experience", label: "Experience", count: experience.length }]
      : []),
    ...(projects && projects.length > 0
      ? [{ id: "projects", label: "Projects", count: projects.length }]
      : []),
    ...(skills && skills.length > 0 ? [{ id: "skills", label: "Skills" }] : []),
    ...(hasEducation || hasCerts
      ? [{ id: "education", label: hasEducation ? "Education" : "Certifications" }]
      : []),
  ];
}

const ACTIVE_TAB_CSS = [
  ".term-root:not(:has(:target)) a[href='#readme']",
  ...["readme", "experience", "projects", "skills", "education"].map(
    (id) => `.term-root:has(#${id}:target) a[href='#${id}']`,
  ),
].join(",\n");

function TabNav({ tabs }: { tabs: Tab[] }) {
  return (
    <nav
      aria-label="Sections"
      className="sticky top-0 z-40 border-b border-[#444c56] bg-[#22272e]/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1280px] overflow-x-auto px-4 md:px-8 no-scrollbar">
        {tabs.map((tab) => (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            className="term-tab flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm text-[#adbac7] hover:border-[#636e7b] focus-visible:outline-2 focus-visible:outline-[#539bf5] focus-visible:-outline-offset-2"
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-[#444c56]/70 px-2 text-xs font-medium tabular-nums text-[#cdd9e5]">
                {tab.count}
              </span>
            )}
          </a>
        ))}
      </div>
    </nav>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const sizing = "size-20 md:size-full md:max-w-[296px] md:aspect-square";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`Portrait of ${name}`}
        width={296}
        height={296}
        fetchPriority="high"
        decoding="async"
        className={`${sizing} shrink-0 rounded-full border border-[#444c56] object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizing} flex shrink-0 items-center justify-center rounded-full border border-[#444c56] bg-[#2d333b] text-2xl font-semibold text-[#cdd9e5] md:text-7xl`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

function ProfileSidebar({ content, avatarUrl }: { content: Content; avatarUrl: string | null }) {
  const links = getContactLinks(content.contact);

  return (
    <aside className="md:sticky md:top-20 md:self-start">
      <div className="flex items-center gap-4 md:block">
        <Avatar name={content.full_name} avatarUrl={avatarUrl} />
        <div className="min-w-0 md:mt-4">
          <h1 className="text-2xl font-semibold leading-tight text-[#cdd9e5] break-words md:text-[26px]">
            {content.full_name}
          </h1>
          {content.headline && (
            <p className="mt-1 hidden text-base text-[#adbac7] md:block">{content.headline}</p>
          )}
        </div>
      </div>
      {content.headline && (
        <p className="mt-3 text-base text-[#adbac7] md:hidden">{content.headline}</p>
      )}

      {links.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {links.map((link) => {
            const icon =
              link.type === "location" ? (
                <MapPin className="size-4" aria-hidden="true" />
              ) : (
                getContactIcon(link.type, {
                  size: 16,
                  className: "size-4",
                  variant: "white",
                  "aria-hidden": true,
                })
              );

            return (
              <li key={link.type} className="flex min-w-0 items-center gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center text-[#768390] opacity-80">
                  {icon}
                </span>
                {link.type === "location" ? (
                  <span className="min-w-0 break-words text-[#adbac7]">{link.label}</span>
                ) : (
                  <a
                    href={link.href}
                    target={link.isExternal ? "_blank" : undefined}
                    rel={link.isExternal ? "noopener noreferrer" : undefined}
                    className="min-w-0 break-all text-[#adbac7] hover:text-[#539bf5] hover:underline"
                  >
                    {link.label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-base font-semibold text-[#cdd9e5]">{children}</h2>;
}

function Readme({ handle, summary }: { handle: string; summary: string }) {
  return (
    <section
      id="readme"
      aria-label="About"
      className="scroll-mt-16 overflow-hidden rounded-md border border-[#444c56]"
    >
      <div className="border-b border-[#444c56] bg-[#2d333b] px-4 py-2.5 text-sm text-[#adbac7]">
        <span className="text-[#768390]">{handle} /</span> README.md
      </div>
      <div className="p-5 md:p-6">
        <div className="font-mono-term rounded-md bg-[#1c2128] px-4 py-3 text-[13px] leading-6 md:px-5 md:py-4 md:text-[15px] md:leading-7">
          <p>
            <span className="select-none text-[#768390]">$ </span>
            <span className="text-[#cdd9e5]">whoami</span>
          </p>
          <p className="text-[#8ddb8c]">
            {handle}
            <span className="term-caret" aria-hidden="true" />
          </p>
        </div>
        {summary && (
          <p className="mt-5 max-w-[68ch] text-[15px] leading-7 text-[#adbac7]">{summary}</p>
        )}
      </div>
    </section>
  );
}

function ProjectsSection({ projects }: { projects: NonNullable<Content["projects"]> }) {
  return (
    <section id="projects" aria-labelledby="projects-title" className="scroll-mt-16">
      <SectionTitle>
        <span id="projects-title">Projects</span>
      </SectionTitle>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {projects.map((project) => (
          <li
            key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
            className="flex min-w-0 flex-col rounded-md border border-[#444c56] p-4"
          >
            <div className="flex items-start gap-2">
              <BookMarked className="mt-0.5 size-4 shrink-0 text-[#768390]" aria-hidden="true" />
              <h3 className="min-w-0 flex-1 break-words text-sm font-semibold">
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#539bf5] hover:underline"
                  >
                    {project.title}
                  </a>
                ) : (
                  <span className="text-[#cdd9e5]">{project.title}</span>
                )}
              </h3>
              {project.year && (
                <span className="shrink-0 rounded-full border border-[#444c56] px-2 text-xs leading-5 text-[#768390]">
                  {project.year}
                </span>
              )}
            </div>
            <p className="mt-2 flex-1 text-sm leading-6 text-[#adbac7]">{project.description}</p>
            {project.technologies && project.technologies.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#768390]">
                {project.technologies.map((tech) => (
                  <li key={`${project.title}-${tech}`} className="flex items-center gap-1.5">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: techDotColor(tech) }}
                      aria-hidden="true"
                    />
                    {tech}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExperienceSection({ experience }: { experience: Content["experience"] }) {
  return (
    <section id="experience" aria-labelledby="experience-title" className="scroll-mt-16">
      <SectionTitle>
        <span id="experience-title">Experience</span>
      </SectionTitle>
      <ol>
        {experience.map((job, index) => (
          <li
            key={`${job.title}-${job.company}-${job.start_date}`}
            className="relative pb-8 pl-12 last:pb-0"
          >
            {index < experience.length - 1 && (
              <span
                className="absolute top-8 bottom-0 left-[15px] w-0.5 bg-[#444c56]"
                aria-hidden="true"
              />
            )}
            <span
              className="absolute top-0 left-0 flex size-8 items-center justify-center rounded-full border border-[#444c56] bg-[#2d333b] text-[#768390]"
              aria-hidden="true"
            >
              <GitCommitHorizontal className="size-4" />
            </span>
            <div className="flex flex-col gap-1 pt-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <h3 className="min-w-0 break-words text-[15px] font-semibold text-[#cdd9e5]">
                {job.title} <span className="font-normal text-[#768390]">at</span> {job.company}
              </h3>
              <p className="shrink-0 text-sm tabular-nums text-[#768390]">
                {formatDateRange(job.start_date, job.end_date)}
              </p>
            </div>
            {job.location && <p className="mt-0.5 text-sm text-[#768390]">{job.location}</p>}
            {job.description && (
              <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[#adbac7]">
                {job.description}
              </p>
            )}
            {job.highlights && job.highlights.length > 0 && (
              <ul className="mt-2 max-w-[68ch] list-disc space-y-1 pl-5 text-sm leading-6 text-[#adbac7] marker:text-[#636e7b]">
                {job.highlights.map((highlight) => (
                  <li key={`${job.title}-${highlight}`}>{highlight}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function SkillsSection({ skills }: { skills: NonNullable<Content["skills"]> }) {
  return (
    <section id="skills" aria-labelledby="skills-title" className="scroll-mt-16">
      <SectionTitle>
        <span id="skills-title">Skills</span>
      </SectionTitle>
      <dl className="divide-y divide-[#444c56] rounded-md border border-[#444c56]">
        {skills.map((group) => (
          <div
            key={group.category}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6"
          >
            <dt className="shrink-0 text-sm font-medium text-[#cdd9e5] sm:w-40">
              {group.category}
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <span
                  key={`${group.category}-${item}`}
                  className="rounded-full bg-[#4184e4]/15 px-2.5 py-0.5 text-xs font-medium leading-5 text-[#6cb6ff]"
                >
                  {item}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function EducationSection({
  education,
  certifications,
}: {
  education: NonNullable<Content["education"]>;
  certifications: NonNullable<Content["certifications"]>;
}) {
  return (
    <div id="education" className="grid scroll-mt-16 grid-cols-1 gap-8 lg:grid-cols-2">
      {education.length > 0 && (
        <section aria-labelledby="education-title">
          <SectionTitle>
            <span id="education-title">Education</span>
          </SectionTitle>
          <ul className="space-y-4">
            {education.map((edu) => (
              <li
                key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
                className="flex gap-3"
              >
                <GraduationCap
                  className="mt-0.5 size-4 shrink-0 text-[#768390]"
                  aria-hidden="true"
                />
                <div className="min-w-0 text-sm leading-6">
                  <h3 className="font-semibold text-[#cdd9e5]">{edu.degree}</h3>
                  <p className="text-[#adbac7]">{edu.institution}</p>
                  {(edu.graduation_date || edu.gpa) && (
                    <p className="text-[#768390]">
                      {edu.graduation_date && <span>{formatYear(edu.graduation_date)}</span>}
                      {edu.graduation_date && edu.gpa && ", "}
                      {edu.gpa && <span>GPA {edu.gpa}</span>}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {certifications.length > 0 && (
        <section aria-labelledby="certifications-title">
          <SectionTitle>
            <span id="certifications-title">Certifications</span>
          </SectionTitle>
          <ul className="space-y-4">
            {certifications.map((cert) => (
              <li key={`${cert.name}-${cert.issuer}-${cert.date ?? ""}`} className="flex gap-3">
                <Award className="mt-0.5 size-4 shrink-0 text-[#768390]" aria-hidden="true" />
                <div className="min-w-0 text-sm leading-6">
                  <h3 className="font-semibold">
                    {cert.url ? (
                      <a
                        href={cert.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#539bf5] hover:underline"
                      >
                        {cert.name}
                      </a>
                    ) : (
                      <span className="text-[#cdd9e5]">{cert.name}</span>
                    )}
                  </h3>
                  {cert.issuer && <p className="text-[#adbac7]">{cert.issuer}</p>}
                  {cert.date && <p className="text-[#768390]">{formatShortDate(cert.date)}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const DevTerminal: React.FC<TemplateProps> = ({ content, profile }) => {
  const { full_name, summary, experience, education, skills, projects, certifications } = content;
  const tabs = buildTabs(content);

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Mona+Sans:wght@400;500;600;700&family=Martian+Mono:wght@400&display=swap" />

      <div className="term-root font-sans-term min-h-screen w-full overflow-x-hidden bg-[#22272e] text-[#adbac7] selection:bg-[#316dca] selection:text-white">
        <style>{`
          .font-sans-term { font-family: 'Mona Sans', -apple-system, 'Segoe UI', sans-serif; }
          .font-mono-term { font-family: 'Martian Mono', ui-monospace, monospace; }
          ${ACTIVE_TAB_CSS} {
            color: #cdd9e5;
            font-weight: 600;
            border-bottom-color: #ec775c;
          }
          .term-caret {
            display: inline-block;
            width: 0.55em;
            height: 1.1em;
            margin-left: 0.35em;
            vertical-align: -0.2em;
            background: #8ddb8c;
          }
          @media (prefers-reduced-motion: no-preference) {
            .term-caret { animation: term-blink 1.1s steps(1) infinite; }
          }
          @keyframes term-blink { 50% { opacity: 0; } }
        `}</style>

        <TabNav tabs={tabs} />

        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-4 py-8 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:px-8 lg:grid-cols-[296px_minmax(0,1fr)]">
          <ProfileSidebar content={content} avatarUrl={profile.avatar_url} />

          <main className="min-w-0 space-y-10">
            <Readme handle={profile.handle} summary={summary} />

            {projects && projects.length > 0 && <ProjectsSection projects={projects} />}

            {experience.length > 0 && <ExperienceSection experience={experience} />}

            {skills && skills.length > 0 && <SkillsSection skills={skills} />}

            {((education?.length ?? 0) > 0 || (certifications?.length ?? 0) > 0) && (
              <EducationSection education={education ?? []} certifications={certifications ?? []} />
            )}

            <footer className="flex flex-col gap-4 border-t border-[#444c56] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#768390]" suppressHydrationWarning>
                &copy; {new Date().getFullYear()} {full_name}
              </p>
              <ShareBar
                handle={profile.handle}
                title={`${full_name}'s Portfolio`}
                name={full_name}
                variant="dev-terminal"
              />
            </footer>
          </main>
        </div>
      </div>
    </>
  );
};
