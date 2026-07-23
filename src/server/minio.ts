import { Client } from 'minio'
import type { Readable } from 'node:stream'

const globalForMinio = globalThis as unknown as { __docproMinio?: Client }

export const minio = globalForMinio.__docproMinio ?? (() => {
  const client = new Client({
    endPoint: (process.env.MINIO_ENDPOINT ?? 'http://localhost:9000')
      .replace(/^https?:\/\//, '')
      .split(':')[0],
    port: Number((process.env.MINIO_ENDPOINT ?? '').split(':')[2] ?? 9000),
    useSSL: process.env.MINIO_ENDPOINT?.startsWith('https'),
    accessKey: process.env.MINIO_ROOT_USER ?? 'docpro',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'docpro_secret',
  })
  if (process.env.NODE_ENV !== 'production') globalForMinio.__docproMinio = client
  return client
})()

export async function ensureBucket(bucket: string): Promise<void> {
  const exists = await minio.bucketExists(bucket)
  if (!exists) await minio.makeBucket(bucket)
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
  await minio.putObject(bucket, key, body, size)
}

export async function getObject(bucket: string, key: string): Promise<Buffer> {
  const stream = await minio.getObject(bucket, key)
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  return Buffer.concat(chunks)
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await minio.removeObject(bucket, key)
}

export async function getPresignedUrl(
  bucket: string,
  key: string,
  expiresSeconds = 60 * 60,
): Promise<string> {
  return minio.presignedGetObject(bucket, key, expiresSeconds)
}
