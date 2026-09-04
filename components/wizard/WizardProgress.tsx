"use client";

import { Progress } from "@/components/ui/progress";

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  progress: number;
  hasUploadStep?: boolean;
}

const getStepTitle = (step: number, hasUploadStep: boolean): string => {
  const uploadStepTitles = [
    "Upload Resume",
    "Choose Handle",
    "Review Content",
    "Privacy Settings",
    "Select Theme",
  ];

  const normalStepTitles = ["Choose Handle", "Review Content", "Privacy Settings", "Select Theme"];

  const titles = hasUploadStep ? uploadStepTitles : normalStepTitles;
  return titles[step - 1] || "Unknown Step";
};

export function WizardProgress({
  currentStep,
  totalSteps,
  progress,
  hasUploadStep,
}: WizardProgressProps) {
  const stepTitle = getStepTitle(currentStep, hasUploadStep ?? false);

  return (
    <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-brand">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="hidden sm:block text-sm text-muted-foreground">&bull;</span>
            <span className="hidden sm:block text-sm font-medium text-foreground">{stepTitle}</span>
          </div>
          <span className="text-sm font-semibold text-muted-foreground">
            {Math.round(progress)}%
          </span>
        </div>

        <Progress value={progress} className="h-2" />
      </div>
    </div>
  );
}
