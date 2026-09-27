import { ComparisonTable } from "@clickfolio/ui";

export const PricingComparison = () => (
  <div className="max-w-4xl bg-card p-6">
    <ComparisonTable
      headers={["Tool", "Starts from", "Free plan", "Paid plans", "Custom domain"]}
      rows={[
        ["linkfolio.net", "Resume upload, chat, or voice", "Yes, subdomain with watermark", "€4.99/mo Basic, €9.99/mo Pro", "Yes, Basic and up"],
        ["linkfolio.cv", "Resume (PDF, DOCX, TXT)", "Yes, up to 5 portfolios", "None listed", "Not mentioned"],
        ["clickfolio.me", "PDF resume or LinkedIn PDF export", "Yes, everything free, 12 templates", "None", "Not yet (on the roadmap)"],
        ["Butternut AI", "Resume/CV PDF", "Yes, 20 AI credits", "$5/mo Starter, $12/mo Pro", "Pro only"],
      ]}
    />
  </div>
);

export const TwoColumn = () => (
  <div className="max-w-xl bg-card p-6">
    <ComparisonTable
      headers={["Feature", "clickfolio.me"]}
      rows={[
        ["Time to publish", "Under 60 seconds"],
        ["Templates", "12 free themes"],
        ["Hosted URL", "clickfolio.me/@janedoe"],
        ["Price", "Free"],
      ]}
    />
  </div>
);
