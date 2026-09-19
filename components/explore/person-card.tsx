import { Briefcase, ExternalLink, GraduationCap, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export interface DirectoryUser {
  handle: string;
  role: string | null;
  previewName: string | null;
  previewHeadline: string | null;
  previewLocation: string | null;
  previewExpCount: number | null;
  previewEduCount: number | null;
  previewSkills: string[] | null;
}

interface PersonCardProps {
  person: DirectoryUser;
}

export function PersonCard({ person }: PersonCardProps) {
  return (
    <Link
      href={`/@${person.handle}`}
      className="group min-w-0 overflow-hidden bg-card rounded-xl border border-border shadow-sm p-6 transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-foreground truncate group-hover:text-brand transition-colors">
            {person.previewName || "Unknown"}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {person.previewHeadline || "Professional"}
          </p>
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-brand shrink-0 ml-2" />
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {person.previewLocation && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {person.previewLocation.split(",")[0]}
          </span>
        )}
        {person.previewExpCount != null && person.previewExpCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Briefcase className="w-3 h-3" />
            {person.previewExpCount} {person.previewExpCount === 1 ? "position" : "positions"}
          </span>
        )}
        {person.previewEduCount != null && person.previewEduCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="w-3 h-3" />
            {person.previewEduCount}
          </span>
        )}
      </div>

      {person.previewSkills && person.previewSkills.length > 0 && (
        <div className="mt-4 flex min-w-0 flex-wrap gap-1.5">
          {person.previewSkills.slice(0, 4).map((skill) => (
            <Badge key={skill} variant="outline" className="max-w-full min-w-0 truncate">
              {skill}
            </Badge>
          ))}
          {person.previewSkills.length > 4 && (
            <span className="inline-block px-1 py-0.5 text-muted-foreground text-xs">
              +{person.previewSkills.length - 4} more
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
