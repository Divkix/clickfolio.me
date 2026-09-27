import { Button } from "@clickfolio/ui";
import { ArrowRight, Download, Trash2, Upload } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>Publish portfolio</Button>
    <Button variant="outline">Preview</Button>
    <Button variant="secondary">Save draft</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="link">View live site</Button>
    <Button variant="destructive">Delete account</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="sm">Small</Button>
    <Button>Default</Button>
    <Button size="lg">
      Get started <ArrowRight />
    </Button>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>
      <Upload /> Upload resume
    </Button>
    <Button variant="outline">
      <Download /> Download PDF
    </Button>
    <Button variant="outline" size="icon" aria-label="Delete">
      <Trash2 />
    </Button>
  </div>
);

export const States = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button loading>Publishing…</Button>
    <Button disabled>Disabled</Button>
    <Button variant="outline" disabled>
      Disabled outline
    </Button>
  </div>
);
