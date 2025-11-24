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
        <div className="mx-auto w-16 h-16 bg-linear-to-r from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center mb-6">
          <FileCheck className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 leading-tight">
          Review Your Information
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          We&apos;ve extracted this from your resume. You can edit it later in your dashboard.
        </p>
      </div>

      {/* Content Preview */}
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Section */}
        <Card className="p-6 border-2 border-slate-200/60 shadow-depth-sm">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{content.full_name}</h2>
              <p className="text-lg text-indigo-600 font-semibold">{content.headline}</p>
            </div>

            {/* Contact Info */}
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
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
                  <div className="flex items-center gap-1 text-sm text-slate-600">
                    <Linkedin className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">{content.contact.linkedin}</span>
                  </div>
                )}
                {content.contact.github && (
                  <div className="flex items-center gap-1 text-sm text-slate-600">
                    <Github className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">{content.contact.github}</span>
                  </div>
                )}
                {content.contact.website && (
                  <div className="flex items-center gap-1 text-sm text-slate-600">
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
          <Card className="p-6 border-2 border-slate-200/60 shadow-depth-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-3">Summary</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{content.summary}</p>
          </Card>
        )}

        {/* Experience */}
        {content.experience && content.experience.length > 0 && (
          <Card className="p-6 border-2 border-slate-200/60 shadow-depth-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Experience</h3>
            <div className="space-y-4">
              {content.experience.slice(0, 3).map((exp, index) => (
                <div key={index} className="border-l-2 border-indigo-200 pl-4">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h4 className="font-semibold text-slate-900">{exp.title}</h4>
                      <p className="text-sm text-slate-600">{exp.company}</p>
                    </div>
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                      {exp.start_date} - {exp.end_date || "Present"}
                    </span>
                  </div>
                  {exp.description && (
                    <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
                      {exp.description}
                    </p>
                  )}
                </div>
              ))}
              {content.experience.length > 3 && (
                <p className="text-xs text-slate-500 font-medium text-center">
                  + {content.experience.length - 3} more positions
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Education */}
        {content.education && content.education.length > 0 && (
          <Card className="p-6 border-2 border-slate-200/60 shadow-depth-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Education</h3>
            <div className="space-y-3">
              {content.education.map((edu, index) => (
                <div key={index}>
                  <h4 className="font-semibold text-slate-900">{edu.degree}</h4>
                  <p className="text-sm text-slate-600">{edu.institution}</p>
                  {edu.graduation_date && (
                    <p className="text-xs text-slate-500">{edu.graduation_date}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Skills */}
        {content.skills && content.skills.length > 0 && (
          <Card className="p-6 border-2 border-slate-200/60 shadow-depth-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Skills</h3>
            <div className="space-y-3">
              {content.skills.map((skillGroup, index) => (
                <div key={index}>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    {skillGroup.category}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {skillGroup.items.map((skill, skillIndex) => (
                      <span
                        key={skillIndex}
                        className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium"
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
            className="w-full bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
            size="lg"
          >
            Looks Good, Continue
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-center">
        <p className="text-sm text-slate-500 font-medium">
          You can edit all of this information later in your dashboard.
        </p>
      </div>
    </div>
  );
}
