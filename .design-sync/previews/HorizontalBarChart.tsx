import { HorizontalBarChart } from "@clickfolio/ui";

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-card rounded-xl shadow-sm border border-border p-6" style={{ width: 520 }}>
    <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
    {children}
  </div>
);

export const TopReferrers = () => (
  <Panel title="Top Referrers">
    <HorizontalBarChart
      items={[
        { label: "linkedin.com", value: 4820, percent: 42 },
        { label: "google.com", value: 2530, percent: 22 },
        { label: "github.com", value: 1610, percent: 14 },
        { label: "twitter.com", value: 920, percent: 8 },
        { label: "news.ycombinator.com", value: 460, percent: 4 },
      ]}
    />
  </Panel>
);

export const TopCountries = () => (
  <Panel title="Top Countries">
    <HorizontalBarChart
      colorClass="bg-info"
      items={[
        { label: "United States", value: 5210, percent: 46 },
        { label: "India", value: 1930, percent: 17 },
        { label: "United Kingdom", value: 1020, percent: 9 },
        { label: "Germany", value: 790, percent: 7 },
        { label: "Canada", value: 610, percent: 5 },
      ]}
    />
  </Panel>
);

export const Devices = () => (
  <Panel title="Devices">
    <HorizontalBarChart
      colorClass="bg-success"
      items={[
        { label: "Desktop", value: 0, percent: 61 },
        { label: "Mobile", value: 0, percent: 36 },
        { label: "Tablet", value: 0, percent: 3 },
      ]}
    />
  </Panel>
);

export const Empty = () => (
  <Panel title="Top Referrers">
    <HorizontalBarChart items={[]} />
  </Panel>
);
