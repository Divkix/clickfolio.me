import type { ResumeContent } from "@/lib/types/database";
import type { ThemeId } from "./theme-registry";

/**
 * Demo profile metadata for landing page cards
 */
export interface DemoProfile {
  id: ThemeId;
  name: string;
  role: string;
  initials: string;
  avatarGradient: string;
  badgeLabel: string;
  badgeBgColor: string;
  badgeTextColor: string;
}

/**
 * Demo profiles for the landing page example cards
 */
export const DEMO_PROFILES: DemoProfile[] = [
  {
    id: "minimalist_editorial",
    name: "Sarah Chen",
    role: "Product Designer",
    initials: "SC",
    avatarGradient: "from-indigo-400 to-blue-500",
    badgeLabel: "Editorial",
    badgeBgColor: "bg-indigo-50",
    badgeTextColor: "text-indigo-600",
  },
  {
    id: "neo_brutalist",
    name: "John Smith",
    role: "Software Engineer",
    initials: "JS",
    avatarGradient: "from-emerald-400 to-teal-500",
    badgeLabel: "Brutalist",
    badgeBgColor: "bg-emerald-50",
    badgeTextColor: "text-emerald-600",
  },
  {
    id: "bento",
    name: "Maria Rodriguez",
    role: "Marketing Lead",
    initials: "MR",
    avatarGradient: "from-purple-400 to-pink-500",
    badgeLabel: "Bento",
    badgeBgColor: "bg-purple-50",
    badgeTextColor: "text-purple-600",
  },
  {
    id: "glass",
    name: "Alex Kim",
    role: "Full-Stack Developer",
    initials: "AK",
    avatarGradient: "from-cyan-400 to-blue-500",
    badgeLabel: "Glass",
    badgeBgColor: "bg-cyan-50",
    badgeTextColor: "text-cyan-600",
  },
];

/**
 * Full demo resume content for each template preview
 */
export const DEMO_RESUME_CONTENT: Record<ThemeId, ResumeContent> = {
  minimalist_editorial: {
    full_name: "Sarah Chen",
    headline: "Product Designer crafting intuitive digital experiences",
    summary:
      "Product designer with 8+ years of experience creating user-centered solutions for fintech and SaaS products. Led design systems at scale and mentored junior designers.",
    contact: {
      email: "sarah@example.com",
      location: "San Francisco, CA",
      linkedin: "linkedin.com/in/sarahchen",
      website: "sarahchen.design",
    },
    experience: [
      {
        title: "Senior Product Designer",
        company: "Stripe",
        location: "San Francisco, CA",
        start_date: "2021-03",
        end_date: undefined,
        description:
          "Leading design for merchant onboarding experiences, improving conversion by 23%.",
        highlights: [
          "Redesigned checkout flow used by 2M+ merchants",
          "Built and maintained design system components",
          "Mentored 3 junior designers",
        ],
      },
      {
        title: "Product Designer",
        company: "Figma",
        location: "San Francisco, CA",
        start_date: "2018-06",
        end_date: "2021-02",
        description: "Designed collaboration features for the flagship product.",
        highlights: ["Shipped multiplayer cursors feature", "Led user research for FigJam launch"],
      },
      {
        title: "UX Designer",
        company: "IDEO",
        location: "Palo Alto, CA",
        start_date: "2016-01",
        end_date: "2018-05",
        description: "Consulted on design strategy for Fortune 500 clients.",
      },
    ],
    education: [
      {
        degree: "BFA in Graphic Design",
        institution: "Rhode Island School of Design",
        location: "Providence, RI",
        graduation_date: "2015-05",
      },
    ],
    skills: [
      { category: "Design", items: ["Figma", "Sketch", "Adobe XD", "Framer"] },
      { category: "Research", items: ["User Interviews", "A/B Testing", "Analytics"] },
    ],
    certifications: [
      {
        name: "Google UX Design Certificate",
        issuer: "Google",
        date: "2022-01",
      },
    ],
    projects: [
      {
        title: "Design System Toolkit",
        description: "Open-source Figma component library with 500+ downloads",
        year: "2023",
        technologies: ["Figma", "React", "Storybook"],
        url: "github.com/sarahchen/design-toolkit",
      },
    ],
  },

  neo_brutalist: {
    full_name: "John Smith",
    headline: "Software Engineer building scalable systems",
    summary:
      "Full-stack engineer with expertise in distributed systems and cloud infrastructure. Passionate about developer experience and open source.",
    contact: {
      email: "john@example.com",
      location: "Austin, TX",
      github: "github.com/johnsmith",
      linkedin: "linkedin.com/in/johnsmith",
    },
    experience: [
      {
        title: "Staff Software Engineer",
        company: "Vercel",
        location: "Remote",
        start_date: "2022-01",
        end_date: undefined,
        description:
          "Building next-generation deployment infrastructure for millions of developers.",
        highlights: [
          "Reduced build times by 40% through caching optimizations",
          "Architected edge function runtime",
          "Led team of 5 engineers",
        ],
      },
      {
        title: "Senior Software Engineer",
        company: "Cloudflare",
        location: "Austin, TX",
        start_date: "2019-06",
        end_date: "2021-12",
        description: "Developed Workers runtime and edge computing platform.",
        highlights: ["Shipped Durable Objects feature", "Optimized V8 isolate startup time by 60%"],
      },
      {
        title: "Software Engineer",
        company: "GitHub",
        location: "San Francisco, CA",
        start_date: "2017-03",
        end_date: "2019-05",
        description: "Built CI/CD pipeline features for GitHub Actions.",
      },
    ],
    education: [
      {
        degree: "BS in Computer Science",
        institution: "University of Texas at Austin",
        location: "Austin, TX",
        graduation_date: "2016-05",
        gpa: "3.8",
      },
    ],
    skills: [
      { category: "Languages", items: ["TypeScript", "Rust", "Go", "Python"] },
      { category: "Infrastructure", items: ["Kubernetes", "AWS", "Cloudflare", "Docker"] },
    ],
    certifications: [
      {
        name: "AWS Solutions Architect",
        issuer: "Amazon Web Services",
        date: "2021-06",
      },
    ],
    projects: [
      {
        title: "Edge Cache Library",
        description: "High-performance caching library for edge computing",
        year: "2023",
        technologies: ["Rust", "WebAssembly"],
        url: "github.com/johnsmith/edge-cache",
      },
      {
        title: "DevTools CLI",
        description: "Developer productivity CLI with 10k+ GitHub stars",
        year: "2022",
        technologies: ["Go", "Cobra"],
      },
    ],
  },

  bento: {
    full_name: "Maria Rodriguez",
    headline: "Marketing Lead driving growth through data",
    summary:
      "Growth marketing leader with 10+ years scaling B2B SaaS companies from Series A to IPO. Expert in demand generation and brand strategy.",
    contact: {
      email: "maria@example.com",
      location: "New York, NY",
      linkedin: "linkedin.com/in/mariarodriguez",
      website: "mariarodriguez.com",
    },
    experience: [
      {
        title: "VP of Marketing",
        company: "Notion",
        location: "New York, NY",
        start_date: "2021-09",
        end_date: undefined,
        description: "Leading global marketing strategy for the #1 productivity tool.",
        highlights: [
          "Grew user base from 20M to 35M users",
          "Launched viral template gallery campaign",
          "Built marketing team from 12 to 45 people",
        ],
      },
      {
        title: "Director of Growth",
        company: "Slack",
        location: "San Francisco, CA",
        start_date: "2018-03",
        end_date: "2021-08",
        description: "Drove user acquisition and activation strategies.",
        highlights: [
          "Increased free-to-paid conversion by 35%",
          "Led product-led growth initiatives",
        ],
      },
      {
        title: "Marketing Manager",
        company: "HubSpot",
        location: "Boston, MA",
        start_date: "2014-06",
        end_date: "2018-02",
        description: "Managed demand generation campaigns for SMB segment.",
      },
    ],
    education: [
      {
        degree: "MBA",
        institution: "Harvard Business School",
        location: "Boston, MA",
        graduation_date: "2014-05",
      },
      {
        degree: "BA in Communications",
        institution: "NYU",
        location: "New York, NY",
        graduation_date: "2010-05",
      },
    ],
    skills: [
      { category: "Marketing", items: ["SEO/SEM", "Content Strategy", "Brand Development"] },
      { category: "Analytics", items: ["Google Analytics", "Mixpanel", "Amplitude", "Tableau"] },
    ],
    certifications: [
      {
        name: "Google Analytics Certification",
        issuer: "Google",
        date: "2023-03",
      },
    ],
    projects: [
      {
        title: "Growth Playbook",
        description: "Published guide on PLG strategies with 50k+ readers",
        year: "2023",
      },
    ],
  },

  glass: {
    full_name: "Alex Kim",
    headline: "Full-Stack Developer building modern web apps",
    summary:
      "Full-stack developer specializing in React, Node.js, and cloud-native applications. Open source contributor and technical writer.",
    contact: {
      email: "alex@example.com",
      location: "Seattle, WA",
      github: "github.com/alexkim",
      linkedin: "linkedin.com/in/alexkim",
      website: "alexkim.dev",
    },
    experience: [
      {
        title: "Senior Full-Stack Developer",
        company: "Supabase",
        location: "Remote",
        start_date: "2022-06",
        end_date: undefined,
        description: "Building the open-source Firebase alternative used by 500k+ developers.",
        highlights: [
          "Shipped real-time subscriptions feature",
          "Improved dashboard performance by 50%",
          "Authored 20+ technical blog posts",
        ],
      },
      {
        title: "Full-Stack Developer",
        company: "Prisma",
        location: "Berlin, Germany",
        start_date: "2020-01",
        end_date: "2022-05",
        description: "Developed Prisma Studio and data browser tools.",
        highlights: ["Built schema visualization feature", "Contributed to Prisma Client core"],
      },
      {
        title: "Frontend Developer",
        company: "Shopify",
        location: "Toronto, Canada",
        start_date: "2018-03",
        end_date: "2019-12",
        description: "Built merchant admin dashboard features.",
      },
    ],
    education: [
      {
        degree: "BS in Software Engineering",
        institution: "University of Washington",
        location: "Seattle, WA",
        graduation_date: "2017-06",
      },
    ],
    skills: [
      { category: "Frontend", items: ["React", "Next.js", "TypeScript", "Tailwind CSS"] },
      { category: "Backend", items: ["Node.js", "PostgreSQL", "Redis", "GraphQL"] },
      { category: "DevOps", items: ["Vercel", "AWS", "Docker", "GitHub Actions"] },
    ],
    certifications: [
      {
        name: "AWS Certified Developer",
        issuer: "Amazon Web Services",
        date: "2022-09",
      },
    ],
    projects: [
      {
        title: "React Query Toolkit",
        description: "Collection of React Query utilities with 5k+ npm downloads/week",
        year: "2023",
        technologies: ["React", "TypeScript"],
        url: "github.com/alexkim/rq-toolkit",
      },
      {
        title: "Database Explorer",
        description: "Visual database schema explorer for PostgreSQL",
        year: "2022",
        technologies: ["Next.js", "D3.js", "PostgreSQL"],
      },
    ],
  },
};

/**
 * Get demo data for a specific theme
 */
export function getDemoData(themeId: ThemeId): {
  content: ResumeContent;
  profile: { avatar_url: string | null; handle: string };
} {
  const profile = DEMO_PROFILES.find((p) => p.id === themeId);
  return {
    content: DEMO_RESUME_CONTENT[themeId],
    profile: {
      avatar_url: null,
      handle: profile?.name.toLowerCase().replace(/\s+/g, "") || "demo",
    },
  };
}

/**
 * Template background configuration for modal display
 */
export const TEMPLATE_BACKGROUNDS: Record<ThemeId, { bg: string; isDark: boolean }> = {
  minimalist_editorial: { bg: "bg-[#fdfbf9]", isDark: false },
  neo_brutalist: { bg: "bg-[#FFFDF5]", isDark: false },
  bento: { bg: "bg-neutral-100", isDark: false },
  glass: { bg: "bg-[#0f172a]", isDark: true },
};
