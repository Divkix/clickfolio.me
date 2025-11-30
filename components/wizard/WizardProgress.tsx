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
    "Upload Resume", // Step 1
    "Choose Handle", // Step 2
    "Review Content", // Step 3
    "Privacy Settings", // Step 4
    "Select Theme", // Step 5
  ];

  const normalStepTitles = [
    "Choose Handle", // Step 1
    "Review Content", // Step 2
    "Privacy Settings", // Step 3
    "Select Theme", // Step 4
  ];

  const titles = hasUploadStep ? uploadStepTitles : normalStepTitles;
  return titles[step - 1] || "Unknown Step";
};

/**
 * WizardProgress Component
 * Displays the current step progress in the wizard flow
 */
export function WizardProgress({
  currentStep,
  totalSteps,
  progress,
  hasUploadStep,
}: WizardProgressProps) {
  const stepTitle = getStepTitle(currentStep, hasUploadStep ?? false);

  return (
    <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200/60 shadow-depth-sm">
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Step Counter and Title */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-indigo-600">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="hidden sm:block text-sm text-slate-400">•</span>
            <span className="hidden sm:block text-sm font-medium text-slate-900">{stepTitle}</span>
          </div>
          <span className="text-sm font-semibold text-slate-600">{Math.round(progress)}%</span>
        </div>

        {/* Progress Bar */}
        <Progress value={progress} className="h-2 bg-slate-100" />
      </div>
    </div>
  );
}
