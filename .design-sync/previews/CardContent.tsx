import { Button, Card, CardContent, CardHeader, CardTitle } from "@clickfolio/ui";

export const Text = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>About</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Senior Product Designer at Linear. Previously led design systems at Stripe. Based in
        Brooklyn, NY.
      </p>
    </CardContent>
  </Card>
);

export const Rows = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Experience</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {[
        ["Senior Product Designer", "Linear · 2022 – Present"],
        ["Product Designer", "Stripe · 2019 – 2022"],
        ["UX Designer", "Shopify · 2017 – 2019"],
      ].map(([role, meta]) => (
        <div key={role}>
          <p className="text-sm font-medium">{role}</p>
          <p className="text-xs text-muted-foreground">{meta}</p>
        </div>
      ))}
      <Button size="sm" variant="outline">
        Edit experience
      </Button>
    </CardContent>
  </Card>
);
