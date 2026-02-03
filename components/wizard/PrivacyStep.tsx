"use client";

import { Eye, EyeOff, Info, MapPin, Phone, Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ResumeContent } from "@/lib/types/database";

interface PrivacyStepProps {
  content: ResumeContent;
  initialSettings?: {
    show_phone: boolean;
    show_address: boolean;
  };
  onContinue: (settings: { show_phone: boolean; show_address: boolean }) => void;
}

/**
 * Step 3: Privacy Settings Component
 * Allows users to control visibility of sensitive information
 */
export function PrivacyStep({
  content,
  initialSettings = { show_phone: false, show_address: false },
  onContinue,
}: PrivacyStepProps) {
  const [showPhone, setShowPhone] = useState(initialSettings.show_phone);
  const [showAddress, setShowAddress] = useState(initialSettings.show_address);

  const handleContinue = () => {
    onContinue({
      show_phone: showPhone,
      show_address: showAddress,
    });
  };

  // Extract city/state from full address for preview
  const getCityState = (location?: string) => {
    if (!location) return "";
    // Simple heuristic: take last 2 comma-separated parts (City, State)
    const parts = location.split(",").map((p) => p.trim());
    if (parts.length >= 2) {
      return parts.slice(-2).join(", ");
    }
    return location;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-linear-to-r from-coral/20 to-coral/20 rounded-2xl flex items-center justify-center mb-6">
          <Shield className="w-8 h-8 text-coral" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 leading-tight">
          Privacy Settings
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Control what information is visible on your public resume. You can change this anytime.
        </p>
      </div>

      {/* Privacy Controls */}
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Info Banner */}
        <Card className="p-4 bg-coral/10 border-coral/30">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-coral shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-coral font-medium">
                Your email is always visible to potential employers.
              </p>
              <p className="text-xs text-coral mt-1">
                We recommend keeping phone and address hidden for privacy, showing only city/state.
              </p>
            </div>
          </div>
        </Card>

        {/* Phone Number Toggle */}
        {content.contact.phone && (
          <Card className="p-6 border-2 border-slate-200/60 shadow-depth-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-5 h-5 text-slate-600" />
                  <Label htmlFor="show-phone" className="text-base font-semibold text-slate-900">
                    Show Phone Number
                  </Label>
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  Display your phone number on your public resume
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Preview:</p>
                  {showPhone ? (
                    <div className="flex items-center gap-2 text-sm text-slate-900">
                      <Eye className="w-4 h-4 text-green-600" />
                      <span className="font-medium">{content.contact.phone}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <EyeOff className="w-4 h-4" />
                      <span className="italic">Hidden from public view</span>
                    </div>
                  )}
                </div>
              </div>
              <Switch
                id="show-phone"
                checked={showPhone}
                onCheckedChange={setShowPhone}
                className="mt-1"
              />
            </div>
          </Card>
        )}

        {/* Address Toggle */}
        {content.contact.location && (
          <Card className="p-6 border-2 border-slate-200/60 shadow-depth-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-slate-600" />
                  <Label htmlFor="show-address" className="text-base font-semibold text-slate-900">
                    Show Full Address
                  </Label>
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  Display your full street address instead of just city and state
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Preview:</p>
                  {showAddress ? (
                    <div className="flex items-center gap-2 text-sm text-slate-900">
                      <Eye className="w-4 h-4 text-green-600" />
                      <span className="font-medium">{content.contact.location}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-900">
                      <EyeOff className="w-4 h-4 text-coral" />
                      <span className="font-medium">{getCityState(content.contact.location)}</span>
                      <span className="text-xs text-slate-500">(City/State only)</span>
                    </div>
                  )}
                </div>
              </div>
              <Switch
                id="show-address"
                checked={showAddress}
                onCheckedChange={setShowAddress}
                className="mt-1"
              />
            </div>
          </Card>
        )}

        {/* No sensitive data message */}
        {!content.contact.phone && !content.contact.location && (
          <Card className="p-6 border-2 border-slate-200/60 shadow-depth-sm text-center">
            <Shield className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">
              No phone number or address found in your resume.
              <br />
              <span className="text-sm">You can add these later in your dashboard.</span>
            </p>
          </Card>
        )}

        {/* Continue Button */}
        <div className="pt-4">
          <Button
            onClick={handleContinue}
            className="w-full bg-linear-to-r from-coral to-coral hover:from-coral/90 hover:to-coral/90 text-white font-semibold shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
            size="lg"
          >
            Continue
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-center">
        <p className="text-sm text-slate-500 font-medium">
          You can change these settings anytime in your dashboard.
        </p>
      </div>
    </div>
  );
}
