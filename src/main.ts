import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from './config/config.service';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Get ConfigService for accessing configuration
  const configService = app.get(ConfigService);
  
  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:8080', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  });

  // Serve static files
  app.useStaticAssets(join(__dirname, '..', 'public'));
  
  const port = configService.getPort();
  const environment = configService.getEnvironment();
  
  await app.listen(port);
  
  console.log(`🚀 Repository Security Scanner started successfully!`);
  console.log(`📡 Server running on: http://localhost:${port}`);
  console.log(`🌍 Environment: ${environment}`);
  console.log(`🔑 API Keys configured: ${configService.getApiKeyCount()}`);
  if (!configService.isProduction()) {
    console.log(`⚠️  Development mode - additional logging enabled`);
  }
}

bootstrap();
