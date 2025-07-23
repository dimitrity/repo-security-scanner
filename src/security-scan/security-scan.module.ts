import { Module } from '@nestjs/common';
import { SecurityScanController } from './security-scan.controller';
import { SecurityScanService } from './security-scan.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { GitScmProvider } from './providers/scm-git.provider';
import { SemgrepScanner } from './providers/scanner-semgrep.service';
import { GitleaksScanner } from './providers/scanner-gitleaks.service';
import { ScanStorageService } from './providers/scan-storage.service';
import { SecurityScanner } from './interfaces/scanners.interface';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [SecurityScanController],
  providers: [
    SecurityScanService,
    ApiKeyGuard,
    GitScmProvider,
    SemgrepScanner,
    GitleaksScanner,
    ScanStorageService,
    {
      provide: 'SCANNERS',
      useFactory: (semgrepScanner: SemgrepScanner, gitleaksScanner: GitleaksScanner): SecurityScanner[] => {
        return [semgrepScanner, gitleaksScanner];
      },
      inject: [SemgrepScanner, GitleaksScanner],
    },
  ],
  exports: [SecurityScanService],
})
export class SecurityScanModule {} 