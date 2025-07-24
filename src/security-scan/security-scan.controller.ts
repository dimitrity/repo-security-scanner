import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Res,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { SecurityScanService } from './security-scan.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ScanRequestDto } from './dto/scan-request.dto';
import { CodeContextRequestDto } from './dto/code-context-request.dto';
import { Response } from 'express';
import { join } from 'path';

@Controller()
export class SecurityScanController {
  constructor(private readonly scanService: SecurityScanService) {}

  // Root route is handled by static assets middleware

  @UseGuards(ApiKeyGuard)
  @Post('scan')
  @Throttle({ default: { ttl: 300000, limit: 5 } }) // 5 requests per 5 minutes for scan endpoints
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async scanRepository(@Body() body: ScanRequestDto): Promise<any> {
    return this.scanService.scanRepository(body.repoUrl);
  }

  @UseGuards(ApiKeyGuard)
  @Post('scan/force')
  @Throttle({ default: { ttl: 300000, limit: 3 } }) // 3 requests per 5 minutes for force scan
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async forceScanRepository(@Body() body: ScanRequestDto): Promise<any> {
    return this.scanService.forceScanRepository(body.repoUrl);
  }

  @UseGuards(ApiKeyGuard)
  @Post('scan/context')
  @Throttle({ default: { ttl: 60000, limit: 20 } }) // 20 requests per minute for context
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async getCodeContext(@Body() body: CodeContextRequestDto): Promise<any> {
    return this.scanService.getCodeContextForFile(
      body.repoUrl,
      body.filePath,
      body.line,
      body.context || 3,
    );
  }

  @UseGuards(ApiKeyGuard)
  @Get('scan/statistics')
  @Throttle({ default: { ttl: 60000, limit: 30 } }) // 30 requests per minute for statistics
  async getScanStatistics(): Promise<any> {
    return this.scanService.getScanStatistics();
  }

  @UseGuards(ApiKeyGuard)
  @Get('scan/records')
  @Throttle({ default: { ttl: 60000, limit: 30 } }) // 30 requests per minute for records
  async getAllScanRecords(): Promise<any> {
    return this.scanService.getAllScanRecords();
  }
}
