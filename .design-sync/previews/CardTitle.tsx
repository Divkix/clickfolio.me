import { Card, CardContent, CardHeader, CardTitle } from "@clickfolio/ui";

export const Default = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Your portfolio is live</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">clickfolio.me/@janedoe</p>
    </CardContent>
  </Card>
);

export const Display = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle className="font-display text-2xl">1,284 views</CardTitle>
      <p className="text-sm text-muted-foreground">Last 30 days</p>
    </CardHeader>
  </Card>
);
