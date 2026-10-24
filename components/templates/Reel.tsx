import { ExternalLink, MaybeLink, LINK_REL } from "./shared/ExternalLink";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { type ContactLinkType, getContactLinks } from "@/lib/templates/contact-links";
import { isOngoing, parseYearMonth, type YearMonth } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// An editing suite (Premiere / Resolve): a program monitor with a broadcast lower third,
// a timeline panel where roles sit as clips on V tracks under a red playhead, timecode-styled
// dates (YYYY:MM:00:00), and an effects-library panel for skills. The horizontal timeline is a
// desktop overview; the clip list below carries every detail and is what mobile reads.

const RED = "#E5342B";
const RED_TEXT = "#FF6A5E";
const ROLE_CLIP = "#2F5D84";
const PROJECT_CLIP = "#6B4E9B";
const EDU_CLIP = "#3E7044";
const MUTED = "#A8A6A0";
const DIM = "#86847E";
const LINE = "#2F2F35";
const PANEL = "#1C1C20";
const MAX_ROLE_LANES = 3;
const MAX_PROJECT_LANES = 2;
const MARKER_WIDTH = 17;

interface TimelineClip {
  key: string;
  start: number;
  end: number;
  label: string;
  sublabel?: string;
  href: string;
}

interface TimelineMarker {
  key: string;
  at: number;
  label: string;
}

function startValue(date: YearMonth): number {
  return date.year + (date.month ? (date.month - 1) / 12 : 0);
}

function endValue(date: YearMonth): number {
  return date.year + (date.month ? date.month / 12 : 1);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function nowYearMonth(): YearMonth {
  const today = new Date();

  return { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 };
}

/** Timecode for a date: "2021:05" plus a dimmed ":00:00" frame field; unparseable text as written. */
function Timecode({ date, raw }: { date: YearMonth | null; raw?: string }) {
  if (!date) return <span className="rl-mono break-words">{raw}</span>;

  return (
    <span className="rl-mono whitespace-nowrap">
      {date.year}:{pad(date.month ?? 0)}
      <span className="rl-frames">:00:00</span>
    </span>
  );
}

function DateTimecode({ raw }: { raw?: string | null }) {
  if (!raw?.trim()) return null;

  return <Timecode date={parseYearMonth(raw)} raw={raw.trim()} />;
}

function SpanTimecode({ start, end }: { start?: string; end?: string | null }) {
  const hasStart = Boolean(start?.trim());

  if (!hasStart && !end?.trim()) return null;

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      {hasStart && <DateTimecode raw={start} />}
      {hasStart && <span aria-hidden="true">–</span>}
      {isOngoing(end) ? <span className="rl-mono">Present</span> : <DateTimecode raw={end} />}
    </span>
  );
}

/** Greedy lane packing, earliest first; clips that need more than `maxLanes` lanes are left off. */
function packLanes(clips: TimelineClip[], maxLanes: number): TimelineClip[][] {
  const lanes: TimelineClip[][] = [];

  for (const clip of [...clips].sort((a, b) => a.start - b.start)) {
    const lane = lanes.find((existing) => (existing.at(-1)?.end ?? 0) <= clip.start + 0.001);

    if (lane) lane.push(clip);
    else if (lanes.length < maxLanes) lanes.push([clip]);
  }

  return lanes;
}

function Panel({
  title,
  aside,
  className = "",
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-md border overflow-hidden ${className}`}
      style={{ borderColor: LINE, backgroundColor: PANEL }}
    >
      <header
        className="flex flex-wrap items-end justify-between gap-x-3 border-b px-2 pt-1.5"
        style={{ borderColor: LINE, backgroundColor: "#141417" }}
      >
        <h2
          className="-mb-px rounded-t border border-b-0 px-3 py-1.5 text-[0.8125rem] font-semibold text-[#E7E6E2]"
          style={{ borderColor: LINE, backgroundColor: PANEL }}
        >
          {title}
        </h2>
        {aside && <div className="pb-1.5 pr-1">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

function TrackHeader({ code, name, tall }: { code: string; name: string; tall?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 border-b px-2.5 ${tall ? "h-14" : "h-10"}`}
      style={{ borderColor: LINE }}
    >
      <span
        className="rl-mono rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium text-[#E7E6E2]"
        style={{ backgroundColor: "#2E2E35" }}
      >
        {code}
      </span>
      <span className="truncate text-[0.8125rem]" style={{ color: MUTED }}>
        {name}
      </span>
    </div>
  );
}

function ClipTrack({
  clips,
  color,
  range,
}: {
  clips: TimelineClip[];
  color: string;
  range: { min: number; span: number };
}) {
  return (
    <div className="relative h-14 border-b" style={{ borderColor: LINE }}>
      {clips.map((clip) => {
        const left = ((clip.start - range.min) / range.span) * 100;
        const width = ((clip.end - clip.start) / range.span) * 100;

        return (
          <a
            key={clip.key}
            href={clip.href}
            title={clip.sublabel ? `${clip.label}, ${clip.sublabel}` : clip.label}
            className="rl-clip absolute top-1.5 bottom-1.5 min-w-[6px] overflow-hidden rounded-[3px] px-2 py-1 text-white"
            style={{
              left: `${left}%`,
              width: `calc(${width}% - 2px)`,
              backgroundColor: color,
            }}
          >
            <span className="block truncate text-[0.8125rem] font-semibold leading-tight">
              {clip.label}
            </span>
            {clip.sublabel && (
              <span className="block truncate text-[0.75rem] leading-tight text-white/85">
                {clip.sublabel}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}

function Timeline({
  roleLanes,
  projectLanes,
  markers,
  playhead,
  playheadDate,
}: {
  roleLanes: TimelineClip[][];
  projectLanes: TimelineClip[][];
  markers: TimelineMarker[];
  playhead: number;
  playheadDate: YearMonth;
}) {
  const points = [
    ...roleLanes.flat().flatMap((clip) => [clip.start, clip.end]),
    ...projectLanes.flat().flatMap((clip) => [clip.start, clip.end]),
    ...markers.map((marker) => marker.at),
    playhead,
  ];

  const max = Math.floor(Math.max(...points)) + 1;
  const min = Math.min(Math.floor(Math.min(...points)), max - 4);
  const span = max - min;
  const range = { min, span };
  const labelStep = Math.max(1, Math.ceil(span / 8));
  const years = Array.from({ length: span }, (_, index) => min + index);
  const playheadLeft = ((playhead - min) / span) * 100;
  // Each education label takes up to MARKER_WIDTH% of the track, to the right of its date (left of
  // it near the end); labels that would collide stay in the Education list only.
  const visibleMarkers: Array<TimelineMarker & { left: number; flipped: boolean }> = [];
  let occupiedUntil = -Infinity;

  for (const marker of [...markers].sort((a, b) => a.at - b.at)) {
    const left = ((marker.at - min) / span) * 100;
    const flipped = left > 100 - MARKER_WIDTH;
    const from = flipped ? left - MARKER_WIDTH : left;

    if (from >= occupiedUntil) {
      visibleMarkers.push({ ...marker, left, flipped });
      occupiedUntil = from + MARKER_WIDTH + 1;
    }
  }

  const roleCodes = roleLanes.map((_, index) => `V${index + 1}`);
  const projectCodes = projectLanes.map((_, index) => `V${roleLanes.length + index + 1}`);

  return (
    <Panel
      title="Timeline"
      className="hidden md:flex"
      aside={
        <span className="text-[1.125rem] font-medium" style={{ color: RED_TEXT }}>
          <Timecode date={playheadDate} />
        </span>
      }
    >
      <div className="flex">
        <div className="w-36 shrink-0 border-r" style={{ borderColor: LINE }}>
          <div className="h-8 border-b" style={{ borderColor: LINE }} />
          {[...projectLanes.keys()].reverse().map((index) => (
            <TrackHeader key={`p${index}`} code={projectCodes[index]} name="Projects" tall />
          ))}
          {[...roleLanes.keys()].reverse().map((index) => (
            <TrackHeader key={`r${index}`} code={roleCodes[index]} name="Roles" tall />
          ))}
          {markers.length > 0 && <TrackHeader code="A1" name="Education" />}
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div
            aria-hidden="true"
            className="relative h-8 border-b"
            style={{
              borderColor: LINE,
              backgroundImage: "linear-gradient(to right, #4A4A52 1px, transparent 1px)",
              backgroundSize: `${100 / (span * 4)}% 5px`,
              backgroundRepeat: "repeat-x",
              backgroundPosition: "left bottom",
            }}
          >
            {years.map((year) => {
              const left = ((year - min) / span) * 100;
              const labelled = (year - min) % labelStep === 0 && left < 88;

              return (
                <div
                  key={year}
                  className="absolute top-0 bottom-0 border-l"
                  style={{ left: `${left}%`, borderColor: "#5A5A63" }}
                >
                  {labelled && (
                    <span
                      className="rl-mono absolute top-1 left-0 z-10 whitespace-nowrap pl-1.5 pr-1 text-[0.6875rem]"
                      style={{ color: MUTED, backgroundColor: PANEL }}
                    >
                      {year}:01:00:00
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {[...projectLanes].reverse().map((lane, index) => (
            <ClipTrack key={`p${index}`} clips={lane} color={PROJECT_CLIP} range={range} />
          ))}
          {[...roleLanes].reverse().map((lane, index) => (
            <ClipTrack key={`r${index}`} clips={lane} color={ROLE_CLIP} range={range} />
          ))}

          {markers.length > 0 && (
            <div className="relative h-10 border-b" style={{ borderColor: LINE }}>
              {visibleMarkers.map((marker) => (
                <span
                  key={marker.key}
                  title={marker.label}
                  className="absolute top-2 bottom-2 flex items-center overflow-hidden rounded-[2px] border-white px-2 text-[0.75rem] font-medium text-white"
                  style={{
                    backgroundColor: EDU_CLIP,
                    maxWidth: `${MARKER_WIDTH}%`,
                    ...(marker.flipped
                      ? { right: `${100 - marker.left}%`, borderRightWidth: 2 }
                      : { left: `${marker.left}%`, borderLeftWidth: 2 }),
                  }}
                >
                  <span className="truncate">{marker.label}</span>
                </span>
              ))}
            </div>
          )}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-1/2"
            style={{ left: `${playheadLeft}%`, backgroundColor: RED }}
          >
            <span
              className="absolute top-0 left-1/2 h-3.5 w-3 -translate-x-1/2"
              style={{
                backgroundColor: RED,
                clipPath: "polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)",
              }}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function displayLink(href: string, isExternal: boolean, label: string): string {
  if (!isExternal) return label;

  return href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

const CONTACT_NAMES: Record<ContactLinkType, string> = {
  email: "Email",
  phone: "Phone",
  location: "Location",
  linkedin: "LinkedIn",
  github: "GitHub",
  website: "Website",
  behance: "Behance",
  dribbble: "Dribbble",
};

export const Reel: React.FC<TemplateProps> = ({ content, profile }) => {
  const {
    full_name,
    summary,
    headline,
    contact,
    experience,
    education,
    skills,
    projects,
    certifications,
  } = content;

  const contactLinks = getContactLinks(contact);
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];
  const roles = experience ?? [];
  const today = nowYearMonth();
  const nowValue = startValue(today) + 0.5 / 12;

  const roleClips: TimelineClip[] = roles.flatMap((job, index) => {
    const start = parseYearMonth(job.start_date);
    const ongoing = isOngoing(job.end_date);
    const end = ongoing ? null : parseYearMonth(job.end_date);

    if (!start || (!ongoing && !end)) return [];

    const from = startValue(start);
    const to = end ? endValue(end) : nowValue;

    if (to <= from) return [];

    return [
      {
        key: `role-${index}`,
        start: from,
        end: to,
        label: job.title,
        sublabel: job.company,
        href: `#rl-role-${index}`,
      },
    ];
  });

  const projectClips: TimelineClip[] = (projects ?? []).flatMap((project, index) => {
    const year = parseYearMonth(project.year);

    if (!year) return [];

    return [
      {
        key: `project-${index}`,
        start: year.year,
        end: year.year + 1,
        label: project.title,
        href: `#rl-project-${index}`,
      },
    ];
  });

  const markers: TimelineMarker[] = (education ?? []).flatMap((edu, index) => {
    const date = parseYearMonth(edu.graduation_date);

    if (!date) return [];

    return [{ key: `edu-${index}`, at: startValue(date), label: edu.degree || edu.institution }];
  });

  const roleLanes = packLanes(roleClips, MAX_ROLE_LANES);
  const projectLanes = packLanes(projectClips, MAX_PROJECT_LANES);
  const hasOngoing = roleClips.some((clip) => clip.end === nowValue);
  const lastEnd = Math.max(...roleClips.map((clip) => clip.end), 0);
  const playhead = hasOngoing || lastEnd === 0 ? nowValue : lastEnd;

  const playheadDate: YearMonth =
    playhead === nowValue
      ? today
      : { year: Math.floor(playhead - 0.001), month: Math.round((playhead % 1) * 12) || 12 };

  const showTimeline = roleClips.length > 0;

  const hasSide =
    skillGroups.length > 0 || (education?.length ?? 0) > 0 || (certifications?.length ?? 0) > 0;

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Sofia+Sans:wght@400;500;600;700&family=Sofia+Sans+Condensed:wght@700;800&family=Red+Hat+Mono:wght@400;500&display=swap" />
      <style>{`
        .rl-root, .rl-root :is(h1, h2, h3, h4) { font-family: 'Sofia Sans', ui-sans-serif, system-ui, sans-serif; }
        .rl-root .rl-cond { font-family: 'Sofia Sans Condensed', 'Sofia Sans', ui-sans-serif, sans-serif; }
        .rl-root { --rl-dim: ${DIM}; }
        .rl-root .rl-frames { color: var(--rl-dim); }
        .rl-root .rl-mono { font-family: 'Red Hat Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        .rl-root .rl-clip { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16), inset 3px 0 0 rgba(255,255,255,0.28); }
        .rl-root .rl-clip:hover { filter: brightness(1.15); }
        .rl-root a:focus-visible { outline: 2px solid ${RED_TEXT}; outline-offset: 2px; }
        .rl-root .rl-safe { position: absolute; inset: 6% 5%; border: 1px dashed rgba(255,255,255,0.14); pointer-events: none; }
        .rl-root .rl-safe-inner { position: absolute; inset: 10% 10%; border: 1px dashed rgba(255,255,255,0.08); pointer-events: none; }
      `}</style>
      <div className="rl-root min-h-screen overflow-x-hidden bg-[#0C0C0E] text-[#E7E6E2]">
        <div className="mx-auto max-w-[76rem] px-4 pt-6 pb-20 sm:px-6 sm:pt-10 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel
              title={`@${profile.handle}`}
              aside={
                <span className="text-[0.875rem]" style={{ color: MUTED }}>
                  <Timecode date={today} />
                </span>
              }
            >
              <div className="flex flex-1 flex-col p-2 sm:p-3">
                <div className="relative flex min-h-[17rem] flex-1 flex-col justify-end overflow-hidden bg-black sm:min-h-[22rem] lg:min-h-[24rem]">
                  {profile.avatar_url && (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-80"
                    />
                  )}
                  <div aria-hidden="true" className="rl-safe" />
                  <div aria-hidden="true" className="rl-safe-inner" />
                  <div className="relative mx-[10%] mb-[10%] mt-16 max-w-[36rem] min-w-0">
                    <h1 className="rl-cond inline bg-[#F2F1ED] px-3 py-1 text-[clamp(2rem,5.2vw,3.5rem)] font-extrabold leading-[1.15] tracking-[-0.01em] text-[#0C0C0E] break-words [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
                      {full_name}
                    </h1>
                    {headline && (
                      <p className="mt-1.5">
                        <span className="inline bg-[#C62A22] px-3 py-1 text-[0.9375rem] font-semibold leading-[1.9] text-white break-words [box-decoration-break:clone] [-webkit-box-decoration-break:clone] sm:text-[1.0625rem]">
                          {headline}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            {(summary || contactLinks.length > 0) && (
              <Panel title="About">
                <div className="p-4 sm:p-5">
                  {summary && (
                    <p className="max-w-[62ch] text-[1rem] leading-[1.65] text-[#D9D8D3] break-words">
                      {summary}
                    </p>
                  )}
                  {contactLinks.length > 0 && (
                    <dl
                      className={`grid grid-cols-[5.5rem_minmax(0,1fr)] gap-y-2 text-[0.875rem] ${summary ? "mt-5 border-t pt-4" : ""}`}
                      style={{ borderColor: LINE }}
                    >
                      {contactLinks.map((link) => (
                        <div key={link.type} className="contents">
                          <dt style={{ color: MUTED }}>{CONTACT_NAMES[link.type]}</dt>
                          <dd className="min-w-0 break-all">
                            {link.href ? (
                              <a
                                href={link.href}
                                target={link.isExternal ? "_blank" : undefined}
                                rel={link.isExternal ? LINK_REL : undefined}
                                className="underline decoration-[#5A5A63] underline-offset-[3px] hover:decoration-current"
                                style={{ color: RED_TEXT }}
                              >
                                {displayLink(link.href, link.isExternal, link.label)}
                              </a>
                            ) : (
                              <span>{link.label}</span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </Panel>
            )}
          </div>

          {showTimeline && (
            <Timeline
              roleLanes={roleLanes}
              projectLanes={projectLanes}
              markers={markers}
              playhead={playhead}
              playheadDate={playheadDate}
            />
          )}

          <div
            className={`grid gap-4 ${hasSide ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : ""} lg:items-start`}
          >
            <div className="min-w-0 space-y-4">
              {roles.length > 0 && (
                <Panel title="Experience">
                  <ol className="divide-y" style={{ borderColor: LINE }}>
                    {roles.map((job, index) => (
                      <li
                        key={`${job.company}-${job.title}-${job.start_date}`}
                        id={`rl-role-${index}`}
                        className="scroll-mt-6 p-3 sm:p-4"
                        style={{ borderColor: LINE }}
                      >
                        <div
                          className="rl-clip flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-[3px] px-3 py-2 text-white"
                          style={{ backgroundColor: ROLE_CLIP }}
                        >
                          <h3 className="min-w-0 text-[1.0625rem] font-bold leading-snug break-words">
                            {job.title}
                          </h3>
                          <span className="text-[0.8125rem] text-white [--rl-dim:rgba(255,255,255,0.72)]">
                            <SpanTimecode start={job.start_date} end={job.end_date} />
                          </span>
                        </div>
                        <div className="px-1 pt-3 sm:px-2">
                          <p className="text-[0.9375rem] font-semibold break-words">
                            {job.company}
                            {job.location && (
                              <span className="font-normal" style={{ color: MUTED }}>
                                , {job.location}
                              </span>
                            )}
                          </p>
                          {job.description && (
                            <p className="mt-1.5 max-w-[68ch] text-[0.9375rem] leading-[1.6] text-[#D9D8D3] break-words">
                              {job.description}
                            </p>
                          )}
                          {job.highlights && job.highlights.length > 0 && (
                            <ul className="mt-2.5 max-w-[68ch] space-y-1.5">
                              {job.highlights.map((highlight) => (
                                <li
                                  key={`${job.title}-${highlight}`}
                                  className="relative pl-4 text-[0.9375rem] leading-[1.55] text-[#D9D8D3] break-words"
                                >
                                  <span
                                    aria-hidden="true"
                                    className="absolute left-0 top-[0.55em] h-2 w-1 rounded-[1px]"
                                    style={{ backgroundColor: RED }}
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
                </Panel>
              )}

              {projects && projects.length > 0 && (
                <Panel title="Projects">
                  <ul>
                    {projects.map((project, index) => (
                      <li
                        key={`${project.title}-${project.year ?? ""}`}
                        id={`rl-project-${index}`}
                        className="scroll-mt-6 grid gap-x-4 gap-y-1 border-b px-4 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5"
                        style={{ borderColor: LINE }}
                      >
                        <div className="min-w-0">
                          <h3 className="flex items-start gap-2 text-[1rem] font-bold break-words">
                            <span
                              aria-hidden="true"
                              className="mt-[0.3em] h-3 w-3 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: PROJECT_CLIP }}
                            />
                            {project.url ? (
                              <ExternalLink
                                href={project.url}
                                className="min-w-0 underline decoration-[#5A5A63] underline-offset-[3px] hover:decoration-current"
                              >
                                {project.title}
                              </ExternalLink>
                            ) : (
                              <span className="min-w-0">{project.title}</span>
                            )}
                          </h3>
                          {project.description && (
                            <p className="mt-1 pl-5 max-w-[66ch] text-[0.9375rem] leading-[1.55] text-[#D9D8D3] break-words">
                              {project.description}
                            </p>
                          )}
                          {project.technologies && project.technologies.length > 0 && (
                            <p
                              className="mt-1 pl-5 text-[0.8125rem] break-words"
                              style={{ color: MUTED }}
                            >
                              {project.technologies.join(", ")}
                            </p>
                          )}
                        </div>
                        {project.year?.trim() && (
                          <p
                            className="pl-5 text-[0.8125rem] sm:pl-0 sm:pt-0.5"
                            style={{ color: MUTED }}
                          >
                            <DateTimecode raw={project.year} />
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>

            {hasSide && (
              <div className="min-w-0 space-y-4">
                {skillGroups.length > 0 && (
                  <Panel title="Effects">
                    <div className="py-2">
                      {skillGroups.map((group) => (
                        <details key={group.category} open className="group px-2">
                          <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-2 py-1.5 text-[0.875rem] font-semibold hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                            <span
                              aria-hidden="true"
                              className="inline-block w-2 text-[0.625rem] transition-transform group-open:rotate-90"
                              style={{ color: MUTED }}
                            >
                              ▶
                            </span>
                            <span className="min-w-0 break-words">{group.category}</span>
                          </summary>
                          <ul
                            className={`mb-1 ml-6 gap-x-5 border-l pl-3 ${group.items.length > 6 ? "columns-2" : ""}`}
                            style={{ borderColor: LINE }}
                          >
                            {group.items.map((item) => (
                              <li
                                key={`${group.category}-${item}`}
                                className="flex break-inside-avoid items-baseline gap-2 py-[3px] text-[0.875rem] text-[#D9D8D3]"
                              >
                                <span
                                  aria-hidden="true"
                                  className="rl-mono shrink-0 text-[0.6875rem] italic"
                                  style={{ color: DIM }}
                                >
                                  fx
                                </span>
                                <span className="min-w-0 break-words">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ))}
                    </div>
                  </Panel>
                )}

                {education && education.length > 0 && (
                  <Panel title="Education">
                    <ul>
                      {education.map((edu) => (
                        <li
                          key={`${edu.institution}-${edu.degree}`}
                          className="border-b px-4 py-3 last:border-b-0 sm:px-5"
                          style={{ borderColor: LINE }}
                        >
                          <h3 className="flex items-start gap-2 text-[0.9375rem] font-bold break-words">
                            <span
                              aria-hidden="true"
                              className="mt-[0.3em] h-3 w-3 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: EDU_CLIP }}
                            />
                            <span className="min-w-0">{edu.degree}</span>
                          </h3>
                          <p className="pl-5 text-[0.875rem] break-words" style={{ color: MUTED }}>
                            {edu.institution}
                            {edu.location && `, ${edu.location}`}
                          </p>
                          {edu.graduation_date?.trim() && (
                            <p className="mt-0.5 pl-5 text-[0.8125rem]" style={{ color: MUTED }}>
                              <DateTimecode raw={edu.graduation_date} />
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}

                {certifications && certifications.length > 0 && (
                  <Panel title="Certifications">
                    <ul>
                      {certifications.map((cert) => (
                        <li
                          key={`${cert.name}-${cert.issuer ?? ""}`}
                          className="border-b px-4 py-3 last:border-b-0 sm:px-5"
                          style={{ borderColor: LINE }}
                        >
                          <p className="text-[0.9375rem] font-semibold break-words">
                            <MaybeLink
                              href={cert.url}
                              className="underline decoration-[#5A5A63] underline-offset-[3px] hover:decoration-current"
                            >
                              {cert.name}
                            </MaybeLink>
                          </p>
                          {(cert.issuer || cert.date?.trim()) && (
                            <p
                              className="flex flex-wrap gap-x-3 text-[0.8125rem] break-words"
                              style={{ color: MUTED }}
                            >
                              {cert.issuer && <span>{cert.issuer}</span>}
                              <DateTimecode raw={cert.date} />
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}
              </div>
            )}
          </div>

          <footer
            className="flex flex-wrap items-center justify-between gap-4 border-t pt-6 !mt-12"
            style={{ borderColor: LINE }}
          >
            <p className="rl-mono text-sm" style={{ color: MUTED }}>
              @{profile.handle}
            </p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="reel"
            />
          </footer>
        </div>
      </div>
    </>
  );
};
