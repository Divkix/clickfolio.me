export function FAQSection() {
  const faqs = [
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

  return (
    <section className="mt-16 lg:mt-20">
      <div className="flex items-center gap-4 mb-8">
        <h2 className="font-black text-2xl sm:text-3xl text-ink">FAQ</h2>
        <div className="flex-1 h-1 bg-ink" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {faqs.map((faq, index) => (
          <div
            key={faq.q}
            className="bg-white border-3 border-ink p-6 shadow-brutal-sm hover-brutal-shift animate-fade-in-up"
            style={{ animationDelay: `${(index + 1) * 100}ms` }}
          >
            <h3 className="font-black text-lg text-ink mb-2">{faq.q}</h3>
            <p className="text-[#6B6B6B] leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
