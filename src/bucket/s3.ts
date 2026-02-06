import { S3Client } from "@aws-sdk/client-s3";

let _s3Client: S3Client | null = null;

export const getS3Client = (): S3Client => {
  if (!_s3Client) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION;

    // Debug: log what we have (mask the secrets)
    console.log("[S3] AWS_REGION:", region);
    console.log("[S3] AWS_ACCESS_KEY_ID:", accessKeyId ? `${accessKeyId.substring(0, 4)}...` : "undefined");
    console.log("[S3] AWS_SECRET_ACCESS_KEY:", secretAccessKey ? "****" : "undefined");

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        `AWS credentials not configured. ` +
        `AWS_ACCESS_KEY_ID: ${accessKeyId ? 'set' : 'MISSING'}, ` +
        `AWS_SECRET_ACCESS_KEY: ${secretAccessKey ? 'set' : 'MISSING'}`
      );
    }

    _s3Client = new S3Client({
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
  }
  return _s3Client;
};

// For backwards compatibility
export const s3 = new Proxy({} as S3Client, {
  get(_, prop) {
    return (getS3Client() as any)[prop];
  },
});
