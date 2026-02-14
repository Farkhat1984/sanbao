import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3_DEFAULT_BUCKET, S3_DEFAULT_REGION, PRESIGNED_URL_EXPIRY } from "@/lib/constants";

const bucket = process.env.S3_BUCKET || S3_DEFAULT_BUCKET;

let client: S3Client | null = null;

function getClient(): S3Client | null {
  if (client) return client;

  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || S3_DEFAULT_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;

  if (!accessKeyId || !secretAccessKey) return null;

  client = new S3Client({
    region,
    ...(endpoint && { endpoint, forcePathStyle: true }), // MinIO compatibility
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

export function isStorageConfigured(): boolean {
  return !!(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const s3 = getClient();
  if (!s3) throw new Error("S3 not configured");

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  // Return the key (caller can generate URL as needed)
  return key;
}

export async function deleteFile(key: string): Promise<void> {
  const s3 = getClient();
  if (!s3) throw new Error("S3 not configured");

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

export async function getPresignedUrl(key: string, expiresIn = PRESIGNED_URL_EXPIRY): Promise<string> {
  const s3 = getClient();
  if (!s3) throw new Error("S3 not configured");

  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn }
  );
}

export async function listFiles(prefix?: string): Promise<{ key: string; size: number; lastModified: Date }[]> {
  const s3 = getClient();
  if (!s3) throw new Error("S3 not configured");

  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    })
  );

  return (result.Contents || []).map((obj) => ({
    key: obj.Key || "",
    size: obj.Size || 0,
    lastModified: obj.LastModified || new Date(),
  }));
}
