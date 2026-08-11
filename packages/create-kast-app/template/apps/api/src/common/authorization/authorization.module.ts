import { Global, Module } from '@nestjs/common';
import { PermissionResolverService } from './permission-resolver.service';

@Global()
@Module({
  providers: [PermissionResolverService],
  exports: [PermissionResolverService],
})
export class AuthorizationModule {}
