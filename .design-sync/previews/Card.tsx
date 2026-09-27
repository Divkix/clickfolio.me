import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@clickfolio/ui";

export const Basic = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Your portfolio is live</CardTitle>
      <p className="text-sm text-muted-foreground">clickfolio.me/@janedoe</p>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Share your link on LinkedIn, in your email signature, or anywhere recruiters look.
      </p>
    </CardContent>
  </Card>
);

export const WithActions = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <div className="flex items-center justify-between gap-2">
        <CardTitle>Resume</CardTitle>
        <Badge variant="success">Parsed</Badge>
      </div>
      <p className="text-sm text-muted-foreground">jane-doe-resume.pdf · uploaded 2 days ago</p>
    </CardHeader>
    <CardContent className="flex gap-2">
      <Button size="sm">Edit content</Button>
      <Button size="sm" variant="outline">
        Replace PDF
      </Button>
    </CardContent>
  </Card>
);

export const StatTiles = () => (
  <div className="grid grid-cols-3 gap-4 max-w-xl">
    {[
      ["Views", "1,284"],
      ["Visitors", "932"],
      ["Link clicks", "117"],
    ].map(([label, value]) => (
      <Card key={label} className="gap-2 py-4">
        <CardContent className="px-4">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-semibold">{value}</p>
        </CardContent>
      </Card>
    ))}
  </div>
);
