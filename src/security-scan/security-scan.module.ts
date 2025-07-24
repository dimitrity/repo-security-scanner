import { Module } from '@nestjs/common';
import { SecurityScanController } from './security-scan.controller';
import { SecurityScanService } from './security-scan.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { SemgrepScanner } from './providers/scanner-semgrep.service';
import { GitleaksScanner } from './providers/scanner-gitleaks.service';
import { ScanStorageService } from './providers/scan-storage.service';
import { SecurityScanner } from './interfaces/scanners.interface';
import { ConfigModule } from '../config/config.module';

// SCM Providers
import { ScmProviderRegistryService } from './providers/scm-provider.registry';
import { ScmManagerService } from './providers/scm-manager.service';
import { EnhancedGitScmProvider } from './providers/scm-git-enhanced.provider';
import { GitHubScmProvider } from './providers/scm-github.provider';
import { GitLabScmProvider } from './providers/scm-gitlab.provider';

@Module({
  imports: [ConfigModule],
  controllers: [SecurityScanController],
  providers: [
    SecurityScanService,
    ApiKeyGuard,
    ScanStorageService,
    
    // Security Scanners
    SemgrepScanner,
    GitleaksScanner,
    {
      provide: 'SCANNERS',
      useFactory: (semgrepScanner: SemgrepScanner, gitleaksScanner: GitleaksScanner): SecurityScanner[] => {
        return [semgrepScanner, gitleaksScanner];
      },
      inject: [SemgrepScanner, GitleaksScanner],
    },

    // SCM Provider Registry and Manager
    ScmProviderRegistryService,
    ScmManagerService,

    // SCM Providers
    EnhancedGitScmProvider,
    GitHubScmProvider,
    GitLabScmProvider,

    // SCM Provider Registration
    {
      provide: 'SCM_PROVIDERS_SETUP',
      useFactory: (
        registry: ScmProviderRegistryService,
        enhancedGitProvider: EnhancedGitScmProvider,
        githubProvider: GitHubScmProvider,
        gitlabProvider: GitLabScmProvider
      ) => {
        // Configure authentication from environment variables
        const setupAuthentication = () => {
          // GitHub authentication
          const githubToken = process.env.GITHUB_TOKEN;
          if (githubToken) {
            githubProvider.configureAuthentication({
              type: 'token',
              token: githubToken
            });
          }

          // GitLab authentication
          const gitlabToken = process.env.GITLAB_TOKEN || process.env.GITLAB_ACCESS_TOKEN;
          if (gitlabToken) {
            gitlabProvider.configureAuthentication({
              type: 'token',
              token: gitlabToken
            });
          }
        };

        // Register providers in order of preference
        // More specific providers first, generic providers last
        registry.registerProvider(githubProvider);
        registry.registerProvider(gitlabProvider);
        registry.registerProvider(enhancedGitProvider);

        // Setup authentication
        setupAuthentication();

        return registry;
      },
      inject: [
        ScmProviderRegistryService,
        EnhancedGitScmProvider,
        GitHubScmProvider,
        GitLabScmProvider
      ],
    },
  ],
  exports: [
    SecurityScanService,
    ScmManagerService,
    ScmProviderRegistryService
  ],
})
export class SecurityScanModule {} 