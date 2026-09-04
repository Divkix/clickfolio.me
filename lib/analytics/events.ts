export interface AnalyticsEventMap {
  resume_uploaded: { file_size_bytes: number; file_name_length: number };
  resume_upload_failed: { error_message: string };
  resume_claimed: { resume_id: string };
  resume_claim_cached: { resume_id: string };
  resume_parse_retried: { resume_id: string; retry_count: number };
  theme_changed: { theme_id: string };
  handle_changed: { new_handle: string };
  account_deleted: { had_r2_warnings: boolean };
  onboarding_completed: {
    handle: string;
    theme_id: string;
    show_in_directory: boolean;
  };
}
