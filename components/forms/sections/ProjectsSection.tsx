import { FolderCode, Plus, Trash2 } from "lucide-react";
import { FormSectionCard } from "@/components/forms/FormSectionCard";
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
import { FormEmptyState } from "./FormEmptyState";

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
    <FormSectionCard
      icon={FolderCode}
      title="Projects"
      description="Personal projects, side work, or portfolio pieces (max 10)"
    >
      <div className="space-y-4">
        {projectFields.length === 0 ? (
          <FormEmptyState
            icon={FolderCode}
            title="No projects added yet"
            description="Showcase your personal projects and portfolio pieces"
            onAdd={() =>
              appendProject({
                title: "",
                description: "",
                year: "",
                technologies: [],
                url: "",
                image_url: "",
              })
            }
            addLabel="Add Your First Project"
          />
        ) : (
          <>
            {projectFields.map((field, index) => (
              <div
                key={field.id}
                className="bg-surface-2 rounded-xl border border-border p-5 hover:border-border-strong transition-colors duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-brand-subtle p-1.5 rounded-md">
                      <FolderCode className="h-3.5 w-3.5 text-brand" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Project {index + 1}</span>
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
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
                          Project Title <span className="text-destructive">*</span>
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
                          Description <span className="text-destructive">*</span>
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
              className="w-full border-dashed"
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
    </FormSectionCard>
  );
}
