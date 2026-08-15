import { User } from "lucide-react";
import { FormSectionCard } from "@/components/forms/FormSectionCard";
import type { FieldPath, UseFormReturn } from "react-hook-form";
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

interface BasicInfoSectionProps {
  form: UseFormReturn<ResumeContentFormData>;
}

export function BasicInfoSection({ form }: BasicInfoSectionProps) {
  const getCharacterCount = (fieldName: FieldPath<ResumeContentFormData>, maxLength: number) => {
    // SAFETY: form.watch returns validated string field from ResumeContentFormData; cast bridges unknown to string.
    const value = form.watch(fieldName) as string | undefined;
    const count = value?.length || 0;
    return `${count}/${maxLength}`;
  };

  return (
    <FormSectionCard
      icon={User}
      title="Basic Information"
      description="Your name, headline, and professional summary"
    >
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
    </FormSectionCard>
  );
}
