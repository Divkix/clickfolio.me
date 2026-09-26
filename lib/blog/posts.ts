import type { Metadata } from "next";
import { siteConfig } from "@/lib/config/site";
import { buildPublicPageMetadata } from "@/lib/seo/page-metadata";

export interface BlogPostFaq {
  q: string;
  a: string;
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  dateModified?: string;
  readTime: string;
  category: string;
  keywords: string[];
  faq?: BlogPostFaq[];
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "read-cv-alternatives",
    title: "Read.cv Alternatives: Where to Move Your Profile After the Shutdown (2026)",
    description:
      "Read.cv was acquired by Perplexity and wound down in 2025. Here's where to move your professional profile and resume website now — with free options.",
    date: "2026-06-09",
    dateModified: "2026-06-19",
    readTime: "8 min read",
    category: "Comparison",
    keywords: [
      "read.cv alternative",
      "read cv shut down",
      "read.cv replacement",
      "resume website alternative",
      "personal site after read.cv",
    ],
    faq: [
      {
        q: "Why did Read.cv shut down?",
        a: "Read.cv was acquired by AI search company Perplexity in January 2025 and began winding down. Users could export their data until May 16, 2025, and the profile and Sites features were discontinued.",
      },
      {
        q: "What is the best free Read.cv alternative?",
        a: "If you mainly used Read.cv to host a clean professional profile, a resume website builder like clickfolio.me is the closest free replacement — upload your resume PDF and get a hosted clickfolio.me/@handle site in about 30 seconds.",
      },
      {
        q: "How do I move my Read.cv profile to a new site?",
        a: "Export or recreate your resume as a PDF, then upload it to a resume website builder. clickfolio.me's AI reads your experience, education, and skills and rebuilds them as an editable hosted page.",
      },
    ],
  },
  {
    slug: "resume-website-examples",
    title: "12 Resume Website Examples to Inspire Your Own (2026)",
    description:
      "Real resume website examples across minimal, creative, and developer styles — what makes each one work, and how to build your own for free.",
    date: "2026-06-02",
    dateModified: "2026-06-19",
    readTime: "9 min read",
    category: "Inspiration",
    keywords: [
      "resume website examples",
      "resume websites examples",
      "cool cv websites",
      "personal website examples",
      "portfolio website examples",
    ],
    faq: [
      {
        q: "What does a good resume website look like?",
        a: "A good resume website loads fast, works on mobile, leads with your name and current role, and puts your strongest experience and projects above the fold. It uses one clear layout, readable type, and a single obvious way to contact you.",
      },
      {
        q: "What should every resume website include?",
        a: "Your name and headline, a short summary, work experience with outcomes, skills, education, links to your work or profiles, and a contact method. Keep it scannable — recruiters skim before they read.",
      },
      {
        q: "How do I make a resume website like these examples for free?",
        a: "Upload your PDF resume to a free builder like clickfolio.me. It parses your details and applies a professional template, so you get an example-quality site without designing one from scratch.",
      },
    ],
  },
  {
    slug: "personal-resume-website",
    title: "Personal Resume Website: What It Is (2026)",
    description:
      "A personal resume website shows your experience, skills, and projects at one link you own. See what to put on it and how to make one free in about 30 seconds.",
    date: "2026-05-26",
    dateModified: "2026-06-19",
    readTime: "7 min read",
    category: "Guide",
    keywords: [
      "personal resume website",
      "personal resume site",
      "personal website resume",
      "resume website",
      "own resume website",
    ],
    faq: [
      {
        q: "What is a personal resume website?",
        a: "A personal resume website is a web page you own that presents your professional background — experience, skills, projects, and contact info — at your own URL. Unlike a PDF, it's always current and shareable with a single link.",
      },
      {
        q: "Is a personal resume site worth it?",
        a: "Yes for most job seekers. It gives you a professional link for applications, email signatures, and your LinkedIn profile, helps you rank in Google for your own name, and lets you track who's viewing your background.",
      },
      {
        q: "How is a personal resume website different from LinkedIn?",
        a: "LinkedIn is rented space with a fixed layout shared by everyone. A personal resume website is yours — you control the design, the URL, the content, and the analytics, and no algorithm decides who sees it.",
      },
    ],
  },
  {
    slug: "how-to-make-a-resume-website",
    title: "How to Make a Resume Website: A Step-by-Step Guide (2026)",
    description:
      "Build a resume website in minutes — no coding. A step-by-step guide covering content, templates, custom URLs, and publishing your PDF resume as a live site.",
    date: "2026-05-19",
    dateModified: "2026-06-19",
    readTime: "8 min read",
    category: "How-To",
    keywords: [
      "how to make a resume website",
      "build a resume website",
      "create a resume website",
      "make a resume website free",
      "resume website tutorial",
    ],
    faq: [
      {
        q: "How do I make a resume website step by step?",
        a: "Prepare your resume content, choose a builder or template, add your experience and projects, pick a clean URL, then publish. With an AI builder like clickfolio.me you can skip most steps: upload your PDF and it builds the page for you.",
      },
      {
        q: "Do I need to know how to code to build a resume website?",
        a: "No. Resume website builders and resume-to-site converters let you publish a professional site with no code. Coding your own is an option for developers who want full control, but it's not required.",
      },
      {
        q: "Can I turn my existing resume PDF into a website?",
        a: "Yes. Tools like clickfolio.me read your PDF resume with AI and rebuild it as an editable hosted website in about 30 seconds, so you don't have to retype anything.",
      },
    ],
  },
  {
    slug: "cv-website-builder",
    title: "CV Website Builder: Turn Your CV Into a Site in 2026",
    description:
      "What a CV website builder does, the features that matter, and how to turn your CV into a fast, hosted website — free, with no coding.",
    date: "2026-05-12",
    dateModified: "2026-06-19",
    readTime: "7 min read",
    category: "Guide",
    keywords: [
      "cv website builder",
      "cv website",
      "online cv builder",
      "cv to website",
      "free cv website",
    ],
    faq: [
      {
        q: "What is the best CV website builder?",
        a: "The best CV website builder depends on whether you want speed or full design control. For most people, an AI converter like clickfolio.me wins on speed — it turns a CV PDF into a hosted site free in about 30 seconds.",
      },
      {
        q: "Are there free CV website builders?",
        a: "Yes. clickfolio.me is free forever for its core features, including hosting and a custom @handle URL. General builders like Carrd are cheap but charge for custom domains and don't import your CV automatically.",
      },
      {
        q: "Can a builder turn my CV into a site automatically?",
        a: "Some can. AI-powered tools read your CV's text and structure, then map it into a template — so your experience, skills, and education appear on the page without manual data entry.",
      },
    ],
  },
  {
    slug: "resume-hosting",
    title: "Resume Hosting: How to Put Your Resume Online With a Shareable Link (2026)",
    description:
      "Stop emailing PDF attachments. Learn how to host your resume online, get one shareable link, track views, and control privacy — free.",
    date: "2026-05-05",
    dateModified: "2026-06-19",
    readTime: "7 min read",
    category: "Guide",
    keywords: [
      "resume hosting",
      "resume hosting site",
      "host resume online",
      "shareable resume link",
      "resume online link",
    ],
    faq: [
      {
        q: "Where can I host my resume online for free?",
        a: "clickfolio.me hosts your resume as a live website free, with a clickfolio.me/@handle link you can share anywhere. It's faster and more professional than uploading a PDF to a file host.",
      },
      {
        q: "Is it better to send a PDF or a resume link?",
        a: "Send both. Use a PDF when an application requires a file or ATS upload, and share a hosted resume link in emails, your LinkedIn, and your signature — the link is always current and can track views.",
      },
      {
        q: "Can I track who views my hosted resume?",
        a: "With a resume website like clickfolio.me, yes. Built-in analytics show how many people viewed your portfolio, unlike a static PDF attachment.",
      },
    ],
  },
  {
    slug: "product-manager-portfolio-website",
    title: "How to Build a Product Manager Portfolio Website (2026)",
    description:
      "A product manager portfolio proves how you think, not just what you shipped. Learn what to include, how to structure case studies, and how to publish one fast.",
    date: "2026-04-29",
    dateModified: "2026-06-19",
    readTime: "9 min read",
    category: "How-To",
    keywords: [
      "product manager portfolio website",
      "product manager portfolio",
      "pm portfolio",
      "product manager website",
      "product manager portfolio examples",
    ],
    faq: [
      {
        q: "Do product managers really need a portfolio?",
        a: "Increasingly, yes. A PM portfolio shows your product thinking — how you found problems, prioritized, and drove outcomes — in a way a resume can't. It helps you stand out in a competitive hiring funnel.",
      },
      {
        q: "What should a PM portfolio case study include?",
        a: "The problem and who had it, the research and data behind your decisions, what you prioritized and why, what you shipped, and the measurable impact. Show the reasoning, not just the feature.",
      },
      {
        q: "How do I build a PM portfolio if my work is under NDA?",
        a: "Anonymize specifics — use ranges instead of exact numbers, describe the problem space generically, or use side projects and public product teardowns to demonstrate your process.",
      },
    ],
  },
  {
    slug: "student-resume-website",
    title: "How to Make a Student Resume Website With No Experience (2026)",
    description:
      "No job history? No problem. Learn how students can build a free resume website using projects, coursework, and activities — and stand out for internships.",
    date: "2026-04-22",
    dateModified: "2026-06-19",
    readTime: "7 min read",
    category: "How-To",
    keywords: [
      "student resume website",
      "student portfolio website",
      "resume website for students",
      "student resume no experience",
      "college resume website",
    ],
    faq: [
      {
        q: "Should a student have a resume website?",
        a: "Yes — it's a low-effort way to stand out for internships and entry-level roles. A clean link on your applications and at career fairs signals initiative and makes you easy to remember.",
      },
      {
        q: "What do I put on a student resume website with no work experience?",
        a: "Lead with education, then class projects, coursework, clubs, volunteering, freelance or personal projects, and skills. Frame what you've built and learned, not just job titles.",
      },
      {
        q: "How do I make a free student resume website?",
        a: "Export your resume as a PDF and upload it to a free builder like clickfolio.me. It builds a hosted site with a shareable link in about 30 seconds — no coding or payment needed.",
      },
    ],
  },
  {
    slug: "resume-website-vs-linkedin",
    title: "Resume Website vs LinkedIn: Which Do You Need? (2026)",
    description:
      "Resume website or LinkedIn? They do different jobs. Compare control, design, SEO, and reach — and learn why the strongest move is using both together.",
    date: "2026-04-16",
    dateModified: "2026-06-19",
    readTime: "7 min read",
    category: "Comparison",
    keywords: [
      "resume website vs linkedin",
      "personal website vs linkedin",
      "linkedin alternative",
      "resume site or linkedin",
      "do i need a website if i have linkedin",
    ],
    faq: [
      {
        q: "Do I need a resume website if I have LinkedIn?",
        a: "They serve different goals. LinkedIn gives you reach and recruiter discovery; a resume website gives you control, custom design, analytics, and a chance to rank in Google for your own name. Most professionals benefit from both.",
      },
      {
        q: "Can my resume website rank above my LinkedIn for my name?",
        a: "Often, yes. A personal site with your name in the domain, title, and headings can outrank a LinkedIn profile for your name over time, especially as it earns visits and links.",
      },
      {
        q: "Which should recruiters get — my LinkedIn or my website?",
        a: "Share both. Use LinkedIn to connect and be discovered, and send your resume website when someone wants the full, curated story of your work.",
      },
    ],
  },
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
    title: "7 Best Free Resume Website Builders (2026)",
    description:
      "We compared 7 resume website builders (clickfolio.me, Standard Resume, Carrd, Super.so, Reactive Resume, JSON Resume, Kickresume) on price, domains, and import.",
    date: "2026-04-25",
    dateModified: "2026-06-19",
    readTime: "11 min read",
    category: "Comparison",
    keywords: [
      "best resume website builder",
      "resume website builders",
      "free portfolio website",
      "resume to website tools",
      "online cv builder",
    ],
    faq: [
      {
        q: "What is the best free resume website builder?",
        a: "For turning an existing resume into a hosted website fast, clickfolio.me is the best free option — it parses your PDF with AI and publishes a site with a custom @handle URL in about 30 seconds, free forever. Carrd is cheaper for hand-built one-page sites but doesn't import your resume.",
      },
      {
        q: "Are resume website builders actually free?",
        a: "Some are. clickfolio.me is free forever for hosting and core features. Many tools advertise 'free' but paywall custom URLs, branding removal, or custom domains — for example, Carrd requires a paid plan ($19/yr) for a custom domain.",
      },
      {
        q: "Do I need a custom domain for my resume website?",
        a: "Not to start. A clean hosted URL like clickfolio.me/@yourname is professional enough for applications and LinkedIn. A custom domain is a nice upgrade later, but it isn't required to look credible.",
      },
    ],
  },
  {
    slug: "clickfolio-templates-showcase",
    title: "clickfolio.me Templates: Complete Showcase & Guide",
    description:
      "Explore all 12 resume templates — from Minimalist Editorial to Bold Corporate. Find the perfect design for your profession.",
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
    title: "LinkedIn to Portfolio Website in 30 Seconds",
    description:
      "Turn your LinkedIn profile into a free portfolio website you own: save it as a PDF, upload it, and go live at clickfolio.me/@you in about 30 seconds.",
    date: "2026-04-19",
    dateModified: "2026-06-19",
    readTime: "7 min read",
    category: "How-To",
    keywords: [
      "linkedin to portfolio",
      "linkedin to website",
      "personal portfolio website",
      "linkedin alternative",
      "own your online presence",
    ],
    faq: [
      {
        q: "How do I turn my LinkedIn profile into a website?",
        a: "Export your LinkedIn profile as a PDF (More → Save to PDF), then upload it to clickfolio.me. The AI reads your experience, education, and skills and rebuilds them as a hosted website at clickfolio.me/@yourname in about 30 seconds.",
      },
      {
        q: "Is a portfolio website better than LinkedIn?",
        a: "They do different jobs. LinkedIn is for networking and recruiter discovery; a portfolio website is land you own, with full control over design, URL, and analytics. The strongest approach is using both together.",
      },
      {
        q: "Can a portfolio website rank on Google for my name?",
        a: "Yes. A site with your name in the URL, title, and headings can rank for your name and build its own authority over time — something a LinkedIn profile on a shared domain can't do for you.",
      },
    ],
  },
  {
    slug: "pdf-resume-vs-portfolio",
    title: "PDF Resume vs Portfolio Website: Which to Use?",
    description:
      "Use a PDF resume for ATS portals, email, and formal applications, and a portfolio website for LinkedIn, social links, and Google. Here's how to pair them.",
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
  {
    slug: "creddle-alternatives",
    title: "Creddle Alternatives After Shutdown (2026)",
    description:
      "Creddle shut down on December 1, 2024. Here are the closest free replacements for its web resume and PDF, plus how to move your resume somewhere new.",
    date: "2026-09-25",
    readTime: "7 min read",
    category: "Comparison",
    keywords: [
      "creddle alternative",
      "creddle shut down",
      "resume builder like creddle",
      "creddle replacement",
      "free web resume builder",
    ],
    faq: [
      {
        q: "Did Creddle shut down?",
        a: "Yes. According to Creddle's archived shutdown notice, the service closed on December 1, 2024. The notice says data export had closed and that all user data would be deleted in 2025.",
      },
      {
        q: "Can I still export my Creddle resume?",
        a: "Not as far as we can tell. The archived notice says data export closed, and creddle.io refused connections when we checked in September 2026. If you have an old PDF from Creddle, use that; otherwise rebuild from another resume or a LinkedIn Save to PDF export.",
      },
      {
        q: "What is the best free alternative to Creddle?",
        a: "For Creddle's free hosted web resume, clickfolio.me is the closest match: upload a resume PDF and get a page at clickfolio.me/@handle in about 30 seconds, free. For a free PDF resume, Reactive Resume is open source and Standard Resume has a free Basic plan.",
      },
      {
        q: "Does clickfolio.me support custom domains or PDF export?",
        a: "Not yet. Sites live at clickfolio.me/@handle, and custom domains are on the roadmap. clickfolio.me builds your site from a PDF you already have rather than designing a PDF for you, so keep your resume PDF in a separate file or tool.",
      },
    ],
  },
  {
    slug: "designfolio-alternatives",
    title: "Designfolio Alternatives: 8 Options (2026)",
    description:
      "Compare 8 Designfolio (designfolio.me) alternatives for designers and PMs, with pricing as of September 2026, plus a free way to turn your resume into a site.",
    date: "2026-09-25",
    readTime: "8 min read",
    category: "Comparison",
    keywords: [
      "designfolio alternative",
      "designfolio",
      "designfolio pricing",
      "is designfolio free",
      "portfolio like designfolio",
    ],
    faq: [
      {
        q: "Is Designfolio free?",
        a: "Designfolio (designfolio.me) has a free plan with 2 case studies, 1 project, starter templates, and Designfolio branding, but no analytics or custom domain. As of September 2026, Pro costs $12/month, $29/quarter, or $69 one-time.",
      },
      {
        q: "What is the best alternative to Designfolio?",
        a: "For long-form UX case studies, UXfolio is the closest match. For full design control, Framer or Webflow. For a free site built from your existing resume, clickfolio.me turns a PDF into a live page in about 30 seconds.",
      },
      {
        q: "Is Designfolio or clickfolio.me better for designers?",
        a: "Designfolio is better if you need long-form case studies, Figma embeds, password-protected NDA work, or a custom domain. clickfolio.me is better if you want a free site generated from your resume without writing new content. It has no case-study editor and no custom domains yet.",
      },
      {
        q: "Is designfolio.me the same as designfolio.co?",
        a: 'No. designfolio.me is a portfolio and case-study builder for designers and PMs. designfolio.co is an unrelated design-news site, and "Designfolio" is also the name of some Framer, Webflow, and WordPress templates.',
      },
    ],
  },
  {
    slug: "linkfolio-alternatives",
    title: "Linkfolio Alternatives: Resume Sites (2026)",
    description:
      "Comparing linkfolio.net and linkfolio.cv with clickfolio.me, Butternut AI, Fastfolio and others on price, custom domains and resume import, as of Sept 2026.",
    date: "2026-09-25",
    readTime: "7 min read",
    category: "Comparison",
    keywords: [
      "linkfolio alternatives",
      "linkfolio ai alternative",
      "linkfolio.net alternative",
      "linkfolio.cv alternative",
      "ai resume to portfolio website",
    ],
    faq: [
      {
        q: "Is Linkfolio free?",
        a: "linkfolio.net has a free plan with a .linkfolio.net subdomain and a watermark; its paid plans cost €4.99 and €9.99 per month as of September 2026. linkfolio.cv says it is free forever.",
      },
      {
        q: "Does Linkfolio support custom domains?",
        a: "linkfolio.net supports connecting a custom domain on its Basic plan and above. linkfolio.cv's homepage doesn't mention custom domains; its URLs look like linkfolio.cv/yourname.",
      },
      {
        q: "Is Linkfolio AI the same as the LinkFolio Chrome extension?",
        a: "No. The LinkFolio AI Chrome extension is a new-tab dashboard for bookmarks and AI chatbot shortcuts. linkfolio.net is a separate AI portfolio builder that turns a resume into a website.",
      },
      {
        q: "What is the best free Linkfolio alternative?",
        a: "If you want a resume website with no watermark and no paid tier, clickfolio.me turns your PDF resume or LinkedIn PDF export into a hosted site in about 30 seconds. It doesn't support custom domains yet.",
      },
    ],
  },
  {
    slug: "ai-portfolio-website-builders",
    title: "Best AI Portfolio Website Builders (2026)",
    description:
      "AI tools that turn your resume PDF or LinkedIn into a portfolio website, compared on input, free tier, custom domain, and price as of September 2026.",
    date: "2026-09-25",
    readTime: "8 min read",
    category: "Comparison",
    keywords: [
      "ai portfolio website builder",
      "resume to portfolio ai",
      "turn resume into website ai",
      "linkedin to portfolio ai",
      "free ai portfolio generator",
    ],
    faq: [
      {
        q: "Is there a free AI tool that turns my resume into a portfolio website?",
        a: "Yes. As of September 2026, clickfolio.me, Butternut AI, linkfolio.net and Artfolio all let you publish a portfolio built from your resume on a free plan. clickfolio.me is free for everything, including all 12 templates, and publishes at clickfolio.me/@handle in about 30 seconds.",
      },
      {
        q: "Can AI build a portfolio website from my LinkedIn profile?",
        a: "Some tools accept LinkedIn input directly, including Fastfolio, Kickresume and Standard Resume. The more reliable route is LinkedIn's Save to PDF export: upload that PDF to a resume-to-website tool like clickfolio.me and the AI reads it like any other resume.",
      },
      {
        q: "Which AI portfolio builders support a custom domain?",
        a: "As of September 2026, linkfolio.net (Basic, €4.99/month), Fastfolio (Pro, $8/month, or the $49 Lifetime plan) and Butternut AI (Pro, $12/month) support custom domains on paid plans. clickfolio.me does not support custom domains yet.",
      },
      {
        q: "How accurate is AI resume parsing in these tools?",
        a: "It is usually good on simple single-column PDFs and less reliable with multi-column layouts, unusual date formats or scanned images. Always review every section before sharing the link, and rewrite any AI-generated bio in your own words.",
      },
    ],
  },
  {
    slug: "consultant-portfolio-website",
    title: "Consultant Portfolio Website: A 2026 Guide",
    description:
      "What a consultant portfolio website should prove, which sections to include, how to write NDA-safe engagement summaries, and how to publish one from a resume.",
    date: "2026-09-25",
    readTime: "8 min read",
    category: "Guide",
    keywords: [
      "consultant portfolio website",
      "consultant resume website",
      "consulting portfolio examples",
      "portfolio for consultants",
      "independent consultant website",
    ],
    faq: [
      {
        q: "What should a consultant portfolio website include?",
        a: "A positioning headline, a short summary, three to six engagement summaries (problem, approach, outcome), the industries and functions you serve, an experience timeline, credentials, and a way to contact you. Keep it to one scannable page.",
      },
      {
        q: "How do I show client work that is under an NDA?",
        a: "Anonymize clients by industry, size, and region, state results as ranges or percentages you can personally verify, make your exact role clear, and check your contract. Only name a client if they have agreed in writing.",
      },
      {
        q: "Does a consultant need a custom domain?",
        a: "Not for job hunting or contract roles, where a clickfolio.me/@handle link works well. If you invoice clients, your own domain helps with email and credibility. clickfolio.me does not offer custom domains yet, so pair your own domain with a clickfolio.me profile for now.",
      },
      {
        q: "Can I hide my phone number and address on a consultant portfolio?",
        a: "Yes. clickfolio.me has field-level privacy toggles, so you can hide your phone number and address while keeping your engagements, credentials, and email public.",
      },
      {
        q: "How fast can I build a consultant portfolio from my resume?",
        a: "Upload your consulting CV or a LinkedIn Save to PDF export to clickfolio.me and the AI builds a live site in about 30 seconds. You can then rewrite engagement summaries, set privacy, and pick one of 12 free templates.",
      },
    ],
  },
];

export function getPostBySlug(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function buildBlogPostMetadata(post: BlogPostMeta): Metadata {
  return {
    ...buildPublicPageMetadata({
      title: post.title,
      ogTitle: `${post.title} | ${siteConfig.fullName}`,
      description: post.description,
      path: `/blog/${post.slug}`,
      ogType: "article",
    }),
    robots: { index: true, follow: true },
  };
}
