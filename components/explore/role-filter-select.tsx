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
        onChange={(e) => e.currentTarget.form?.submit()}
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
