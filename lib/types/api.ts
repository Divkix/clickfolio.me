export interface ApiErrorBody {
  error?: string;
  code?: string;
  details?: unknown;
}

export interface ClaimResponse {
  resume_id: string;
  cached?: boolean;
  error?: string;
}

export type Period = "7d" | "30d" | "90d";
