import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:8080', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  });

  // Serve static files
  app.useStaticAssets(join(__dirname, '..', 'public'));
  
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  
  await app.listen(port);
  
  console.log(`🚀 Repository Security Scanner started successfully!`);
  console.log(`📡 Server running on: http://localhost:${port}`);
}

bootstrap();
