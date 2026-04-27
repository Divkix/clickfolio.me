import { FAQ_ITEMS } from "@/lib/config/faq";

export function FAQSection() {
  return (
    <section className="mt-16 lg:mt-20">
      <div className="flex items-center gap-4 mb-8">
        <h2 className="font-black text-2xl sm:text-3xl text-ink">FAQ</h2>
        <div className="flex-1 h-1 bg-ink" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FAQ_ITEMS.map((faq, index) => (
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
