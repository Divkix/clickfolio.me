"use client";

import { AlertCircle, Calendar, FileText, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface ResumeManagementCardProps {
  resumeCount: number;
  latestResumeDate?: string | null;
  latestResumeStatus?: string | null;
  latestResumeError?: string | null;
  latestResumeId?: string | null;
}

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
  return `${month} ${day}, ${year}`;
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
      <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-900">Resume</h3>
        </div>

        {/* Horizontal stats row */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-lg blur-md opacity-20" />
              <div className="relative bg-gradient-to-r from-indigo-100 to-blue-100 p-2.5 rounded-lg">
                <Upload className="h-4 w-4 text-indigo-600" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{resumeCount}</p>
              <p className="text-xs text-slate-500">Uploads</p>
            </div>
          </div>

          {latestResumeStatus && (
            <>
              <Separator orientation="vertical" className="h-10" />
              <div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(latestResumeStatus)}`}
                >
                  {getStatusLabel(latestResumeStatus)}
                </span>
                {latestResumeDate && (
                  <p className="text-xs text-slate-500 mt-1">
                    <Calendar className="inline h-3 w-3 mr-1" />
                    {formatDate(latestResumeDate)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Error Message - compact version */}
        {latestResumeStatus === "failed" && latestResumeError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-900">Processing failed</p>
                <p className="text-xs text-red-700 truncate">{latestResumeError}</p>
              </div>
            </div>
            {latestResumeId && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="w-full mt-2 border-red-200 text-red-700 hover:bg-red-100"
              >
                <Link href={`/waiting?resume_id=${latestResumeId}`}>Retry Processing</Link>
              </Button>
            )}
          </div>
        )}

        {/* Upload button - pushed to bottom */}
        <div className="mt-auto">
          <Button
            onClick={() => setUploadModalOpen(true)}
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold transition-all duration-300 shadow-depth-sm hover:shadow-depth-md"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload New Resume
          </Button>
          <p className="text-xs text-slate-500 text-center mt-2">5 uploads per 24 hours</p>
        </div>
      </div>

      <FileDropzone open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </>
  );
}
