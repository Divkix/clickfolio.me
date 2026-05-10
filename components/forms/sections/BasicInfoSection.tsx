import { User } from "lucide-react";
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
    const value = form.watch(fieldName) as string | undefined;
    const count = value?.length || 0;
    return `${count}/${maxLength}`;
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-ink/10 p-6 hover:shadow-md transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-linear-to-r from-coral to-coral rounded-lg blur-md opacity-20" />
          <div className="relative bg-linear-to-r from-coral/20 to-coral/20 p-2.5 rounded-lg">
            <User className="h-5 w-5 text-coral" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>
          <p className="text-sm text-muted-foreground">
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
  );
}
