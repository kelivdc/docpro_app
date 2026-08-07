import { Client } from 'minio'
import type { Readable } from 'node:stream'

const globalForMinio = globalThis as unknown as { __docproMinio?: Client }

// Storage driver switch: `minio` (local dev, default) vs `s3` (VPS, CloudEka).
// - MinIO: one real bucket per tenant (`docpro-person`, `docpro-{org}`), buckets auto-created.
// - S3:    single shared bucket; tenant separation is an object-key prefix.
export const STORAGE_DRIVER = (process.env.STORAGE_DRIVER ?? 'minio').toLowerCase()
export const isS3 = STORAGE_DRIVER === 's3'

export const minio = globalForMinio.__docproMinio ?? (() => {
  const client = isS3 ? new Client(s3Config()) : new Client(minioConfig())
  if (process.env.NODE_ENV !== 'production') globalForMinio.__docproMinio = client
  return client
})()

function s3Config() {
  const endpoint = process.env.ACCESS_HOST ?? 'https://s3.amazonaws.com'
  const url = new URL(endpoint)
  return {
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    useSSL: url.protocol === 'https:',
    region: process.env.ACCESS_REGION ?? 'us-east-1',
    accessKey: process.env.ACCESS_ID ?? '',
    secretKey: process.env.ACCESS_SECRET ?? '',
  }
}

function minioConfig() {
  const endpoint = process.env.MINIO_ENDPOINT ?? 'http://localhost:9000'
  const url = new URL(endpoint)
  return {
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    useSSL: url.protocol === 'https:',
    accessKey: process.env.MINIO_ROOT_USER ?? 'docpro',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'docpro_secret',
  }
}

// For S3 the single shared bucket is always ACCESS_BUCKET; for MinIO it's the
// real per-tenant bucket passed in.
function storageBucket(bucket: string): string {
  return isS3 ? (process.env.ACCESS_BUCKET ?? process.env.MINIO_BUCKET ?? 'docpro-person') : bucket
}

// On S3 a tenant "bucket" (e.g. `docpro-person`) becomes a folder prefix inside
// the single shared bucket. On MinIO the bucket is real, so the key is untouched.
function objectKey(bucket: string, key: string): string {
  if (!isS3) return key
  const p = bucket.replace(/^\/+/, '').replace(/\/+$/, '')
  return p ? `${p}/${key}` : key
}

export async function ensureBucket(bucket: string): Promise<void> {
  const target = storageBucket(bucket)
  const exists = await minio.bucketExists(target)
  if (!exists) await minio.makeBucket(target)
}

// Object key layout (AD-4): {userId}/{docId}/{filename}
export function objectKeyFor(userId: string, docId: string, filename: string): string {
  return `${userId}/${docId}/${filename}`
}

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer | Readable,
  size?: number,
): Promise<void> {
  await ensureBucket(bucket)
  await minio.putObject(storageBucket(bucket), objectKey(bucket, key), body, size)
}

export async function getObject(bucket: string, key: string): Promise<Buffer> {
  const stream = await minio.getObject(storageBucket(bucket), objectKey(bucket, key))
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  return Buffer.concat(chunks)
}

// Permanent delete that verifies the object is actually gone. Throws when the
// object still exists after removal so the DB row is never removed while the
// blob stays orphaned in storage (no silent `.catch` swallow is permitted).
export async function deleteObject(bucket: string, key: string): Promise<void> {
  const target = storageBucket(bucket)
  const objectKeyName = objectKey(bucket, key)
  await minio.removeObject(target, objectKeyName)
  // Confirms the object no longer exists. Already-absent key -> NoSuchKey is fine.
  try {
    await minio.statObject(target, objectKeyName)
    throw new Error(`Object still exists after delete: ${objectKeyName}`)
  } catch (e) {
    if (e instanceof Error && !(e as { code?: string }).code) throw e
    const code = (e as { code?: string }).code
    if (code !== 'NoSuchKey' && code !== 'NotFound') throw e
  }
}

export async function getPresignedUrl(
  bucket: string,
  key: string,
  expiresSeconds = 60 * 60,
): Promise<string> {
  return minio.presignedGetObject(storageBucket(bucket), objectKey(bucket, key), expiresSeconds)
}