import { RoleFilterSelect } from "@/components/explore/role-filter-select";

interface ExploreFiltersProps {
  roleFilter: string;
  roleOptions: { value: string; label: string }[];
  totalCount: number;
}

export function ExploreFilters({ roleFilter, roleOptions, totalCount }: ExploreFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-3">
        <label htmlFor="role-filter" className="text-sm font-medium text-foreground">
          Filter by role:
        </label>
        <RoleFilterSelect roleFilter={roleFilter} roleOptions={roleOptions} />
      </div>
      <p className="text-sm text-muted-foreground">
        {totalCount} {totalCount === 1 ? "professional" : "professionals"} listed
      </p>
    </div>
  );
}
