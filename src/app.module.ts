import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { SecurityScanModule } from './security-scan/security-scan.module';
import { ConfigService } from './config/config.service';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getThrottlerConfig();
        return [
          {
            ttl: config.ttl * 1000, // Convert to milliseconds
            limit: config.limit,
          },
        ];
      },
    }),
    SecurityScanModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
