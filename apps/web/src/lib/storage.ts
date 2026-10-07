import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type ObjectStore = {
  presignPut(key: string, contentType: string, origin: string): Promise<string>;
  get(key: string): Promise<Buffer | null>;
  put(key: string, body: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
};

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is required");
  return value;
}

export function signStorage(method: string, key: string, contentType: string, exp: number) {
  return createHmac("sha256", secret())
    .update(`${method}\n${key}\n${contentType}\n${exp}`)
    .digest("base64url");
}

export function verifyStorage(
  method: string,
  key: string,
  contentType: string,
  exp: number,
  signature: string,
) {
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = signStorage(method, key, contentType, exp);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function localRoot() {
  return path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), ".data", "objects"));
}

function localPath(key: string) {
  const root = localRoot();
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("invalid object key");
  }
  return full;
}

function localStore(): ObjectStore {
  return {
    async presignPut(key, contentType, origin) {
      const exp = Date.now() + 60 * 60 * 1000;
      const sig = signStorage("PUT", key, contentType, exp);
      const url = new URL("/api/storage/object", origin);
      url.searchParams.set("op", "put");
      url.searchParams.set("key", key);
      url.searchParams.set("ct", contentType);
      url.searchParams.set("exp", String(exp));
      url.searchParams.set("sig", sig);
      return url.toString();
    },
    async get(key) {
      try {
        return await readFile(localPath(key));
      } catch {
        return null;
      }
    },
    async put(key, body) {
      const full = localPath(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
    },
    async delete(key) {
      await rm(localPath(key), { force: true });
    },
  };
}

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function r2Store(): ObjectStore {
  const config = r2Config();
  if (!config) return localStore();
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return {
    async presignPut(key, contentType) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
      });
      return getSignedUrl(client, command, { expiresIn: 3600 });
    },
    async get(key) {
      try {
        const response = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        );
        const bytes = await response.Body?.transformToByteArray();
        return bytes ? Buffer.from(bytes) : null;
      } catch {
        return null;
      }
    },
    async put(key, body) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
        }),
      );
    },
    async delete(key) {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

let store: ObjectStore | null = null;

export function getStore(): ObjectStore {
  if (!store) store = r2Config() ? r2Store() : localStore();
  return store;
}

export function objectKey(projectId: string, externalId: string, relativePath: string) {
  return `${projectId}/${externalId}/${relativePath}`;
}
