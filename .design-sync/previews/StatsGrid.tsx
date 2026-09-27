import { StatsGrid } from "@clickfolio/ui";

export const WithProgress = () => (
  <div className="max-w-3xl">
    <StatsGrid
      stats={[
        { value: "100%", label: "Names — reliably extracted every time", percentage: 100 },
        { value: "98%", label: "Contact info — email, phone, location", percentage: 98 },
        { value: "93%", label: "Experience — job titles, dates, bullets", percentage: 93 },
        { value: "90%", label: "Skills — comma-separated lists work best", percentage: 90 },
      ]}
    />
  </div>
);

export const ValuesOnly = () => (
  <div className="max-w-3xl">
    <StatsGrid
      stats={[
        { value: "<60s", label: "From PDF upload to live portfolio" },
        { value: "12", label: "Free templates to choose from" },
      ]}
    />
  </div>
);

export const SingleColumn = () => (
  <div className="max-w-md">
    <StatsGrid
      columns={1}
      stats={[
        { value: "97%", label: "Education — schools, degrees, dates", percentage: 97 },
        { value: "92%", label: "Languages — proficiency levels", percentage: 92 },
      ]}
    />
  </div>
);
