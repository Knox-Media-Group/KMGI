import { IsString, IsOptional, IsObject, ValidateNested, IsArray, IsEmail, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class SiteSettingsDto {
  @IsString()
  businessName: string;

  @IsString()
  industry: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['modern', 'classic', 'bold', 'minimal', 'playful', 'professional'])
  stylePreset: string;

  @IsString()
  accentColor: string;

  @IsIn(['call', 'book', 'quote'])
  primaryCta: string;

  @IsEmail()
  contactEmail: string;

  @IsString()
  contactPhone: string;
}

export class CreateSiteDto {
  @ValidateNested()
  @Type(() => SiteSettingsDto)
  settings: SiteSettingsDto;
}

export class GenerateDto {
  @IsString()
  @IsOptional()
  sectionId?: string;
}

class BlockDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsObject()
  props: Record<string, unknown>;
}

class SectionDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  variant: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  blocks: BlockDto[];
}

class PageDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  sections: SectionDto[];
}

export class SaveDraftDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageDto)
  pages: PageDto[];
}

export class RollbackDto {
  @IsString()
  versionId: string;
}
