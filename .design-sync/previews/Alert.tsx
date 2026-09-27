import { Alert, AlertDescription } from "@clickfolio/ui";
import { AlertCircle, CheckCircle2, Info, Sparkles, TriangleAlert } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-col gap-3 max-w-lg">
    <Alert>
      <Info />
      <AlertDescription>Your resume is private until you publish your portfolio.</AlertDescription>
    </Alert>
    <Alert variant="brand">
      <Sparkles />
      <AlertDescription>New: 2 templates added. Try Case File on your portfolio.</AlertDescription>
    </Alert>
    <Alert variant="success">
      <CheckCircle2 />
      <AlertDescription>Portfolio published at clickfolio.me/@janedoe</AlertDescription>
    </Alert>
    <Alert variant="warning">
      <TriangleAlert />
      <AlertDescription>You can change your handle 1 more time in the next 24 hours.</AlertDescription>
    </Alert>
    <Alert variant="info">
      <Info />
      <AlertDescription>Parsing usually takes under 60 seconds.</AlertDescription>
    </Alert>
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>We couldn&apos;t read this PDF. Try exporting it again.</AlertDescription>
    </Alert>
  </div>
);

export const WithHeading = () => (
  <Alert variant="destructive" className="max-w-lg">
    <AlertCircle />
    <div>
      <p className="mb-1 font-medium leading-none">Resume parsing failed</p>
      <AlertDescription>
        The file looks like a scanned image. Upload a text-based PDF, or export your LinkedIn
        profile with &quot;Save to PDF&quot;.
      </AlertDescription>
    </div>
  </Alert>
);
