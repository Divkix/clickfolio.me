import { Mail } from "lucide-react";
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
    <div className="bg-card rounded-xl shadow-sm border border-ink/10 p-6 hover:shadow-md transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-linear-to-r from-purple-500 to-pink-500 rounded-lg blur-md opacity-20" />
          <div className="relative bg-linear-to-r from-purple-100 to-pink-100 p-2.5 rounded-lg">
            <Mail className="h-5 w-5 text-purple-600" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Contact Information</h2>
          <p className="text-sm text-muted-foreground">How people can reach you</p>
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
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
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
  );
}
