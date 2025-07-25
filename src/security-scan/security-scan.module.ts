import { Module } from '@nestjs/common';
import { SecurityScanController } from './security-scan.controller';
import { SecurityScanService } from './security-scan.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { SemgrepScanner } from './providers/scanner-semgrep.service';
import { GitleaksScanner } from './providers/scanner-gitleaks.service';
import { ScanStorageService } from './providers/scan-storage.service';
import { ScanCacheService } from './providers/scan-cache.service';
import { SecurityScanner } from './interfaces/scanners.interface';
import { ConfigModule } from '../config/config.module';

// SCM Providers
import { ScmProviderRegistryService } from './providers/scm-provider.registry';
import { ScmManagerService } from './providers/scm-manager.service';
import { EnhancedGitScmProvider } from './providers/scm-git-enhanced.provider';
import { GitHubScmProvider } from './providers/scm-github.provider';
import { GitLabScmProvider } from './providers/scm-gitlab.provider';
import { BitbucketScmProvider } from './providers/scm-bitbucket.provider';

@Module({
  imports: [ConfigModule],
  controllers: [SecurityScanController],
  providers: [
    SecurityScanService,
    ApiKeyGuard,
    ScanStorageService,
    ScanCacheService,
    
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
    BitbucketScmProvider,

    // SCM Provider Registration
    {
      provide: 'SCM_PROVIDERS_SETUP',
      useFactory: (
        registry: ScmProviderRegistryService,
        enhancedGitProvider: EnhancedGitScmProvider,
        githubProvider: GitHubScmProvider,
        gitlabProvider: GitLabScmProvider,
        bitbucketProvider: BitbucketScmProvider
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

          // Bitbucket authentication
          const bitbucketToken = process.env.BITBUCKET_TOKEN || process.env.BITBUCKET_APP_PASSWORD;
          if (bitbucketToken) {
            bitbucketProvider.configureAuthentication({
              type: 'token',
              token: bitbucketToken
            });
          }
        };

        // Register providers in order of preference
        // More specific providers first, generic providers last
        registry.registerProvider(githubProvider);
        registry.registerProvider(gitlabProvider);
        registry.registerProvider(bitbucketProvider);
        registry.registerProvider(enhancedGitProvider);

        // Setup authentication
        setupAuthentication();

        return registry;
      },
      inject: [
        ScmProviderRegistryService,
        EnhancedGitScmProvider,
        GitHubScmProvider,
        GitLabScmProvider,
        BitbucketScmProvider
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