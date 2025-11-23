"use client";

import { Progress } from "@/components/ui/progress";

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  progress: number;
}

const STEP_TITLES = [
  "Choose Your Role",
  "Craft Your Headline",
  "Polish Your Summary",
  "Enhance Experience",
];

/**
 * WizardProgress Component
 * Displays the current step progress in the wizard flow
 */
export function WizardProgress({
  currentStep,
  totalSteps,
  progress,
}: WizardProgressProps) {
  const stepTitle = STEP_TITLES[currentStep - 1] || "Unknown Step";

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
            <span className="hidden sm:block text-sm font-medium text-slate-900">
              {stepTitle}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-600">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Progress Bar */}
        <Progress value={progress} className="h-2 bg-slate-100" />
      </div>
    </div>
  );
}
