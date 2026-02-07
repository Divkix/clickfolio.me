"use client";

import {
  ArrowUpRight,
  Briefcase,
  ExternalLink,
  GithubIcon,
  Globe,
  GraduationCap,
  Layers,
  LinkedinIcon,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { ShareBar } from "@/components/ShareBar";
import { type ContactLinkType, getContactLinks } from "@/lib/templates/contact-links";
import {
  flattenSkills,
  formatDateRange,
  formatShortDate,
  formatYear,
  getInitials,
} from "@/lib/templates/helpers";
import type { Project } from "@/lib/types/database";
import type { TemplateProps } from "@/lib/types/template";

// --- Configuration & Assets ---

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;800&family=JetBrains+Mono:wght@400;500&display=swap";

const glassIconMap: Partial<
  Record<ContactLinkType, React.ComponentType<{ size: number; className?: string }>>
> = {
  github: GithubIcon,
  linkedin: LinkedinIcon,
  email: Mail,
  phone: Phone,
  website: Globe,
};

const NAV_SECTIONS = [
  { id: "about", label: "Overview", icon: User },
  { id: "experience", label: "Career", icon: Briefcase },
  { id: "projects", label: "Works", icon: Layers },
  { id: "skills", label: "Stack", icon: Zap },
  { id: "education", label: "Education", icon: GraduationCap },
] as const;

// --- Components ---

/**
 * SpotlightCard
 * A card that tracks mouse movement to create a glowing border/background effect
 */
const SpotlightCard = ({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.15)",
}: {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-3xl overflow-hidden border border-white/[0.08] bg-[#0A0A0A]/40 backdrop-blur-2xl transition-colors duration-300 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
};

const SectionHeading = ({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: any;
  title: string;
  subtitle?: string;
}) => (
  <div className="flex items-end gap-4 mb-10 pb-4 border-b border-white/[0.05]">
    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-[#D8B4FE]">
      <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
    </div>
    <div>
      <h2 className="text-3xl md:text-4xl font-display-gm font-bold text-white tracking-tight">
        {title}
      </h2>
      {subtitle && <p className="text-sm font-mono-gm text-white/40 mt-1">{subtitle}</p>}
    </div>
  </div>
);

// --- Main Template ---

const GlassMorphic: React.FC<TemplateProps> = ({ content, profile }) => {
  const flatSkills = content.skills ? flattenSkills(content.skills) : [];
  const contactLinks = getContactLinks(content.contact);

  // Memoized Nav Logic
  const availableNavSections = useMemo(
    () =>
      NAV_SECTIONS.filter((section) => {
        switch (section.id) {
          case "about":
            return true;
          case "experience":
            return content.experience && content.experience.length > 0;
          case "projects":
            return content.projects && content.projects.length > 0;
          case "skills":
            return flatSkills.length > 0;
          case "education":
            return (
              (content.education && content.education.length > 0) ||
              (content.certifications && content.certifications.length > 0)
            );
          default:
            return false;
        }
      }),
    [
      content.experience,
      content.projects,
      content.education,
      content.certifications,
      flatSkills.length,
    ],
  );

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={FONT_URL} rel="stylesheet" />

      <style>{`
        :root {
          --glass-border: rgba(255, 255, 255, 0.08);
          --glass-surface: rgba(20, 20, 20, 0.6);
          --primary-glow: #A78BFA;
          --secondary-glow: #2DD4BF;
        }
        
        .font-display-gm { font-family: 'Outfit', sans-serif; }
        .font-mono-gm { font-family: 'JetBrains Mono', monospace; }

        html { scroll-behavior: smooth; }

        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #050505; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }

        /* Animations */
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 10s infinite;
        }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }

        @media (prefers-reduced-motion: reduce) {
          .animate-blob { animation: none; }
          .animate-ping { animation: none; }
          .animate-pulse { animation: none; }
        }

        .text-gradient {
          background: linear-gradient(135deg, #fff 0%, #a5a5a5 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .text-gradient-purple {
          background: linear-gradient(135deg, #E879F9 0%, #A78BFA 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      <div className="min-h-screen bg-[#030303] text-slate-300 relative selection:bg-[#A78BFA]/30 selection:text-white font-display-gm overflow-x-hidden">
        {/* --- Background Ambient Layer --- */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[50vw] h-[50vw] bg-[#A78BFA]/20 rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-blob" />
          <div className="absolute top-0 right-1/4 w-[50vw] h-[50vw] bg-[#2DD4BF]/10 rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-32 left-1/3 w-[60vw] h-[60vw] bg-[#F472B6]/10 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-blob animation-delay-4000" />

          {/* Noise Overlay */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* --- Floating Navigation --- */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-1 p-1.5 rounded-full bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/50">
            {availableNavSections.map((section) => {
              const Icon = section.icon;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="group relative flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full hover:bg-white/[0.1] transition-all duration-300"
                  aria-label={section.label}
                >
                  <Icon
                    size={20}
                    className="text-white/50 group-hover:text-white transition-colors"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  {/* Tooltip */}
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1a1a1a] border border-white/10 text-[10px] font-mono-gm text-white rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {section.label}
                  </span>
                </a>
              );
            })}
            {content.contact.email && (
              <a
                href={`mailto:${content.contact.email}`}
                className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-white text-black hover:scale-110 transition-transform duration-300 ml-2"
                aria-label="Contact"
              >
                <Mail size={18} strokeWidth={2.5} aria-hidden="true" />
              </a>
            )}
          </div>
        </nav>

        {/* --- Main Content --- */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 md:py-32 space-y-32">
          {/* HERO SECTION */}
          <section id="about" className="relative">
            <div className="flex flex-col gap-8">
              {/* Status Indicator */}
              <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full border border-[#A78BFA]/30 bg-[#A78BFA]/5 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A78BFA] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#A78BFA]"></span>
                </span>
                <span className="text-xs font-mono-gm text-[#D8B4FE]">ONLINE_V2.0</span>
              </div>

              <div className="grid md:grid-cols-[1fr_auto] gap-8 items-end">
                <div className="space-y-2">
                  <h1 className="text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter text-white leading-[0.9]">
                    <span className="block">{content.full_name.split(" ")[0]}</span>
                    <span className="block text-white/20">
                      {content.full_name.split(" ").slice(1).join(" ")}
                    </span>
                  </h1>
                  <h2 className="text-xl md:text-2xl font-light text-gradient-purple tracking-wide">
                    {content.headline}
                  </h2>
                </div>

                {/* Abstract Avatar / Photo */}
                <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full border-2 border-white/10 p-1">
                  <div className="w-full h-full rounded-full overflow-hidden relative group">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Profile"
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#111] flex items-center justify-center text-4xl font-bold text-[#333]">
                        {getInitials(content.full_name)}
                      </div>
                    )}
                    {/* Scanline overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent bg-[length:100%_4px] pointer-events-none" />
                  </div>
                </div>
              </div>

              <SpotlightCard className="p-8 md:p-10 mt-8">
                <div className="grid md:grid-cols-[2fr_1fr] gap-10">
                  <div className="space-y-6">
                    <p className="text-lg md:text-xl font-light leading-relaxed text-slate-300">
                      {content.summary}
                    </p>

                    {/* Socials */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      {contactLinks
                        .filter((l) => l.type !== "location")
                        .map((link) => {
                          const Icon = glassIconMap[link.type] || ExternalLink;
                          const isBranded = link.type === "behance" || link.type === "dribbble";
                          const brandColor =
                            link.type === "behance"
                              ? "#1769FF"
                              : link.type === "dribbble"
                                ? "#EA4C89"
                                : undefined;
                          const brandText =
                            link.type === "behance" ? "Be" : link.type === "dribbble" ? "Dr" : null;

                          return (
                            <a
                              key={link.type}
                              href={link.href}
                              target={link.isExternal ? "_blank" : undefined}
                              rel={link.isExternal ? "noopener noreferrer" : undefined}
                              aria-label={link.label}
                              className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all"
                            >
                              {isBranded ? (
                                <span
                                  className="text-xs font-bold font-mono-gm"
                                  style={{ color: brandColor }}
                                >
                                  {brandText}
                                </span>
                              ) : (
                                <Icon
                                  size={14}
                                  className="text-white/60 group-hover:text-white"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="text-sm font-mono-gm text-white/60 group-hover:text-white capitalize">
                                {link.label}
                              </span>
                            </a>
                          );
                        })}
                    </div>
                  </div>

                  {/* Meta Data */}
                  <div className="hidden md:block border-l border-white/10 pl-10 space-y-6">
                    <div>
                      <h3 className="text-xs font-mono-gm text-white/30 uppercase tracking-widest mb-2">
                        Location
                      </h3>
                      <div className="flex items-center gap-2 text-slate-300">
                        <MapPin size={14} aria-hidden="true" />
                        <span>{content.contact.location || "Remote"}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-mono-gm text-white/30 uppercase tracking-widest mb-2">
                        Status
                      </h3>
                      <div className="flex items-center gap-2 text-[#A78BFA]">
                        <Sparkles size={14} aria-hidden="true" />
                        <span>Available for work</span>
                      </div>
                    </div>
                    <div className="pt-4 opacity-50 hover:opacity-100 transition-opacity">
                      <ShareBar
                        handle={profile.handle}
                        title="Portfolio"
                        name={content.full_name}
                        variant="glass-morphic"
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile ShareBar */}
                <div className="md:hidden mt-6 flex justify-center opacity-50 hover:opacity-100 transition-opacity">
                  <ShareBar
                    handle={profile.handle}
                    title="Portfolio"
                    name={content.full_name}
                    variant="glass-morphic"
                  />
                </div>
              </SpotlightCard>
            </div>
          </section>

          {/* EXPERIENCE SECTION */}
          {content.experience && content.experience.length > 0 && (
            <section id="experience">
              <SectionHeading
                icon={Briefcase}
                title="Experience"
                subtitle="Professional trajectory"
              />

              <div className="space-y-4">
                {content.experience.map((job, index) => (
                  <SpotlightCard key={index} className="group p-6 md:p-8">
                    <div className="flex flex-col md:flex-row gap-4 md:items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-[#A78BFA] transition-colors">
                          {job.title}
                        </h3>
                        <div className="flex items-center gap-2 text-slate-400 mt-1">
                          <span className="font-medium">{job.company}</span>
                          {job.location && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-600" />
                              <span className="text-sm text-slate-500">{job.location}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 self-start shrink-0">
                        <span className="text-xs font-mono-gm text-slate-300">
                          {formatDateRange(job.start_date, job.end_date)}
                        </span>
                      </div>
                    </div>

                    {job.description && (
                      <p className="text-slate-400 font-light leading-relaxed mb-6 max-w-3xl">
                        {job.description}
                      </p>
                    )}

                    {job.highlights && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {job.highlights.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 text-sm text-slate-400/80">
                            <span className="mt-1.5 w-1 h-1 rounded-full bg-[#A78BFA]/50 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </SpotlightCard>
                ))}
              </div>
            </section>
          )}

          {/* PROJECTS SECTION */}
          {content.projects && content.projects.length > 0 && (
            <section id="projects">
              <SectionHeading
                icon={Layers}
                title="Projects"
                subtitle="Selected works & experiments"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {content.projects.map((project: Project, i: number) => (
                  <SpotlightCard key={i} className="group flex flex-col h-full">
                    <div className="p-6 md:p-8 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-transparent border border-white/5 flex items-center justify-center">
                          <span className="font-display-gm font-bold text-xl text-white">
                            {project.title.charAt(0)}
                          </span>
                        </div>
                        {project.url && (
                          <a
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View ${project.title}`}
                            className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all"
                          >
                            <ArrowUpRight size={20} aria-hidden="true" />
                          </a>
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#A78BFA] transition-colors">
                        {project.title}
                      </h3>
                      {project.year && (
                        <span className="text-xs font-mono-gm text-white/30">{project.year}</span>
                      )}

                      <p className="text-slate-400 font-light text-sm leading-relaxed mb-6 flex-grow">
                        {project.description}
                      </p>

                      <div className="pt-6 border-t border-white/5">
                        <div className="flex flex-wrap gap-2">
                          {project.technologies?.slice(0, 4).map((tech) => (
                            <span
                              key={tech}
                              className="px-2 py-1 text-[10px] font-mono-gm uppercase tracking-wider text-[#A78BFA] bg-[#A78BFA]/10 rounded border border-[#A78BFA]/20"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                ))}
              </div>
            </section>
          )}

          {/* SKILLS SECTION - CLOUD */}
          {flatSkills.length > 0 && (
            <section id="skills">
              <SectionHeading icon={Zap} title="Stack" subtitle="Tools & Technologies" />
              <SpotlightCard className="p-8 md:p-12">
                <div className="flex flex-wrap justify-center gap-3">
                  {flatSkills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-slate-300 hover:bg-white/[0.08] hover:text-white hover:border-[#A78BFA]/30 hover:shadow-[0_0_15px_rgba(167,139,250,0.3)] transition-all duration-300 cursor-default select-none"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </SpotlightCard>
            </section>
          )}

          {/* EDUCATION & CERTS */}
          {((content.education && content.education.length > 0) ||
            (content.certifications && content.certifications.length > 0)) && (
            <section id="education">
              <SectionHeading
                icon={GraduationCap}
                title="Education"
                subtitle="Academic background"
              />

              <div className="grid md:grid-cols-2 gap-6">
                {/* Edu Column */}
                <div className="space-y-4">
                  {content.education?.map((edu, i) => (
                    <SpotlightCard key={i} className="p-6">
                      <div className="text-xs font-mono-gm text-[#A78BFA] mb-2">
                        {edu.graduation_date ? formatYear(edu.graduation_date) : "Present"}
                      </div>
                      <h4 className="text-lg font-bold text-white mb-1">{edu.institution}</h4>
                      <p className="text-slate-400 text-sm font-medium">{edu.degree}</p>
                      {edu.gpa && (
                        <p className="text-slate-500 text-xs mt-2 font-mono-gm">GPA: {edu.gpa}</p>
                      )}
                    </SpotlightCard>
                  ))}
                </div>

                {/* Certs Column */}
                <div className="space-y-4">
                  {content.certifications?.map((cert, i) => (
                    <SpotlightCard key={i} className="p-6 h-full flex flex-col justify-center">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-base font-bold text-white mb-1">{cert.name}</h4>
                          <p className="text-slate-500 text-xs uppercase tracking-wider">
                            {cert.issuer}
                          </p>
                          {cert.date && (
                            <p className="text-slate-500 text-xs mt-1 font-mono-gm">
                              {formatShortDate(cert.date)}
                            </p>
                          )}
                        </div>
                        {cert.url && (
                          <a
                            href={cert.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View ${cert.name} certificate`}
                            className="text-white/20 hover:text-white transition-colors"
                          >
                            <ExternalLink size={16} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </SpotlightCard>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* FOOTER */}
          <footer className="pt-20 pb-32 text-center">
            <div className="inline-flex items-center justify-center p-1 rounded-full border border-white/10 bg-white/5 mb-8">
              <div className="w-2 h-2 bg-green-500 rounded-full mx-3 animate-pulse" />
              <span className="text-xs font-mono-gm text-white/50 pr-4 py-1">
                System Operational
              </span>
            </div>
            <p className="text-slate-600 text-sm font-light" suppressHydrationWarning>
              &copy; {new Date().getFullYear()} {content.full_name}. <br className="md:hidden" />
              <span className="hidden md:inline mx-2">&middot;</span>
              Designed with precision.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
};

export default GlassMorphic;
