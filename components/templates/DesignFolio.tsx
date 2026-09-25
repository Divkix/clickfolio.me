import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

type Content = TemplateProps["content"];

type Project = NonNullable<Content["projects"]>[number];

// Palette: cool paper grey, true black ink, one cobalt block.
const PAPER = "#EDEEF0";

const COBALT = "#2D3BFF";

function formatMonth(date: string): string {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function formatYearOnly(date: string): string {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });
}

const inkLink =
  "underline decoration-2 underline-offset-4 hover:text-[#2D3BFF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D3BFF]";

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="border-t-[3px] border-black pt-4 mb-10 md:mb-14 text-2xl md:text-3xl font-bold tracking-[-0.01em]"
    >
      {children}
    </h2>
  );
}

function Hero({ content, profile }: { content: Content; profile: TemplateProps["profile"] }) {
  const links = getContactLinks(content.contact);

  return (
    <header className="grid gap-8 md:grid-cols-12 md:gap-6 pt-5 md:pt-6 pb-20 md:pb-28">
      <div
        className="md:col-span-7 md:order-2 flex flex-col justify-between gap-16 min-h-[22rem] md:min-h-[34rem] p-6 md:p-10 text-white"
        style={{ backgroundColor: COBALT }}
      >
        <div className="flex justify-end">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={`Portrait of ${content.full_name}`}
              width={112}
              height={112}
              fetchPriority="high"
              decoding="async"
              className="w-20 h-20 md:w-28 md:h-28 object-cover grayscale contrast-125"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-20 h-20 md:w-28 md:h-28 border-2 border-white flex items-center justify-center text-2xl md:text-4xl font-bold"
            >
              {getInitials(content.full_name)}
            </div>
          )}
        </div>
        <h1 className="text-[clamp(3rem,9vw,7.5rem)] font-extrabold leading-[0.9] tracking-[-0.04em] break-words [text-wrap:balance]">
          {content.full_name}
        </h1>
      </div>

      <div className="md:col-span-5 md:order-1 flex flex-col justify-end gap-8 min-w-0">
        {content.headline && (
          <p className="text-3xl md:text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.02em] break-words">
            {content.headline}
          </p>
        )}
        {content.summary && (
          <p className="text-lg leading-[1.6] text-[#43464D] max-w-[46ch]">{content.summary}</p>
        )}
        {links.length > 0 && (
          <ul className="grid gap-2 text-[0.98rem]">
            {links.map((link) => (
              <li key={link.type} className="flex items-center gap-3 min-w-0">
                {getContactIcon(link.type, {
                  className: "w-4 h-4 shrink-0",
                  size: 16,
                  "aria-hidden": true,
                })}
                {link.href ? (
                  <a
                    href={link.href}
                    target={link.isExternal ? "_blank" : undefined}
                    rel={link.isExternal ? "noopener noreferrer" : undefined}
                    className={`${inkLink} break-all`}
                  >
                    {link.label}
                  </a>
                ) : (
                  <span>{link.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}

function ProjectCover({ project, featured }: { project: Project; featured: boolean }) {
  if (project.image_url) {
    const aspect = featured ? "aspect-[4/3] md:aspect-[21/9]" : "aspect-[4/3]";

    return (
      <div className={`${aspect} overflow-hidden bg-white`}>
        <img
          src={project.image_url}
          alt=""
          width={featured ? 1600 : 800}
          height={featured ? 686 : 600}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
        />
      </div>
    );
  }

  // No image: the title itself becomes the cover, so the grid keeps its rhythm.
  return (
    <div
      className={`${
        featured ? "min-h-56 md:min-h-80" : "min-h-56 md:min-h-72"
      } bg-white flex flex-col justify-between gap-8 p-6 md:p-8 overflow-hidden transition-colors group-hover:bg-[#2D3BFF] group-hover:text-white text-[#2D3BFF]`}
    >
      <span className="text-[0.95rem] font-semibold">{project.year}</span>
      <h3
        className={`font-extrabold leading-[0.92] tracking-[-0.035em] break-words ${
          featured ? "text-[clamp(2.5rem,7vw,6rem)]" : "text-[clamp(2.25rem,4.5vw,3.75rem)]"
        }`}
      >
        {project.title}
      </h3>
    </div>
  );
}

function Projects({ items }: { items: Content["projects"] }) {
  if (!items?.length) return null;

  // An odd count features the first project across both columns, so no card is left alone.
  const featureFirst = items.length % 2 === 1;

  return (
    <section aria-labelledby="df-work" className="pb-24 md:pb-32">
      <SectionHeading id="df-work">Selected work</SectionHeading>
      <ul className="grid gap-x-6 gap-y-14 md:grid-cols-2">
        {items.map((project, index) => {
          const featured = featureFirst && index === 0;

          const body = (
            <>
              <ProjectCover project={project} featured={featured} />
              {project.image_url && (
                <div className="mt-5 flex items-baseline justify-between gap-4">
                  <h3 className="text-xl md:text-2xl font-bold tracking-[-0.01em] break-words group-hover:underline decoration-2 underline-offset-4">
                    {project.title}
                  </h3>
                  {project.year && <span className="shrink-0 text-[#5B5F68]">{project.year}</span>}
                </div>
              )}
              {project.description && (
                <p
                  className={`${project.image_url ? "mt-2" : "mt-5"} leading-[1.6] text-[#43464D] max-w-[60ch]`}
                >
                  {project.description}
                </p>
              )}
              {project.technologies && project.technologies.length > 0 && (
                <p className="mt-2 text-[0.95rem] text-[#5B5F68]">
                  {project.technologies.join(", ")}
                </p>
              )}
            </>
          );

          return (
            <li
              key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
              className={`min-w-0 ${featured ? "md:col-span-2" : ""}`}
            >
              {project.url ? (
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#2D3BFF]"
                >
                  {body}
                </a>
              ) : (
                <div className="group">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Experience({ items }: { items: Content["experience"] }) {
  if (!items?.length) return null;

  return (
    <section aria-labelledby="df-experience" className="pb-24 md:pb-32">
      <SectionHeading id="df-experience">Experience</SectionHeading>
      <ol className="grid gap-12">
        {items.map((job) => (
          <li
            key={`${job.title}-${job.company}-${job.start_date}`}
            className="grid gap-3 md:grid-cols-12 md:gap-6"
          >
            <p className="md:col-span-3 text-[#5B5F68] tabular-nums">
              {formatMonth(job.start_date)} – {job.end_date ? formatMonth(job.end_date) : "Present"}
            </p>
            <div className="md:col-span-4 min-w-0">
              <h3 className="text-xl font-bold leading-snug break-words">{job.title}</h3>
              <p className="mt-1 text-lg">{job.company}</p>
              {job.location && <p className="mt-1 text-[#5B5F68]">{job.location}</p>}
            </div>
            <div className="md:col-span-5 min-w-0 text-[#43464D] leading-[1.6]">
              {job.description && <p>{job.description}</p>}
              {job.highlights && job.highlights.length > 0 && (
                <ul className={`grid gap-2 ${job.description ? "mt-4" : ""}`}>
                  {job.highlights.map((highlight, i) => (
                    <li
                      key={`${job.title}-${i}-${highlight}`}
                      className="grid grid-cols-[1.25rem_1fr]"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[0.55em] w-2 h-2"
                        style={{ backgroundColor: COBALT }}
                      />
                      <span>{highlight}</span>
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

function Skills({ groups }: { groups: Content["skills"] }) {
  const filled = groups?.filter((group) => group.items.length > 0) ?? [];

  if (filled.length === 0) return null;

  return (
    <section aria-labelledby="df-skills" className="pb-24 md:pb-32">
      <SectionHeading id="df-skills">Skills</SectionHeading>
      <dl className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {filled.map((group) => (
          <div key={group.category}>
            <dt className="text-lg font-bold">{group.category}</dt>
            <dd className="mt-3">
              <ul className="grid gap-1 text-[#43464D]">
                {group.items.map((item) => (
                  <li key={`${group.category}-${item}`}>{item}</li>
                ))}
              </ul>
            </dd>
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
  education: Content["education"];
  certifications: Content["certifications"];
}) {
  const hasEducation = Boolean(education?.length);
  const hasCertifications = Boolean(certifications?.length);

  if (!hasEducation && !hasCertifications) return null;

  return (
    <div className="grid gap-y-0 gap-x-6 md:grid-cols-2 pb-24 md:pb-32">
      {education && education.length > 0 && (
        <section aria-labelledby="df-education" className="pb-16 md:pb-0">
          <SectionHeading id="df-education">Education</SectionHeading>
          <ul className="grid gap-8">
            {education.map((edu) => (
              <li key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}>
                <h3 className="text-lg font-bold break-words">{edu.degree}</h3>
                <p className="mt-1">{edu.institution}</p>
                {(edu.graduation_date || edu.gpa) && (
                  <p className="mt-1 text-[#5B5F68]">
                    {edu.graduation_date && formatYearOnly(edu.graduation_date)}
                    {edu.graduation_date && edu.gpa ? ", " : ""}
                    {edu.gpa && `GPA ${edu.gpa}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {certifications && certifications.length > 0 && (
        <section aria-labelledby="df-certifications">
          <SectionHeading id="df-certifications">Certifications</SectionHeading>
          <ul className="grid gap-8">
            {certifications.map((cert) => (
              <li key={`${cert.name}-${cert.issuer}-${cert.date ?? ""}`}>
                <h3 className="text-lg font-bold break-words">
                  {cert.url ? (
                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={inkLink}
                    >
                      {cert.name}
                    </a>
                  ) : (
                    cert.name
                  )}
                </h3>
                {cert.issuer && <p className="mt-1">{cert.issuer}</p>}
                {cert.date && <p className="mt-1 text-[#5B5F68]">{formatMonth(cert.date)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const DesignFolio: React.FC<TemplateProps> = ({ content, profile }) => {
  const { full_name, contact } = content;
  const links = getContactLinks(contact).filter((link) => link.href);

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..900&display=swap" />

      <div
        className="df-root min-h-screen w-full overflow-x-hidden text-black selection:bg-[#2D3BFF] selection:text-white"
        style={{ backgroundColor: PAPER }}
      >
        <style>{`
          .df-root { font-family: 'Schibsted Grotesk', system-ui, sans-serif; font-size: 17px; }
        `}</style>

        <main className="max-w-[88rem] mx-auto px-5 md:px-10">
          <Hero content={content} profile={profile} />
          <Projects items={content.projects} />
          <Experience items={content.experience} />
          <Skills groups={content.skills} />
          <Credentials education={content.education} certifications={content.certifications} />
        </main>

        <footer className="text-white" style={{ backgroundColor: COBALT }}>
          <div className="max-w-[88rem] mx-auto px-5 md:px-10 pt-16 md:pt-24 pb-10 grid gap-14">
            {links.length > 0 && (
              <ul className="grid gap-3 md:gap-4">
                {links.map((link) => (
                  <li key={link.type} className="min-w-0">
                    <a
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "noopener noreferrer" : undefined}
                      className="inline-flex items-center gap-4 text-2xl md:text-5xl font-bold tracking-[-0.02em] break-all hover:underline decoration-[3px] underline-offset-[6px] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      {getContactIcon(link.type, {
                        className: "w-5 h-5 md:w-8 md:h-8 shrink-0",
                        size: 32,
                        variant: "white",
                        "aria-hidden": true,
                      })}
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col-reverse md:flex-row md:items-end md:justify-between gap-6">
              <span className="text-white/80" suppressHydrationWarning>
                © {new Date().getFullYear()} {full_name}
              </span>
              <ShareBar
                handle={profile.handle}
                title={`${full_name}'s Portfolio`}
                name={full_name}
                variant="design-folio"
              />
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};
