import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// Near-black, high-contrast, diagonal color blocks — a motivational-poster read on a coach's
// career. Stat callouts come only from numbers already present in the resume's own highlights.

const CYAN = "#37E6E0";

function firstNumber(text: string): string | null {
  return /(\d+(?:\.\d+)?\s?[%xX+]?)/.exec(text)?.[1]?.trim() ?? null;
}

export const PersonalBest: React.FC<TemplateProps> = ({ content, profile }) => {
  const { full_name, summary, headline, contact, experience, education, skills, certifications } =
    content;

  const contactLinks = getContactLinks(contact);
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];

  const stats = (experience ?? [])
    .flatMap((job) => job.highlights ?? [])
    .map((h) => ({ num: firstNumber(h), text: h }))
    .filter((h): h is { num: string; text: string } => h.num !== null)
    .slice(0, 3);

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;600&display=swap" />
      <style>{`
        .font-pb-head, .font-pb-head :is(h1, h2) { font-family: 'Archivo Black', Arial, sans-serif; }
        .font-pb-body, .font-pb-body :is(p, li, dt, dd, a, span, h3) { font-family: 'Archivo', ui-sans-serif, sans-serif; }
      `}</style>
      <div className="font-pb-body font-pb-head min-h-screen bg-[#0B0B0D] text-[#F2F2F0] overflow-x-hidden">
        <header
          className="relative px-5 sm:px-8 pt-16 pb-14 overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(135deg, #0B0B0D 55%, ${CYAN} 55.5%)`,
          }}
        >
          <div className="mx-auto max-w-[48rem] flex items-end gap-6">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                width={96}
                height={96}
                className="w-24 h-24 rounded-xl object-cover shrink-0 border-2 border-[#0B0B0D]"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-24 h-24 rounded-xl bg-[#1A1A1D] flex items-center justify-center text-2xl font-black shrink-0"
                style={{ color: CYAN }}
              >
                {getInitials(full_name)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[clamp(2rem,6vw,3.25rem)] uppercase leading-[0.95] break-words">
                {full_name}
              </h1>
              {headline && (
                <p className="font-pb-body mt-2 text-lg text-[#C8C8C6] break-words">{headline}</p>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[48rem] px-5 sm:px-8 pb-24">
          {contactLinks.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {contactLinks.map((link) => (
                <li key={link.type} className="min-w-0 break-all">
                  {link.href ? (
                    <a
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                      className="font-semibold hover:underline"
                      style={{ color: CYAN }}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <span className="text-[#9A9A98]">{link.label}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {summary && (
            <p className="mt-7 text-[1.0625rem] leading-[1.7] text-[#D7D7D5]">{summary}</p>
          )}

          {stats.length > 0 && (
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {stats.map((s) => (
                <div
                  key={s.text}
                  className="rounded-lg bg-[#17171A] border border-[#2A2A2E] px-5 py-4 min-w-0"
                >
                  <p className="text-4xl font-black tabular-nums" style={{ color: CYAN }}>
                    {s.num}
                  </p>
                  <p className="mt-1 text-[0.8125rem] text-[#9A9A98] break-words">{s.text}</p>
                </div>
              ))}
            </div>
          )}

          {skillGroups.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {skillGroups
                .flatMap((g) => g.items)
                .map((item) => (
                  <span
                    key={item}
                    className="text-[0.8125rem] font-bold uppercase tracking-wide rounded px-3 py-1.5"
                    style={{ backgroundColor: `${CYAN}1A`, color: CYAN }}
                  >
                    {item}
                  </span>
                ))}
            </div>
          )}

          {experience && experience.length > 0 && (
            <section className="mt-14">
              <h2 className="text-2xl uppercase mb-6" style={{ color: CYAN }}>
                Training Log
              </h2>
              <div className="space-y-6">
                {experience.map((job) => (
                  <article
                    key={`${job.company}-${job.title}-${job.start_date}`}
                    className="border-l-2 pl-5 min-w-0"
                    style={{ borderColor: CYAN }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-lg font-bold break-words">{job.title}</h3>
                      <p className="text-sm text-[#9A9A98] tabular-nums shrink-0">
                        {formatDateSpan(job.start_date, job.end_date)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[#C8C8C6]">
                      {job.company}
                      {job.location && (
                        <span className="text-[#9A9A98] font-normal">, {job.location}</span>
                      )}
                    </p>
                    {job.description && (
                      <p className="mt-2 text-[0.9375rem] text-[#D7D7D5]">{job.description}</p>
                    )}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {job.highlights.map((highlight) => (
                          <li
                            key={`${job.title}-${highlight}`}
                            className="text-[0.9375rem] text-[#D7D7D5]"
                          >
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {education && education.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl uppercase mb-4" style={{ color: CYAN }}>
                Credentials
              </h2>
              <div className="space-y-2">
                {education.map((edu) => (
                  <p key={`${edu.institution}-${edu.degree}`} className="text-[0.9375rem]">
                    <span className="font-bold">{edu.degree}</span>
                    <span className="text-[#9A9A98]"> — {edu.institution}</span>
                  </p>
                ))}
              </div>
            </section>
          )}

          {certifications && certifications.length > 0 && (
            <section className="mt-10">
              <h2 className="text-2xl uppercase mb-4" style={{ color: CYAN }}>
                Certifications
              </h2>
              <ul className="space-y-1.5">
                {certifications.map((cert) => (
                  <li key={`${cert.name}-${cert.issuer ?? ""}`} className="text-[0.9375rem]">
                    {cert.name}
                    {cert.issuer && <span className="text-[#9A9A98]"> — {cert.issuer}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="mt-16 pt-6 border-t border-[#2A2A2E] flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[#9A9A98]">@{profile.handle}</p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="personal-best"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
