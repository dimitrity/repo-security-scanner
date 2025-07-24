import { IsString, IsUrl } from 'class-validator';

export class ScanRequestDto {
  @IsString()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  repoUrl: string;
}
