/**
 * Evita TS7016 em servidores onde `npm install` não trouxe `@types/multer`
 * (por exemplo deploy só com dependências de produção ou lock desatualizado).
 * O pacote oficial continua preferível: `npm i -D @types/multer`
 */
declare module 'multer' {
  import type { Request } from 'express';

  export interface StorageEngine {
    _handleFile(
      req: Request,
      file: Express.Multer.File,
      callback: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
    ): void;
    _removeFile(
      req: Request,
      file: Express.Multer.File,
      callback: (error: Error) => void,
    ): void;
  }

  export function memoryStorage(): StorageEngine;
}
