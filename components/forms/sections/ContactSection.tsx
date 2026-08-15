import { Mail } from "lucide-react";
import { FormSectionCard } from "@/components/forms/FormSectionCard";
import type { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { ResumeContentFormData } from "@/lib/schemas/resume";

interface ContactSectionProps {
  form: UseFormReturn<ResumeContentFormData>;
}

export function ContactSection({ form }: ContactSectionProps) {
  return (
    <FormSectionCard icon={Mail} title="Contact Information" description="How people can reach you">
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
        <p className="text-sm text-foreground font-medium">Design Portfolio Links</p>

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
    </FormSectionCard>
  );
}
