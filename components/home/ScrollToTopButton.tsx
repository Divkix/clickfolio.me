"use client";

export function ScrollToTopButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="
                    inline-block
                    bg-ink
                    text-cream
                    font-black
                    text-lg
                    px-8
                    py-4
                    border-3
                    border-cream
                    shadow-[5px_5px_0px_#eff6ff]
                    hover:-translate-x-0.5
                    hover:-translate-y-0.5
                    hover:shadow-[7px_7px_0px_#eff6ff]
                    active:translate-x-0
                    active:translate-y-0
                    active:shadow-[3px_3px_0px_#eff6ff]
                    transition-all
                    duration-150
                  "
    >
      Upload your resume →
    </button>
  );
}
