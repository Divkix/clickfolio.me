import { MapPin } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

type Content = TemplateProps["content"];

// Annual-report palette: one navy carries all emphasis, everything else is ink and slate.
const NAVY = "#0E2A47";

const SLATE = "#5B6776";

const LINK =
  "underline decoration-[#0E2A47]/25 underline-offset-4 hover:decoration-[#0E2A47] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E2A47] rounded-sm";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-t-[6px] pt-5" style={{ borderColor: NAVY }}>
      <h2
        id={id}
        className="bc-display mb-8 text-[1.75rem] font-bold leading-none tracking-[-0.01em]"
        style={{ color: NAVY, fontStretch: "87.5%" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Sidebar({ content, avatarUrl }: { content: Content; avatarUrl: string | null }) {
  const contactLinks = getContactLinks(content.contact).filter((link) => link.type !== "location");
  const skills = content.skills?.filter((group) => group.items.length > 0) ?? [];

  return (
    <aside
      className="px-6 pb-10 pt-10 text-white sm:px-10 lg:px-10 lg:pb-16 lg:pt-14"
      style={{ backgroundColor: NAVY }}
    >
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden bg-white/10 lg:h-28 lg:w-28">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`Portrait of ${content.full_name}`}
            width={112}
            height={112}
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="bc-display text-4xl font-extrabold" aria-hidden="true">
            {getInitials(content.full_name)}
          </span>
        )}
      </div>

      <h1
        className="bc-display mt-8 text-[clamp(3.25rem,6.5vw,5.25rem)] font-extrabold leading-[0.88] tracking-[-0.015em] break-words hyphens-auto"
        style={{ fontStretch: "75%" }}
      >
        {content.full_name}
      </h1>
      {content.headline && (
        <p className="mt-5 text-lg leading-snug text-white/80">{content.headline}</p>
      )}
      {content.contact?.location && (
        <p className="mt-4 flex items-center gap-2 text-[15px] text-white/70">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          {content.contact.location}
        </p>
      )}

      {contactLinks.length > 0 && (
        <nav aria-label="Contact" className="mt-10 border-t border-white/20 pt-6">
          <ul className="space-y-3">
            {contactLinks.map((link) => (
              <li key={link.type} className="min-w-0">
                <a
                  href={link.href}
                  target={link.isExternal ? "_blank" : undefined}
                  rel={link.isExternal ? "noopener noreferrer" : undefined}
                  className="inline-flex max-w-full items-center gap-3 text-[15px] text-white hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm"
                >
                  <span className="flex shrink-0 text-white/70">
                    {getContactIcon(link.type, {
                      className: "h-4 w-4",
                      variant: "white",
                      "aria-hidden": true,
                    })}
                  </span>
                  <span className="truncate">{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {skills.length > 0 && (
        <section aria-labelledby="bc-skills" className="mt-10 border-t border-white/20 pt-6">
          <h2
            id="bc-skills"
            className="bc-display text-xl font-bold"
            style={{ fontStretch: "87.5%" }}
          >
            Skills
          </h2>
          <dl className="mt-5 space-y-5">
            {skills.map((group) => (
              <div key={group.category}>
                <dt className="text-sm font-semibold text-white/60">{group.category}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed">{group.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </aside>
  );
}

function ExperienceSection({ experience }: { experience: NonNullable<Content["experience"]> }) {
  return (
    <Section id="bc-experience" title="Experience">
      <ol className="space-y-10">
        {experience.map((job) => (
          <li
            key={`${job.title}-${job.company}-${job.start_date}`}
            className="grid gap-x-8 gap-y-2 md:grid-cols-[10.5rem_1fr]"
          >
            <p className="text-sm font-medium tabular-nums md:pt-1.5" style={{ color: SLATE }}>
              {formatDateRange(job.start_date, job.end_date)}
            </p>
            <div className="min-w-0">
              <h3 className="text-xl font-bold leading-snug break-words">{job.title}</h3>
              <p className="text-[15px]" style={{ color: SLATE }}>
                {job.company}
                {job.location && `, ${job.location}`}
              </p>
              {job.description && (
                <p className="mt-3 max-w-[68ch] leading-relaxed">{job.description}</p>
              )}
              {job.highlights && job.highlights.length > 0 && (
                <ul className="mt-3 max-w-[68ch] space-y-2 leading-relaxed">
                  {job.highlights.map((highlight, i) => (
                    <li key={`${job.title}-${i}`} className="relative pl-5">
                      <span
                        className="absolute left-0 top-[0.6em] h-1.5 w-1.5"
                        style={{ backgroundColor: NAVY }}
                        aria-hidden="true"
                      />
                      {highlight}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function ProjectsSection({ projects }: { projects: NonNullable<Content["projects"]> }) {
  return (
    <Section id="bc-projects" title="Projects">
      <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
        {projects.map((project) => (
          <article
            key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
            className="min-w-0 border-t-2 pt-4"
            style={{ borderColor: NAVY }}
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-lg font-bold leading-snug break-words">
                {project.url ? (
                  <a href={project.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                    {project.title}
                  </a>
                ) : (
                  project.title
                )}
              </h3>
              {project.year && (
                <span className="shrink-0 text-sm tabular-nums" style={{ color: SLATE }}>
                  {project.year}
                </span>
              )}
            </div>
            {project.description && <p className="mt-2 leading-relaxed">{project.description}</p>}
            {project.technologies && project.technologies.length > 0 && (
              <p className="mt-3 text-sm" style={{ color: SLATE }}>
                Built with {project.technologies.join(", ")}
              </p>
            )}
          </article>
        ))}
      </div>
    </Section>
  );
}

function EducationSection({ education }: { education: NonNullable<Content["education"]> }) {
  return (
    <Section id="bc-education" title="Education">
      <ul className="space-y-6">
        {education.map((edu) => (
          <li
            key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
            className="grid gap-x-8 gap-y-1 md:grid-cols-[10.5rem_1fr]"
          >
            <p className="text-sm font-medium tabular-nums md:pt-1" style={{ color: SLATE }}>
              {edu.graduation_date ? formatYear(edu.graduation_date) : ""}
            </p>
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-snug break-words">{edu.degree}</h3>
              <p className="text-[15px]" style={{ color: SLATE }}>
                {edu.institution}
                {edu.gpa && `, GPA ${edu.gpa}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function CertificationsSection({
  certifications,
}: {
  certifications: NonNullable<Content["certifications"]>;
}) {
  return (
    <Section id="bc-certifications" title="Certifications">
      <ul className="space-y-6">
        {certifications.map((cert) => (
          <li
            key={`${cert.name}-${cert.issuer}-${cert.date ?? ""}`}
            className="grid gap-x-8 gap-y-1 md:grid-cols-[10.5rem_1fr]"
          >
            <p className="text-sm font-medium tabular-nums md:pt-1" style={{ color: SLATE }}>
              {cert.date ? formatYear(cert.date) : ""}
            </p>
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-snug break-words">
                {cert.url ? (
                  <a href={cert.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                    {cert.name}
                  </a>
                ) : (
                  cert.name
                )}
              </h3>
              {cert.issuer && (
                <p className="text-[15px]" style={{ color: SLATE }}>
                  {cert.issuer}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export const BoldCorporate: React.FC<TemplateProps> = ({ content, profile }) => {
  const experience = content.experience ?? [];
  const projects = content.projects ?? [];
  const education = content.education ?? [];
  const certifications = content.certifications ?? [];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,400..800&display=swap" />
      <style>{`.bc-root, .bc-display { font-family: 'Archivo', ui-sans-serif, system-ui, sans-serif; }`}</style>

      <main className="bc-root min-h-screen bg-white text-[#1B2430] antialiased selection:bg-[#0E2A47] selection:text-white lg:grid lg:grid-cols-[minmax(320px,400px)_1fr]">
        <Sidebar content={content} avatarUrl={profile.avatar_url} />

        <div className="min-w-0 px-6 py-12 sm:px-10 lg:px-16 lg:py-16 xl:px-20">
          <div className="max-w-3xl space-y-16">
            <div>
              {content.summary && (
                <p
                  className="max-w-[40ch] text-[1.5rem] leading-[1.35] font-medium tracking-[-0.01em] sm:text-[1.75rem]"
                  style={{ color: NAVY }}
                >
                  {content.summary}
                </p>
              )}
              <div className={content.summary ? "mt-8" : ""}>
                <ShareBar
                  handle={profile.handle}
                  title={`${content.full_name}'s Portfolio`}
                  name={content.full_name}
                  variant="bold-corporate"
                />
              </div>
            </div>

            {experience.length > 0 && <ExperienceSection experience={experience} />}
            {projects.length > 0 && <ProjectsSection projects={projects} />}
            {education.length > 0 && <EducationSection education={education} />}
            {certifications.length > 0 && <CertificationsSection certifications={certifications} />}
          </div>
        </div>
      </main>
    </>
  );
};
