import type { ResumeContent } from "@/lib/types/database";
import type { ThemeId } from "./theme-registry";

/**
 * Demo profile metadata for landing page cards
 */
interface DemoProfile {
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
  {
    id: "spotlight",
    name: "Emma Torres",
    role: "Creative Director",
    initials: "ET",
    avatarGradient: "from-amber-400 to-orange-500",
    badgeLabel: "Spotlight",
    badgeBgColor: "bg-amber-50",
    badgeTextColor: "text-amber-600",
  },
  {
    id: "midnight",
    name: "Raj Patel",
    role: "Data Scientist",
    initials: "RP",
    avatarGradient: "from-yellow-400 to-amber-500",
    badgeLabel: "Midnight",
    badgeBgColor: "bg-yellow-50",
    badgeTextColor: "text-yellow-600",
  },
  {
    id: "bold_corporate",
    name: "Diana Walsh",
    role: "VP of Engineering",
    initials: "DW",
    avatarGradient: "from-slate-400 to-gray-600",
    badgeLabel: "Corporate",
    badgeBgColor: "bg-slate-50",
    badgeTextColor: "text-slate-600",
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

  bold_corporate: {
    full_name: "Diana Walsh",
    headline: "VP of Engineering scaling distributed systems",
    summary:
      "Engineering executive with 15+ years leading high-performance teams at Fortune 500 companies. Expert in platform engineering, organizational scaling, and technical strategy.",
    contact: {
      email: "diana@example.com",
      location: "Chicago, IL",
      linkedin: "linkedin.com/in/dianawalsh",
      website: "dianawalsh.io",
    },
    experience: [
      {
        title: "VP of Engineering",
        company: "Datadog",
        location: "New York, NY",
        start_date: "2022-01",
        end_date: undefined,
        description:
          "Leading platform engineering org of 120+ engineers across infrastructure, reliability, and developer experience.",
        highlights: [
          "Scaled engineering org from 60 to 120 engineers",
          "Reduced P0 incidents by 70% through reliability program",
          "Launched internal developer platform used by 500+ engineers",
        ],
      },
      {
        title: "Senior Director of Engineering",
        company: "Twilio",
        location: "San Francisco, CA",
        start_date: "2018-06",
        end_date: "2021-12",
        description: "Directed messaging platform serving 10M+ API calls/day.",
        highlights: [
          "Led migration to microservices architecture",
          "Built and mentored 8 engineering managers",
        ],
      },
      {
        title: "Engineering Manager",
        company: "Amazon",
        location: "Seattle, WA",
        start_date: "2014-03",
        end_date: "2018-05",
        description: "Managed AWS Lambda compute infrastructure team.",
      },
    ],
    education: [
      {
        degree: "MS in Computer Science",
        institution: "Stanford University",
        location: "Stanford, CA",
        graduation_date: "2013-06",
      },
      {
        degree: "BS in Electrical Engineering",
        institution: "MIT",
        location: "Cambridge, MA",
        graduation_date: "2011-05",
      },
    ],
    skills: [
      { category: "Leadership", items: ["Org Design", "Technical Strategy", "M&A Due Diligence"] },
      { category: "Technical", items: ["Distributed Systems", "Kubernetes", "Go", "Python"] },
      { category: "Platforms", items: ["AWS", "GCP", "Terraform", "Datadog"] },
    ],
    certifications: [
      {
        name: "AWS Solutions Architect Professional",
        issuer: "Amazon Web Services",
        date: "2020-03",
      },
      {
        name: "Engineering Leadership Certificate",
        issuer: "Stanford GSB",
        date: "2022-06",
      },
    ],
    projects: [
      {
        title: "Platform Engineering Blueprint",
        description: "Open-source framework for building internal developer platforms",
        year: "2023",
        technologies: ["Go", "Kubernetes", "Terraform"],
        url: "github.com/dianawalsh/platform-blueprint",
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

  midnight: {
    full_name: "Raj Patel",
    headline: "Data Scientist turning complexity into clarity",
    summary:
      "Data scientist with 7+ years building ML pipelines and predictive models for healthcare and fintech. Published researcher with a focus on NLP and time-series forecasting.",
    contact: {
      email: "raj@example.com",
      location: "Boston, MA",
      github: "github.com/rajpatel",
      linkedin: "linkedin.com/in/rajpatel",
      website: "rajpatel.dev",
    },
    experience: [
      {
        title: "Senior Data Scientist",
        company: "Moderna",
        location: "Cambridge, MA",
        start_date: "2022-03",
        end_date: undefined,
        description: "Building ML models for drug discovery and clinical trial optimization.",
        highlights: [
          "Developed NLP pipeline processing 50k+ research papers",
          "Reduced trial patient matching time by 60%",
          "Led team of 4 data scientists",
        ],
      },
      {
        title: "Data Scientist",
        company: "Capital One",
        location: "McLean, VA",
        start_date: "2019-06",
        end_date: "2022-02",
        description: "Built fraud detection models processing 100M+ daily transactions.",
        highlights: [
          "Improved fraud detection accuracy by 25%",
          "Shipped real-time scoring API with <10ms latency",
        ],
      },
      {
        title: "ML Engineer",
        company: "Two Sigma",
        location: "New York, NY",
        start_date: "2017-08",
        end_date: "2019-05",
        description: "Developed time-series forecasting models for quantitative trading.",
      },
    ],
    education: [
      {
        degree: "PhD in Statistics",
        institution: "MIT",
        location: "Cambridge, MA",
        graduation_date: "2017-05",
      },
      {
        degree: "BS in Mathematics",
        institution: "UC Berkeley",
        location: "Berkeley, CA",
        graduation_date: "2013-05",
        gpa: "3.9",
      },
    ],
    skills: [
      { category: "ML/AI", items: ["PyTorch", "TensorFlow", "Scikit-learn", "Hugging Face"] },
      { category: "Data", items: ["Python", "SQL", "Spark", "dbt"] },
      { category: "Tools", items: ["MLflow", "Airflow", "Databricks", "AWS SageMaker"] },
    ],
    certifications: [
      {
        name: "AWS Machine Learning Specialty",
        issuer: "Amazon Web Services",
        date: "2023-01",
      },
    ],
    projects: [
      {
        title: "TimeSeries Toolkit",
        description: "Open-source library for time-series forecasting with transformer models",
        year: "2023",
        technologies: ["Python", "PyTorch"],
        url: "github.com/rajpatel/ts-toolkit",
      },
    ],
  },

  spotlight: {
    full_name: "Emma Torres",
    headline: "Creative Director shaping brand identities",
    summary:
      "Award-winning creative director with 12+ years crafting brand experiences for startups and global brands. Expert in visual storytelling, design systems, and creative strategy.",
    contact: {
      email: "emma@example.com",
      location: "Los Angeles, CA",
      linkedin: "linkedin.com/in/emmatorres",
      website: "emmatorres.co",
    },
    experience: [
      {
        title: "Creative Director",
        company: "Airbnb",
        location: "San Francisco, CA",
        start_date: "2021-04",
        end_date: undefined,
        description:
          "Leading brand design for Airbnb Experiences, overseeing a team of 15 designers and art directors.",
        highlights: [
          "Rebranded Airbnb Experiences increasing engagement by 40%",
          "Won 3 D&AD Awards for campaign work",
          "Built creative team from 6 to 15 people",
        ],
      },
      {
        title: "Senior Art Director",
        company: "Spotify",
        location: "New York, NY",
        start_date: "2017-09",
        end_date: "2021-03",
        description: "Directed visual identity for Spotify Wrapped and editorial campaigns.",
        highlights: [
          "Led Spotify Wrapped 2020 campaign with 60M+ shares",
          "Established brand illustration system",
        ],
      },
      {
        title: "Art Director",
        company: "Pentagram",
        location: "New York, NY",
        start_date: "2014-06",
        end_date: "2017-08",
        description: "Designed brand identities for Fortune 500 clients.",
      },
    ],
    education: [
      {
        degree: "MFA in Graphic Design",
        institution: "Yale School of Art",
        location: "New Haven, CT",
        graduation_date: "2014-05",
      },
      {
        degree: "BFA in Visual Communication",
        institution: "Parsons School of Design",
        location: "New York, NY",
        graduation_date: "2012-05",
      },
    ],
    skills: [
      {
        category: "Design",
        items: ["Brand Strategy", "Art Direction", "Typography", "Motion Design"],
      },
      { category: "Tools", items: ["Figma", "After Effects", "Cinema 4D", "Illustrator"] },
      { category: "Leadership", items: ["Team Building", "Creative Strategy", "Client Relations"] },
    ],
    certifications: [
      {
        name: "D&AD Professional Member",
        issuer: "D&AD",
        date: "2021-01",
      },
    ],
    projects: [
      {
        title: "Brand Playbook",
        description: "Open-source brand guidelines template used by 200+ startups",
        year: "2023",
        technologies: ["Figma"],
        url: "figma.com/emmatorres/brand-playbook",
      },
    ],
  },
};

/**
 * Template background configuration for modal display
 */
export const TEMPLATE_BACKGROUNDS: Record<ThemeId, { bg: string; isDark: boolean }> = {
  bento: { bg: "bg-neutral-100", isDark: false },
  bold_corporate: { bg: "bg-white", isDark: false },
  glass: { bg: "bg-[#0f172a]", isDark: true },
  midnight: { bg: "bg-[#0a0a0a]", isDark: true },
  minimalist_editorial: { bg: "bg-[#fdfbf9]", isDark: false },
  neo_brutalist: { bg: "bg-[#FFFDF5]", isDark: false },
  spotlight: { bg: "bg-[#fdfbf7]", isDark: false },
};
