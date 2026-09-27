import { Badge, Button, FormSectionCard, Input, Label, Textarea } from "@clickfolio/ui";
import { Briefcase, Plus, User, Wrench } from "lucide-react";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 640 }}>{children}</div>
);

export const BasicInformation = () => (
  <Frame>
    <FormSectionCard
      icon={User}
      title="Basic Information"
      description="Your name, headline, and professional summary"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="full-name">Full name</Label>
            <Input id="full-name" defaultValue="Jane Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="headline">Headline</Label>
            <Input id="headline" defaultValue="Senior Product Designer" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="summary">Summary</Label>
          <Textarea
            id="summary"
            rows={3}
            defaultValue="Product designer with 8 years shaping B2B SaaS tools at Figma and Linear. I turn messy workflows into calm, fast interfaces."
          />
        </div>
      </div>
    </FormSectionCard>
  </Frame>
);

export const WorkExperience = () => (
  <Frame>
    <FormSectionCard
      icon={Briefcase}
      title="Work Experience"
      description="Your professional work history"
    >
      <div className="space-y-4">
        {[
          ["Senior Product Designer", "Linear", "2022 – Present"],
          ["Product Designer", "Figma", "2018 – 2022"],
        ].map(([title, company, dates]) => (
          <div key={company} className="rounded-lg border border-border p-4">
            <p className="font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">
              {company} · {dates}
            </p>
          </div>
        ))}
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          Add experience
        </Button>
      </div>
    </FormSectionCard>
  </Frame>
);

export const SkillsNoDescription = () => (
  <Frame>
    <FormSectionCard icon={Wrench} title="Skills">
      <div className="flex flex-wrap gap-2">
        {["Figma", "Design Systems", "Prototyping", "User Research", "React", "Accessibility"].map(
          (s) => (
            <Badge key={s} variant="outline">
              {s}
            </Badge>
          ),
        )}
      </div>
    </FormSectionCard>
  </Frame>
);
