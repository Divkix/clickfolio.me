import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@clickfolio/ui";

const Sample = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <div className="flex items-center justify-between gap-2">
        <CardTitle>Jane Doe</CardTitle>
        <Badge>Live</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Senior Product Designer at Linear</p>
    </CardHeader>
    <CardContent className="flex gap-2">
      <Button size="sm">View portfolio</Button>
      <Button size="sm" variant="outline">
        Edit
      </Button>
    </CardContent>
  </Card>
);

export const Light = () => (
  <div className="bg-background p-6 text-foreground">
    <Sample />
  </div>
);

export const Dark = () => (
  <div className="dark bg-background p-6 text-foreground">
    <Sample />
  </div>
);
