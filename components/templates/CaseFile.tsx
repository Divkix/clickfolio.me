import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatShortDate, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A typed dossier clipped inside a manila folder on a dark desk. The header is an intake form
// (subject, occupation, location), and each resume section is filed as a lettered exhibit —
// letters are assigned only to sections that exist, so a sparse resume never skips a letter.

type Content = TemplateProps["content"];

const INK = "#1F1D1A";

const LINK =
  "text-[#1F1D1A] underline decoration-[#B3261E]/50 underline-offset-[3px] hover:decoration-[#B3261E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B3261E]";

function dateSpan(start?: string, end?: string | null): string | null {
  if (!start?.trim()) return end?.trim() ? formatShortDate(end) : null;

  return `${formatShortDate(start)} – ${end?.trim() ? formatShortDate(end) : "Present"}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-b border-[#CFC5B1] pb-1.5">
      <dt className="font-label-cf text-[10.5px] tracking-[0.18em] text-[#6A6358] uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 min-w-0 break-words text-[15px] leading-6">{children}</dd>
    </div>
  );
}

function Exhibit({
  id,
  letter,
  title,
  children,
}: {
  id: string;
  letter: string;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-12 md:mt-14">
      <header className="flex items-baseline gap-3 border-b-2 border-[#1F1D1A] pb-2">
        <span className="font-label-cf shrink-0 text-[11px] tracking-[0.2em] text-[#B3261E] uppercase">
          Exhibit {letter}
        </span>
        <h2
          id={`${id}-title`}
          className="font-type-cf min-w-0 text-xl leading-tight tracking-wide uppercase md:text-2xl"
        >
          {title}
        </h2>
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Record({
  dates,
  children,
}: {
  dates: string | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <article className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-1 border-b border-dashed border-[#CFC5B1] py-4 first:pt-0 last:border-b-0 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <p className="font-label-cf text-xs tracking-[0.08em] text-[#6A6358] uppercase tabular-nums sm:pt-1">
        {dates ?? "Undated"}
      </p>
      <div className="min-w-0">{children}</div>
    </article>
  );
}

function Photo({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <div className="relative mx-auto w-32 shrink-0 rotate-[2.5deg] bg-white p-2 pb-6 shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:mx-0 md:w-36">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-5 h-9 w-3.5 rounded-full border-[3px] border-[#8E9196] border-b-transparent"
      />
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`Photograph of ${name}`}
          width={128}
          height={160}
          fetchPriority="high"
          decoding="async"
          className="aspect-[4/5] w-full object-cover grayscale-[35%] sepia-[15%]"
        />
      ) : (
        <div
          aria-hidden="true"
          className="font-type-cf flex aspect-[4/5] w-full items-center justify-center bg-[#E7E1D3] text-3xl text-[#6A6358]"
        >
          {getInitials(name)}
        </div>
      )}
      <p
        aria-hidden="true"
        className="font-label-cf absolute inset-x-0 bottom-1 text-center text-[9px] tracking-[0.2em] text-[#6A6358] uppercase"
      >
        Attached
      </p>
    </div>
  );
}

function ExperienceExhibit({
  letter,
  experience,
}: {
  letter: string;
  experience: Content["experience"];
}) {
  return (
    <Exhibit id="experience" letter={letter} title="Employment History">
      {experience.map((job) => (
        <Record
          key={`${job.company}-${job.title}-${job.start_date}`}
          dates={dateSpan(job.start_date, job.end_date)}
        >
          <h3 className="text-base font-bold break-words md:text-[17px]">{job.title}</h3>
          {(job.company || job.location) && (
            <p className="text-[#6A6358]">
              {job.company}
              {job.company && job.location && " · "}
              {job.location}
            </p>
          )}
          {job.description && <p className="mt-2 leading-7">{job.description}</p>}
          {job.highlights && job.highlights.length > 0 && (
            <ul className="mt-2 space-y-1 leading-7">
              {job.highlights.map((highlight) => (
                <li key={`${job.title}-${highlight}`} className="flex gap-3">
                  <span aria-hidden="true" className="shrink-0 text-[#B3261E]">
                    —
                  </span>
                  <span className="min-w-0">{highlight}</span>
                </li>
              ))}
            </ul>
          )}
        </Record>
      ))}
    </Exhibit>
  );
}

function ProjectsExhibit({
  letter,
  projects,
}: {
  letter: string;
  projects: NonNullable<Content["projects"]>;
}) {
  return (
    <Exhibit id="projects" letter={letter} title="Projects & Casework">
      {projects.map((project) => (
        <Record
          key={`${project.title}-${project.year ?? ""}-${project.url ?? ""}`}
          dates={project.year?.trim() || null}
        >
          <h3 className="text-base font-bold break-words md:text-[17px]">
            {project.url ? (
              <a href={project.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                {project.title}
              </a>
            ) : (
              project.title
            )}
          </h3>
          {project.description && <p className="mt-1.5 leading-7">{project.description}</p>}
          {project.technologies && project.technologies.length > 0 && (
            <p className="font-label-cf mt-2 text-xs tracking-[0.08em] text-[#6A6358] uppercase">
              Methods: {project.technologies.join(", ")}
            </p>
          )}
        </Record>
      ))}
    </Exhibit>
  );
}

function EducationExhibit({
  letter,
  education,
}: {
  letter: string;
  education: NonNullable<Content["education"]>;
}) {
  return (
    <Exhibit id="education" letter={letter} title="Education">
      {education.map((edu) => (
        <Record
          key={`${edu.institution}-${edu.degree}-${edu.graduation_date ?? ""}`}
          dates={edu.graduation_date?.trim() ? formatShortDate(edu.graduation_date) : null}
        >
          <h3 className="text-base font-bold break-words md:text-[17px]">{edu.degree}</h3>
          <p className="text-[#6A6358]">
            {edu.institution}
            {edu.location && `, ${edu.location}`}
          </p>
          {edu.gpa && <p className="mt-1 text-sm">GPA {edu.gpa}</p>}
        </Record>
      ))}
    </Exhibit>
  );
}

function SkillsExhibit({
  letter,
  skills,
}: {
  letter: string;
  skills: NonNullable<Content["skills"]>;
}) {
  return (
    <Exhibit id="skills" letter={letter} title="Known Capabilities">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {skills.map((group) => (
          <div key={group.category} className="min-w-0 border-l-2 border-[#B3261E]/60 pl-3">
            <dt className="font-label-cf text-[11px] tracking-[0.16em] text-[#6A6358] uppercase">
              {group.category || "General"}
            </dt>
            <dd className="mt-1 leading-7">{group.items.filter(Boolean).join(" / ")}</dd>
          </div>
        ))}
      </dl>
    </Exhibit>
  );
}

function CertificationsExhibit({
  letter,
  certifications,
}: {
  letter: string;
  certifications: NonNullable<Content["certifications"]>;
}) {
  return (
    <Exhibit id="certifications" letter={letter} title="Credentials on File">
      {certifications.map((cert) => (
        <Record
          key={`${cert.name}-${cert.issuer ?? ""}-${cert.date ?? ""}`}
          dates={cert.date?.trim() ? formatShortDate(cert.date) : null}
        >
          <h3 className="text-base font-bold break-words">
            {cert.url ? (
              <a href={cert.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                {cert.name}
              </a>
            ) : (
              cert.name
            )}
          </h3>
          {cert.issuer && <p className="text-[#6A6358]">Issued by {cert.issuer}</p>}
        </Record>
      ))}
    </Exhibit>
  );
}

export const CaseFile: React.FC<TemplateProps> = ({ content, profile }) => {
  const { full_name, headline, summary, contact, experience, projects, education, certifications } =
    content;

  const skillGroups = content.skills?.filter((group) => group.items.some(Boolean)) ?? [];
  const links = getContactLinks(contact).filter((link) => link.type !== "location");
  const fileNumber = profile.handle.toUpperCase();

  const exhibits: Array<(letter: string) => React.ReactNode> = [
    ...(experience.length > 0
      ? [
          (letter: string) => (
            <ExperienceExhibit key="experience" letter={letter} experience={experience} />
          ),
        ]
      : []),
    ...(projects && projects.length > 0
      ? [(letter: string) => <ProjectsExhibit key="projects" letter={letter} projects={projects} />]
      : []),
    ...(education && education.length > 0
      ? [
          (letter: string) => (
            <EducationExhibit key="education" letter={letter} education={education} />
          ),
        ]
      : []),
    ...(skillGroups.length > 0
      ? [(letter: string) => <SkillsExhibit key="skills" letter={letter} skills={skillGroups} />]
      : []),
    ...(certifications && certifications.length > 0
      ? [
          (letter: string) => (
            <CertificationsExhibit
              key="certifications"
              letter={letter}
              certifications={certifications}
            />
          ),
        ]
      : []),
  ];

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Special+Elite&family=IBM+Plex+Sans+Condensed:wght@500&display=swap" />
      <style>{`
        .font-body-cf, .font-body-cf h3 { font-family: 'Courier Prime', 'Courier New', ui-monospace, monospace; }
        .font-type-cf { font-family: 'Special Elite', 'Courier Prime', 'Courier New', monospace; }
        .font-label-cf { font-family: 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; font-weight: 500; }
        .cf-desk {
          background-color: #2F2A26;
          background-image: repeating-linear-gradient(92deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 7px);
        }
        .cf-paper {
          background-color: #FBF7EE;
          background-image: linear-gradient(rgba(120,100,60,0.035) 1px, transparent 1px);
          background-size: 100% 28px;
        }
        @media print {
          .cf-desk, .cf-folder { background: #fff !important; padding: 0 !important; box-shadow: none !important; }
          .cf-paper { background: #fff !important; box-shadow: none !important; }
          .cf-no-print { display: none !important; }
        }
      `}</style>
      <div
        className="cf-desk font-body-cf min-h-screen w-full overflow-x-hidden px-2 py-6 sm:px-6 md:py-14"
        style={{ color: INK }}
      >
        <div className="mx-auto max-w-[56rem]">
          <div className="cf-no-print flex">
            <p className="font-label-cf rounded-t-md bg-[#D9BF83] px-5 pt-2 pb-1.5 text-[11px] tracking-[0.2em] text-[#4A3D22] uppercase">
              File No. {fileNumber}
            </p>
          </div>
          <div className="cf-folder rounded-tr-md rounded-b-md bg-[#D9BF83] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)] sm:p-4 md:p-6">
            <article className="cf-paper relative px-5 pt-8 pb-10 shadow-[0_1px_3px_rgba(0,0,0,0.2)] sm:px-8 md:px-14 md:pt-12 md:pb-14">
              <p
                aria-hidden="true"
                className="font-type-cf cf-no-print pointer-events-none absolute top-5 right-4 rotate-[-9deg] rounded-sm border-[3px] border-[#B3261E]/80 px-3 py-0.5 text-lg tracking-[0.2em] text-[#B3261E]/80 uppercase mix-blend-multiply sm:top-8 sm:right-10 md:text-xl"
              >
                On File
              </p>

              <p className="font-label-cf text-[11px] tracking-[0.25em] text-[#6A6358] uppercase">
                Personnel Dossier
              </p>

              <div className="mt-5 flex flex-col gap-7 sm:flex-row-reverse sm:items-start sm:gap-10">
                <Photo name={full_name} avatarUrl={profile.avatar_url} />
                <div className="min-w-0 flex-1">
                  <h1 className="font-type-cf text-[clamp(2rem,6vw,3.25rem)] leading-[1.05] break-words">
                    {full_name}
                  </h1>
                  <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                    {headline && (
                      <div className="sm:col-span-2">
                        <Field label="Occupation">{headline}</Field>
                      </div>
                    )}
                    {contact.location && (
                      <Field label="Last known location">{contact.location}</Field>
                    )}
                    <Field label="Reference">@{profile.handle}</Field>
                  </dl>
                </div>
              </div>

              {links.length > 0 && (
                <ul
                  aria-label="Contact"
                  className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-y border-[#CFC5B1] py-3 text-[15px]"
                >
                  {links.map((link) => (
                    <li key={link.type} className="min-w-0 break-all sm:break-normal">
                      <span className="font-label-cf mr-2 text-[10.5px] tracking-[0.16em] text-[#6A6358] uppercase">
                        {link.type}
                      </span>
                      <a
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? "noopener noreferrer" : undefined}
                        className={LINK}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {summary && (
                <section aria-labelledby="summary-title" className="mt-10">
                  <h2
                    id="summary-title"
                    className="font-label-cf text-[11px] tracking-[0.25em] text-[#6A6358] uppercase"
                  >
                    Summary of findings
                  </h2>
                  <p className="mt-2 max-w-[68ch] text-[16px] leading-7 whitespace-pre-line md:text-[17px] md:leading-8">
                    {summary}
                  </p>
                </section>
              )}

              {exhibits.map((render, index) => render(String.fromCharCode(65 + index)))}

              <footer className="mt-16 flex flex-col gap-5 border-t-2 border-[#1F1D1A] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-type-cf text-sm tracking-[0.2em] uppercase">— End of file —</p>
                <div className="cf-no-print">
                  <ShareBar
                    handle={profile.handle}
                    title={`${full_name}'s Portfolio`}
                    name={full_name}
                    variant="case-file"
                  />
                </div>
              </footer>
            </article>
          </div>
        </div>
      </div>
    </>
  );
};
