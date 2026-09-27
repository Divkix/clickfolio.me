import { CommaArrayInput, Label } from "@clickfolio/ui";
import { useState } from "react";

export const Filled = () => {
  const [skills, setSkills] = useState(["Figma", "Design systems", "Prototyping", "User research"]);
  return (
    <div className="flex flex-col gap-2 max-w-md">
      <Label htmlFor="skills">Skills</Label>
      <CommaArrayInput value={skills} onChange={setSkills} placeholder="React, TypeScript, Node.js" />
      <p className="text-xs text-muted-foreground">Separate items with commas.</p>
    </div>
  );
};

export const Empty = () => {
  const [tech, setTech] = useState<string[]>([]);
  return (
    <div className="flex flex-col gap-2 max-w-md">
      <Label htmlFor="tech">Technologies</Label>
      <CommaArrayInput value={tech} onChange={setTech} placeholder="React, TypeScript, Node.js" />
    </div>
  );
};
