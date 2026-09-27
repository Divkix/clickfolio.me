import { Card, CardContent, Skeleton } from "@clickfolio/ui";

export const ProfileRow = () => (
  <div className="flex items-center gap-4 max-w-sm">
    <Skeleton className="size-12 rounded-full" />
    <div className="flex flex-1 flex-col gap-2">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-28" />
    </div>
  </div>
);

export const LoadingCard = () => (
  <Card className="max-w-sm">
    <CardContent className="flex flex-col gap-4">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-5 w-48" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </CardContent>
  </Card>
);
