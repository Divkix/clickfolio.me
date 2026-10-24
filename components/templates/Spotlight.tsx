import { MaybeLink, LINK_REL } from "./shared/ExternalLink";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { currentYear } from "@/lib/utils/format";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

type Content = TemplateProps["content"];

// Palette: a black-box stage, one tungsten followspot, a red house curtain.
const STAGE = "#170E10";

const CREAM = "#F3E9D8";

const linkClass =
  "underline decoration-[#E8A93B] decoration-2 underline-offset-[5px] hover:bg-[#FFF1CF] hover:text-[#170E10] hover:decoration-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFF1CF] rounded-[2px] transition-colors";

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
    <section id={id} aria-labelledby={`${id}-title`} className="pt-16 md:pt-24">
      <h2
        id={`${id}-title`}
        className="sl-serif text-center text-[2.1rem] md:text-[2.7rem] italic font-normal leading-tight tracking-normal text-[#F3E9D8]"
      >
        {title}
      </h2>
      <div className="mt-8 md:mt-10 min-w-0">{children}</div>
    </section>
  );
}

// The house curtain's valance: pleated velvet with a scalloped hem.
function Valance() {
  return (
    <div aria-hidden="true">
      <div
        className="h-9 md:h-12"
        style={{
          background:
            "repeating-linear-gradient(90deg, #4E0B12 0px, #96202D 13px, #B42E3B 17px, #96202D 21px, #4E0B12 34px)",
        }}
      />
      <div
        className="h-[17px]"
        style={{
          background:
            "radial-gradient(circle at 50% 0, #7C1622 0 16px, transparent 17px) 0 0 / 34px 17px repeat-x",
        }}
      />
    </div>
  );
}

function Hero({ content }: { content: Content }) {
  const links = getContactLinks(content.contact);

  return (
    <header
      className="relative isolate overflow-hidden text-center px-4 md:px-10 pt-10 md:pt-16 pb-16 md:pb-24"
      style={{ backgroundColor: STAGE }}
    >
      <p className="sl-serif italic text-xl md:text-2xl text-[#D9C8B4]">Starring</p>

      <div className="mt-6 md:mt-8 flex justify-center">
        <div className="sl-name relative inline-block max-w-full px-[0.9em] py-[0.5em] text-[clamp(3rem,13vw,8.5rem)]">
          {/* The followspot: a beam from the rig above, landing as a hard-edged pool. */}
          <div
            aria-hidden="true"
            className="sl-beam pointer-events-none absolute inset-x-0 bottom-1/2 h-[60rem]"
            style={{
              clipPath: "polygon(43% 0, 57% 0, 100% 100%, 0 100%)",
              background:
                "linear-gradient(to bottom, rgba(255,236,196,0) 0%, rgba(255,236,196,0.05) 55%, rgba(255,236,196,0.12) 100%)",
            }}
          />
          <div
            aria-hidden="true"
            className="sl-pool pointer-events-none absolute inset-0 rounded-[50%]"
            style={{
              background:
                "radial-gradient(closest-side, #FFF9EC 0%, #FFF2D2 62%, #FFE3A6 98%, #F5CD7E 100%)",
            }}
          />
          <h1 className="sl-serif sl-blend relative font-black leading-[0.95] tracking-[-0.015em] break-words [overflow-wrap:anywhere] [text-wrap:balance]">
            {content.full_name}
          </h1>
        </div>
      </div>

      {content.headline && (
        <p className="sl-serif mt-6 md:mt-8 mx-auto italic text-[1.45rem] md:text-[2rem] leading-[1.2] max-w-[30ch] break-words text-[#F3E9D8]">
          {content.headline}
        </p>
      )}

      {links.length > 0 && (
        <ul className="mt-9 flex flex-wrap justify-center gap-x-7 gap-y-3 text-[0.98rem] text-[#E2D4C2]">
          {links.map((link) => {
            const icon = getContactIcon(link.type, {
              className: "w-4 h-4 shrink-0 text-[#E8A93B]",
              size: 16,
              variant: "white",
              "aria-hidden": true,
            });

            return (
              <li key={link.type} className="flex items-center gap-2 min-w-0">
                {icon}
                {link.href ? (
                  <a
                    href={link.href}
                    target={link.isExternal ? "_blank" : undefined}
                    rel={link.isExternal ? LINK_REL : undefined}
                    className={`${linkClass} break-all`}
                  >
                    {link.label}
                  </a>
                ) : (
                  <span className="break-words">{link.label}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* The stage edge: where the lit floor stops and the house begins. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#E8A93B]/60 to-transparent"
      />
    </header>
  );
}

function WhosWho({
  summary,
  avatarUrl,
  name,
}: {
  summary?: string;
  avatarUrl: string | null;
  name: string;
}) {
  if (!summary && !avatarUrl) return null;

  return (
    <Section id="whos-who" title="Who’s who">
      <div className={avatarUrl ? "grid gap-8 sm:grid-cols-[9rem_1fr] sm:items-start" : ""}>
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt={`Headshot of ${name}`}
            width={144}
            height={180}
            decoding="async"
            className="w-32 sm:w-36 aspect-[4/5] object-cover border-[6px] border-[#F3E9D8] mx-auto sm:mx-0"
          />
        )}
        {summary && (
          <p className="sl-serif sl-dropcap text-[1.2rem] md:text-[1.3rem] font-medium leading-[1.7] text-[#EADFCD] break-words">
            {summary}
          </p>
        )}
      </div>
    </Section>
  );
}

function Credits({ items }: { items: Content["experience"] }) {
  if (!items?.length) return null;

  return (
    <Section id="credits" title="Credits">
      <ol className="space-y-12">
        {items.map((job) => {
          const span = formatDateSpan(job.start_date, job.end_date);
          const meta = [span, job.location].filter(Boolean).join(", ");

          return (
            <li key={`${job.title}-${job.company}-${job.start_date}`}>
              <div className="sm:flex sm:items-baseline sm:gap-3">
                <h3 className="sl-serif text-[1.45rem] md:text-[1.7rem] italic font-normal leading-snug tracking-normal min-w-0 break-words text-[#F3E9D8]">
                  {job.title}
                </h3>
                <span
                  aria-hidden="true"
                  className="hidden sm:block flex-1 min-w-8 border-b-2 border-dotted border-[#8C7766] translate-y-[-0.3em]"
                />
                <p className="sl-serif text-[1.3rem] md:text-[1.55rem] font-bold leading-snug sm:text-right sm:max-w-[50%] break-words text-[#FFF1CF]">
                  {job.company}
                </p>
              </div>
              {meta && <p className="mt-1.5 text-[0.95rem] text-[#BFAE9F]">{meta}</p>}

              {job.description && (
                <p className="mt-4 leading-[1.7] max-w-[62ch] text-[#E2D4C2] break-words">
                  {job.description}
                </p>
              )}

              {job.highlights && job.highlights.length > 0 && (
                <ul className="mt-4 space-y-2 max-w-[62ch]">
                  {job.highlights.map((highlight, i) => (
                    <li
                      key={`${job.title}-${i}-${highlight}`}
                      className="grid grid-cols-[1.25rem_1fr] leading-[1.65] text-[#E2D4C2]"
                    >
                      <span aria-hidden="true" className="text-[#E8A93B]">
                        –
                      </span>
                      <span className="break-words">{highlight}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function Featuring({ groups }: { groups: Content["skills"] }) {
  const filled = groups?.filter((group) => group.items.length > 0) ?? [];

  if (filled.length === 0) return null;

  return (
    <Section id="featuring" title="Featuring">
      <div className="space-y-9 text-center">
        {filled.map((group) => (
          <div key={group.category}>
            {group.category && (
              <p className="text-[0.95rem] text-[#BFAE9F] break-words">{group.category}</p>
            )}
            <p className="sl-serif mt-2 text-[1.4rem] md:text-[1.75rem] font-semibold leading-[1.45] text-[#F3E9D8] break-words [text-wrap:balance]">
              {group.items.join(", ")}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Productions({ items }: { items: Content["projects"] }) {
  if (!items?.length) return null;

  return (
    <Section id="productions" title="Productions">
      <ul className="space-y-10">
        {items.map((project) => (
          <li key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h3 className="sl-serif text-[1.45rem] md:text-[1.7rem] font-bold leading-snug tracking-normal break-words min-w-0 text-[#FFF1CF]">
                <MaybeLink href={project.url} className={linkClass}>
                  {project.title}
                </MaybeLink>
              </h3>
              {project.year && <span className="text-[#BFAE9F]">{project.year}</span>}
            </div>
            {project.description && (
              <p className="mt-3 leading-[1.7] max-w-[62ch] text-[#E2D4C2] break-words">
                {project.description}
              </p>
            )}
            {project.technologies && project.technologies.length > 0 && (
              <p className="mt-2 text-[0.95rem] text-[#BFAE9F] break-words">
                Made with {project.technologies.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Training({ items }: { items: Content["education"] }) {
  if (!items?.length) return null;

  return (
    <Section id="training" title="Training">
      <ul className="space-y-5">
        {items.map((edu) => (
          <li
            key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
            className="leading-[1.6] text-[#E2D4C2] break-words"
          >
            <span className="sl-serif text-[1.25rem] md:text-[1.35rem] font-bold text-[#FFF1CF]">
              {edu.degree}
            </span>
            {edu.institution && (
              <span className="sl-serif text-[1.2rem] italic">, {edu.institution}</span>
            )}
            {edu.graduation_date && (
              <span className="text-[#BFAE9F]"> ({formatYear(edu.graduation_date)})</span>
            )}
            {edu.gpa && <span className="block text-[0.95rem] text-[#BFAE9F]">GPA {edu.gpa}</span>}
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
      <ul className="space-y-5">
        {items.map((cert) => (
          <li
            key={`${cert.name}-${cert.issuer}-${cert.date ?? ""}`}
            className="leading-[1.6] text-[#E2D4C2] break-words"
          >
            <span className="sl-serif text-[1.25rem] md:text-[1.35rem] font-bold text-[#FFF1CF]">
              <MaybeLink href={cert.url} className={linkClass}>
                {cert.name}
              </MaybeLink>
            </span>
            {cert.issuer && <span className="sl-serif text-[1.2rem] italic">, {cert.issuer}</span>}
            {cert.date && <span className="text-[#BFAE9F]"> ({formatShortDate(cert.date)})</span>}
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
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Hanken+Grotesk:wght@400;500;600&display=swap" />

      <div
        className="sl-root min-h-screen overflow-x-hidden selection:bg-[#FFF1CF] selection:text-[#170E10]"
        style={{ backgroundColor: STAGE, color: CREAM }}
      >
        <style>{`
          .sl-root { font-family: 'Hanken Grotesk', system-ui, sans-serif; font-size: 17px; }
          .sl-serif { font-family: 'Bodoni Moda', 'Didot', 'Bodoni 72', Georgia, serif; font-optical-sizing: auto; }
          .sl-blend { color: #FFF7E3; mix-blend-mode: difference; }
          .sl-dropcap::first-letter { float: left; font-size: 3.4em; line-height: 0.82; font-weight: 900; padding: 0.06em 0.08em 0 0; color: #FFF1CF; }
          @keyframes sl-pickup {
            0% { opacity: 0; transform: scale(0.08); }
            60% { opacity: 1; }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes sl-beam-on {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @media (prefers-reduced-motion: no-preference) {
            .sl-animate .sl-pool { animation: sl-pickup 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) 0.45s both; }
            .sl-animate .sl-beam { animation: sl-beam-on 0.3s ease-out 0.45s both; }
          }
        `}</style>

        <div className={isPreview ? "" : "sl-animate"}>
          <Valance />
          <Hero content={content} />

          <div className="max-w-3xl mx-auto px-5 md:px-10">
            <WhosWho summary={content.summary} avatarUrl={profile.avatar_url} name={name} />
            <Credits items={content.experience} />
            <Productions items={content.projects} />
            <Featuring groups={content.skills} />
            <Training items={content.education} />
            <Certifications items={content.certifications} />
          </div>

          <footer className="max-w-3xl mx-auto px-5 md:px-10 pt-20 md:pt-28 pb-14">
            <div className="border-t border-[#E8A93B]/50 pt-12 md:pt-14 text-center">
              <h2 className="sl-serif italic font-normal tracking-normal text-[1.6rem] md:text-[2rem] text-[#D9C8B4]">
                Stage door
              </h2>
              {content.contact.email ? (
                <p className="sl-serif mt-4 text-[2.2rem] md:text-[3.4rem] font-black leading-tight break-words">
                  <a href={`mailto:${content.contact.email}`} className={linkClass}>
                    Write to {firstName}
                  </a>
                </p>
              ) : null}
              <div className="mt-10 flex justify-center">
                <ShareBar
                  handle={profile.handle}
                  title={`${name}'s Portfolio`}
                  name={name}
                  variant="spotlight"
                />
              </div>
              <p className="mt-8 text-[0.95rem] text-[#BFAE9F]" suppressHydrationWarning>
                © {currentYear()} {name}
              </p>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
};
