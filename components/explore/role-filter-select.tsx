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
        className="px-3 py-2 border border-ink/15 rounded-lg text-sm bg-card focus:ring-2 focus:ring-coral focus:border-coral"
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
