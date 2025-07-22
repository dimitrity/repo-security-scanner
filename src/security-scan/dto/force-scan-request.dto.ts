import { IsUrl, IsOptional, IsBoolean } from 'class-validator';

export class ForceScanRequestDto {
  @IsUrl()
  repoUrl: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
} 