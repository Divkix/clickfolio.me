"use client";

interface RoleFilterSelectProps {
  roleFilter: string;
  roleOptions: { value: string; label: string }[];
}

export function RoleFilterSelect({ roleFilter, roleOptions }: RoleFilterSelectProps) {
  return (
    <form action="/explore" method="get">
      <select
        id="role-filter"
        name="role"
        defaultValue={roleFilter}
        onChange={(e) => (e.target as HTMLSelectElement).form?.submit()}
        className="px-3 py-2 border border-border-strong rounded-lg text-sm bg-card text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-border-strong"
      >
        {roleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </form>
  );
}
