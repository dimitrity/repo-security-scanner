import { Module } from '@nestjs/common';
import { SecurityScanController } from './security-scan.controller';
import { SecurityScanService } from './security-scan.service';
import { ConfigModule } from './config.module';


@Module({
  imports: [ConfigModule],
  controllers: [SecurityScanController],
  providers: [SecurityScanService],
})
export class AppModule {}
