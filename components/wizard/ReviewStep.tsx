"use client";

import { FileCheck, Github, Globe, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ResumeContent } from "@/lib/types/database";

interface ReviewStepProps {
  content: ResumeContent;
  onContinue: () => void;
}

/**
 * Step 2: Review Content Component
 * Displays parsed resume content for user verification
 */
export function ReviewStep({ content, onContinue }: ReviewStepProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-linear-to-r from-coral/20 to-coral/20 rounded-xl flex items-center justify-center mb-6">
          <FileCheck className="w-8 h-8 text-coral" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 leading-tight">
          Review Your Information
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          We&apos;ve extracted this from your resume. You can edit it later in your dashboard.
        </p>
      </div>

      {/* Content Preview */}
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Section */}
        <Card className="p-6 border-ink/10 shadow-sm">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{content.full_name}</h2>
              <p className="text-lg text-coral font-semibold">{content.headline}</p>
            </div>

            {/* Contact Info */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {content.contact.email && (
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  <span>{content.contact.email}</span>
                </div>
              )}
              {content.contact.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  <span>{content.contact.phone}</span>
                </div>
              )}
              {content.contact.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{content.contact.location}</span>
                </div>
              )}
            </div>

            {/* Social Links */}
            {(content.contact.linkedin || content.contact.github || content.contact.website) && (
              <div className="flex flex-wrap gap-3">
                {content.contact.linkedin && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Linkedin className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">{content.contact.linkedin}</span>
                  </div>
                )}
                {content.contact.github && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Github className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">{content.contact.github}</span>
                  </div>
                )}
                {content.contact.website && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Globe className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">{content.contact.website}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Summary */}
        {content.summary && (
          <Card className="p-6 border-ink/10 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-3">Summary</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">{content.summary}</p>
          </Card>
        )}

        {/* Experience */}
        {content.experience && content.experience.length > 0 && (
          <Card className="p-6 border-ink/10 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-4">Experience</h3>
            <div className="space-y-4">
              {content.experience.slice(0, 3).map((exp, index) => (
                <div key={index} className="border-l-2 border-coral/30 pl-4">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h4 className="font-semibold text-foreground">{exp.title}</h4>
                      <p className="text-sm text-muted-foreground">{exp.company}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                      {exp.start_date} - {exp.end_date || "Present"}
                    </span>
                  </div>
                  {exp.description && (
                    <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">
                      {exp.description}
                    </p>
                  )}
                </div>
              ))}
              {content.experience.length > 3 && (
                <p className="text-xs text-muted-foreground font-medium text-center">
                  + {content.experience.length - 3} more positions
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Education */}
        {content.education && content.education.length > 0 && (
          <Card className="p-6 border-ink/10 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-4">Education</h3>
            <div className="space-y-3">
              {content.education.map((edu, index) => (
                <div key={index}>
                  <h4 className="font-semibold text-foreground">{edu.degree}</h4>
                  <p className="text-sm text-muted-foreground">{edu.institution}</p>
                  {edu.graduation_date && (
                    <p className="text-xs text-muted-foreground">{edu.graduation_date}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Skills */}
        {content.skills && content.skills.length > 0 && (
          <Card className="p-6 border-ink/10 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-4">Skills</h3>
            <div className="space-y-3">
              {content.skills.map((skillGroup, index) => (
                <div key={index}>
                  <h4 className="text-sm font-semibold text-foreground/80 mb-1">
                    {skillGroup.category}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {skillGroup.items.map((skill, skillIndex) => (
                      <span
                        key={skillIndex}
                        className="px-2 py-1 bg-muted text-foreground/80 rounded text-xs font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Continue Button */}
        <div className="pt-4">
          <Button
            onClick={onContinue}
            className="w-full bg-linear-to-r from-coral to-coral hover:from-coral/90 hover:to-coral/90 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-300"
            size="lg"
          >
            Looks Good, Continue
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground font-medium">
          You can edit all of this information later in your dashboard.
        </p>
      </div>
    </div>
  );
}
