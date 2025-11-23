"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/FileDropzone";
import { Upload, FileText, Calendar, AlertCircle } from "lucide-react";
import Link from "next/link";

interface ResumeManagementCardProps {
  resumeCount: number;
  latestResumeDate?: string | null;
  latestResumeStatus?: string | null;
  latestResumeError?: string | null;
  latestResumeId?: string | null;
}

/**
 * Format date for display (deterministic, avoids hydration mismatch)
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${month} ${day}, ${year} at ${hour12.toString().padStart(2, "0")}:${minutes} ${ampm}`;
}

export function ResumeManagementCard({
  resumeCount,
  latestResumeDate,
  latestResumeStatus,
  latestResumeError,
  latestResumeId,
}: ResumeManagementCardProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case "completed":
        return "text-green-700 bg-green-100";
      case "processing":
        return "text-blue-700 bg-blue-100";
      case "failed":
        return "text-red-700 bg-red-100";
      default:
        return "text-slate-700 bg-slate-100";
    }
  };

  const getStatusLabel = (status?: string | null) => {
    switch (status) {
      case "completed":
        return "Published";
      case "processing":
        return "Processing";
      case "failed":
        return "Failed";
      case "pending_claim":
        return "Pending";
      default:
        return "Unknown";
    }
  };

  return (
    <>
      <Card className="shadow-depth-sm border-slate-200/60 hover:shadow-depth-md transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <FileText className="h-5 w-5 text-indigo-600" />
            Resume Management
          </CardTitle>
          <CardDescription className="text-slate-600">
            Upload and manage your resume versions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Resume Stats */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">
                Total Uploads
              </p>
              <p className="text-2xl font-bold text-slate-900">{resumeCount}</p>
            </div>
            {latestResumeStatus && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">
                  Current Status
                </p>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(latestResumeStatus)}`}
                >
                  {getStatusLabel(latestResumeStatus)}
                </span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {latestResumeStatus === "failed" && latestResumeError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold text-red-900">
                    Processing Failed
                  </p>
                  <p className="text-sm text-red-700">{latestResumeError}</p>
                </div>
              </div>
              {latestResumeId && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full border-red-200 text-red-700 hover:bg-red-100"
                >
                  <Link href={`/waiting?resume_id=${latestResumeId}`}>
                    Retry Processing
                  </Link>
                </Button>
              )}
            </div>
          )}

          {/* Latest Resume Info */}
          {latestResumeDate && (
            <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-medium text-slate-700">
                  Latest Upload
                </p>
              </div>
              <p className="text-sm text-slate-600">
                {formatDate(latestResumeDate)}
              </p>
            </div>
          )}

          {/* Upload New Resume Button */}
          <Button
            onClick={() => setUploadModalOpen(true)}
            className="w-full bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold transition-all duration-300 shadow-depth-sm hover:shadow-depth-md"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload New Resume
          </Button>

          {/* Info Text */}
          <p className="text-xs text-slate-500 text-center">
            Rate limit: 5 uploads per 24 hours. All uploads are kept for
            history.
          </p>
        </CardContent>
      </Card>

      <FileDropzone open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </>
  );
}
