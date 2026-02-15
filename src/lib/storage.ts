import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3-compatible client (Cloudflare R2)
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

export const StoragePrefix = {
  PHOTO_CARDS: 'photo-cards',
} as const;

type StoragePrefixType = (typeof StoragePrefix)[keyof typeof StoragePrefix];

/** 퍼블릭 URL 생성 */
export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`;
}

/** URL에서 R2 object key 추출 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    const publicUrlBase = PUBLIC_URL.replace(/\/$/, '');
    if (url.startsWith(publicUrlBase)) {
      const key = url.slice(publicUrlBase.length + 1);
      return key || null;
    }
    const parsed = new URL(url);
    return parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
  } catch {
    return null;
  }
}

/** 고유 파일 키 생성 (prefix/entityId/timestamp-random.ext) */
export function generateFileKey(
  prefix: StoragePrefixType,
  entityId: string,
  fileName: string,
): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  const random = Math.random().toString(36).substring(7);
  return `${prefix}/${entityId}/${Date.now()}-${random}.${ext}`;
}

/** 파일 업로드 → 퍼블릭 URL 반환 */
export async function uploadFile(
  key: string,
  body: ArrayBuffer | Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: new Uint8Array(body),
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return getPublicUrl(key);
}

/** URL로 단일 파일 삭제 */
export async function deleteFileByUrl(url: string): Promise<void> {
  const key = extractKeyFromUrl(url);
  if (!key) return;

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );
}

/** URL 배열로 여러 파일 삭제 (최대 1000개) */
export async function deleteFilesByUrls(urls: string[]): Promise<void> {
  const keys = urls
    .map(extractKeyFromUrl)
    .filter((k): k is string => k !== null);

  if (keys.length === 0) return;

  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: keys.map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );
}

/** prefix/entityId/ 하위 모든 파일 삭제 */
export async function deleteFilesByPrefix(
  prefix: StoragePrefixType,
  entityId: string,
): Promise<void> {
  const dirPrefix = `${prefix}/${entityId}/`;

  const listed = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: dirPrefix,
    }),
  );

  const keys = listed.Contents?.map((obj) => obj.Key).filter(Boolean) as string[] | undefined;
  if (!keys || keys.length === 0) return;

  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: keys.map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );
}

/** 서명된 다운로드 URL 생성 (기본 60초) */
export async function getSignedDownloadUrl(
  url: string,
  expiresIn = 60,
): Promise<string | null> {
  const key = extractKeyFromUrl(url);
  if (!key) return null;

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn },
  );
}
