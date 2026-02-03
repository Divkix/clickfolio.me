"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Award,
  Briefcase,
  FolderCode,
  GraduationCap,
  List,
  Mail,
  Plus,
  Save,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type FieldPath, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SaveIndicator, type SaveStatus } from "@/components/ui/save-indicator";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { type ResumeContentFormData, resumeContentSchemaStrict } from "@/lib/schemas/resume";
import type { ResumeContent } from "@/lib/types/database";

interface EditResumeFormProps {
  initialData: ResumeContent;
  onSave: (data: ResumeContent) => Promise<void>;
}

export function EditResumeForm({ initialData, onSave }: EditResumeFormProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Warn user about unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === "saving") {
        e.preventDefault();
        e.returnValue = "Changes are being saved. Leave anyway?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  const form = useForm<ResumeContentFormData>({
    resolver: zodResolver(resumeContentSchemaStrict),
    defaultValues: {
      ...initialData,
      // Ensure arrays are never undefined
      experience: initialData.experience || [],
      education: initialData.education || [],
      skills: initialData.skills || [],
      certifications: initialData.certifications || [],
      projects: initialData.projects || [],
    },
  });

  const {
    fields: experienceFields,
    append: appendExperience,
    remove: removeExperience,
  } = useFieldArray({
    control: form.control,
    name: "experience",
  });

  const {
    fields: educationFields,
    append: appendEducation,
    remove: removeEducation,
  } = useFieldArray({
    control: form.control,
    name: "education",
  });

  const {
    fields: skillFields,
    append: appendSkill,
    remove: removeSkill,
  } = useFieldArray({
    control: form.control,
    name: "skills",
  });

  const {
    fields: certificationFields,
    append: appendCertification,
    remove: removeCertification,
  } = useFieldArray({
    control: form.control,
    name: "certifications",
  });

  const {
    fields: projectFields,
    append: appendProject,
    remove: removeProject,
  } = useFieldArray({
    control: form.control,
    name: "projects",
  });

  const handleSave = useCallback(
    async (data: ResumeContent, isAutoSave = false) => {
      setSaveStatus("saving");
      try {
        await onSave(data);
        setLastSaved(new Date());
        setSaveStatus("saved");
        if (!isAutoSave) {
          toast.success("Resume updated successfully!");
        }
      } catch (error) {
        console.error("Failed to save resume:", error);
        setSaveStatus("error");
        if (!isAutoSave) {
          toast.error("Failed to save resume. Please try again.");
        } else {
          toast.error("Auto-save failed. Your changes may not be saved.");
        }
      }
    },
    [onSave],
  );

  // Auto-save functionality with debounce
  useEffect(() => {
    const subscription = form.watch(() => {
      // Clear existing timeout
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }

      // Set new timeout for auto-save (3 seconds)
      const timeout = setTimeout(() => {
        const values = form.getValues();
        const result = resumeContentSchemaStrict.safeParse(values);

        if (result.success) {
          handleSave(result.data, true);
        } else {
          // Show validation errors to user
          const fieldErrors = result.error.issues.map((i) => i.path.join(".")).slice(0, 3);
          toast.warning(`Fix validation errors: ${fieldErrors.join(", ")}`, {
            duration: 5000,
          });
        }
      }, 3000);

      setAutoSaveTimeout(timeout);
    });

    return () => {
      subscription.unsubscribe();
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [form, handleSave, autoSaveTimeout]);

  const onSubmit = async (data: ResumeContentFormData) => {
    await handleSave(data as ResumeContent, false);
  };

  const getCharacterCount = (fieldName: FieldPath<ResumeContentFormData>, maxLength: number) => {
    const value = form.watch(fieldName) as string | undefined;
    const count = value?.length || 0;
    return `${count}/${maxLength}`;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Save Status Bar */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md py-4 -mx-4 px-4 border-b border-slate-200/60 shadow-depth-sm mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-linear-to-r from-coral to-coral rounded-lg blur-md opacity-20" />
                <div className="relative bg-linear-to-r from-coral/20 to-coral/20 p-2 rounded-lg">
                  <Save className="h-4 w-4 text-coral" />
                </div>
              </div>
              <SaveIndicator status={saveStatus} lastSaved={lastSaved} />
            </div>
            <Button
              type="submit"
              disabled={saveStatus === "saving"}
              className="bg-linear-to-r from-coral to-coral hover:from-coral/90 hover:to-coral/90 text-white font-semibold shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
            >
              <Save className="h-4 w-4 mr-2" />
              Publish Changes
            </Button>
          </div>
        </div>

        {/* Basic Information Section */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 hover:shadow-depth-md transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-linear-to-r from-coral to-coral rounded-lg blur-md opacity-20" />
              <div className="relative bg-linear-to-r from-coral/20 to-coral/20 p-2.5 rounded-lg">
                <User className="h-5 w-5 text-coral" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Basic Information</h2>
              <p className="text-sm text-slate-600">
                Your name, headline, and professional summary
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="headline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Professional Headline</FormLabel>
                  <FormControl>
                    <Input placeholder="Senior Software Engineer" {...field} />
                  </FormControl>
                  <FormDescription>
                    A brief title that describes your professional role (
                    {getCharacterCount("headline", 200)})
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Professional Summary</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write a compelling summary of your professional background and key achievements..."
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Highlight your key skills and experience ({getCharacterCount("summary", 1000)})
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 hover:shadow-depth-md transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-linear-to-r from-purple-500 to-pink-500 rounded-lg blur-md opacity-20" />
              <div className="relative bg-linear-to-r from-purple-100 to-pink-100 p-2.5 rounded-lg">
                <Mail className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Contact Information</h2>
              <p className="text-sm text-slate-600">How people can reach you</p>
            </div>
          </div>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="contact.email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact.phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormDescription>Visibility controlled in privacy settings</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact.location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="San Francisco, CA" {...field} />
                  </FormControl>
                  <FormDescription>Visibility controlled in privacy settings</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-2" />

            <FormField
              control={form.control}
              name="contact.linkedin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LinkedIn (Optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://linkedin.com/in/johndoe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact.github"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GitHub (Optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://github.com/johndoe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact.website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Website (Optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://johndoe.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-2" />
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Design Portfolio Links
            </p>

            <FormField
              control={form.control}
              name="contact.behance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Behance (Optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://behance.net/johndoe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact.dribbble"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dribbble (Optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://dribbble.com/johndoe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Experience Section */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 hover:shadow-depth-md transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-linear-to-r from-emerald-500 to-teal-500 rounded-lg blur-md opacity-20" />
              <div className="relative bg-linear-to-r from-emerald-100 to-teal-100 p-2.5 rounded-lg">
                <Briefcase className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Work Experience</h2>
              <p className="text-sm text-slate-600">Your professional work history</p>
            </div>
          </div>
          <div className="space-y-4">
            {experienceFields.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-linear-to-r from-emerald-500 to-teal-500 rounded-xl blur-lg opacity-15" />
                  <div className="relative bg-linear-to-r from-emerald-100 to-teal-100 p-4 rounded-xl">
                    <Briefcase className="h-8 w-8 text-emerald-600" />
                  </div>
                </div>
                <p className="text-slate-600 font-medium mb-1">No work experience yet</p>
                <p className="text-sm text-slate-500 mb-4">Add your professional work history</p>
                <Button
                  type="button"
                  className="bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-depth-sm hover:shadow-depth-md"
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
                    className="bg-slate-50/50 rounded-xl border border-slate-200/60 p-5 hover:border-slate-300 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-linear-to-r from-emerald-100 to-teal-100 p-1.5 rounded-md">
                          <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          Position {index + 1}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExperience(index)}
                        className="text-slate-400 hover:text-coral hover:bg-coral/10 transition-colors"
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
                                      className="shrink-0 text-slate-400 hover:text-coral hover:bg-coral/10"
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
                  className="w-full border-dashed border-2 border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 text-slate-600 hover:text-emerald-700 transition-all duration-200"
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

        {/* Education Section */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 hover:shadow-depth-md transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-linear-to-r from-orange-500 to-amber-500 rounded-lg blur-md opacity-20" />
              <div className="relative bg-linear-to-r from-orange-100 to-amber-100 p-2.5 rounded-lg">
                <GraduationCap className="h-5 w-5 text-orange-600" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Education</h2>
              <p className="text-sm text-slate-600">Your educational background</p>
            </div>
          </div>
          <div className="space-y-4">
            {educationFields.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-linear-to-r from-orange-500 to-amber-500 rounded-xl blur-lg opacity-15" />
                  <div className="relative bg-linear-to-r from-orange-100 to-amber-100 p-4 rounded-xl">
                    <GraduationCap className="h-8 w-8 text-orange-600" />
                  </div>
                </div>
                <p className="text-slate-600 font-medium mb-1">No education entries yet</p>
                <p className="text-sm text-slate-500 mb-4">
                  Add your educational background to complete your profile
                </p>
                <Button
                  type="button"
                  className="bg-linear-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-semibold shadow-depth-sm hover:shadow-depth-md"
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
                    className="bg-slate-50/50 rounded-xl border border-slate-200/60 p-5 hover:border-slate-300 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-linear-to-r from-orange-100 to-amber-100 p-1.5 rounded-md">
                          <GraduationCap className="h-3.5 w-3.5 text-orange-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          Education {index + 1}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEducation(index)}
                        className="text-slate-400 hover:text-coral hover:bg-coral/10 transition-colors"
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
                  className="w-full border-dashed border-2 border-slate-300 hover:border-orange-400 hover:bg-orange-50/50 text-slate-600 hover:text-orange-700 transition-all duration-200"
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

        {/* Skills Section */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 hover:shadow-depth-md transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-linear-to-r from-cyan-500 to-sky-500 rounded-lg blur-md opacity-20" />
              <div className="relative bg-linear-to-r from-cyan-100 to-sky-100 p-2.5 rounded-lg">
                <Wrench className="h-5 w-5 text-cyan-600" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Skills</h2>
              <p className="text-sm text-slate-600">Your technical and professional skills</p>
            </div>
          </div>
          <div className="space-y-4">
            {skillFields.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-linear-to-r from-cyan-500 to-sky-500 rounded-xl blur-lg opacity-15" />
                  <div className="relative bg-linear-to-r from-cyan-100 to-sky-100 p-4 rounded-xl">
                    <Wrench className="h-8 w-8 text-cyan-600" />
                  </div>
                </div>
                <p className="text-slate-600 font-medium mb-1">No skills added yet</p>
                <p className="text-sm text-slate-500 mb-4">Add your skills grouped by category</p>
                <Button
                  type="button"
                  className="bg-linear-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-semibold shadow-depth-sm hover:shadow-depth-md"
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
                    className="bg-slate-50/50 rounded-xl border border-slate-200/60 p-5 hover:border-slate-300 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-linear-to-r from-cyan-100 to-sky-100 p-1.5 rounded-md">
                          <Wrench className="h-3.5 w-3.5 text-cyan-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          Skill Category {index + 1}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSkill(index)}
                        className="text-slate-400 hover:text-coral hover:bg-coral/10 transition-colors"
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
                              <Input
                                placeholder="JavaScript, TypeScript, Python"
                                value={field.value?.join(", ") || ""}
                                onChange={(e) => {
                                  const items = e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter((s) => s.length > 0);
                                  field.onChange(items);
                                }}
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
                  className="w-full border-dashed border-2 border-slate-300 hover:border-cyan-400 hover:bg-cyan-50/50 text-slate-600 hover:text-cyan-700 transition-all duration-200"
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

        {/* Certifications Section */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 hover:shadow-depth-md transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-linear-to-r from-coral to-pink-500 rounded-lg blur-md opacity-20" />
              <div className="relative bg-linear-to-r from-coral/20 to-pink-100 p-2.5 rounded-lg">
                <Award className="h-5 w-5 text-coral" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Certifications</h2>
              <p className="text-sm text-slate-600">Professional certifications and credentials</p>
            </div>
          </div>
          <div className="space-y-4">
            {certificationFields.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-linear-to-r from-coral to-pink-500 rounded-xl blur-lg opacity-15" />
                  <div className="relative bg-linear-to-r from-coral/20 to-pink-100 p-4 rounded-xl">
                    <Award className="h-8 w-8 text-coral" />
                  </div>
                </div>
                <p className="text-slate-600 font-medium mb-1">No certifications added yet</p>
                <p className="text-sm text-slate-500 mb-4">
                  Add your professional certifications and credentials
                </p>
                <Button
                  type="button"
                  className="bg-linear-to-r from-coral to-pink-600 hover:from-coral/90 hover:to-pink-700 text-white font-semibold shadow-depth-sm hover:shadow-depth-md"
                  onClick={() =>
                    appendCertification({
                      name: "",
                      issuer: "",
                      date: "",
                      url: "",
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Certification
                </Button>
              </div>
            ) : (
              <>
                {certificationFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="bg-slate-50/50 rounded-xl border border-slate-200/60 p-5 hover:border-slate-300 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-linear-to-r from-coral/20 to-pink-100 p-1.5 rounded-md">
                          <Award className="h-3.5 w-3.5 text-coral" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          Certification {index + 1}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCertification(index)}
                        className="text-slate-400 hover:text-coral hover:bg-coral/10 transition-colors"
                        aria-label={`Remove certification ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`certifications.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Certification Name</FormLabel>
                            <FormControl>
                              <Input placeholder="AWS Certified Solutions Architect" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`certifications.${index}.issuer`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issuer</FormLabel>
                            <FormControl>
                              <Input placeholder="Amazon Web Services" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <FormField
                        control={form.control}
                        name={`certifications.${index}.date`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date Issued</FormLabel>
                            <FormControl>
                              <Input placeholder="Jan 2023" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`certifications.${index}.url`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Credential URL</FormLabel>
                            <FormControl>
                              <Input
                                type="url"
                                placeholder="https://credentials.example.com/..."
                                {...field}
                              />
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
                  className="w-full border-dashed border-2 border-slate-300 hover:border-coral/40 hover:bg-coral/10 text-slate-600 hover:text-coral transition-all duration-200"
                  onClick={() =>
                    appendCertification({
                      name: "",
                      issuer: "",
                      date: "",
                      url: "",
                    })
                  }
                  disabled={certificationFields.length >= 20}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Certification
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Projects Section */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 hover:shadow-depth-md transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-linear-to-r from-violet-500 to-purple-500 rounded-lg blur-md opacity-20" />
              <div className="relative bg-linear-to-r from-violet-100 to-purple-100 p-2.5 rounded-lg">
                <FolderCode className="h-5 w-5 text-violet-600" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
              <p className="text-sm text-slate-600">
                Personal projects, side work, or portfolio pieces (max 10)
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {projectFields.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-linear-to-r from-violet-500 to-purple-500 rounded-xl blur-lg opacity-15" />
                  <div className="relative bg-linear-to-r from-violet-100 to-purple-100 p-4 rounded-xl">
                    <FolderCode className="h-8 w-8 text-violet-600" />
                  </div>
                </div>
                <p className="text-slate-600 font-medium mb-1">No projects added yet</p>
                <p className="text-sm text-slate-500 mb-4">
                  Showcase your personal projects and portfolio pieces
                </p>
                <Button
                  type="button"
                  className="bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold shadow-depth-sm hover:shadow-depth-md"
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
                    className="bg-slate-50/50 rounded-xl border border-slate-200/60 p-5 hover:border-slate-300 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-linear-to-r from-violet-100 to-purple-100 p-1.5 rounded-md">
                          <FolderCode className="h-3.5 w-3.5 text-violet-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          Project {index + 1}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProject(index)}
                        className="text-slate-400 hover:text-coral hover:bg-coral/10 transition-colors"
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
                              <Input
                                placeholder="React, Node.js, PostgreSQL (comma-separated)"
                                value={field.value?.join(", ") || ""}
                                onChange={(e) => {
                                  const technologies = e.target.value
                                    .split(",")
                                    .map((t) => t.trim())
                                    .filter((t) => t !== "");
                                  field.onChange(technologies);
                                }}
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
                  className="w-full border-dashed border-2 border-slate-300 hover:border-violet-400 hover:bg-violet-50/50 text-slate-600 hover:text-violet-700 transition-all duration-200"
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

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={saveStatus === "saving"}
            className="bg-linear-to-r from-coral to-coral hover:from-coral/90 hover:to-coral/90 text-white font-semibold shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
          >
            <Save className="h-4 w-4 mr-2" />
            Publish Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
