# NestJS Folder Structure

## Overview

The repository has been restructured to follow NestJS conventions and best practices. This provides better organization, maintainability, and scalability.

## New Structure

```
src/
├── main.ts                          # Application entry point
├── app.module.ts                    # Root application module
├── app.service.ts                   # Root application service
├── config/                          # Configuration module
│   ├── config.module.ts            # Configuration module definition
│   └── config.service.ts           # Configuration service
└── security-scan/                   # Security scanning feature module
    ├── dto/                         # Data Transfer Objects
    │   ├── scan-request.dto.ts     # Request DTO for scan endpoint
    │   ├── scan-request.dto.spec.ts
    │   ├── scan-result.dto.ts      # Response DTO for scan results
    │   └── scan-result.dto.spec.ts
    ├── guards/                      # Authentication guards
    │   ├── api-key.guard.ts        # API key authentication guard
    │   └── api-key.guard.spec.ts
    ├── interfaces/                  # TypeScript interfaces
    │   ├── scanners.interface.ts   # Security scanner interface
    │   └── scm.interface.ts        # Source control management interface
    ├── providers/                   # Service providers
    │   ├── scm-git.provider.ts     # Git SCM provider implementation
    │   ├── scm-git.provider.spec.ts
    │   ├── scanner-semgrep.service.ts # Semgrep security scanner
    │   └── scanner-semgrep.service.spec.ts
    ├── security-scan.controller.ts # Main controller for scan endpoints
    ├── security-scan.controller.spec.ts
    ├── security-scan.service.ts    # Main service for scan orchestration
    ├── security-scan.service.spec.ts
    └── security-scan.module.ts     # Feature module definition
```

## Key Changes

### 1. **Feature-Based Organization**
- All security scanning functionality is now grouped under `security-scan/`
- Related files are organized by type (controllers, services, providers, etc.)
- Clear separation of concerns

### 2. **Module Structure**
- **AppModule**: Root module that imports feature modules
- **ConfigModule**: Handles application configuration
- **SecurityScanModule**: Encapsulates all security scanning functionality

### 3. **Dependency Injection**
- Services now use proper dependency injection
- Providers are registered in the module
- Better testability and maintainability

### 4. **File Organization**
- **DTOs**: Data transfer objects for API contracts
- **Guards**: Authentication and authorization
- **Interfaces**: TypeScript type definitions
- **Providers**: Service implementations
- **Controllers**: HTTP request handlers
- **Services**: Business logic

## Module Definitions

### AppModule (src/app.module.ts)
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { SecurityScanModule } from './security-scan/security-scan.module';

@Module({
  imports: [ConfigModule, SecurityScanModule],
})
export class AppModule {}
```

### SecurityScanModule (src/security-scan/security-scan.module.ts)
```typescript
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
```

### ConfigModule (src/config/config.module.ts)
```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';

@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
```

## Benefits of the New Structure

### 1. **Scalability**
- Easy to add new features as separate modules
- Clear boundaries between different parts of the application
- Modular architecture supports team development

### 2. **Maintainability**
- Related code is grouped together
- Clear file naming conventions
- Easy to locate specific functionality

### 3. **Testability**
- Services use dependency injection
- Easy to mock dependencies
- Isolated unit tests

### 4. **NestJS Best Practices**
- Follows official NestJS conventions
- Proper module organization
- Standard file naming patterns

### 5. **Type Safety**
- Clear interface definitions
- Proper TypeScript usage
- Better IDE support

## Import Paths

### Before Restructuring
```typescript
import { SecurityScanController } from './security-scan.controller';
import { SecurityScanService } from './security-scan.service';
import { ApiKeyGuard } from './api-key.guard';
import { ScmProvider } from './scm.interface';
```

### After Restructuring
```typescript
import { SecurityScanController } from './security-scan/security-scan.controller';
import { SecurityScanService } from './security-scan/security-scan.service';
import { ApiKeyGuard } from './security-scan/guards/api-key.guard';
import { ScmProvider } from './security-scan/interfaces/scm.interface';
```

## Testing Structure

Tests are co-located with their corresponding implementation files:

```
src/security-scan/
├── dto/
│   ├── scan-request.dto.ts
│   └── scan-request.dto.spec.ts    # Test file next to implementation
├── providers/
│   ├── scm-git.provider.ts
│   └── scm-git.provider.spec.ts    # Test file next to implementation
└── security-scan.service.ts
    └── security-scan.service.spec.ts # Test file next to implementation
```

## Future Enhancements

### 1. **Additional Modules**
- `auth/` - Authentication and authorization
- `reports/` - Report generation and management
- `notifications/` - Notification services
- `analytics/` - Analytics and metrics

### 2. **Shared Modules**
- `common/` - Shared utilities and components
- `database/` - Database configuration and models
- `logging/` - Logging configuration

### 3. **Feature Flags**
- Easy to enable/disable features
- Module-level feature toggles
- Configuration-driven features

## Migration Notes

### 1. **Import Updates**
All import paths have been updated to reflect the new structure. The main changes are:
- Services moved to `security-scan/`
- Providers moved to `security-scan/providers/`
- Guards moved to `security-scan/guards/`
- DTOs moved to `security-scan/dto/`

### 2. **Module Registration**
- Services are now properly registered in modules
- Dependency injection is used throughout
- Providers are configured with proper tokens

### 3. **Testing**
- Test files moved with their corresponding implementation
- Import paths updated in test files
- Mock configurations updated for new structure

The new structure provides a solid foundation for future development while maintaining all existing functionality. 