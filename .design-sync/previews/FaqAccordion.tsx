import { FaqAccordion } from "@clickfolio/ui";
import { useEffect, useRef } from "react";

const items = [
  {
    q: "What is clickfolio.me?",
    a: "clickfolio.me turns your PDF resume into a hosted web portfolio in seconds. Upload your resume, and our AI parses it into a professional website with a custom @handle URL — free forever.",
  },
  {
    q: "What file formats can I upload?",
    a: "We accept PDF resumes up to 5 MB. If your resume lives in Word or Google Docs, export it to PDF first and upload that.",
  },
  {
    q: "Is my data private and secure?",
    a: "Your resume is processed securely and never sold or shared. You decide what appears publicly through granular privacy settings.",
  },
];

export const Default = () => <FaqAccordion items={items} className="max-w-2xl" />;

export const FirstOpen = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("details")?.setAttribute("open", "");
  }, []);
  return (
    <div ref={ref} className="max-w-2xl">
      <FaqAccordion items={items} />
    </div>
  );
};
