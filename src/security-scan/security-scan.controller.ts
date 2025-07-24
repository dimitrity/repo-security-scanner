import { Body, Controller, Post, Get, UseGuards, UsePipes, ValidationPipe, Res } from '@nestjs/common';
import { SecurityScanService } from './security-scan.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ScanRequestDto } from './dto/scan-request.dto';
import { CodeContextRequestDto } from './dto/code-context-request.dto';
import { Response } from 'express';
import { join } from 'path';

@Controller()
export class SecurityScanController {
  constructor(private readonly scanService: SecurityScanService) {}

  @Get()
  serveUI(@Res() res: Response) {
    res.sendFile(join(__dirname, 'ui', 'index.html'));
  }

  @UseGuards(ApiKeyGuard)
  @Post('scan')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async scanRepository(@Body() body: ScanRequestDto): Promise<any> {
    return this.scanService.scanRepository(body.repoUrl);
  }

  @UseGuards(ApiKeyGuard)
  @Post('scan/force')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async forceScanRepository(@Body() body: ScanRequestDto): Promise<any> {
    return this.scanService.forceScanRepository(body.repoUrl);
  }

  @UseGuards(ApiKeyGuard)
  @Post('scan/context')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async getCodeContext(@Body() body: CodeContextRequestDto): Promise<any> {
    return this.scanService.getCodeContextForFile(
      body.repoUrl,
      body.filePath,
      body.line,
      body.context || 3
    );
  }

  @UseGuards(ApiKeyGuard)
  @Get('scan/statistics')
  async getScanStatistics(): Promise<any> {
    return this.scanService.getScanStatistics();
  }

  @UseGuards(ApiKeyGuard)
  @Get('scan/records')
  async getAllScanRecords(): Promise<any> {
    return this.scanService.getAllScanRecords();
  }
} 