import { PersonCard } from "@clickfolio/ui";

const jane = {
  handle: "janedoe",
  role: "senior",
  previewName: "Jane Doe",
  previewHeadline: "Senior Product Designer at Linear",
  previewLocation: "Austin, TX",
  previewExpCount: 4,
  previewEduCount: 1,
  previewSkills: ["Figma", "Design Systems", "Prototyping", "User Research", "Accessibility", "React"],
};

const marcus = {
  handle: "marcuschen",
  role: "mid_level",
  previewName: "Marcus Chen",
  previewHeadline: "Backend Engineer · Go, Postgres, Kubernetes",
  previewLocation: "Seattle, WA",
  previewExpCount: 3,
  previewEduCount: 2,
  previewSkills: ["Go", "PostgreSQL", "Kubernetes"],
};

const priya = {
  handle: "priyaraman",
  role: "entry_level",
  previewName: "Priya Raman",
  previewHeadline: "Data Analyst",
  previewLocation: "Toronto, ON",
  previewExpCount: 1,
  previewEduCount: 1,
  previewSkills: ["SQL", "Python", "Tableau", "dbt"],
};

const sofia = {
  handle: "sofiamartinez",
  role: "manager",
  previewName: "Sofia Martinez",
  previewHeadline: "Engineering Manager, Payments at Stripe",
  previewLocation: "New York, NY",
  previewExpCount: 6,
  previewEduCount: 2,
  previewSkills: ["Team Leadership", "Distributed Systems", "Hiring", "Ruby"],
};

export const DirectoryGrid = () => (
  <div className="grid grid-cols-2 gap-6" style={{ width: 640 }}>
    <PersonCard person={jane} />
    <PersonCard person={marcus} />
    <PersonCard person={priya} />
    <PersonCard person={sofia} />
  </div>
);

export const Single = () => (
  <div className="grid grid-cols-1" style={{ width: 340 }}>
    <PersonCard person={jane} />
  </div>
);

export const MinimalProfile = () => (
  <div className="grid grid-cols-1" style={{ width: 340 }}>
    <PersonCard
      person={{
        handle: "alexkim",
        role: null,
        previewName: "Alex Kim",
        previewHeadline: null,
        previewLocation: null,
        previewExpCount: 0,
        previewEduCount: null,
        previewSkills: null,
      }}
    />
  </div>
);
