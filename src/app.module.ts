import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { SecurityScanModule } from './security-scan/security-scan.module';

@Module({
  imports: [ConfigModule, SecurityScanModule],
})
export class AppModule {}
