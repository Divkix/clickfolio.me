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
    a: "We use advanced language models to extract your work experience, education, skills, projects, and contact info from your PDF resume. The parsing takes about 30 seconds and produces a complete, editable online portfolio.",
  },
  {
    q: "Is clickfolio.me really free?",
    a: "Yes. All 6 base templates are completely free with no time limits. You can upgrade to 4 premium templates by sharing your portfolio with others via our referral system.",
  },
  {
    q: "Can I customize my portfolio after publishing?",
    a: "Absolutely. You get a full editing suite to update your content anytime. Changes auto-save and publish instantly. You can also switch between 10 templates, control what's visible via privacy settings, and update your @handle.",
  },
];
