import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { SecurityScanModule } from './security-scan/security-scan.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [ConfigModule, SecurityScanModule, AuthModule],
})
export class AppModule {}
