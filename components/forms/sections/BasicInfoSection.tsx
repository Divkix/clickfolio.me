import { User } from "lucide-react";
import { FormSectionCard } from "@/components/forms/FormSectionCard";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";
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

function CharacterCount({
  form,
  name,
  maxLength,
}: {
  form: UseFormReturn<ResumeContentFormData>;
  name: FieldPath<ResumeContentFormData>;
  maxLength: number;
}) {
  // SAFETY: useWatch returns validated string field from ResumeContentFormData; cast bridges unknown to string.
  const value = useWatch({ control: form.control, name }) as string | undefined;
  return <>{`${value?.length || 0}/${maxLength}`}</>;
}

export function BasicInfoSection({ form }: BasicInfoSectionProps) {
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
                <CharacterCount form={form} name="headline" maxLength={200} />)
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
                Highlight your key skills and experience (
                <CharacterCount form={form} name="summary" maxLength={1000} />)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </FormSectionCard>
  );
}
