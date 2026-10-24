import { MaybeLink, LINK_REL } from "./shared/ExternalLink";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A real-estate listing sheet. The agent's name hangs on a yard sign (phone number as big as
// the name, brokerage on the rider), the resume's facts fill an MLS-style property-details
// table, and each role is filed as a listing marked Active or Closed. No counts anywhere.

const SIGN = "#1F4D3A";
const INK = "#18231D";
const MUTED = "#56615A";
const CLOSED = "#9B2C24";

interface ListingFact {
  label: string;
  value: React.ReactNode;
}

function earliestYear(dates: Array<string | undefined>): string | null {
  const years = dates.flatMap((date) => {
    const year = date ? formatYear(date) : "";

    return /^\d{4}$/.test(year) ? [year] : [];
  });

  return years.sort()[0] ?? null;
}

function YardSign({
  name,
  headline,
  phone,
  phoneHref,
  rider,
  avatarUrl,
}: {
  name: string;
  headline?: string;
  phone?: string;
  phoneHref?: string;
  rider: string | null;
  avatarUrl: string | null;
}): React.ReactElement {
  return (
    <div className="relative pl-7 sm:pl-10 pt-3 pb-8">
      {/* post, arm and finial */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-3 sm:w-4"
        style={{ backgroundColor: INK }}
      />
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 h-3 right-[6%]"
        style={{ backgroundColor: INK }}
      />
      <span
        aria-hidden="true"
        className="absolute -left-1 -top-2 h-3 w-5 sm:w-6"
        style={{ backgroundColor: INK }}
      />

      <div className="relative mt-9 mr-[3%]">
        <span
          aria-hidden="true"
          className="absolute -top-9 left-[14%] h-9 border-l-2 border-dotted border-[#18231D]"
        />
        <span
          aria-hidden="true"
          className="absolute -top-9 right-[14%] h-9 border-l-2 border-dotted border-[#18231D]"
        />

        <div className="text-white p-2" style={{ backgroundColor: SIGN }}>
          <div className="border-2 border-white/80 px-5 py-6 sm:px-9 sm:py-9 flex flex-col sm:flex-row sm:items-center gap-6">
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt=""
                width={112}
                height={112}
                className="w-24 h-24 sm:w-28 sm:h-28 object-cover border-2 border-white shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="oh-sign text-[clamp(2rem,7vw,3.75rem)] leading-[0.95] uppercase [overflow-wrap:anywhere] [text-wrap:balance]">
                {name}
              </h1>
              {headline && (
                <p className="oh-serif mt-3 text-lg sm:text-xl italic text-white/90 [overflow-wrap:anywhere]">
                  {headline}
                </p>
              )}
              {phone && (
                <a
                  href={phoneHref}
                  className="oh-sign mt-5 inline-block text-[clamp(1.5rem,4.5vw,2.25rem)] tabular-nums leading-none border-t-2 border-white/70 pt-4 hover:text-[#D9EADF]"
                >
                  {phone}
                </a>
              )}
            </div>
          </div>
        </div>

        {rider && (
          <div className="relative mt-3 ml-[8%] mr-[8%]">
            <span
              aria-hidden="true"
              className="absolute -top-3 left-[10%] h-3 border-l-2 border-[#18231D]"
            />
            <span
              aria-hidden="true"
              className="absolute -top-3 right-[10%] h-3 border-l-2 border-[#18231D]"
            />
            <p
              className="oh-label bg-white border-2 px-4 py-2 text-center text-sm sm:text-base uppercase tracking-[0.06em] [overflow-wrap:anywhere]"
              style={{ borderColor: SIGN, color: SIGN }}
            >
              {rider}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export const OpenHouse: React.FC<TemplateProps> = ({ content, profile }) => {
  const {
    full_name,
    headline,
    summary,
    contact,
    experience,
    education,
    skills,
    certifications,
    projects,
  } = content;

  const contactLinks = getContactLinks(contact).filter((link) => link.type !== "location");
  const phoneLink = contactLinks.find((link) => link.type === "phone");
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];
  const currentRole = experience?.find((job) => !job.end_date?.trim());
  const activeSince = earliestYear((experience ?? []).map((job) => job.start_date));

  const facts: ListingFact[] = [];

  if (contact.location) facts.push({ label: "Location", value: contact.location });

  if (activeSince) facts.push({ label: "In practice since", value: activeSince });

  for (const group of skillGroups) {
    facts.push({ label: group.category, value: group.items.join(", ") });
  }

  if (certifications && certifications.length > 0) {
    facts.push({
      label: "Licenses and designations",
      value: (
        <ul className="space-y-1.5">
          {certifications.map((cert) => (
            <li key={`${cert.name}-${cert.issuer ?? ""}`}>
              <span className="font-semibold">{cert.name}</span>
              {(cert.issuer || cert.date) && (
                <span style={{ color: MUTED }}>
                  {cert.issuer && `, ${cert.issuer}`}
                  {cert.date && `, ${formatYear(cert.date)}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (education && education.length > 0) {
    facts.push({
      label: "Education",
      value: (
        <ul className="space-y-1.5">
          {education.map((edu) => (
            <li key={`${edu.institution}-${edu.degree}`}>
              <span className="font-semibold">{edu.degree}</span>
              <span style={{ color: MUTED }}>
                , {edu.institution}
                {edu.graduation_date && `, ${formatShortDate(edu.graduation_date)}`}
              </span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  // The phone number is already on the sign.
  const otherLinks = contactLinks.filter((link) => link.type !== "phone");

  if (otherLinks.length > 0) {
    facts.push({
      label: "Contact",
      value: (
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {otherLinks.map((link) => (
            <li key={link.type} className="min-w-0 break-all">
              <a
                href={link.href}
                target={link.isExternal ? "_blank" : undefined}
                rel={link.isExternal ? LINK_REL : undefined}
                className="underline decoration-[#1F4D3A]/40 underline-offset-4 hover:decoration-[#1F4D3A]"
                style={{ color: SIGN }}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ),
    });
  }

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;1,8..60,400&display=swap" />
      <style>{`
        .oh-root, .oh-root :is(p, li, dt, dd, a, span, button, td, th) { font-family: 'Archivo', system-ui, sans-serif; }
        .oh-root .oh-serif { font-family: 'Source Serif 4', Georgia, serif; }
        .oh-root .oh-sign { font-family: 'Archivo', system-ui, sans-serif; font-weight: 800; font-stretch: 118%; }
        .oh-root :is(h2, h3), .oh-root .oh-label { font-family: 'Archivo', system-ui, sans-serif; font-weight: 700; font-stretch: 108%; }
      `}</style>
      <div className="oh-root min-h-screen bg-[#EEF1EE] text-[#18231D] overflow-x-hidden">
        <div className="mx-auto max-w-[50rem] px-4 sm:px-8 pt-10 sm:pt-14 pb-24">
          <YardSign
            name={full_name}
            headline={headline}
            phone={phoneLink?.label}
            phoneHref={phoneLink?.href}
            rider={currentRole?.company ?? null}
            avatarUrl={profile.avatar_url}
          />

          {facts.length > 0 && (
            <section aria-labelledby="oh-details" className="mt-6">
              <h2
                id="oh-details"
                className="text-white text-sm uppercase tracking-[0.08em] px-4 py-2"
                style={{ backgroundColor: INK }}
              >
                Property details
              </h2>
              <dl className="bg-white border-x border-b border-[#18231D]">
                {facts.map((fact, i) => (
                  <div
                    key={`${i}-${fact.label}`}
                    className="grid grid-cols-1 sm:grid-cols-[13rem_minmax(0,1fr)] border-t border-[#18231D]/25 first:border-t-0"
                  >
                    <dt
                      className="oh-label bg-[#E1E7E2] px-4 pt-2.5 pb-1 sm:py-2.5 text-xs uppercase tracking-[0.06em] [overflow-wrap:anywhere]"
                      style={{ color: INK }}
                    >
                      {fact.label}
                    </dt>
                    <dd className="px-4 py-2.5 text-[0.9375rem] leading-snug [overflow-wrap:anywhere] sm:border-l border-[#18231D]/25">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {summary && (
            <section className="mt-12">
              <h2 className="text-sm uppercase tracking-[0.08em] pb-2 border-b-2 border-[#18231D]">
                Remarks
              </h2>
              <p className="oh-serif mt-4 text-[1.1875rem] leading-[1.65] max-w-[38rem] [overflow-wrap:anywhere]">
                {summary}
              </p>
            </section>
          )}

          {experience && experience.length > 0 && (
            <section className="mt-12">
              <h2 className="text-sm uppercase tracking-[0.08em] pb-2 border-b-2 border-[#18231D]">
                Listing history
              </h2>
              <div>
                {experience.map((job) => {
                  const isActive = !job.end_date?.trim();
                  const span = formatDateSpan(job.start_date, job.end_date);

                  return (
                    <article
                      key={`${job.company}-${job.title}-${job.start_date}`}
                      className="py-6 border-b border-[#18231D]/25 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span
                          className="oh-label px-2 py-0.5 text-[0.6875rem] uppercase tracking-[0.08em] text-white"
                          style={{ backgroundColor: isActive ? SIGN : CLOSED }}
                        >
                          {isActive ? "Active" : "Closed"}
                        </span>
                        {span && (
                          <span className="text-sm tabular-nums" style={{ color: MUTED }}>
                            {span}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-[1.375rem] leading-tight [overflow-wrap:anywhere]">
                        {job.company}
                      </h3>
                      <p
                        className="text-[0.9375rem] [overflow-wrap:anywhere]"
                        style={{ color: MUTED }}
                      >
                        {job.title}
                        {job.location && `, ${job.location}`}
                      </p>
                      {job.description && (
                        <p className="oh-serif mt-3 text-[1.0625rem] leading-relaxed max-w-[38rem] [overflow-wrap:anywhere]">
                          {job.description}
                        </p>
                      )}
                      {job.highlights && job.highlights.length > 0 && (
                        <ul className="mt-3 space-y-1.5 max-w-[38rem]">
                          {job.highlights.map((highlight) => (
                            <li
                              key={`${job.title}-${highlight}`}
                              className="relative pl-4 text-[0.9375rem] leading-snug [overflow-wrap:anywhere]"
                            >
                              <span
                                aria-hidden="true"
                                className="absolute left-0 top-[0.45em] size-[0.4rem]"
                                style={{ backgroundColor: SIGN }}
                              />
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section className="mt-12">
              <h2 className="text-sm uppercase tracking-[0.08em] pb-2 border-b-2 border-[#18231D]">
                Featured projects
              </h2>
              <div>
                {projects.map((project) => (
                  <article
                    key={`${project.title}-${project.year ?? ""}`}
                    className="py-5 border-b border-[#18231D]/25 last:border-b-0"
                  >
                    <h3 className="text-[1.1875rem] leading-tight [overflow-wrap:anywhere]">
                      <MaybeLink
                        href={project.url}
                        className="underline decoration-[#1F4D3A]/40 underline-offset-4 hover:decoration-[#1F4D3A]"
                        style={{ color: SIGN }}
                      >
                        {project.title}
                      </MaybeLink>
                      {project.year && (
                        <span className="ml-3 text-sm font-normal" style={{ color: MUTED }}>
                          {project.year}
                        </span>
                      )}
                    </h3>
                    {project.description && (
                      <p className="oh-serif mt-1.5 text-[1.0625rem] leading-relaxed max-w-[38rem] [overflow-wrap:anywhere]">
                        {project.description}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <footer className="mt-14 pt-5 border-t-2 border-[#18231D] flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm" style={{ color: MUTED }}>
              @{profile.handle}
            </p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="open-house"
            />
          </footer>
        </div>
      </div>
    </>
  );
};
