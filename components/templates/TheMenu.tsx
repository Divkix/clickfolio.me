import { MaybeLink, LINK_REL } from "./shared/ExternalLink";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import type { ContactLinkDescriptor } from "@/lib/templates/contact-links";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A bistro prix-fixe card laid on a red gingham tablecloth. The card has a double-ruled frame,
// a heavy didone masthead, and one course per section in menu order: training is the first
// course, roles the main, projects the side, certifications dessert. Each entry is a dish whose
// name runs along a dotted leader to its years, where a menu prints the price. Skills are the
// pantry, printed on an inverted oxblood insert like a wine list.

type Content = TemplateProps["content"];

const INK = "#241A16";
const OXBLOOD = "#7A1E22";
const MUTED = "#5C4E45";

const LINK =
  "underline decoration-[#7A1E22]/40 underline-offset-[3px] hover:decoration-[#7A1E22] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A1E22]";

/** Years only, the length of a menu price: "since 2019", "2015 – 2019". */
function yearSpan(start?: string, end?: string | null): string | null {
  const from = start?.trim() ? formatYear(start) : "";
  const to = end?.trim() ? formatYear(end) : "";

  if (!from) return to || null;

  if (!to) return `since ${from}`;

  return from === to ? from : `${from} – ${to}`;
}

function ContactLink({ link }: { link: ContactLinkDescriptor }): React.ReactElement {
  if (link.type === "location") return <span>{link.label}</span>;

  return (
    <a
      href={link.href}
      target={link.isExternal ? "_blank" : undefined}
      rel={link.isExternal ? LINK_REL : undefined}
      className={LINK}
    >
      {link.label}
    </a>
  );
}

/** A menu line: the dish name runs along a dotted leader to its "price" on the right. */
function MenuLine({
  name,
  price,
  as: Heading = "h3",
}: {
  name: React.ReactNode;
  price: string | null;
  as?: "h3" | "p";
}) {
  return (
    <div className="flex items-end gap-2">
      <Heading className="tm-dish min-w-0 break-words text-[1.125rem] font-bold leading-snug sm:text-[1.1875rem]">
        {name}
      </Heading>
      {price && (
        <>
          <span
            aria-hidden="true"
            className="mb-[0.42em] h-0 min-w-6 flex-1 border-b-2 border-dotted border-[#A8968A]"
          />
          <span className="shrink-0 whitespace-nowrap text-[0.9375rem] tabular-nums text-[#4A3C34]">
            {price}
          </span>
        </>
      )}
    </div>
  );
}

function Course({
  course,
  dish,
  children,
}: {
  course: string;
  dish: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 sm:mt-14">
      <header className="text-center">
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="h-px flex-1 bg-[#7A1E22]/35" />
          <h2
            className="tm-display text-[1.75rem] leading-none sm:text-[2.125rem]"
            style={{ color: OXBLOOD }}
          >
            {course}
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-[#7A1E22]/35" />
        </div>
        <p className="mt-2 text-[0.9375rem] italic" style={{ color: MUTED }}>
          {dish}
        </p>
      </header>
      <div className="mt-7 space-y-8">{children}</div>
    </section>
  );
}

function ExperienceDishes({ experience }: { experience: NonNullable<Content["experience"]> }) {
  return experience.map((job) => (
    <article key={`${job.company}-${job.title}-${job.start_date}`}>
      <MenuLine name={job.title || job.company} price={yearSpan(job.start_date, job.end_date)} />
      {job.title && (job.company || job.location) && (
        <p className="mt-0.5 break-words text-[0.9375rem]" style={{ color: OXBLOOD }}>
          {job.company}
          {job.company && job.location ? ", " : ""}
          {job.location}
        </p>
      )}
      {job.description && (
        <p className="mt-2 break-words italic leading-relaxed" style={{ color: MUTED }}>
          {job.description}
        </p>
      )}
      {job.highlights && job.highlights.length > 0 && (
        <ul className="mt-2 space-y-1.5 leading-relaxed">
          {job.highlights.map((highlight) => (
            <li key={`${job.title}-${highlight}`} className="break-words pl-4 -indent-4">
              <span aria-hidden="true" style={{ color: OXBLOOD }}>
                ~{" "}
              </span>
              {highlight}
            </li>
          ))}
        </ul>
      )}
    </article>
  ));
}

function ProjectDishes({ projects }: { projects: NonNullable<Content["projects"]> }) {
  return projects.map((project) => (
    <article key={`${project.title}-${project.year ?? ""}`}>
      <MenuLine
        name={
          <MaybeLink href={project.url} className={LINK}>
            {project.title}
          </MaybeLink>
        }
        price={project.year?.trim() || null}
      />
      {project.description && (
        <p className="mt-1.5 break-words italic leading-relaxed" style={{ color: MUTED }}>
          {project.description}
        </p>
      )}
      {project.technologies && project.technologies.length > 0 && (
        <p className="mt-1.5 break-words text-[0.9375rem]" style={{ color: OXBLOOD }}>
          with {project.technologies.join(", ")}
        </p>
      )}
    </article>
  ));
}

function EducationDishes({ education }: { education: NonNullable<Content["education"]> }) {
  return education.map((edu) => (
    <article key={`${edu.institution}-${edu.degree}`}>
      <MenuLine
        name={edu.degree || edu.institution}
        price={yearSpan(undefined, edu.graduation_date)}
      />
      {edu.degree && edu.institution && (
        <p className="mt-0.5 break-words text-[0.9375rem]" style={{ color: OXBLOOD }}>
          {edu.institution}
          {edu.location ? `, ${edu.location}` : ""}
        </p>
      )}
      {edu.gpa && (
        <p className="mt-1 italic" style={{ color: MUTED }}>
          GPA {edu.gpa}
        </p>
      )}
    </article>
  ));
}

function CertificationDishes({
  certifications,
}: {
  certifications: NonNullable<Content["certifications"]>;
}) {
  return (
    <ul className="space-y-4">
      {certifications.map((cert) => (
        <li key={`${cert.name}-${cert.issuer ?? ""}`}>
          <MenuLine
            as="p"
            name={
              <MaybeLink href={cert.url} className={LINK}>
                {cert.name}
              </MaybeLink>
            }
            price={yearSpan(undefined, cert.date)}
          />
          {cert.issuer && (
            <p className="mt-0.5 break-words italic" style={{ color: MUTED }}>
              {cert.issuer}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export const TheMenu: React.FC<TemplateProps> = ({ content, profile, share }) => {
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

  const contactLinks = getContactLinks(contact);
  const location = contactLinks.find((link) => link.type === "location");
  const reachLinks = contactLinks.filter((link) => link.type !== "location");
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];

  const courses: Array<{ key: string; course: string; dish: string; body: React.ReactNode }> = [];

  if (education && education.length > 0) {
    courses.push({
      key: "education",
      course: "First course",
      dish: "Education",
      body: <EducationDishes education={education} />,
    });
  }

  if (experience && experience.length > 0) {
    courses.push({
      key: "experience",
      course: "Main course",
      dish: "Experience",
      body: <ExperienceDishes experience={experience} />,
    });
  }

  if (projects && projects.length > 0) {
    courses.push({
      key: "projects",
      course: "On the side",
      dish: "Projects",
      body: <ProjectDishes projects={projects} />,
    });
  }

  if (certifications && certifications.length > 0) {
    courses.push({
      key: "certifications",
      course: "Dessert",
      dish: "Certifications",
      body: <CertificationDishes certifications={certifications} />,
    });
  }

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&display=swap" />
      <style>{`
        .tm-root, .tm-root :is(p, li, a, span, button, h3) { font-family: 'Libre Caslon Text', Georgia, 'Times New Roman', serif; }
        .tm-root :is(h1, h2, .tm-display) { font-family: 'Abril Fatface', 'Bodoni 72', Didot, Georgia, serif; font-weight: 400; letter-spacing: 0.005em; }
        .tm-root .tm-dish { font-weight: 700; }
        .tm-cloth {
          background-color: #F1E7D8;
          background-image:
            linear-gradient(90deg, rgba(160, 32, 38, 0.5) 50%, transparent 50%),
            linear-gradient(rgba(160, 32, 38, 0.5) 50%, transparent 50%);
          background-size: 56px 56px;
        }
        .tm-card {
          background-color: #FCF8F0;
          box-shadow: 0 1px 0 rgba(36, 26, 22, 0.08), 0 28px 50px -18px rgba(70, 14, 18, 0.55);
        }
      `}</style>
      <div
        className="tm-root tm-cloth min-h-screen w-full overflow-x-hidden px-3 py-8 sm:px-6 sm:py-16"
        style={{ color: INK }}
      >
        <div className="tm-card mx-auto max-w-[44rem] p-2.5 sm:p-3.5">
          <div className="border-[3px] border-double border-[#7A1E22]/70 px-5 pb-8 pt-10 sm:px-12 sm:pb-12 sm:pt-14">
            <header className="text-center">
              <h1
                className="break-words text-[clamp(2.5rem,10vw,4.75rem)] leading-[0.95] [text-wrap:balance]"
                style={{ color: OXBLOOD }}
              >
                {full_name}
              </h1>
              {headline && (
                <div className="mt-5 flex items-center gap-3 sm:gap-4">
                  <span
                    aria-hidden="true"
                    className="h-[3px] flex-1 border-y border-[#7A1E22]/60"
                  />
                  <p className="min-w-0 max-w-[30rem] break-words text-[1.0625rem] italic leading-snug sm:text-[1.1875rem]">
                    {headline}
                  </p>
                  <span
                    aria-hidden="true"
                    className="h-[3px] flex-1 border-y border-[#7A1E22]/60"
                  />
                </div>
              )}
              {location && (
                <p className="mt-3 break-words text-[0.9375rem]" style={{ color: MUTED }}>
                  {location.label}
                </p>
              )}
            </header>

            {summary && (
              <p className="mx-auto mt-9 max-w-[34rem] break-words text-center text-[1.0625rem] italic leading-[1.75]">
                {summary}
              </p>
            )}

            {courses.map((course) => (
              <Course key={course.key} course={course.course} dish={course.dish}>
                {course.body}
              </Course>
            ))}

            {skillGroups.length > 0 && (
              <section className="mt-14 bg-[#7A1E22] px-5 py-7 text-[#FBF3E6] sm:px-9 sm:py-9">
                <h2 className="text-center text-[1.75rem] leading-none sm:text-[2.125rem]">
                  The pantry
                </h2>
                <p className="mt-2 text-center text-[0.9375rem] italic text-[#F1DCCB]">
                  Skills on hand
                </p>
                <div className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
                  {skillGroups.map((group) => (
                    <div key={group.category} className="min-w-0">
                      <h3 className="border-b border-[#FBF3E6]/35 pb-1.5 text-[1.0625rem] font-bold break-words">
                        {group.category}
                      </h3>
                      <ul className="mt-2.5 space-y-1 italic leading-relaxed text-[#F7E9DA]">
                        {group.items.map((item) => (
                          <li key={`${group.category}-${item}`} className="break-words">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <footer className="mt-14 text-center">
              {reachLinks.length > 0 && (
                <>
                  <p className="tm-display text-[1.375rem] leading-none" style={{ color: OXBLOOD }}>
                    Reservations
                  </p>
                  <ul className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[0.9375rem]">
                    {reachLinks.map((link) => (
                      <li key={link.type} className="min-w-0 break-all">
                        <ContactLink link={link} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-[#7A1E22]/25 pt-6 sm:justify-between">
                <p className="text-sm" style={{ color: MUTED }}>
                  @{profile.handle}
                </p>
                <ShareBar
                  handle={profile.handle}
                  title={`${full_name}'s Portfolio`}
                  name={full_name}
                  styles={share}
                />
              </div>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
};
