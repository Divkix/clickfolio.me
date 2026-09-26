import { Award, FileText, Folder, GraduationCap, HardDrive, User, Wrench } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatShortDate, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A late-90s desktop: every resume section is a bevelled window on a teal wallpaper, desktop
// icons jump to each window, and the taskbar closes the page. Pure CSS, no client JS.

type Content = TemplateProps["content"];

const FOCUS = "focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black";

function dateSpan(start?: string, end?: string | null): string | null {
  if (!start?.trim()) return end?.trim() ? formatShortDate(end) : null;

  return `${formatShortDate(start)} – ${end?.trim() ? formatShortDate(end) : "Present"}`;
}

function Window({
  id,
  title,
  icon,
  status,
  className = "",
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  status?: string;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`ros-raised scroll-mt-4 min-w-0 bg-[#C0C0C0] p-[3px] ${className}`}
    >
      <div className="ros-titlebar flex items-center gap-2 px-1.5 py-[3px] text-white">
        <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
          {icon}
        </span>
        <h2
          id={`${id}-title`}
          className="font-pixel-ros min-w-0 flex-1 truncate text-[15px] leading-5 tracking-wide"
        >
          {title}
        </h2>
        <span className="flex shrink-0 gap-[2px]" aria-hidden="true">
          {["_", "□", "×"].map((glyph) => (
            <span
              key={glyph}
              className="ros-raised flex h-[14px] w-4 items-center justify-center bg-[#C0C0C0] text-[11px] leading-none font-bold text-black"
            >
              {glyph}
            </span>
          ))}
        </span>
      </div>
      <div className="px-3 pt-3 pb-2 md:px-4 md:pt-4">{children}</div>
      {status && (
        <p className="ros-sunken mx-[2px] mb-[2px] truncate px-2 py-0.5 text-xs text-[#222]">
          {status}
        </p>
      )}
    </section>
  );
}

function DesktopIcon({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}): React.ReactElement {
  return (
    <li>
      <a
        href={href}
        className={`group flex w-20 flex-col items-center gap-1 text-center text-xs text-white ${FOCUS} focus-visible:outline-white`}
      >
        <span
          className="flex size-10 items-center justify-center text-white drop-shadow-[1px_1px_0_#000]"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="px-1 leading-tight [text-shadow:1px_1px_0_#000] group-hover:bg-[#000080] group-focus-visible:bg-[#000080]">
          {label}
        </span>
      </a>
    </li>
  );
}

function Portrait({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`Portrait of ${name}`}
        width={112}
        height={112}
        fetchPriority="high"
        decoding="async"
        className="ros-sunken size-24 shrink-0 bg-white object-cover p-[2px] [image-rendering:auto] md:size-28"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="ros-sunken font-pixel-ros flex size-24 shrink-0 items-center justify-center bg-[#008080] text-4xl text-white md:size-28"
    >
      {getInitials(name)}
    </div>
  );
}

function AboutWindow({ content, avatarUrl }: { content: Content; avatarUrl: string | null }) {
  const links = getContactLinks(content.contact).filter((link) => link.type !== "location");

  return (
    <Window
      id="about"
      title="About_Me.txt - Notepad"
      icon={<FileText className="size-4" />}
      status={content.contact.location ? `Location: ${content.contact.location}` : undefined}
      className="lg:col-span-12"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Portrait name={content.full_name} avatarUrl={avatarUrl} />
        <div className="min-w-0 flex-1">
          <h1 className="font-pixel-ros text-[clamp(2rem,6vw,3.25rem)] leading-[1.05] break-words text-black">
            {content.full_name}
          </h1>
          {content.headline && (
            <p className="mt-1 text-base font-semibold text-[#000080] md:text-lg">
              {content.headline}
            </p>
          )}
          {links.length > 0 && (
            <ul aria-label="Contact" className="mt-3 flex flex-wrap gap-2">
              {links.map((link) => (
                <li key={link.type} className="min-w-0">
                  <a
                    href={link.href}
                    target={link.isExternal ? "_blank" : undefined}
                    rel={link.isExternal ? "noopener noreferrer" : undefined}
                    className={`ros-raised inline-flex max-w-full items-center gap-1.5 bg-[#C0C0C0] px-2.5 py-1 text-sm text-black active:[box-shadow:inset_1px_1px_#0a0a0a,inset_-1px_-1px_#fff] ${FOCUS}`}
                  >
                    {getContactIcon(link.type, {
                      size: 14,
                      className: "size-3.5 shrink-0",
                      "aria-hidden": true,
                    })}
                    <span className="min-w-0 truncate">{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {content.summary && (
        <div className="ros-sunken mt-4 bg-white px-3 py-2.5 text-[15px] leading-7 text-black">
          <p className="max-w-[72ch] whitespace-pre-line">{content.summary}</p>
        </div>
      )}
    </Window>
  );
}

function ExperienceWindow({ experience }: { experience: Content["experience"] }) {
  return (
    <Window
      id="experience"
      title="C:\Career\Experience"
      icon={<Folder className="size-4" />}
      status={`${experience.length} object(s)`}
      className="lg:col-span-7"
    >
      <ol className="ros-sunken divide-y divide-dotted divide-[#808080] bg-white">
        {experience.map((job) => {
          const dates = dateSpan(job.start_date, job.end_date);

          return (
            <li key={`${job.title}-${job.company}-${job.start_date}`} className="px-3 py-3">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <h3 className="min-w-0 text-[15px] font-bold break-words text-black">
                  {job.title}
                  {job.company && (
                    <span className="font-normal text-[#000080]"> @ {job.company}</span>
                  )}
                </h3>
                {dates && (
                  <p className="shrink-0 font-mono text-xs text-[#444] tabular-nums">{dates}</p>
                )}
              </div>
              {job.location && <p className="text-xs text-[#555]">{job.location}</p>}
              {job.description && (
                <p className="mt-1.5 text-sm leading-6 text-[#222]">{job.description}</p>
              )}
              {job.highlights && job.highlights.length > 0 && (
                <ul className="mt-1.5 space-y-1 text-sm leading-6 text-[#222]">
                  {job.highlights.map((highlight) => (
                    <li key={`${job.title}-${highlight}`} className="flex gap-2">
                      <span className="shrink-0 text-[#000080]" aria-hidden="true">
                        ►
                      </span>
                      <span className="min-w-0">{highlight}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </Window>
  );
}

function SkillsWindow({ skills }: { skills: NonNullable<Content["skills"]> }) {
  return (
    <Window
      id="skills"
      title="System Properties"
      icon={<Wrench className="size-4" />}
      className="lg:col-span-5"
    >
      <div className="space-y-3">
        {skills.map((group) => (
          <fieldset
            key={group.category}
            className="min-w-0 border border-[#808080] px-3 pt-1 pb-3 shadow-[1px_1px_0_#fff,inset_1px_1px_0_#fff]"
          >
            {group.category && (
              <legend className="px-1 text-sm font-semibold text-black">{group.category}</legend>
            )}
            <ul className="flex flex-wrap gap-1.5">
              {group.items.filter(Boolean).map((item) => (
                <li
                  key={`${group.category}-${item}`}
                  className="ros-sunken bg-white px-2 py-0.5 text-[13px] text-black"
                >
                  {item}
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>
    </Window>
  );
}

function ProjectsWindow({ projects }: { projects: NonNullable<Content["projects"]> }) {
  return (
    <Window
      id="projects"
      title="My Projects"
      icon={<HardDrive className="size-4" />}
      status={`${projects.length} object(s)`}
      className="lg:col-span-12"
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <li
            key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
            className="ros-sunken flex min-w-0 gap-3 bg-white p-3"
          >
            <Folder
              className="mt-0.5 size-8 shrink-0 fill-[#F6D66B] text-[#8A6D1C]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-bold break-words text-black">
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-[#0000EE] underline visited:text-[#551A8B] ${FOCUS}`}
                  >
                    {project.title}
                  </a>
                ) : (
                  project.title
                )}
                {project.year && (
                  <span className="ml-2 font-mono text-xs font-normal text-[#555]">
                    {project.year}
                  </span>
                )}
              </h3>
              {project.description && (
                <p className="mt-1 text-sm leading-6 text-[#222]">{project.description}</p>
              )}
              {project.technologies && project.technologies.length > 0 && (
                <p className="mt-1.5 font-mono text-xs text-[#555]">
                  {project.technologies.join(" · ")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Window>
  );
}

function CredentialsWindow({
  education,
  certifications,
}: {
  education: NonNullable<Content["education"]>;
  certifications: NonNullable<Content["certifications"]>;
}) {
  return (
    <Window
      id="education"
      title="Credentials"
      icon={<GraduationCap className="size-4" />}
      className="lg:col-span-12"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {education.length > 0 && (
          <fieldset className="min-w-0 border border-[#808080] px-3 pt-1 pb-3 shadow-[1px_1px_0_#fff,inset_1px_1px_0_#fff]">
            <legend className="px-1 text-sm font-semibold text-black">Education</legend>
            <ul className="space-y-3">
              {education.map((edu) => (
                <li
                  key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
                  className="flex gap-2.5"
                >
                  <GraduationCap
                    className="mt-0.5 size-5 shrink-0 text-[#000080]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 text-sm leading-6">
                    <h3 className="font-bold break-words text-black">{edu.degree}</h3>
                    <p className="text-[#222]">
                      {edu.institution}
                      {edu.location && <span className="text-[#555]">, {edu.location}</span>}
                    </p>
                    {(edu.graduation_date || edu.gpa) && (
                      <p className="font-mono text-xs text-[#555]">
                        {edu.graduation_date && formatYear(edu.graduation_date)}
                        {edu.graduation_date && edu.gpa && " · "}
                        {edu.gpa && `GPA ${edu.gpa}`}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {certifications.length > 0 && (
          <fieldset className="min-w-0 border border-[#808080] px-3 pt-1 pb-3 shadow-[1px_1px_0_#fff,inset_1px_1px_0_#fff]">
            <legend className="px-1 text-sm font-semibold text-black">Certificates</legend>
            <ul className="space-y-3">
              {certifications.map((cert) => (
                <li
                  key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}
                  className="flex gap-2.5"
                >
                  <Award className="mt-0.5 size-5 shrink-0 text-[#800000]" aria-hidden="true" />
                  <div className="min-w-0 text-sm leading-6">
                    <h3 className="font-bold break-words text-black">
                      {cert.url ? (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-[#0000EE] underline ${FOCUS}`}
                        >
                          {cert.name}
                        </a>
                      ) : (
                        cert.name
                      )}
                    </h3>
                    {cert.issuer && <p className="text-[#222]">{cert.issuer}</p>}
                    {cert.date && (
                      <p className="font-mono text-xs text-[#555]">{formatShortDate(cert.date)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </div>
    </Window>
  );
}

export const RetroOS: React.FC<TemplateProps> = ({ content, profile }) => {
  const { full_name, experience, projects, education, skills, certifications } = content;
  const skillGroups = skills?.filter((group) => group.items.some(Boolean)) ?? [];
  const hasExperience = experience.length > 0;
  const hasProjects = (projects?.length ?? 0) > 0;
  const hasCredentials = (education?.length ?? 0) > 0 || (certifications?.length ?? 0) > 0;

  const icons = [
    { href: "#about", label: "About Me", icon: <User className="size-8" strokeWidth={1.5} /> },
    ...(hasExperience
      ? [
          {
            href: "#experience",
            label: "Experience",
            icon: <Folder className="size-8 fill-[#F6D66B] text-[#8A6D1C]" strokeWidth={1.5} />,
          },
        ]
      : []),
    ...(hasProjects
      ? [
          {
            href: "#projects",
            label: "Projects",
            icon: <HardDrive className="size-8" strokeWidth={1.5} />,
          },
        ]
      : []),
    ...(skillGroups.length > 0
      ? [
          {
            href: "#skills",
            label: "Skills",
            icon: <Wrench className="size-8" strokeWidth={1.5} />,
          },
        ]
      : []),
    ...(hasCredentials
      ? [
          {
            href: "#education",
            label: "Credentials",
            icon: <GraduationCap className="size-8" strokeWidth={1.5} />,
          },
        ]
      : []),
  ];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600&family=IBM+Plex+Sans:wght@400;600;700&display=swap" />
      <style>{`
        .font-body-ros, .font-body-ros h3 { font-family: 'IBM Plex Sans', Tahoma, 'Segoe UI', sans-serif; }
        .font-pixel-ros { font-family: 'Pixelify Sans', 'IBM Plex Sans', monospace; }
        .ros-raised { box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px #808080, inset 2px 2px #dfdfdf; }
        .ros-sunken { box-shadow: inset -1px -1px #fff, inset 1px 1px #0a0a0a, inset -2px -2px #dfdfdf, inset 2px 2px #808080; }
        .ros-titlebar { background: linear-gradient(90deg, #000080, #1084D0); }
        .ros-desktop {
          background-color: #008080;
          background-image: radial-gradient(rgba(0,0,0,0.07) 1px, transparent 1px);
          background-size: 3px 3px;
        }
        @media print {
          .ros-desktop { background: #fff; }
          .ros-no-print { display: none !important; }
        }
      `}</style>
      <div className="ros-desktop font-body-ros flex min-h-screen w-full flex-col overflow-x-hidden text-black selection:bg-[#000080] selection:text-white">
        <div className="mx-auto flex w-full max-w-[1280px] flex-1 gap-6 px-3 pt-4 pb-8 md:px-6 md:pt-8">
          <nav aria-label="Desktop" className="ros-no-print hidden shrink-0 md:block">
            <ul className="sticky top-8 flex flex-col gap-5">
              {icons.map((icon) => (
                <DesktopIcon key={icon.href} {...icon} />
              ))}
            </ul>
          </nav>

          <main className="grid min-w-0 flex-1 grid-cols-1 content-start gap-5 lg:grid-cols-12">
            <AboutWindow content={content} avatarUrl={profile.avatar_url} />
            {hasExperience && <ExperienceWindow experience={experience} />}
            {skillGroups.length > 0 && <SkillsWindow skills={skillGroups} />}
            {hasProjects && projects && <ProjectsWindow projects={projects} />}
            {hasCredentials && (
              <CredentialsWindow
                education={education ?? []}
                certifications={certifications ?? []}
              />
            )}
          </main>
        </div>

        <footer className="ros-raised flex flex-wrap items-center gap-2 bg-[#C0C0C0] px-2 py-1.5 sm:flex-nowrap">
          <a
            href="#about"
            className={`ros-raised font-pixel-ros flex shrink-0 items-center gap-1.5 bg-[#C0C0C0] px-2.5 py-1 text-[15px] font-semibold text-black ${FOCUS}`}
          >
            <span aria-hidden="true" className="grid size-4 grid-cols-2 gap-[1px] [&>span]:block">
              <span className="bg-[#FF0000]" />
              <span className="bg-[#00A000]" />
              <span className="bg-[#0000FF]" />
              <span className="bg-[#FFD700]" />
            </span>
            Start
          </a>
          <div className="ros-no-print order-last flex w-full justify-center sm:order-none sm:w-auto sm:flex-1 sm:justify-start">
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="retro-os"
            />
          </div>
          <p
            className="ros-sunken ml-auto shrink-0 px-2.5 py-1 font-mono text-xs text-black"
            suppressHydrationWarning
          >
            @{profile.handle} · {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </>
  );
};
