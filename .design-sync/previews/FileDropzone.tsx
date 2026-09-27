import { FileDropzone } from "@clickfolio/ui";
import { useEffect, useRef } from "react";

export const Idle = () => (
  <div className="max-w-md">
    <FileDropzone />
  </div>
);

export const Dragging = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = ref.current?.querySelector("button");
    target?.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true }));
  }, []);
  return (
    <div ref={ref} className="max-w-md">
      <FileDropzone />
    </div>
  );
};

export const InvalidFile = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = ref.current?.querySelector("button");
    const dt = new DataTransfer();
    dt.items.add(
      new File(["resume"], "jane-doe-resume.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    target?.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
    );
  }, []);
  return (
    <div ref={ref} className="max-w-md">
      <FileDropzone />
    </div>
  );
};
