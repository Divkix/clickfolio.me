import { FolderCode, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { ResumeContentFormData } from "@/lib/schemas/resume";

interface ProjectsSectionProps {
  form: UseFormReturn<ResumeContentFormData>;
}

export function ProjectsSection({ form }: ProjectsSectionProps) {
  const {
    fields: projectFields,
    append: appendProject,
    remove: removeProject,
  } = useFieldArray({
    control: form.control,
    name: "projects",
  });

  return (
    <div className="bg-card rounded-xl shadow-sm border border-ink/10 p-6 hover:shadow-md transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-linear-to-r from-violet-500 to-purple-500 rounded-lg blur-md opacity-20" />
          <div className="relative bg-linear-to-r from-violet-100 to-purple-100 p-2.5 rounded-lg">
            <FolderCode className="h-5 w-5 text-violet-600" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Personal projects, side work, or portfolio pieces (max 10)
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {projectFields.length === 0 ? (
          <div className="text-center py-8 px-4 bg-muted/50 rounded-xl border border-dashed border-ink/15">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-linear-to-r from-violet-500 to-purple-500 rounded-xl blur-lg opacity-15" />
              <div className="relative bg-linear-to-r from-violet-100 to-purple-100 p-4 rounded-xl">
                <FolderCode className="h-8 w-8 text-violet-600" />
              </div>
            </div>
            <p className="text-muted-foreground font-medium mb-1">No projects added yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Showcase your personal projects and portfolio pieces
            </p>
            <Button
              type="button"
              className="bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold shadow-sm hover:shadow-md"
              onClick={() =>
                appendProject({
                  title: "",
                  description: "",
                  year: "",
                  technologies: [],
                  url: "",
                  image_url: "",
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Project
            </Button>
          </div>
        ) : (
          <>
            {projectFields.map((field, index) => (
              <div
                key={field.id}
                className="bg-muted/50 rounded-xl border border-ink/10 p-5 hover:border-ink/25 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-linear-to-r from-violet-100 to-purple-100 p-1.5 rounded-md">
                      <FolderCode className="h-3.5 w-3.5 text-violet-600" />
                    </div>
                    <span className="text-sm font-medium text-foreground/80">
                      Project {index + 1}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to remove this item?")) {
                        removeProject(index);
                      }
                    }}
                    className="text-muted-foreground/70 hover:text-coral hover:bg-coral/10 transition-colors"
                    aria-label={`Remove project ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`projects.${index}.title`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Project Title <span className="text-coral">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="My Awesome Project" {...field} maxLength={200} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`projects.${index}.year`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input placeholder="2024 or 2023-2024" {...field} maxLength={50} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-4">
                  <FormField
                    control={form.control}
                    name={`projects.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Description <span className="text-coral">*</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the project, your role, and key achievements..."
                            className="min-h-24 resize-y"
                            {...field}
                            maxLength={2000}
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

                <div className="mt-4">
                  <FormField
                    control={form.control}
                    name={`projects.${index}.technologies`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Technologies Used</FormLabel>
                        <FormControl>
                          <CommaArrayInput
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="React, Node.js, PostgreSQL (comma-separated)"
                          />
                        </FormControl>
                        <FormDescription>
                          Comma-separated list of technologies, frameworks, or tools
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name={`projects.${index}.url`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project URL</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="https://github.com/username/project"
                            {...field}
                            maxLength={500}
                          />
                        </FormControl>
                        <FormDescription>Link to live demo or repo</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`projects.${index}.image_url`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image URL (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="https://imgur.com/screenshot.png"
                            {...field}
                            maxLength={500}
                          />
                        </FormControl>
                        <FormDescription>External image (Imgur, etc.)</FormDescription>
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
              className="w-full border-dashed border-2 border-ink/20 hover:border-violet-400 hover:bg-violet-50/50 text-muted-foreground hover:text-violet-700 transition-all duration-200"
              onClick={() =>
                appendProject({
                  title: "",
                  description: "",
                  year: "",
                  technologies: [],
                  url: "",
                  image_url: "",
                })
              }
              disabled={projectFields.length >= 10}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
