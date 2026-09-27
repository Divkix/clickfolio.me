import { Badge, Card, CardContent, CardHeader, CardTitle } from "@clickfolio/ui";

export const TitleAndDescription = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Privacy</CardTitle>
      <p className="text-sm text-muted-foreground">Control what visitors see on your portfolio.</p>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">Phone and address are hidden by default.</p>
    </CardContent>
  </Card>
);

export const WithBadge = () => (
  <Card className="max-w-sm">
    <CardHeader className="border-b">
      <div className="flex items-center justify-between gap-2">
        <CardTitle>Resume</CardTitle>
        <Badge variant="success">Parsed</Badge>
      </div>
      <p className="text-sm text-muted-foreground">jane-doe-resume.pdf · 2 pages</p>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">Last updated 2 days ago.</p>
    </CardContent>
  </Card>
);
