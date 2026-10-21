import { MapPin } from "lucide-react";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateRange, formatShortDate, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { getContactIcon } from "./shared/ContactIcon";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

type Content = TemplateProps["content"];

type Job = NonNullable<Content["experience"]>[number];

type Area =
  | "id"
  | "now"
  | "contact"
  | "feat"
  | "about"
  | "exp"
  | "skills"
  | "edu"
  | "proj"
  | "cert";

// Tile fills. Flat colours, no shadows: hierarchy comes from size and type, not depth.
const PINE = "#1F4E3D";

const PAPER = "#F4F5F1";

const INK = "#1A1C20";

const MUSTARD = "#F4D35E";

const SKY = "#BFD7EA";

const LILAC = "#D9D2F2";

const TILE = "rounded-[22px] p-6 md:p-7 min-w-0";

const TILE_HEADING = "font-bento text-[15px] font-bold mb-4";

function row(...cells: Array<[Area, number]>): string {
  return `"${cells.flatMap(([area, span]) => Array<Area>(span).fill(area)).join(" ")}"`;
}

/**
 * Builds the grid-template-areas for whichever tiles exist, so a missing section never
 * leaves a hole: the neighbouring tile takes over its columns instead.
 */
function buildAreas(has: Record<Area, boolean>) {
  const rows: string[] = [];
  // The identity tile runs down the left of the "now" and contact tiles.
  const beside = (["now", "contact"] as const).filter((area) => has[area]);

  if (beside.length === 0) rows.push(row(["id", 6]));

  for (const area of beside) rows.push(row(["id", 4], [area, 2]));

  if (has.feat && has.about) rows.push(row(["feat", 2], ["about", 4]));
  else if (has.about) rows.push(row(["about", 6]));
  else if (has.feat) rows.push(row(["feat", 6]));

  // Experience is usually the tallest tile, so the short tiles stack in a column beside it.
  const side = (["skills", "edu", "cert"] as const).filter((area) => has[area]);

  if (has.exp) {
    if (side.length === 0) rows.push(row(["exp", 6]));

    for (const area of side) rows.push(row(["exp", 4], [area, 2]));
  } else if (side.length > 0) {
    rows.push(row(...side.map((area): [Area, number] => [area, 6 / side.length])));
  }

  if (has.proj) rows.push(row(["proj", 6]));

  const order: Area[] = [
    "id",
    "now",
    "contact",
    "about",
    "feat",
    "exp",
    "skills",
    "edu",
    "cert",
    "proj",
  ];

  const mobile = order.flatMap((area) => (has[area] ? [`"${area}"`] : [])).join(" ");

  return { mobile, desktop: rows.join(" ") };
}

function isOngoing(job: Job): boolean {
  const end = job.end_date?.trim();

  return !end || /^(present|current|now|ongoing)$/i.test(end);
}

/** The role the "now" tile describes: the ongoing one, or else the latest entry. */
function pickCurrentRole(experience: Job[]): { job: Job; ongoing: boolean } | null {
  const usable = experience.filter((job) => job.title?.trim());
  const ongoing = usable.find(isOngoing);

  if (ongoing) return { job: ongoing, ongoing: true };

  return usable[0] ? { job: usable[0], ongoing: false } : null;
}

/**
 * A single achievement to pull out at display size. Prefers one that carries a real figure
 * from the resume ("35%", "20M"), since those read best as a headline; falls back to the
 * first highlight written.
 */
function pickFeatured(experience: Job[]): { text: string; job: Job } | null {
  const all = experience.flatMap((job) =>
    (job.highlights ?? [])
      .map((text) => text.trim())
      .filter((text) => text.length > 0 && text.length <= 140)
      .map((text) => ({ text, job })),
  );

  return all.find((item) => /\d/.test(item.text)) ?? all[0] ?? null;
}

function NowTile({
  role,
  location,
}: {
  role: { job: Job; ongoing: boolean } | null;
  location: string | undefined;
}) {
  const { job, ongoing } = role ?? {};
  const since = job?.start_date?.trim();

  return (
    <section
      aria-labelledby="bento-now"
      className={`b-now flex flex-col justify-between gap-6 ${TILE}`}
      style={{ backgroundColor: SKY }}
    >
      {job ? (
        <div>
          <h2 id="bento-now" className="text-[15px] text-[#2F4253]">
            {ongoing ? "Currently" : "Most recently"}
          </h2>
          <p className="font-bento mt-2 text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.03em] break-words">
            {job.title}
          </p>
          {job.company && (
            <p className="mt-1.5 text-[17px] font-medium leading-snug break-words">{job.company}</p>
          )}
          {since && ongoing && (
            <p className="mt-1 text-[15px] text-[#2F4253] tabular-nums">
              Since {formatShortDate(since)}
            </p>
          )}
        </div>
      ) : (
        <h2 id="bento-now" className="text-[15px] text-[#2F4253]">
          Based in
        </h2>
      )}
      {location && (
        <p
          className={`flex items-start gap-1.5 break-words ${job ? "text-[15px] font-medium" : "font-bento text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em]"}`}
        >
          {job && <MapPin size={16} aria-hidden="true" className="mt-[3px] shrink-0" />}
          <span className="min-w-0">{location}</span>
        </p>
      )}
    </section>
  );
}

function ExperienceTile({ experience }: { experience: Job[] }) {
  return (
    <section aria-labelledby="bento-exp" className={`b-exp bg-white ${TILE}`}>
      <h2 id="bento-exp" className={TILE_HEADING}>
        Experience
      </h2>
      <ol className="divide-y divide-[#E3E5DF]">
        {experience.map((job) => (
          <li
            key={`${job.title}-${job.company}-${job.start_date}`}
            className="grid gap-x-6 gap-y-1 py-5 first:pt-0 last:pb-0 sm:grid-cols-[9.5rem_1fr]"
          >
            <p className="text-sm text-[#5E6259] tabular-nums sm:pt-1">
              {formatDateRange(job.start_date, job.end_date)}
            </p>
            <div className="min-w-0">
              <h3 className="font-bento text-xl font-bold leading-snug tracking-[-0.01em] break-words">
                {job.title}
              </h3>
              <p className="text-[15px] text-[#5E6259] break-words">
                {job.company}
                {job.location && <span>, {job.location}</span>}
              </p>
              {job.description && (
                <p className="mt-3 text-[15px] leading-relaxed">{job.description}</p>
              )}
              {job.highlights && job.highlights.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-[15px] leading-relaxed">
                  {job.highlights.map((highlight, i) => (
                    <li key={`${job.title}-${i}`} className="relative pl-4 break-words">
                      <span
                        className="absolute left-0 top-[0.7em] h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: PINE }}
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
    </section>
  );
}

// Indexed by column count; literal class names so Tailwind picks them up.
const PROJECT_COLS = ["", "", "lg:grid-cols-2", "lg:grid-cols-3"] as const;

const PROJECT_SPAN = ["", "", "lg:col-span-2", "lg:col-span-3"] as const;

function ProjectTiles({ projects }: { projects: NonNullable<Content["projects"]> }) {
  const cols = Math.min(projects.length, 3);
  const remainder = projects.length % cols;
  // Stretch the last tile across the leftover columns so the row never ends in a gap.
  const lastSpan = remainder === 0 ? 1 : cols - remainder + 1;

  return (
    <section aria-labelledby="bento-proj" className="b-proj min-w-0">
      <h2 id="bento-proj" className="sr-only">
        Projects
      </h2>
      <div className={`grid h-full gap-3 ${PROJECT_COLS[cols]}`}>
        {projects.map((project, i) => (
          <article
            key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
            className={`flex flex-col bg-white ${TILE} ${i === projects.length - 1 ? PROJECT_SPAN[lastSpan] : ""}`}
          >
            {project.image_url && (
              <img
                src={project.image_url}
                alt=""
                loading="lazy"
                decoding="async"
                className="mb-5 aspect-[16/9] w-full rounded-[14px] object-cover"
              />
            )}
            {project.year && <p className="text-sm text-[#5E6259] tabular-nums">{project.year}</p>}
            <h3 className="font-bento mt-1 text-2xl font-bold leading-tight tracking-[-0.02em] break-words">
              {project.url ? (
                <a
                  href={project.url}
                  target="_blank"
                  rel="ugc nofollow noopener noreferrer"
                  className="underline decoration-2 underline-offset-4 decoration-[#1F4E3D]/30 hover:decoration-[#1F4E3D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E3D] rounded-sm"
                >
                  {project.title}
                </a>
              ) : (
                project.title
              )}
            </h3>
            {project.description && (
              <p className="mt-2 text-[15px] leading-relaxed">{project.description}</p>
            )}
            {project.technologies && project.technologies.length > 0 && (
              <p className="mt-auto pt-4 text-sm font-medium break-words" style={{ color: PINE }}>
                <span className="sr-only">Built with: </span>
                {project.technologies.join(", ")}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export const BentoGrid: React.FC<TemplateProps> = ({ content, profile }) => {
  const contactLinks = getContactLinks(content.contact).filter((link) => link.type !== "location");
  const skills = content.skills?.filter((group) => group.items.length > 0) ?? [];
  const experience = content.experience ?? [];
  const education = content.education ?? [];
  const projects = content.projects ?? [];
  const certifications = content.certifications ?? [];
  const location = content.contact?.location?.trim() || undefined;
  const currentRole = pickCurrentRole(experience);
  const featured = pickFeatured(experience);

  const has: Record<Area, boolean> = {
    id: true,
    now: Boolean(currentRole || location),
    contact: contactLinks.length > 0,
    feat: featured !== null,
    about: Boolean(content.summary?.trim()),
    exp: experience.length > 0,
    skills: skills.length > 0,
    edu: education.length > 0,
    proj: projects.length > 0,
    cert: certifications.length > 0,
  };

  const areas = buildAreas(has);

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;700;800&display=swap" />
      <style>{`
        .font-bento, .bento-root h1, .bento-root h2, .bento-root h3 { font-family: 'Schibsted Grotesk', ui-sans-serif, system-ui, sans-serif; }
        .bento-grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: ${areas.mobile}; }
        .b-id { grid-area: id; } .b-now { grid-area: now; } .b-contact { grid-area: contact; }
        .b-feat { grid-area: feat; } .b-about { grid-area: about; }
        .b-exp { grid-area: exp; } .b-skills { grid-area: skills; } .b-edu { grid-area: edu; }
        .b-proj { grid-area: proj; } .b-cert { grid-area: cert; }
        @media (min-width: 1024px) {
          .bento-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); grid-template-areas: ${areas.desktop}; }
        }
      `}</style>

      <main
        className="bento-root font-bento min-h-screen px-3 py-3 antialiased sm:px-5 sm:py-5 lg:px-8 lg:py-8"
        style={{ backgroundColor: "#E4E7E1", color: INK }}
      >
        <div className="bento-grid mx-auto grid max-w-6xl gap-3">
          <header
            className={`b-id flex min-h-[280px] flex-col justify-between gap-10 ${TILE} lg:min-h-[400px] lg:p-10`}
            style={{ backgroundColor: PINE, color: PAPER }}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`Portrait of ${content.full_name}`}
                width={88}
                height={88}
                decoding="async"
                fetchPriority="high"
                className="h-[72px] w-[72px] rounded-[18px] object-cover lg:h-[88px] lg:w-[88px]"
              />
            ) : (
              <span aria-hidden="true" />
            )}
            <div>
              <h1 className="text-[clamp(2.75rem,8vw,7.25rem)] font-extrabold leading-[0.92] tracking-[-0.045em] break-words">
                {content.full_name}
              </h1>
              {content.headline && (
                <p className="mt-5 max-w-xl text-lg leading-snug text-[#F4F5F1]/80 sm:text-xl">
                  {content.headline}
                </p>
              )}
            </div>
          </header>

          {has.now && <NowTile role={currentRole} location={location} />}

          {has.contact && (
            <section aria-labelledby="bento-contact" className={`b-contact bg-white ${TILE}`}>
              <h2 id="bento-contact" className={TILE_HEADING}>
                Get in touch
              </h2>
              <ul className="space-y-2.5">
                {contactLinks.map((link) => (
                  <li key={link.type} className="min-w-0">
                    <a
                      href={link.href}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                      className="inline-flex max-w-full items-center gap-2.5 text-[15px] font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E3D] rounded-sm"
                    >
                      <span className="flex shrink-0" style={{ color: PINE }}>
                        {getContactIcon(link.type, {
                          size: 18,
                          strokeWidth: 1.75,
                          "aria-hidden": true,
                        })}
                      </span>
                      <span className="truncate">{link.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {featured && (
            <figure
              className={`b-feat flex flex-col justify-between gap-8 ${TILE}`}
              style={{ backgroundColor: MUSTARD }}
            >
              <blockquote className="font-bento text-[clamp(1.5rem,2.4vw,2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] break-words">
                {featured.text}
              </blockquote>
              <figcaption className="text-[15px] leading-snug text-[#4D4110] break-words">
                {[featured.job.title, featured.job.company].filter(Boolean).join(", ")}
              </figcaption>
            </figure>
          )}

          {has.about && (
            <section
              aria-labelledby="bento-about"
              className={`b-about flex items-end bg-white ${TILE} lg:p-10`}
            >
              <h2 id="bento-about" className="sr-only">
                About
              </h2>
              <p className="max-w-[46ch] text-lg leading-relaxed sm:text-xl lg:text-[1.5rem] lg:leading-snug">
                {content.summary}
              </p>
            </section>
          )}

          {has.exp && <ExperienceTile experience={experience} />}

          {has.skills && (
            <section
              aria-labelledby="bento-skills"
              className={`b-skills ${TILE}`}
              style={{ backgroundColor: LILAC }}
            >
              <h2 id="bento-skills" className={TILE_HEADING}>
                Skills
              </h2>
              <dl className="space-y-5">
                {skills.map((group) => (
                  <div key={group.category}>
                    <dt className="text-sm text-[#4A4560]">{group.category}</dt>
                    <dd className="font-bento mt-1 text-[17px] font-bold leading-snug break-words">
                      {group.items.join(", ")}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {has.edu && (
            <section aria-labelledby="bento-edu" className={`b-edu bg-white ${TILE}`}>
              <h2 id="bento-edu" className={TILE_HEADING}>
                Education
              </h2>
              <ul className="space-y-5">
                {education.map((edu) => (
                  <li key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}>
                    <h3 className="text-[17px] font-bold leading-snug break-words">{edu.degree}</h3>
                    <p className="text-[15px] text-[#5E6259] break-words">{edu.institution}</p>
                    {(edu.graduation_date || edu.gpa) && (
                      <p className="mt-0.5 text-sm text-[#5E6259] tabular-nums">
                        {edu.graduation_date && formatYear(edu.graduation_date)}
                        {edu.graduation_date && edu.gpa && ", "}
                        {edu.gpa && `GPA ${edu.gpa}`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {has.cert && (
            <section
              aria-labelledby="bento-cert"
              className={`b-cert ${TILE}`}
              style={{ backgroundColor: PINE, color: PAPER }}
            >
              <h2 id="bento-cert" className={TILE_HEADING}>
                Certifications
              </h2>
              <ul className="space-y-4">
                {certifications.map((cert) => (
                  <li key={`${cert.name}-${cert.issuer}-${cert.date ?? ""}`} className="min-w-0">
                    <h3 className="text-[17px] font-bold leading-snug break-words">
                      {cert.url ? (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="ugc nofollow noopener noreferrer"
                          className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4F5F1] rounded-sm"
                        >
                          {cert.name}
                        </a>
                      ) : (
                        cert.name
                      )}
                    </h3>
                    {(cert.issuer || cert.date) && (
                      <p className="text-[15px] text-[#F4F5F1]/75 break-words">
                        {cert.issuer}
                        {cert.issuer && cert.date && ", "}
                        {cert.date && formatYear(cert.date)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {has.proj && <ProjectTiles projects={projects} />}
        </div>

        <footer className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-1 pb-2">
          <p className="text-[15px] font-medium text-[#41453D]">Share this portfolio</p>
          <ShareBar
            handle={profile.handle}
            title={`${content.full_name}'s Portfolio`}
            name={content.full_name}
            variant="bento-grid"
          />
        </footer>
      </main>
    </>
  );
};
