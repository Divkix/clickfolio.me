import { GraduationCap, Plus, Trash2 } from "lucide-react";
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
    <div className="bg-card rounded-xl shadow-sm border border-ink/10 p-6 hover:shadow-md transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-linear-to-r from-orange-500 to-amber-500 rounded-lg blur-md opacity-20" />
          <div className="relative bg-linear-to-r from-orange-100 to-amber-100 p-2.5 rounded-lg">
            <GraduationCap className="h-5 w-5 text-orange-600" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Education</h2>
          <p className="text-sm text-muted-foreground">Your educational background</p>
        </div>
      </div>
      <div className="space-y-4">
        {educationFields.length === 0 ? (
          <div className="text-center py-8 px-4 bg-muted/50 rounded-xl border border-dashed border-ink/15">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-linear-to-r from-orange-500 to-amber-500 rounded-xl blur-lg opacity-15" />
              <div className="relative bg-linear-to-r from-orange-100 to-amber-100 p-4 rounded-xl">
                <GraduationCap className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            <p className="text-muted-foreground font-medium mb-1">No education entries yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add your educational background to complete your profile
            </p>
            <Button
              type="button"
              className="bg-linear-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-semibold shadow-sm hover:shadow-md"
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
                className="bg-muted/50 rounded-xl border border-ink/10 p-5 hover:border-ink/25 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-linear-to-r from-orange-100 to-amber-100 p-1.5 rounded-md">
                      <GraduationCap className="h-3.5 w-3.5 text-orange-600" />
                    </div>
                    <span className="text-sm font-medium text-foreground/80">
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
                    className="text-muted-foreground/70 hover:text-coral hover:bg-coral/10 transition-colors"
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
              className="w-full border-dashed border-2 border-ink/20 hover:border-orange-400 hover:bg-orange-50/50 text-muted-foreground hover:text-orange-700 transition-all duration-200"
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
    </div>
  );
}
