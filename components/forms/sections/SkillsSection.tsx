import { Plus, Trash2, Wrench } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { CommaArrayInput } from "@/components/ui/comma-array-input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ResumeContentFormData } from "@/lib/schemas/resume";

interface SkillsSectionProps {
  form: UseFormReturn<ResumeContentFormData>;
}

export function SkillsSection({ form }: SkillsSectionProps) {
  const {
    fields: skillFields,
    append: appendSkill,
    remove: removeSkill,
  } = useFieldArray({
    control: form.control,
    name: "skills",
  });

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="shrink-0 bg-brand-subtle p-2.5 rounded-lg">
          <Wrench className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Skills</h2>
          <p className="text-sm text-muted-foreground">Your technical and professional skills</p>
        </div>
      </div>
      <div className="space-y-4">
        {skillFields.length === 0 ? (
          <div className="text-center py-8 px-4 bg-surface-2 rounded-xl border border-dashed border-border">
            <div className="inline-flex mb-4 bg-brand-subtle p-4 rounded-xl">
              <Wrench className="h-8 w-8 text-brand" />
            </div>
            <p className="text-foreground font-medium mb-1">No skills added yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add your skills grouped by category
            </p>
            <Button
              type="button"
              onClick={() =>
                appendSkill({
                  category: "",
                  items: [],
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Skill Category
            </Button>
          </div>
        ) : (
          <>
            {skillFields.map((field, index) => (
              <div
                key={field.id}
                className="bg-surface-2 rounded-xl border border-border p-5 hover:border-border-strong transition-colors duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-brand-subtle p-1.5 rounded-md">
                      <Wrench className="h-3.5 w-3.5 text-brand" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      Skill Category {index + 1}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to remove this item?")) {
                        removeSkill(index);
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label={`Remove skill group ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name={`skills.${index}.category`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder="Programming Languages" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`skills.${index}.items`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Skills (comma-separated)</FormLabel>
                        <FormControl>
                          <CommaArrayInput
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="JavaScript, TypeScript, Python"
                          />
                        </FormControl>
                        <FormDescription>Separate each skill with a comma</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={() =>
                appendSkill({
                  category: "",
                  items: [],
                })
              }
              disabled={skillFields.length >= 20}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Skill Category
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
