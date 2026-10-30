import { Eye, EyeOff, Info, Mail, MapPin, Phone, Search, Shield, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PrivacySettings } from "@/lib/db/schema/auth";
import type { ResumeContent } from "@/lib/types/database";
import { DEFAULT_PRIVACY_SETTINGS, extractCityState } from "@/lib/utils/privacy";

interface PrivacyStepProps {
  content: ResumeContent;
  initialSettings?: PrivacySettings;
  onContinue: (settings: PrivacySettings) => void;
}

export function PrivacyStep({
  content,
  initialSettings = DEFAULT_PRIVACY_SETTINGS,
  onContinue,
}: PrivacyStepProps) {
  const [showEmail, setShowEmail] = useState(initialSettings.show_email);
  const [showPhone, setShowPhone] = useState(initialSettings.show_phone);
  const [showAddress, setShowAddress] = useState(initialSettings.show_address);
  const [showInDirectory, setShowInDirectory] = useState(initialSettings.show_in_directory);
  const [hideFromSearch, setHideFromSearch] = useState(initialSettings.hide_from_search);

  const handleContinue = () => {
    onContinue({
      show_email: showEmail,
      show_phone: showPhone,
      show_address: showAddress,
      show_in_directory: showInDirectory,
      hide_from_search: hideFromSearch,
    });
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-brand-subtle rounded-xl flex items-center justify-center mb-6">
          <Shield className="w-8 h-8 text-brand" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 leading-tight">
          Privacy Settings
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Your page will be public to anyone with the link. By default, it is listed in Explore and
          findable in search engines. Use the switches below to choose what appears.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="p-4 bg-info/10 border-info/30">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-info font-medium">
                Email is shown by default; phone and street address are hidden.
              </p>
              <p className="text-xs text-info mt-1">
                You can change these choices now or later in Settings.
              </p>
            </div>
          </div>
        </Card>

        {content.contact.email && (
          <Card className="p-6 border-border shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <Label htmlFor="show-email" className="text-base font-semibold text-foreground">
                    Show Email
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Display your email address on your public resume
                </p>
                <div className="bg-surface-2 border border-border rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
                  {showEmail ? (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Eye className="w-4 h-4 text-success" />
                      <span className="font-medium break-all">{content.contact.email}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <EyeOff className="w-4 h-4" />
                      <span className="italic">Hidden from public view</span>
                    </div>
                  )}
                </div>
              </div>
              <Switch
                id="show-email"
                checked={showEmail}
                onCheckedChange={setShowEmail}
                className="mt-1"
              />
            </div>
          </Card>
        )}

        {content.contact.phone && (
          <Card className="p-6 border-border shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <Label htmlFor="show-phone" className="text-base font-semibold text-foreground">
                    Show Phone Number
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Display your phone number on your public resume
                </p>
                <div className="bg-surface-2 border border-border rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
                  {showPhone ? (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Eye className="w-4 h-4 text-success" />
                      <span className="font-medium">{content.contact.phone}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
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

        {content.contact.location && (
          <Card className="p-6 border-border shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <Label htmlFor="show-address" className="text-base font-semibold text-foreground">
                    Show Full Address
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Show the full location from your resume, including any street address
                </p>
                <div className="bg-surface-2 border border-border rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
                  {showAddress ? (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Eye className="w-4 h-4 text-success" />
                      <span className="font-medium">{content.contact.location}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <EyeOff className="w-4 h-4 text-brand" />
                      <span className="font-medium">
                        {extractCityState(content.contact.location)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        (City, region or country)
                      </span>
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

        <Card className="p-6 border-border shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <Label
                  htmlFor="show-in-directory"
                  className="text-base font-semibold text-foreground"
                >
                  Show in Explore Directory
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Let others discover your portfolio on the public explore page
              </p>
              <div className="bg-surface-2 border border-border rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
                {showInDirectory ? (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Eye className="w-4 h-4 text-success" />
                    <span className="font-medium">Listed on /explore</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <EyeOff className="w-4 h-4" />
                    <span className="italic">Hidden from explore directory</span>
                  </div>
                )}
              </div>
            </div>
            <Switch
              id="show-in-directory"
              checked={showInDirectory}
              onCheckedChange={setShowInDirectory}
              className="mt-1"
            />
          </div>
        </Card>

        <Card className="p-6 border-border shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Label
                  htmlFor="hide-from-search"
                  className="text-base font-semibold text-foreground"
                >
                  Hide from Search Engines
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Prevent search engines like Google from indexing your portfolio
              </p>
              <div className="bg-surface-2 border border-border rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
                {hideFromSearch ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <EyeOff className="w-4 h-4 text-warning" />
                    <span className="font-medium">Not indexed by search engines</span>
                    <span className="text-xs text-muted-foreground">(noindex)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Eye className="w-4 h-4 text-success" />
                    <span className="font-medium">Visible in search results</span>
                  </div>
                )}
              </div>
            </div>
            <Switch
              id="hide-from-search"
              checked={hideFromSearch}
              onCheckedChange={setHideFromSearch}
              className="mt-1"
            />
          </div>
        </Card>

        {!content.contact.phone && !content.contact.location && (
          <Card className="p-6 border-border shadow-sm text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No phone number or address found in your resume.
              <br />
              <span className="text-sm">You can add these later in your dashboard.</span>
            </p>
          </Card>
        )}

        <div className="pt-4">
          <Button onClick={handleContinue} className="w-full" size="lg">
            Continue
          </Button>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground font-medium">
          You can change these settings anytime in your dashboard.
        </p>
      </div>
    </div>
  );
}
