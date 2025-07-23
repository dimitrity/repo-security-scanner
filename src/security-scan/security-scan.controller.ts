import { Body, Controller, Post, Get, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { SecurityScanService } from './security-scan.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ScanRequestDto } from './dto/scan-request.dto';
import { CodeContextRequestDto } from './dto/code-context-request.dto';

@UseGuards(ApiKeyGuard)
@Controller('scan')
export class SecurityScanController {
  constructor(private readonly scanService: SecurityScanService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async scanRepository(@Body() body: ScanRequestDto): Promise<any> {
    return this.scanService.scanRepository(body.repoUrl);
  }

  @Post('force')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async forceScanRepository(@Body() body: ScanRequestDto): Promise<any> {
    return this.scanService.forceScanRepository(body.repoUrl);
  }

  @Post('context')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async getCodeContext(@Body() body: CodeContextRequestDto): Promise<any> {
    return this.scanService.getCodeContextForFile(
      body.repoUrl,
      body.filePath,
      body.line,
      body.context || 3
    );
  }

  @Get('statistics')
  async getScanStatistics(): Promise<any> {
    return this.scanService.getScanStatistics();
  }

  @Get('records')
  async getAllScanRecords(): Promise<any> {
    return this.scanService.getAllScanRecords();
  }
} 