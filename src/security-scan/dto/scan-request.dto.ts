import { IsString, IsUrl } from 'class-validator';

export class ScanRequestDto {
  @IsString()
  @IsUrl()
  repoUrl: string;
} 