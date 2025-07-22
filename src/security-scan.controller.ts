import { Body, Controller, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { SecurityScanService } from './security-scan.service';
import { ApiKeyGuard } from './api-key.guard';
import { ScanRequestDto } from './dto/scan-request.dto';

@UseGuards(ApiKeyGuard)
@Controller('scan')
export class SecurityScanController {
  constructor(private readonly scanService: SecurityScanService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async scanRepository(@Body() body: ScanRequestDto): Promise<any> {
    return this.scanService.scanRepository(body.repoUrl);
  }
} 