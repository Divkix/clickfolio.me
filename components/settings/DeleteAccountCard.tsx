"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { signOut } from "@/lib/auth/client";

interface DeleteAccountCardProps {
  userEmail: string;
}

interface DeleteApiResponse {
  success?: boolean;
  error?: string;
  code?: string;
  warnings?: Array<{ type: string; message: string }>;
}

export function DeleteAccountCard({ userEmail }: DeleteAccountCardProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailMatches = confirmation.toLowerCase() === userEmail.toLowerCase();

  const handleDelete = async () => {
    if (!emailMatches) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ confirmation }),
      });

      const data: DeleteApiResponse = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "Failed to delete account";
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((warning) => {
          toast.warning(`Warning: ${warning.message}`);
        });
      }

      toast.success("Your account has been deleted");
      setIsDialogOpen(false);

      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/");
            router.refresh();
          },
        },
      });
    } catch (err) {
      console.error("Account deletion error:", err);
      const errorMessage = "An unexpected error occurred. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDialogClose = () => {
    if (isDeleting) return;
    setIsDialogOpen(false);
    setConfirmation("");
    setError(null);
  };

  return (
    <>
      {/* Compact inline danger zone row */}
      <div className="rounded-2xl border border-coral/30 bg-coral/5 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-lg bg-coral/20 p-2">
              <AlertTriangle className="h-5 w-5 text-coral" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-coral">Danger Zone</h3>
              <p className="text-sm text-coral">Delete your account and all data permanently</p>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={() => setIsDialogOpen(true)}
            className="shrink-0 gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-coral">
              <AlertTriangle className="h-5 w-5 text-coral" />
              Delete Account
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-coral/30 bg-coral/10 p-4">
              <p className="text-sm font-medium text-coral">
                This action is permanent and cannot be undone.
              </p>
              <p className="text-sm text-coral mt-2">
                The following data will be permanently deleted:
              </p>
              <ul className="text-sm text-coral mt-2 space-y-1 list-disc list-inside">
                <li>Your profile information</li>
                <li>All uploaded resume files</li>
                <li>Your published portfolio page</li>
                <li>All account settings and preferences</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmation" className="text-sm font-medium text-slate-900">
                Type <span className="font-mono text-coral">{userEmail}</span> to confirm
              </label>
              <Input
                id="confirmation"
                type="email"
                placeholder="Enter your email address"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={isDeleting}
                className={error ? "border-coral" : ""}
                autoComplete="off"
              />
              {error && <p className="text-sm text-coral">{error}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleDialogClose}
                disabled={isDeleting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!emailMatches || isDeleting}
                className="flex-1 gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Forever
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
