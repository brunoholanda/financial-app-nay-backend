import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { R2ObjectStorage } from './r2-object-storage.service';
import { OBJECT_STORAGE } from './object-storage.types';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new R2ObjectStorage(config),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class ObjectStorageModule {}
