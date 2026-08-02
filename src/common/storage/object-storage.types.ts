import type { Readable } from 'stream';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorage {
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObjectStream(key: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
