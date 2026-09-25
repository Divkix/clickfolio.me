import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

type Content = TemplateProps["content"];

// Palette: a pale lilac stage, one straw-gel pool of light, aubergine ink.
const STAGE = "#E9E7F2";

const INK = "#22163A";

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

function formatRange(start: string, end?: string | null): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : "Present"}`;
}

const linkClass =
  "underline decoration-[#E8B400] decoration-[3px] underline-offset-[5px] hover:bg-[#FFD95A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22163A] rounded-[2px] transition-colors";

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className="grid gap-6 md:grid-cols-[11rem_1fr] md:gap-10 py-10 md:py-14"
    >
      <h2
        id={id ? `${id}-title` : undefined}
        className="sl-display text-2xl md:text-[1.7rem] font-bold leading-tight"
      >
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Hero({ content, profile }: { content: Content; profile: TemplateProps["profile"] }) {
  const name = content.full_name;
  const links = getContactLinks(content.contact);

  return (
    <header className="relative isolate">
      <div
        aria-hidden="true"
        className="sl-light pointer-events-none absolute -z-10 -inset-x-[40vw] -top-32 -bottom-10 md:-inset-x-[24rem] md:-top-48 md:-bottom-16"
        style={{
          background:
            "radial-gradient(ellipse 34rem 26rem at 42% 50%, #FFEFA8 0%, #FFD95A 45%, rgba(255,217,90,0.5) 68%, rgba(255,217,90,0) 100%)",
        }}
      />
      <div className="pt-14 md:pt-24 pb-14 md:pb-20">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={`Portrait of ${name}`}
            width={96}
            height={96}
            fetchPriority="high"
            decoding="async"
            className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover ring-4 ring-[#FFE995] mb-8"
          />
        ) : (
          <div
            aria-hidden="true"
            className="sl-display w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#22163A] text-[#FFD95A] flex items-center justify-center text-2xl md:text-3xl font-bold mb-8"
          >
            {getInitials(name)}
          </div>
        )}

        <h1 className="sl-display sl-name text-[clamp(3.5rem,15vw,10.5rem)] font-extrabold leading-[0.88] tracking-[-0.012em] break-words [text-wrap:balance]">
          {name}
        </h1>

        {content.headline && (
          <p className="sl-display mt-6 md:mt-8 text-2xl md:text-[2.1rem] font-semibold leading-[1.15] max-w-[26ch] break-words">
            {content.headline}
          </p>
        )}

        {content.summary && (
          <p className="mt-6 text-lg leading-[1.65] max-w-[60ch] text-[#4A4060]">
            {content.summary}
          </p>
        )}

        {links.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[0.98rem]">
            {links.map((link) => {
              const icon = getContactIcon(link.type, {
                className: "w-4 h-4 shrink-0",
                size: 16,
                "aria-hidden": true,
              });

              return (
                <li key={link.type} className="flex items-center gap-2 min-w-0">
                  {icon}
                  {link.href ? (
                    <a
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "noopener noreferrer" : undefined}
                      className={`${linkClass} break-all`}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <span>{link.label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </header>
  );
}

function Work({ items }: { items: Content["experience"] }) {
  if (!items?.length) return null;

  return (
    <Section id="work" title="Work">
      <ol className="space-y-12">
        {items.map((job) => (
          <li key={`${job.title}-${job.company}-${job.start_date}`}>
            <div className="flex items-baseline gap-3">
              <h3 className="sl-display text-xl md:text-2xl font-bold leading-snug min-w-0 break-words">
                {job.title}
              </h3>
              <span
                aria-hidden="true"
                className="hidden sm:block flex-1 border-b-2 border-dotted border-[#9C93B3] translate-y-[-0.3em]"
              />
              <span className="sl-display hidden sm:block text-xl md:text-2xl font-semibold text-right shrink-0 max-w-[45%] break-words">
                {job.company}
              </span>
            </div>
            <p className="sm:hidden sl-display text-lg font-semibold mt-1">{job.company}</p>
            <p className="mt-1 text-[0.95rem] text-[#5E5575]">
              {formatRange(job.start_date, job.end_date)}
              {job.location ? <span className="ml-4">{job.location}</span> : null}
            </p>

            {job.description && (
              <p className="mt-4 leading-[1.65] max-w-[64ch] text-[#3A2F52]">{job.description}</p>
            )}

            {job.highlights && job.highlights.length > 0 && (
              <ul className="mt-4 space-y-2 max-w-[64ch]">
                {job.highlights.map((highlight, i) => (
                  <li
                    key={`${job.title}-${i}-${highlight}`}
                    className="grid grid-cols-[1rem_1fr] leading-[1.6] text-[#3A2F52]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[0.6em] w-2 h-2 rounded-full bg-[#F2C230]"
                    />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Projects({ items }: { items: Content["projects"] }) {
  if (!items?.length) return null;

  return (
    <Section id="projects" title="Projects">
      <ul className="space-y-10">
        {items.map((project) => (
          <li key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h3 className="sl-display text-xl md:text-2xl font-bold break-words">
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {project.title}
                  </a>
                ) : (
                  project.title
                )}
              </h3>
              {project.year && <span className="text-[#5E5575]">{project.year}</span>}
            </div>
            {project.description && (
              <p className="mt-3 leading-[1.65] max-w-[64ch] text-[#3A2F52]">
                {project.description}
              </p>
            )}
            {project.technologies && project.technologies.length > 0 && (
              <p className="mt-3 text-[0.95rem] text-[#5E5575]">
                Made with {project.technologies.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Skills({ groups }: { groups: Content["skills"] }) {
  const filled = groups?.filter((group) => group.items.length > 0) ?? [];

  if (filled.length === 0) return null;

  return (
    <Section id="skills" title="Skills">
      <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {filled.map((group) => (
          <div key={group.category}>
            <dt className="sl-display text-lg font-bold">{group.category}</dt>
            <dd className="mt-1 leading-[1.65] text-[#3A2F52]">{group.items.join(", ")}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function Education({ items }: { items: Content["education"] }) {
  if (!items?.length) return null;

  return (
    <Section id="education" title="Education">
      <ul className="space-y-6">
        {items.map((edu) => (
          <li key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}>
            <h3 className="sl-display text-lg md:text-xl font-bold break-words">{edu.degree}</h3>
            <p className="mt-1 text-[#3A2F52]">
              {edu.institution}
              {edu.graduation_date && (
                <span className="ml-3 text-[#5E5575]">{formatYearOnly(edu.graduation_date)}</span>
              )}
            </p>
            {edu.gpa && <p className="mt-1 text-[0.95rem] text-[#5E5575]">GPA {edu.gpa}</p>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Certifications({ items }: { items: Content["certifications"] }) {
  if (!items?.length) return null;

  return (
    <Section id="certifications" title="Certifications">
      <ul className="space-y-6">
        {items.map((cert) => (
          <li key={`${cert.name}-${cert.issuer}-${cert.date ?? ""}`}>
            <h3 className="sl-display text-lg md:text-xl font-bold break-words">
              {cert.url ? (
                <a href={cert.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {cert.name}
                </a>
              ) : (
                cert.name
              )}
            </h3>
            {(cert.issuer || cert.date) && (
              <p className="mt-1 text-[#3A2F52]">
                {cert.issuer}
                {cert.date && (
                  <span className={cert.issuer ? "ml-3 text-[#5E5575]" : "text-[#5E5575]"}>
                    {formatMonth(cert.date)}
                  </span>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export const Spotlight: React.FC<TemplateProps> = ({ content, profile, isPreview }) => {
  const name = content.full_name;
  const firstName = name.split(" ")[0] || name;

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,300..800&display=swap" />

      <div
        className="sl-root min-h-screen overflow-x-hidden selection:bg-[#FFD95A] selection:text-[#22163A]"
        style={{ backgroundColor: STAGE, color: INK }}
      >
        <style>{`
          .sl-root { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-optical-sizing: auto; font-size: 17px; }
          .sl-display { font-family: 'Bricolage Grotesque', system-ui, sans-serif; }
          .sl-name { font-stretch: 75%; }
          @keyframes sl-lights-up {
            from { opacity: 0; transform: scale(0.82); }
            to { opacity: 1; transform: scale(1); }
          }
          @media (prefers-reduced-motion: no-preference) {
            .sl-animate .sl-light { animation: sl-lights-up 1.1s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
          }
        `}</style>

        <div className={isPreview ? "" : "sl-animate"}>
          <main className="max-w-5xl mx-auto px-5 md:px-10">
            <Hero content={content} profile={profile} />
            <Work items={content.experience} />
            <Projects items={content.projects} />
            <Skills groups={content.skills} />
            <Education items={content.education} />
            <Certifications items={content.certifications} />
          </main>

          <footer className="max-w-5xl mx-auto px-5 md:px-10 pb-14">
            <div className="border-t-2 border-[#22163A] pt-12 md:pt-16 grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                {content.contact.email ? (
                  <p className="sl-display text-3xl md:text-5xl font-bold leading-tight">
                    <a href={`mailto:${content.contact.email}`} className={linkClass}>
                      Email {firstName}
                    </a>
                  </p>
                ) : null}
                <p className="mt-6 text-[0.95rem] text-[#5E5575]" suppressHydrationWarning>
                  © {new Date().getFullYear()} {name}
                </p>
              </div>
              <ShareBar
                handle={profile.handle}
                title={`${name}'s Portfolio`}
                name={name}
                variant="spotlight"
              />
            </div>
          </footer>
        </div>
      </div>
    </>
  );
};
