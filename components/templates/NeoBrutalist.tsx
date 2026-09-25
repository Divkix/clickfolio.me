import { ArrowUpRight, MapPin } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import {
  flattenSkills,
  formatDateRange,
  formatShortDate,
  formatYear,
  getInitials,
} from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { NeoBrutalistMobileNav } from "./NeoBrutalistMobileNav";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

type Content = TemplateProps["content"];

const SLAB = "bg-white border-[3px] md:border-4 border-black shadow-[6px_6px_0_0_#000]";

const PRESS =
  "transition-[transform,box-shadow] duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1F3BFF]";

function sectionLinks(content: Content) {
  return [
    ...(content.experience.length > 0 ? [{ href: "#experience", label: "Experience" }] : []),
    ...(content.projects && content.projects.length > 0 ? [{ href: "#work", label: "Work" }] : []),
    ...(content.skills && content.skills.length > 0 ? [{ href: "#skills", label: "Skills" }] : []),
    ...((content.education?.length ?? 0) > 0 || (content.certifications?.length ?? 0) > 0
      ? [{ href: "#education", label: "Education" }]
      : []),
  ];
}

function TopBar({ content, handle }: { content: Content; handle: string }) {
  const links = sectionLinks(content);

  return (
    <nav aria-label="Sections" className="bg-black text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <span className="font-heading-nb truncate text-sm md:text-base">@{handle}</span>
        <div className="hidden gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-1 text-sm font-bold hover:bg-[#FFD400] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]"
            >
              {link.label}
            </a>
          ))}
        </div>
        <NeoBrutalistMobileNav links={links} />
      </div>
    </nav>
  );
}

function Hero({ content, profile }: TemplateProps) {
  const links = getContactLinks(content.contact).filter((link) => link.type !== "location");

  return (
    <header className="mx-auto max-w-6xl px-4 pt-10 pb-4 md:px-8 md:pt-14">
      <h1 className="font-heading-nb text-[clamp(3.25rem,13vw,11rem)] leading-[0.85] tracking-[-0.03em] uppercase break-words">
        {content.full_name}
      </h1>

      <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-12 md:items-start">
        <div className="md:col-span-3">
          <div
            className={`${SLAB} aspect-square w-40 -rotate-2 overflow-hidden md:w-full md:max-w-[240px]`}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`Portrait of ${content.full_name}`}
                width={240}
                height={240}
                fetchPriority="high"
                decoding="async"
                className="size-full object-cover grayscale contrast-125"
              />
            ) : (
              <div
                className="font-heading-nb flex size-full items-center justify-center bg-[#1F3BFF] text-6xl text-white md:text-7xl"
                aria-hidden="true"
              >
                {getInitials(content.full_name)}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-6">
          {content.headline && (
            <p className="font-heading-nb text-2xl leading-tight md:text-4xl">{content.headline}</p>
          )}
          {content.summary && (
            <p className="mt-5 max-w-[60ch] text-lg leading-relaxed font-medium">
              {content.summary}
            </p>
          )}
          {content.contact.location && (
            <p className="mt-5 flex items-center gap-2 font-bold">
              <MapPin className="size-5 shrink-0" aria-hidden="true" />
              {content.contact.location}
            </p>
          )}
        </div>

        {links.length > 0 && (
          <ul className="flex flex-col gap-3 md:col-span-3">
            {links.map((link) => (
              <li key={link.type}>
                <a
                  href={link.href}
                  target={link.isExternal ? "_blank" : undefined}
                  rel={link.isExternal ? "noopener noreferrer" : undefined}
                  className={`${SLAB} ${PRESS} flex min-w-0 items-center gap-3 px-4 py-3 font-bold`}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    {getContactIcon(link.type, {
                      size: 20,
                      className: "size-5",
                      "aria-hidden": true,
                    })}
                  </span>
                  <span className="min-w-0 truncate">{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}

function Marquee({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;

  const run = skills.map((skill, i) => (
    <span key={`${skill}-${i}`} className="mx-5 inline-flex items-center gap-10 md:mx-8">
      {skill}
      <span className="inline-block size-3 rotate-45 bg-[#FFD400] md:size-4" />
    </span>
  ));

  return (
    <div
      aria-hidden="true"
      className="my-12 -ml-[2%] w-[104%] -rotate-1 overflow-hidden border-y-4 border-black bg-black py-4 whitespace-nowrap text-[#FFD400] md:my-16"
    >
      <div className="nb-marquee font-heading-nb inline-block text-2xl uppercase md:text-4xl">
        {run}
        {run}
      </div>
    </div>
  );
}

function SectionTitle({
  id,
  compact = false,
  children,
}: {
  id: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className={`font-heading-nb mb-8 text-[clamp(1.75rem,8.5vw,3rem)] leading-[0.9] tracking-[-0.02em] uppercase md:mb-10 md:text-7xl ${compact ? "lg:text-5xl" : ""}`}
    >
      {children}
    </h2>
  );
}

function Experience({ experience }: { experience: Content["experience"] }) {
  return (
    <section id="experience" aria-labelledby="experience-title" className="scroll-mt-4">
      <SectionTitle id="experience-title">Experience</SectionTitle>
      <ol className="space-y-8">
        {experience.map((job) => (
          <li
            key={`${job.title}-${job.company}-${job.start_date}`}
            className={`${SLAB} grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)]`}
          >
            <div className="border-b-[3px] border-black bg-[#1F3BFF] p-5 text-white md:border-r-4 md:border-b-0">
              <p className="font-heading-nb text-lg leading-snug">
                {formatDateRange(job.start_date, job.end_date)}
              </p>
              {job.location && <p className="mt-2 text-sm font-semibold">{job.location}</p>}
            </div>
            <div className="min-w-0 p-5 md:p-7">
              <h3 className="font-heading-nb text-2xl leading-tight break-words uppercase md:text-3xl">
                {job.title}
              </h3>
              <p className="mt-1 text-lg font-bold">{job.company}</p>
              {job.description && (
                <p className="mt-4 max-w-[68ch] leading-relaxed">{job.description}</p>
              )}
              {job.highlights && job.highlights.length > 0 && (
                <ul className="mt-4 max-w-[68ch] space-y-2">
                  {job.highlights.map((highlight) => (
                    <li
                      key={`${job.title}-${highlight}`}
                      className="flex gap-3 leading-relaxed font-medium"
                    >
                      <span className="mt-[0.55em] size-2.5 shrink-0 bg-black" aria-hidden="true" />
                      <span className="min-w-0">{highlight}</span>
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

function Work({ projects }: { projects: NonNullable<Content["projects"]> }) {
  return (
    <section id="work" aria-labelledby="work-title" className="scroll-mt-4">
      <SectionTitle id="work-title">Work</SectionTitle>
      <ul className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {projects.map((project) => (
          <li
            key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
            className={`${SLAB} flex min-w-0 flex-col p-5 md:p-7`}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-heading-nb min-w-0 text-2xl leading-tight break-words uppercase md:text-3xl">
                {project.title}
              </h3>
              {project.year && (
                <span className="font-heading-nb shrink-0 bg-black px-2 py-1 text-sm text-white">
                  {project.year}
                </span>
              )}
            </div>
            <p className="mt-3 flex-1 leading-relaxed">{project.description}</p>
            {project.technologies && project.technologies.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {project.technologies.map((tech) => (
                  <li
                    key={`${project.title}-${tech}`}
                    className="border-2 border-black bg-[#FFD400] px-2 py-0.5 text-sm font-bold"
                  >
                    {tech}
                  </li>
                ))}
              </ul>
            )}
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-6 inline-flex items-center gap-2 self-start border-[3px] border-black bg-black px-4 py-2 font-bold text-white shadow-[4px_4px_0_0_#1F3BFF] ${PRESS} hover:shadow-[1px_1px_0_0_#1F3BFF]`}
              >
                Visit {project.title}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Skills({ skills }: { skills: NonNullable<Content["skills"]> }) {
  return (
    <section id="skills" aria-labelledby="skills-title" className="scroll-mt-4">
      <SectionTitle id="skills-title">Skills</SectionTitle>
      <dl className={`${SLAB} divide-y-[3px] divide-black`}>
        {skills.map((group) => (
          <div key={group.category} className="grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)]">
            <dt className="font-heading-nb bg-black px-5 py-3 text-lg text-white md:py-4">
              {group.category}
            </dt>
            <dd className="flex flex-wrap gap-2 px-5 py-4">
              {group.items.map((item) => (
                <span
                  key={`${group.category}-${item}`}
                  className="border-2 border-black px-2.5 py-0.5 font-bold"
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

function EducationAndCerts({
  education,
  certifications,
}: {
  education: NonNullable<Content["education"]>;
  certifications: NonNullable<Content["certifications"]>;
}) {
  return (
    <div id="education" className="grid scroll-mt-4 grid-cols-1 gap-12 lg:grid-cols-2">
      {education.length > 0 && (
        <section aria-labelledby="education-title">
          <SectionTitle id="education-title" compact>
            Education
          </SectionTitle>
          <ul className="space-y-6">
            {education.map((edu) => (
              <li
                key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
                className={`${SLAB} p-5`}
              >
                <h3 className="font-heading-nb text-xl leading-tight uppercase">{edu.degree}</h3>
                <p className="mt-1 font-bold">{edu.institution}</p>
                {(edu.graduation_date || edu.gpa) && (
                  <p className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
                    {edu.graduation_date && (
                      <span className="bg-black px-2 py-0.5 text-white">
                        {formatYear(edu.graduation_date)}
                      </span>
                    )}
                    {edu.gpa && <span className="border-2 border-black px-2">GPA {edu.gpa}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {certifications.length > 0 && (
        <section aria-labelledby="certifications-title">
          <SectionTitle id="certifications-title" compact>
            Certifications
          </SectionTitle>
          <ul className="space-y-6">
            {certifications.map((cert) => (
              <li key={`${cert.name}-${cert.issuer}-${cert.date ?? ""}`} className={`${SLAB} p-5`}>
                <h3 className="font-heading-nb text-xl leading-tight uppercase">
                  {cert.url ? (
                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-[#1F3BFF] decoration-4 underline-offset-4 hover:bg-[#FFD400]"
                    >
                      {cert.name}
                    </a>
                  ) : (
                    cert.name
                  )}
                </h3>
                {cert.issuer && <p className="mt-1 font-bold">{cert.issuer}</p>}
                {cert.date && (
                  <p className="mt-2 text-sm font-semibold">{formatShortDate(cert.date)}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const NeoBrutalist: React.FC<TemplateProps> = ({ content, profile }) => {
  const flatSkills = flattenSkills(content.skills);
  const education = content.education ?? [];
  const certifications = content.certifications ?? [];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&display=swap" />
      <div className="nb-root min-h-screen overflow-x-hidden bg-[#FFD400] text-black selection:bg-black selection:text-[#FFD400]">
        <TopBar content={content} handle={profile.handle} />

        <Hero content={content} profile={profile} />

        <Marquee skills={flatSkills} />

        <main className="mx-auto max-w-6xl space-y-20 px-4 pb-20 md:space-y-28 md:px-8">
          {content.experience.length > 0 && <Experience experience={content.experience} />}

          {content.projects && content.projects.length > 0 && <Work projects={content.projects} />}

          {content.skills && content.skills.length > 0 && <Skills skills={content.skills} />}

          {(education.length > 0 || certifications.length > 0) && (
            <EducationAndCerts education={education} certifications={certifications} />
          )}
        </main>

        <footer className="mx-auto flex max-w-6xl flex-col gap-4 border-t-4 border-black px-4 py-8 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p className="text-sm font-bold" suppressHydrationWarning>
            © {new Date().getFullYear()} {content.full_name}
          </p>
          <ShareBar
            handle={profile.handle}
            title={`${content.full_name}'s Portfolio`}
            name={content.full_name}
            variant="neo-brutalist"
          />
        </footer>

        <style>{`
          .nb-root { font-family: 'Archivo', system-ui, sans-serif; }
          .font-heading-nb { font-family: 'Archivo Black', 'Archivo', sans-serif; font-weight: 400; }
          @media (prefers-reduced-motion: no-preference) {
            .nb-marquee { animation: nb-marquee 28s linear infinite; }
          }
          @keyframes nb-marquee {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
        `}</style>
      </div>
    </>
  );
};
