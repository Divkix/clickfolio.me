import { S3Client } from "@aws-sdk/client-s3";
import { ENV } from "./env";

let _r2Client: S3Client | null = null;
let _r2Bucket: string | null = null;

export function getR2Client(): S3Client {
  if (!_r2Client) {
    _r2Client = new S3Client({
      region: "auto",
      endpoint: ENV.R2_ENDPOINT(),
      credentials: {
        accessKeyId: ENV.R2_ACCESS_KEY_ID(),
        secretAccessKey: ENV.R2_SECRET_ACCESS_KEY(),
      },
      // Disable automatic checksum calculation to avoid CORS issues with R2
      // AWS SDK v3 automatically adds x-amz-checksum-* headers which R2 CORS doesn't allow by default
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }
  return _r2Client;
}

export function getR2Bucket(): string {
  if (!_r2Bucket) {
    _r2Bucket = ENV.R2_BUCKET_NAME();
  }
  return _r2Bucket;
}
