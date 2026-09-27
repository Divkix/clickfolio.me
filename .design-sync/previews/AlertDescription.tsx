import { Alert, AlertDescription } from "@clickfolio/ui";
import { Info, TriangleAlert } from "lucide-react";

export const InAlert = () => (
  <Alert variant="info" className="max-w-lg">
    <Info />
    <AlertDescription>
      Your portfolio updates automatically after you save changes in the editor.
    </AlertDescription>
  </Alert>
);

export const MultiParagraph = () => (
  <Alert variant="warning" className="max-w-lg">
    <TriangleAlert />
    <AlertDescription>
      <p>Changing your handle breaks links to clickfolio.me/@janedoe.</p>
      <p>Old links keep working for 90 days, then redirect to your homepage.</p>
    </AlertDescription>
  </Alert>
);
