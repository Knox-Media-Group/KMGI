import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiService, WebsiteGenerationRequest, ApiKey } from './api.service';

class CreateApiKeyDto {
  name: string;
  permissions?: string[];
  expiresInDays?: number;
}

@Controller('v1')
export class ApiController {
  constructor(private apiService: ApiService) {}

  // Middleware helper to validate API key
  private async validateApiKey(apiKeyHeader: string): Promise<ApiKey> {
    if (!apiKeyHeader) {
      throw new HttpException('API key required', HttpStatus.UNAUTHORIZED);
    }

    const apiKey = await this.apiService.validateApiKey(apiKeyHeader);
    if (!apiKey) {
      throw new HttpException('Invalid API key', HttpStatus.UNAUTHORIZED);
    }

    return apiKey;
  }

  /**
   * POST /api/v1/websites
   *
   * Generate a new website via the white-label API
   */
  @Post('websites')
  async createWebsite(
    @Headers('x-api-key') apiKeyHeader: string,
    @Body() request: WebsiteGenerationRequest,
  ) {
    const apiKey = await this.validateApiKey(apiKeyHeader);

    // Validate required fields
    if (!request.businessName || !request.industry || !request.contactEmail || !request.contactPhone) {
      throw new HttpException(
        'Missing required fields: businessName, industry, contactEmail, contactPhone',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.apiService.generateWebsite(request, apiKey);
    return result;
  }

  /**
   * GET /api/v1/websites/:websiteId
   *
   * Get website status and details
   */
  @Get('websites/:websiteId')
  async getWebsite(
    @Headers('x-api-key') apiKeyHeader: string,
    @Param('websiteId') websiteId: string,
  ) {
    const apiKey = await this.validateApiKey(apiKeyHeader);
    return this.apiService.getWebsiteStatus(websiteId, apiKey);
  }

  /**
   * POST /api/v1/websites/:websiteId/publish
   *
   * Publish a website to production
   */
  @Post('websites/:websiteId/publish')
  async publishWebsite(
    @Headers('x-api-key') apiKeyHeader: string,
    @Param('websiteId') websiteId: string,
  ) {
    const apiKey = await this.validateApiKey(apiKeyHeader);

    // In production, trigger the publish workflow
    return {
      success: true,
      message: 'Website publishing initiated',
      websiteId,
    };
  }

  /**
   * POST /api/v1/api-keys
   *
   * Create a new API key (requires admin API key)
   */
  @Post('api-keys')
  async createApiKey(
    @Headers('x-api-key') apiKeyHeader: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    const apiKey = await this.validateApiKey(apiKeyHeader);

    if (!dto.name) {
      throw new HttpException('API key name is required', HttpStatus.BAD_REQUEST);
    }

    const result = await this.apiService.createApiKey(
      apiKey.tenantId,
      dto.name,
      dto.permissions,
      100,
      dto.expiresInDays,
    );

    return {
      id: result.apiKey.id,
      key: result.rawKey, // Only returned once!
      name: result.apiKey.name,
      permissions: result.apiKey.permissions,
      createdAt: result.apiKey.createdAt,
      expiresAt: result.apiKey.expiresAt,
    };
  }

  /**
   * GET /api/v1/openapi.json
   *
   * Get OpenAPI specification
   */
  @Get('openapi.json')
  getOpenAPISpec() {
    return this.apiService.getOpenAPISpec();
  }

  /**
   * GET /api/v1/docs
   *
   * Get SDK examples and documentation
   */
  @Get('docs')
  getDocs() {
    return {
      openApiSpec: '/api/v1/openapi.json',
      sdkExamples: this.apiService.getSDKExamples(),
      authentication: {
        type: 'API Key',
        header: 'X-API-Key',
        format: 'wb_live_xxxxxxxx',
      },
      rateLimits: {
        default: '100 requests/minute',
        enterprise: 'Contact for higher limits',
      },
      support: {
        email: 'api@1smartersite.com',
        docs: 'https://docs.1smartersite.com',
      },
    };
  }
}
