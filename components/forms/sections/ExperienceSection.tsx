import { Briefcase, List, Plus, Trash2, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ResumeContentFormData } from "@/lib/schemas/resume";

interface ExperienceSectionProps {
  form: UseFormReturn<ResumeContentFormData>;
}

export function ExperienceSection({ form }: ExperienceSectionProps) {
  const {
    fields: experienceFields,
    append: appendExperience,
    remove: removeExperience,
  } = useFieldArray({
    control: form.control,
    name: "experience",
  });

  return (
    <div className="bg-card rounded-xl shadow-sm border border-ink/10 p-6 hover:shadow-md transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-linear-to-r from-emerald-500 to-teal-500 rounded-lg blur-md opacity-20" />
          <div className="relative bg-linear-to-r from-emerald-100 to-teal-100 p-2.5 rounded-lg">
            <Briefcase className="h-5 w-5 text-emerald-600" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Work Experience</h2>
          <p className="text-sm text-muted-foreground">Your professional work history</p>
        </div>
      </div>
      <div className="space-y-4">
        {experienceFields.length === 0 ? (
          <div className="text-center py-8 px-4 bg-muted/50 rounded-xl border border-dashed border-ink/15">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-linear-to-r from-emerald-500 to-teal-500 rounded-xl blur-lg opacity-15" />
              <div className="relative bg-linear-to-r from-emerald-100 to-teal-100 p-4 rounded-xl">
                <Briefcase className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <p className="text-muted-foreground font-medium mb-1">No work experience yet</p>
            <p className="text-sm text-muted-foreground mb-4">Add your professional work history</p>
            <Button
              type="button"
              className="bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-sm hover:shadow-md"
              onClick={() =>
                appendExperience({
                  title: "",
                  company: "",
                  location: "",
                  start_date: "",
                  end_date: "",
                  description: "",
                  highlights: [],
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Experience
            </Button>
          </div>
        ) : (
          <>
            {experienceFields.map((field, index) => (
              <div
                key={field.id}
                className="bg-muted/50 rounded-xl border border-ink/10 p-5 hover:border-ink/25 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-linear-to-r from-emerald-100 to-teal-100 p-1.5 rounded-md">
                      <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span className="text-sm font-medium text-foreground/80">
                      Position {index + 1}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to remove this item?")) {
                        removeExperience(index);
                      }
                    }}
                    className="text-muted-foreground/70 hover:text-coral hover:bg-coral/10 transition-colors"
                    aria-label={`Remove experience ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`experience.${index}.title`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Senior Software Engineer" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`experience.${index}.company`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input placeholder="Tech Corp" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name={`experience.${index}.location`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="San Francisco, CA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`experience.${index}.start_date`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input placeholder="Jan 2020" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`experience.${index}.end_date`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input placeholder="Present" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-4">
                  <FormField
                    control={form.control}
                    name={`experience.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your key responsibilities and achievements..."
                            className="min-h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {field.value?.length || 0}/2000 characters
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Highlights Section */}
                <div className="mt-4">
                  <FormField
                    control={form.control}
                    name={`experience.${index}.highlights`}
                    render={({ field }) => {
                      const highlights = field.value || [];
                      return (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <List className="h-4 w-4" />
                            Key Achievements (Optional)
                          </FormLabel>
                          <FormDescription className="mb-2">
                            Add bullet points highlighting your key accomplishments
                          </FormDescription>
                          <div className="space-y-2">
                            {highlights.map((highlight: string, hIndex: number) => (
                              <div key={hIndex} className="flex gap-2">
                                <Input
                                  value={highlight}
                                  onChange={(e) => {
                                    const newHighlights = [...highlights];
                                    newHighlights[hIndex] = e.target.value;
                                    field.onChange(newHighlights);
                                  }}
                                  placeholder="e.g., Increased sales by 25%"
                                  className="flex-1"
                                  maxLength={500}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const newHighlights = highlights.filter(
                                      (_: string, i: number) => i !== hIndex,
                                    );
                                    field.onChange(newHighlights);
                                  }}
                                  className="shrink-0 text-muted-foreground/70 hover:text-coral hover:bg-coral/10"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                field.onChange([...highlights, ""]);
                              }}
                              disabled={highlights.length >= 5}
                              className="text-xs"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Achievement
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed border-2 border-ink/20 hover:border-emerald-400 hover:bg-emerald-50/50 text-muted-foreground hover:text-emerald-700 transition-all duration-200"
              onClick={() =>
                appendExperience({
                  title: "",
                  company: "",
                  location: "",
                  start_date: "",
                  end_date: "",
                  description: "",
                  highlights: [],
                })
              }
              disabled={experienceFields.length >= 10}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Experience
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
