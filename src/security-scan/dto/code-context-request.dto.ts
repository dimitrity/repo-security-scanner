import {
  IsString,
  IsUrl,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CodeContextRequestDto {
  @IsString()
  @IsUrl()
  repoUrl: string;

  @IsString()
  filePath: string;

  @IsNumber()
  @Min(1)
  line: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  context?: number; // Optional, defaults to 3, max 20 lines of context
}
