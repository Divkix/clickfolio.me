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
  {
    q: "What file formats can I upload?",
    a: "We accept PDF resumes up to 5 MB. PDFs give the most reliable parsing because the text and layout are preserved. If your resume lives in Word or Google Docs, export it to PDF first and upload that.",
  },
  {
    q: "Is my data private and secure?",
    a: "Your resume is processed securely and never sold or shared. You decide what appears publicly through granular privacy settings, and you can delete your account and all associated data permanently at any time from Settings.",
  },
  {
    q: "Do I need an account to try it?",
    a: "You can upload a resume and watch it get parsed before signing up. To claim your @handle, publish your portfolio, and edit it later, you'll create a free account with Google or email.",
  },
  {
    q: "How do I unlock premium templates?",
    a: "Share your portfolio link with others through the built-in referral system. As people visit through your link, you unlock the 4 premium templates — no payment required.",
  },
  {
    q: "Can I use my own custom domain?",
    a: "Every portfolio gets a clean clickfolio.me/@handle URL that's yours to share. Custom domain support is on our roadmap; follow along for updates.",
  },
];
