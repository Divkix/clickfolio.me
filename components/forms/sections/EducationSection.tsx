import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { FormSectionCard } from "@/components/forms/FormSectionCard";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ResumeContentFormData } from "@/lib/schemas/resume";

interface EducationSectionProps {
  form: UseFormReturn<ResumeContentFormData>;
}

export function EducationSection({ form }: EducationSectionProps) {
  const {
    fields: educationFields,
    append: appendEducation,
    remove: removeEducation,
  } = useFieldArray({
    control: form.control,
    name: "education",
  });

  return (
    <FormSectionCard
      icon={GraduationCap}
      title="Education"
      description="Your educational background"
    >
      <div className="space-y-4">
        {educationFields.length === 0 ? (
          <div className="text-center py-8 px-4 bg-surface-2 rounded-xl border border-dashed border-border">
            <div className="inline-flex mb-4 bg-brand-subtle p-4 rounded-xl">
              <GraduationCap className="h-8 w-8 text-brand" />
            </div>
            <p className="text-foreground font-medium mb-1">No education entries yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add your educational background to complete your profile
            </p>
            <Button
              type="button"
              onClick={() =>
                appendEducation({
                  degree: "",
                  institution: "",
                  location: "",
                  graduation_date: "",
                  gpa: "",
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Education
            </Button>
          </div>
        ) : (
          <>
            {educationFields.map((field, index) => (
              <div
                key={field.id}
                className="bg-surface-2 rounded-xl border border-border p-5 hover:border-border-strong transition-colors duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-brand-subtle p-1.5 rounded-md">
                      <GraduationCap className="h-3.5 w-3.5 text-brand" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      Education {index + 1}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to remove this item?")) {
                        removeEducation(index);
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label={`Remove education ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`education.${index}.degree`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Degree</FormLabel>
                        <FormControl>
                          <Input placeholder="Bachelor of Science" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`education.${index}.institution`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Institution</FormLabel>
                        <FormControl>
                          <Input placeholder="University of Example" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name={`education.${index}.location`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Boston, MA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`education.${index}.graduation_date`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Graduation Date</FormLabel>
                        <FormControl>
                          <Input placeholder="May 2020" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`education.${index}.gpa`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GPA (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="3.8" {...field} />
                        </FormControl>
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
                appendEducation({
                  degree: "",
                  institution: "",
                  location: "",
                  graduation_date: "",
                  gpa: "",
                })
              }
              disabled={educationFields.length >= 10}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Education
            </Button>
          </>
        )}
      </div>
    </FormSectionCard>
  );
}
