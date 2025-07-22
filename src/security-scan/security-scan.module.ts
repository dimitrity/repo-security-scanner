import { Module } from '@nestjs/common';
import { SecurityScanController } from './security-scan.controller';
import { SecurityScanService } from './security-scan.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { GitScmProvider } from './providers/scm-git.provider';
import { SemgrepScanner } from './providers/scanner-semgrep.service';
import { SecurityScanner } from './interfaces/scanners.interface';

@Module({
  controllers: [SecurityScanController],
  providers: [
    SecurityScanService,
    ApiKeyGuard,
    GitScmProvider,
    SemgrepScanner,
    {
      provide: 'SCANNERS',
      useFactory: (semgrepScanner: SemgrepScanner): SecurityScanner[] => {
        return [semgrepScanner];
      },
      inject: [SemgrepScanner],
    },
  ],
  exports: [SecurityScanService],
})
export class SecurityScanModule {} 