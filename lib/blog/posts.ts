export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: string;
  keywords: string[];
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "pdf-resume-to-website",
    title: "PDF Resume to Website Converter: The Complete Guide (2026)",
    description:
      "Why a PDF resume isn't enough anymore and how AI can turn it into a hosted website in under 30 seconds.",
    date: "2026-04-27",
    readTime: "8 min read",
    category: "Guide",
    keywords: [
      "pdf resume to website",
      "resume website converter",
      "ai resume parser",
      "online portfolio",
      "pdf to web portfolio",
    ],
  },
  {
    slug: "best-resume-website-builders",
    title: "Best Free Resume Website Builders Compared (2026)",
    description:
      "We tested 8 resume-to-website tools. Here's how clickfolio.me, Magic Self, DockPage, and others stack up on features, pricing, and ease of use.",
    date: "2026-04-25",
    readTime: "10 min read",
    category: "Comparison",
    keywords: [
      "resume website builders",
      "free portfolio website",
      "resume to website tools",
      "clickfolio vs alternatives",
      "online cv builder",
    ],
  },
  {
    slug: "clickfolio-templates-showcase",
    title: "clickfolio.me Templates: Complete Showcase & Guide",
    description:
      "Explore all 10 resume templates — from Minimalist Editorial to Bold Corporate. Find the perfect design for your profession.",
    date: "2026-04-23",
    readTime: "7 min read",
    category: "Product",
    keywords: [
      "resume templates",
      "portfolio templates",
      "clickfolio themes",
      "resume design",
      "premium resume templates",
    ],
  },
  {
    slug: "ai-resume-parsing-accuracy",
    title: "How Accurate is AI Resume Parsing? We Tested It",
    description:
      "We put AI resume parsing through its paces with real-world PDFs. Here's what it gets right, what trips it up, and how to fix the gaps.",
    date: "2026-04-21",
    readTime: "6 min read",
    category: "Deep Dive",
    keywords: [
      "ai resume parsing",
      "resume ocr accuracy",
      "ai pdf extraction",
      "resume data extraction",
      "structured resume parsing",
    ],
  },
  {
    slug: "linkedin-to-portfolio",
    title: "LinkedIn to Portfolio Website: The Complete Guide",
    description:
      "LinkedIn is borrowed land. Learn how to turn your LinkedIn profile into a portfolio website you own, control, and can rank on Google.",
    date: "2026-04-19",
    readTime: "7 min read",
    category: "How-To",
    keywords: [
      "linkedin to portfolio",
      "linkedin to website",
      "personal portfolio website",
      "linkedin alternative",
      "own your online presence",
    ],
  },
  {
    slug: "pdf-resume-vs-portfolio",
    title: "PDF Resume vs Portfolio Website: Why You Need Both",
    description:
      "They serve different purposes. Learn when to send a PDF, when to share your portfolio URL, and how to use both together for maximum impact.",
    date: "2026-04-17",
    readTime: "6 min read",
    category: "Guide",
    keywords: [
      "pdf resume vs portfolio",
      "resume formats",
      "ats resume",
      "online portfolio benefits",
      "hybrid resume strategy",
    ],
  },
  {
    slug: "resume-writing-tips",
    title: "How to Write a Resume That Converts (2026)",
    description:
      "The fundamentals haven't changed, but delivery has. Learn how to write a resume that works for both AI parsers and human recruiters.",
    date: "2026-04-15",
    readTime: "8 min read",
    category: "Guide",
    keywords: [
      "resume writing tips",
      "how to write a resume",
      "resume keywords",
      "ats optimization",
      "resume structure",
    ],
  },
  {
    slug: "privacy-at-clickfolio",
    title: "Your Data, Your Control: Privacy at clickfolio.me",
    description:
      "Privacy isn't an afterthought — it's a core feature. See how we handle your data, what we do and don't collect, and how you stay in control.",
    date: "2026-04-13",
    readTime: "5 min read",
    category: "Product",
    keywords: [
      "privacy",
      "data control",
      "resume privacy",
      "personal data protection",
      "clickfolio security",
    ],
  },
];

export function getPostBySlug(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
