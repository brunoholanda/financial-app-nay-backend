import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'stream';
import type { ObjectStorage } from './object-storage.types';

export class R2ObjectStorage implements ObjectStorage {
  private readonly logger = new Logger(R2ObjectStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    let endpoint = (config.get<string>('R2_ENDPOINT') ?? '').replace(
      /\/+$/,
      '',
    );
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY') ?? '';
    this.bucket = config.get<string>('R2_BUCKET') ?? '';

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      throw new Error(
        'Armazenamento R2 obrigatório: defina R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY.',
      );
    }

    // Aceita endpoint com ou sem /financial-app no final.
    if (endpoint.endsWith(`/${this.bucket}`)) {
      endpoint = endpoint.slice(0, -(this.bucket.length + 1));
    }

    this.client = new S3Client({
      region: config.get<string>('R2_REGION') ?? 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    this.logger.log(`R2 ativo: bucket=${this.bucket} endpoint=${endpoint}`);
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObjectStream(key: string): Promise<Readable> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!out.Body) {
      throw new Error(`R2_OBJECT_MISSING:${key}`);
    }
    return out.Body as Readable;
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      /* já ausente */
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
