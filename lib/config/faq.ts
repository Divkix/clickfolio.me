import { TEMPLATE_COUNT } from "@/lib/templates/theme-ids";

export interface FAQItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    q: "What is clickfolio.me?",
    a: "clickfolio.me turns your PDF resume into a hosted web portfolio in seconds. Upload your resume, and our AI parses it into a professional website with a custom @handle URL — free forever.",
  },
  {
    q: "How does the AI resume parsing work?",
    a: "After you sign in, we send your resume content (extracted text, or the PDF for scanned documents) to AI models through OpenRouter and Cloudflare AI Gateway to extract work experience, education, skills, projects, and contact info. Parsing takes about 30 seconds. Review and edit the result before publishing.",
  },
  {
    q: "Is clickfolio.me really free?",
    a: `Yes. Publishing, editing, hosting and all ${TEMPLATE_COUNT} templates are free, with no trial, paid tier or premium locks. Public pages include a small “Built with clickfolio.me” link.`,
  },
  {
    q: "Can I customize my portfolio after publishing?",
    a: `Absolutely. You get a full editing suite to update your content anytime. Changes auto-save and publish instantly. You can also switch between ${TEMPLATE_COUNT} templates, control what's visible via privacy settings, and update your @handle.`,
  },
  {
    q: "What file formats can I upload?",
    a: "We accept PDF resumes up to 5 MB. PDFs give the most reliable parsing because the text and layout are preserved. If your resume lives in Word or Google Docs, export it to PDF first and upload that.",
  },
  {
    q: "Is my data private and secure?",
    a: "We never sell your resume. We share it only with the service providers needed to run the service, including AI parsing, storage and sign-in; see our Privacy Policy at /privacy for details. Published pages are public, listed in Explore and visible to search engines by default. You can change visibility in Settings and delete your account, resume and uploads. Diagnostics are deleted automatically within 90 days, even if you delete your account.",
  },
  {
    q: "Can I use my LinkedIn profile instead of a resume?",
    a: "Yes. On LinkedIn's desktop site, open your profile, click More (or Resources), choose Save to PDF, and upload that file here. We recognize LinkedIn exports and import your experience, education, and certifications. LinkedIn only exports your top skills and no projects, so add those in the editor afterwards.",
  },
  {
    q: "Do I need an account to try it?",
    a: "You can upload a resume without an account. A free account with Google or email is required to parse it, review the result, choose your @handle and publish your portfolio.",
  },
  {
    q: "How do I unlock premium templates?",
    a: `All ${TEMPLATE_COUNT} templates are free for every user — no unlocking, no referrals, and no payment required. Just pick any template and publish.`,
  },
  {
    q: "Can I use my own custom domain?",
    a: "Every portfolio gets a clean clickfolio.me/@handle URL that's yours to share. Custom domain support is on our roadmap; follow along for updates.",
  },
];
