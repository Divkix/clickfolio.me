import { NoResults } from "@clickfolio/ui";

export const WithRoleFilter = () => (
  <div style={{ width: 720 }}>
    <NoResults roleFilter="executive" />
  </div>
);

export const NoFilter = () => (
  <div style={{ width: 720 }}>
    <NoResults roleFilter="" />
  </div>
);
