"use client";

import {
  ArrowUpRight,
  Briefcase,
  Github,
  Globe,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { ShareBar } from "@/components/ShareBar";
import { type ContactLinkType, getContactLinks } from "@/lib/templates/contact-links";
import { flattenSkills, formatDateRange, formatYear, getInitials } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";

/* ─── Icon map ─── */
const spotlightIconMap: Partial<Record<ContactLinkType, React.ReactNode>> = {
  github: <Github className="w-5 h-5" aria-hidden="true" />,
  linkedin: <Linkedin className="w-5 h-5" aria-hidden="true" />,
  email: <Mail className="w-5 h-5" aria-hidden="true" />,
  website: <Globe className="w-5 h-5" aria-hidden="true" />,
  phone: <Phone className="w-5 h-5" aria-hidden="true" />,
  location: <MapPin className="w-5 h-5" aria-hidden="true" />,
};

/* ─── Spotlight card with cursor-tracking radial gradient ─── */
function SpotlightCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--spot-x", `${x}px`);
    card.style.setProperty("--spot-y", `${y}px`);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`relative bg-stone-50/80 border border-stone-200/50 rounded-2xl p-6 md:p-8 transition-shadow duration-300 hover:shadow-lg hover:shadow-orange-500/5 overflow-hidden ${className}`}
      style={
        {
          "--spot-x": "-999px",
          "--spot-y": "-999px",
        } as React.CSSProperties
      }
    >
      {/* Cursor spotlight overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 hover-parent:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "radial-gradient(circle 300px at var(--spot-x) var(--spot-y), rgba(232,77,14,0.06), transparent 60%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ─── Award icon (inline SVG) ─── */
const AwardIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);

/* ─── Opacity class for marquee sweep ─── */
function getMarqueeOpacity(index: number): string {
  if (index % 5 === 0) return "opacity-25";
  if (index % 2 === 0) return "opacity-[0.12]";
  return "opacity-[0.08]";
}

/* ─── Main component ─── */
const Spotlight: React.FC<TemplateProps> = ({ content, profile }) => {
  const firstName = content.full_name.split(" ")[0] || content.full_name;
  const allSkills = flattenSkills(content.skills);
  const contactLinks = getContactLinks(content.contact);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState({ x: -9999, y: -9999 });

  const handlePageMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
  }, []);

  const navLinks = [
    { label: "About", href: "#about" },
    ...(content.experience?.length > 0 ? [{ label: "Work", href: "#work" }] : []),
    ...(content.projects && content.projects.length > 0
      ? [{ label: "Projects", href: "#projects" }]
      : []),
    { label: "Contact", href: "#contact" },
  ];

  return (
    <>
      {/* Font preloading */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800&family=Instrument+Sans:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <div
        ref={containerRef}
        onMouseMove={handlePageMouseMove}
        className="min-h-screen bg-[#FFFCF9] text-[#1C1917] font-body-sl selection:bg-[#E84D0E] selection:text-white relative overflow-x-hidden"
      >
        {/* Custom CSS */}
        <style>{`
          .font-display-sl { font-family: 'Bricolage Grotesque', sans-serif; }
          .font-body-sl { font-family: 'Instrument Sans', sans-serif; }
          @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          .mask-linear-fade { mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }
        `}</style>

        {/* Stage beam backgrounds — tall conic triangles from top */}
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute top-0 left-[15%] w-[400px] h-[600px]"
            style={{
              background:
                "conic-gradient(from 180deg at 50% 0%, transparent 40%, rgba(232,77,14,0.03) 50%, transparent 60%)",
            }}
          />
          <div
            className="absolute top-0 left-[55%] w-[500px] h-[700px]"
            style={{
              background:
                "conic-gradient(from 180deg at 50% 0%, transparent 38%, rgba(232,77,14,0.025) 50%, transparent 62%)",
            }}
          />
          <div
            className="absolute top-0 right-[10%] w-[350px] h-[500px]"
            style={{
              background:
                "conic-gradient(from 180deg at 50% 0%, transparent 42%, rgba(232,77,14,0.02) 50%, transparent 58%)",
            }}
          />
        </div>

        {/* Cursor-following spotlight overlay */}
        <div
          className="fixed inset-0 z-1 pointer-events-none motion-safe:transition-[background] motion-safe:duration-100"
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle 250px at ${cursorPos.x}px ${cursorPos.y}px, rgba(232,77,14,0.04), transparent)`,
          }}
        />

        {/* Navigation — minimal text links top-left */}
        <nav
          className="fixed top-8 left-8 z-50 hidden md:flex flex-col gap-1.5"
          aria-label="Main navigation"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-body-sl text-stone-400 hover:text-[#E84D0E] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Mobile nav — horizontal at top */}
        <nav
          className="fixed top-6 left-0 right-0 z-50 flex md:hidden justify-center gap-4 px-4 pt-[env(safe-area-inset-top)]"
          aria-label="Main navigation"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-body-sl text-stone-400 hover:text-[#E84D0E] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* "Hire Me" pill — fixed top-right */}
        {content.contact.email && (
          <a
            href="#contact"
            className="fixed top-8 right-8 z-50 px-5 py-2 text-sm font-display-sl font-semibold bg-[#E84D0E] text-white rounded-full hover:bg-[#d4430c] transition-colors shadow-lg shadow-orange-500/20"
          >
            Hire Me
          </a>
        )}

        <main className="relative z-10 max-w-4xl mx-auto px-6 pt-28 md:pt-40 pb-20">
          {/* ─── Hero Section ─── */}
          <section id="about" className="mb-24 md:mb-32">
            <div className="flex flex-col-reverse md:flex-row gap-8 items-start md:items-center justify-between">
              <div className="flex-1 space-y-6">
                <div className="space-y-3">
                  <span className="inline-block px-3 py-1 rounded-full bg-orange-50 border border-orange-200/60 text-xs font-display-sl font-semibold text-[#E84D0E] tracking-wide">
                    Available for work
                  </span>
                  <h1 className="text-5xl md:text-7xl font-display-sl font-extrabold tracking-tight text-[#1C1917]">
                    I&apos;m {firstName}.
                  </h1>
                  <h2 className="text-2xl md:text-3xl text-[#78716C] font-display-sl font-semibold tracking-tight">
                    {content.headline}
                  </h2>
                </div>

                <p className="text-lg text-stone-600 leading-relaxed max-w-xl font-body-sl">
                  {content.summary}
                </p>

                {/* Contact icons */}
                <div className="flex gap-3 pt-4">
                  {contactLinks.map((link) => {
                    const icon = spotlightIconMap[link.type];
                    const isBranded = link.type === "behance" || link.type === "dribbble";
                    const brandColor =
                      link.type === "behance"
                        ? "#1769FF"
                        : link.type === "dribbble"
                          ? "#EA4C89"
                          : undefined;
                    const brandText =
                      link.type === "behance" ? "Bē" : link.type === "dribbble" ? "Dr" : null;

                    if (link.type === "location") {
                      return (
                        <div
                          key={link.type}
                          className="p-2 text-[#78716C] rounded-full flex items-center justify-center"
                        >
                          {icon}
                        </div>
                      );
                    }

                    return (
                      <a
                        key={link.type}
                        href={link.href}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? "noreferrer" : undefined}
                        aria-label={link.label}
                        className="p-2 text-[#78716C] hover:text-[#E84D0E] hover:bg-orange-50 rounded-full transition-colors flex items-center justify-center"
                        style={isBranded ? { color: brandColor } : undefined}
                      >
                        {isBranded ? <span className="font-bold text-sm">{brandText}</span> : icon}
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Avatar with spotlight cone */}
              <div className="relative shrink-0">
                {/* Conic spotlight cone behind avatar */}
                <div
                  className="absolute pointer-events-none"
                  aria-hidden="true"
                  style={{
                    background:
                      "conic-gradient(from 180deg at 50% 0%, transparent 30%, rgba(232,77,14,0.06) 50%, transparent 70%)",
                    top: "-200px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "600px",
                    height: "500px",
                  }}
                />
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={content.full_name}
                    width={192}
                    height={192}
                    className="relative w-32 h-32 md:w-48 md:h-48 rounded-full object-cover border-4 border-[#FFFCF9] shadow-xl shadow-orange-500/10"
                  />
                ) : (
                  <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full bg-stone-100 flex items-center justify-center text-3xl font-display-sl font-bold text-stone-300 border-4 border-[#FFFCF9] shadow-xl shadow-orange-500/10">
                    {getInitials(content.full_name)}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ─── Skills Marquee with opacity sweep ─── */}
          {allSkills.length > 0 && (
            <section className="mb-24 py-10 border-y border-stone-200/60 relative overflow-hidden mask-linear-fade">
              <div className="flex whitespace-nowrap motion-safe:animate-[marquee_40s_linear_infinite]">
                {[...allSkills, ...allSkills, ...allSkills].map((skill, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center text-4xl md:text-6xl font-display-sl font-bold text-[#1C1917] mx-8 uppercase tracking-tighter ${getMarqueeOpacity(i)}`}
                  >
                    {skill}
                    <span className="text-stone-300 ml-8 text-2xl">•</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* ─── Experience — spotlight cards ─── */}
          {content.experience?.length > 0 && (
            <section id="work" className="mb-24" aria-label="Work history">
              <h3 className="text-sm font-display-sl font-bold uppercase tracking-widest text-[#78716C] mb-10 flex items-center gap-2">
                <Briefcase className="w-4 h-4" aria-hidden="true" /> Work History
              </h3>

              <div className="space-y-4">
                {content.experience.map((job, index) => (
                  <SpotlightCard key={index}>
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
                      <h4 className="text-xl font-display-sl font-bold text-[#1C1917]">
                        {job.company}
                      </h4>
                      <span className="text-sm font-body-sl text-[#78716C] bg-stone-100 px-2 py-0.5 rounded">
                        {formatDateRange(job.start_date, job.end_date)}
                      </span>
                    </div>

                    <div className="text-[#1C1917] font-body-sl font-medium mb-2">{job.title}</div>

                    {job.description && (
                      <p className="text-stone-600 leading-relaxed mb-4 text-sm max-w-2xl font-body-sl">
                        {job.description}
                      </p>
                    )}

                    {job.highlights && job.highlights.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {job.highlights.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 text-xs text-stone-600 bg-stone-100 rounded border border-stone-200/60 font-body-sl"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </SpotlightCard>
                ))}
              </div>
            </section>
          )}

          {/* ─── Projects Grid ─── */}
          {content.projects && content.projects.length > 0 && (
            <section id="projects" className="mb-24" aria-label="Selected projects">
              <h3 className="text-sm font-display-sl font-bold uppercase tracking-widest text-[#78716C] mb-10 flex items-center gap-2">
                <Globe className="w-4 h-4" aria-hidden="true" /> Selected Projects
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {content.projects.map((project, index) => (
                  <SpotlightCard key={index} className="flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-full bg-[#FFFCF9] border border-stone-200 flex items-center justify-center text-[#1C1917] shadow-sm font-display-sl font-bold text-sm">
                        {getInitials(project.title)}
                      </div>
                      {project.url && (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="View project"
                          className="text-stone-400 hover:text-[#E84D0E] transition-colors"
                        >
                          <ArrowUpRight className="w-5 h-5" aria-hidden="true" />
                        </a>
                      )}
                    </div>

                    <h4 className="text-lg font-display-sl font-bold text-[#1C1917] mb-2 hover:text-[#E84D0E] transition-colors">
                      {project.title}
                    </h4>

                    <p className="text-sm text-stone-600 leading-relaxed mb-6 grow font-body-sl">
                      {project.description}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-auto">
                      {project.technologies?.slice(0, 4).map((tech, i) => (
                        <span
                          key={i}
                          className="text-xs font-body-sl font-medium text-[#78716C] px-2 py-1 bg-[#FFFCF9] rounded-md border border-stone-200 shadow-sm"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </SpotlightCard>
                ))}
              </div>
            </section>
          )}

          {/* ─── Education & Certifications ─── */}
          {((content.education && content.education.length > 0) ||
            (content.certifications && content.certifications.length > 0)) && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
              {content.education && content.education.length > 0 && (
                <div>
                  <h3 className="text-sm font-display-sl font-bold uppercase tracking-widest text-[#78716C] mb-8 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" aria-hidden="true" /> Education
                  </h3>
                  <div className="space-y-6">
                    {content.education.map((edu, index) => (
                      <div key={index} className="pb-2">
                        <h4 className="font-display-sl font-semibold text-[#1C1917]">
                          {edu.institution}
                        </h4>
                        <p className="text-sm text-stone-600 font-body-sl">{edu.degree}</p>
                        <p className="text-xs text-[#78716C] mt-1 font-body-sl">
                          {edu.graduation_date ? formatYear(edu.graduation_date) : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {content.certifications && content.certifications.length > 0 && (
                <div>
                  <h3 className="text-sm font-display-sl font-bold uppercase tracking-widest text-[#78716C] mb-8 flex items-center gap-2">
                    <AwardIcon className="w-4 h-4" aria-hidden="true" /> Certifications
                  </h3>
                  <div className="space-y-4">
                    {content.certifications.map((cert, index) => (
                      <a
                        key={index}
                        href={cert.url || "#"}
                        target={cert.url ? "_blank" : undefined}
                        className="flex items-center justify-between p-4 bg-[#FFFCF9] border border-stone-200/60 rounded-xl hover:border-[#E84D0E]/30 transition-colors group"
                      >
                        <div>
                          <h4 className="font-display-sl font-semibold text-sm text-[#1C1917] group-hover:text-[#E84D0E] transition-colors">
                            {cert.name}
                          </h4>
                          <p className="text-xs text-[#78716C] font-body-sl">{cert.issuer}</p>
                        </div>
                        {cert.url && (
                          <ArrowUpRight
                            className="w-3 h-3 text-stone-300 group-hover:text-[#E84D0E]"
                            aria-hidden="true"
                          />
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ─── CTA Footer ─── */}
          <footer id="contact" className="py-20 border-t border-stone-200/60" role="contentinfo">
            <div className="flex flex-col items-center text-center space-y-6">
              <h2 className="text-4xl md:text-5xl font-display-sl font-extrabold tracking-tight text-[#1C1917]">
                The stage is yours.
              </h2>
              <p className="text-[#78716C] max-w-md font-body-sl">
                Currently open for new opportunities. Whether you have a role, a project, or just
                want to say hi — let&apos;s connect.
              </p>

              {content.contact.email && (
                <a
                  href={`mailto:${content.contact.email}`}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[#E84D0E] px-8 text-sm font-display-sl font-semibold text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-[#d4430c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E84D0E] focus-visible:ring-offset-2"
                >
                  Say Hello
                </a>
              )}

              <div className="pt-10 w-full max-w-sm">
                <ShareBar
                  handle={profile.handle}
                  title={`${content.full_name}'s Portfolio`}
                  name={content.full_name}
                  variant="spotlight"
                />
              </div>

              <div className="pt-8 text-xs text-[#78716C] font-body-sl" suppressHydrationWarning>
                © {new Date().getFullYear()} {content.full_name}. All rights reserved.
              </div>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
};

export default Spotlight;
