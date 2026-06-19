import { Award, Plus, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ResumeContentFormData } from "@/lib/schemas/resume";

interface CertificationsSectionProps {
  form: UseFormReturn<ResumeContentFormData>;
}

export function CertificationsSection({ form }: CertificationsSectionProps) {
  const {
    fields: certificationFields,
    append: appendCertification,
    remove: removeCertification,
  } = useFieldArray({
    control: form.control,
    name: "certifications",
  });

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="shrink-0 bg-brand-subtle p-2.5 rounded-lg">
          <Award className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Certifications</h2>
          <p className="text-sm text-muted-foreground">
            Professional certifications and credentials
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {certificationFields.length === 0 ? (
          <div className="text-center py-8 px-4 bg-surface-2 rounded-xl border border-dashed border-border">
            <div className="inline-flex mb-4 bg-brand-subtle p-4 rounded-xl">
              <Award className="h-8 w-8 text-brand" />
            </div>
            <p className="text-foreground font-medium mb-1">No certifications added yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add your professional certifications and credentials
            </p>
            <Button
              type="button"
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
                className="bg-surface-2 rounded-xl border border-border p-5 hover:border-border-strong transition-colors duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-brand-subtle p-1.5 rounded-md">
                      <Award className="h-3.5 w-3.5 text-brand" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      Certification {index + 1}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to remove this item?")) {
                        removeCertification(index);
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
              className="w-full border-dashed"
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
  );
}
