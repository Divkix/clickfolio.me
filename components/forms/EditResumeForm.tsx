"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SaveIndicator, type SaveStatus } from "@/components/ui/save-indicator";
import { type ResumeContentFormData, resumeContentSchemaStrict } from "@/lib/schemas/resume";
import type { ResumeContent } from "@/lib/types/database";
import { BasicInfoSection } from "./sections/BasicInfoSection";
import { CertificationsSection } from "./sections/CertificationsSection";
import { ContactSection } from "./sections/ContactSection";
import { EducationSection } from "./sections/EducationSection";
import { ExperienceSection } from "./sections/ExperienceSection";
import { ProjectsSection } from "./sections/ProjectsSection";
import { SkillsSection } from "./sections/SkillsSection";

interface EditResumeFormProps {
  initialData: ResumeContent;
  onSave: (data: ResumeContent, isAutoSave?: boolean) => Promise<void>;
}

export function EditResumeForm({ initialData, onSave }: EditResumeFormProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      experience: initialData.experience || [],
      education: initialData.education || [],
      skills: initialData.skills || [],
      certifications: initialData.certifications || [],
      projects: initialData.projects || [],
    },
  });

  const handleSave = useCallback(
    async (data: ResumeContent, isAutoSave = false) => {
      setSaveStatus("saving");
      try {
        await onSave(data, isAutoSave);
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
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        const values = form.getValues();
        const result = resumeContentSchemaStrict.safeParse(values);

        if (result.success) {
          handleSave(result.data, true);
        } else {
          const fieldErrors = result.error.issues.map((i) => i.path.join(".")).slice(0, 3);
          toast.warning(`Fix validation errors: ${fieldErrors.join(", ")}`, {
            duration: 5000,
          });
        }
      }, 3000);
    });

    return () => {
      subscription.unsubscribe();
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [form, handleSave]);

  const onSubmit = async (data: ResumeContentFormData) => {
    await handleSave(data as ResumeContent, false);
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

        <BasicInfoSection form={form} />
        <ContactSection form={form} />
        <ExperienceSection form={form} />
        <EducationSection form={form} />
        <SkillsSection form={form} />
        <CertificationsSection form={form} />
        <ProjectsSection form={form} />

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
