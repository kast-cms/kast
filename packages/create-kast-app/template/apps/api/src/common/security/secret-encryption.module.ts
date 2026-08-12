import { Global, Module } from '@nestjs/common';
import { SecretEncryptionService } from './secret-encryption.service';

@Global()
@Module({
  providers: [SecretEncryptionService],
  exports: [SecretEncryptionService],
})
export class SecretEncryptionModule {}
