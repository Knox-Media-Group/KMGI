import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { WordPressService } from '../wordpress/wordpress.service';
import { SiteSettings, SiteContent, generateId } from '@builder/shared';
import * as crypto from 'crypto';

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  tenantId: string;
  permissions: string[];
  rateLimit: number;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}

export interface WebsiteGenerationRequest {
  businessName: string;
  industry: string;
  description?: string;
  contactEmail: string;
  contactPhone: string;
  address?: string;
  city?: string;
  state?: string;
  stylePreset?: 'modern' | 'classic' | 'bold' | 'minimal' | 'playful' | 'professional';
  accentColor?: string;
  primaryCta?: 'call' | 'book' | 'quote';
  pages?: ('home' | 'about' | 'services' | 'contact' | 'faq')[];
  ecommerce?: boolean;
}

export interface WebsiteGenerationResponse {
  id: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  previewUrl?: string;
  adminUrl?: string;
  generatedAt?: Date;
  pages: string[];
  estimatedTime: number; // seconds
}

@Injectable()
export class ApiService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private aiService: AiService,
    private wordPressService: WordPressService,
  ) {}

  // ============================================
  // API Key Management
  // ============================================

  generateApiKey(): string {
    const prefix = 'wb_live_';
    const key = crypto.randomBytes(32).toString('hex');
    return `${prefix}${key}`;
  }

  hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async createApiKey(
    tenantId: string,
    name: string,
    permissions: string[] = ['website:create', 'website:read'],
    rateLimit: number = 100,
    expiresInDays?: number,
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const rawKey = this.generateApiKey();
    const hashedKey = this.hashApiKey(rawKey);
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Store in database (assuming we have an ApiKey model)
    // For MVP, we'll simulate this
    const apiKey: ApiKey = {
      id: generateId(),
      key: hashedKey,
      name,
      tenantId,
      permissions,
      rateLimit,
      createdAt: new Date(),
      lastUsedAt: null,
      expiresAt,
    };

    return { apiKey, rawKey };
  }

  async validateApiKey(rawKey: string): Promise<ApiKey | null> {
    if (!rawKey || !rawKey.startsWith('wb_live_')) {
      return null;
    }

    const hashedKey = this.hashApiKey(rawKey);

    // Look up in database
    // For MVP, return mock validation
    // In production, query the database

    return {
      id: 'mock-key',
      key: hashedKey,
      name: 'Test API Key',
      tenantId: 'mock-tenant',
      permissions: ['website:create', 'website:read', 'website:update'],
      rateLimit: 100,
      createdAt: new Date(),
      lastUsedAt: null,
      expiresAt: null,
    };
  }

  // ============================================
  // White-Label Website Generation
  // ============================================

  async generateWebsite(
    request: WebsiteGenerationRequest,
    apiKey: ApiKey,
  ): Promise<WebsiteGenerationResponse> {
    const requestId = generateId();

    // Build site settings from request
    const settings: SiteSettings = {
      businessName: request.businessName,
      industry: request.industry,
      description: request.description,
      contactEmail: request.contactEmail,
      contactPhone: request.contactPhone,
      address: request.address,
      city: request.city,
      state: request.state,
      stylePreset: request.stylePreset || 'modern',
      accentColor: request.accentColor || '#8B5CF6',
      primaryCta: request.primaryCta || 'quote',
    };

    // Generate content using AI service
    try {
      const content = await this.aiService.generateSiteContent(settings);

      // Filter pages if specified
      if (request.pages && request.pages.length > 0) {
        content.pages = content.pages.filter(p =>
          request.pages!.includes(p.slug as 'home' | 'about' | 'services' | 'contact' | 'faq'),
        );
      }

      return {
        id: requestId,
        status: 'completed',
        previewUrl: `https://preview.1smartersite.com/${requestId}`,
        adminUrl: `https://1smartersite.com/admin/${requestId}`,
        generatedAt: new Date(),
        pages: content.pages.map(p => p.slug),
        estimatedTime: 0,
      };
    } catch (error) {
      console.error('Website generation error:', error);
      return {
        id: requestId,
        status: 'failed',
        pages: [],
        estimatedTime: 0,
      };
    }
  }

  async getWebsiteStatus(websiteId: string, apiKey: ApiKey): Promise<WebsiteGenerationResponse> {
    // Look up website status
    // For MVP, return mock status
    return {
      id: websiteId,
      status: 'completed',
      previewUrl: `https://preview.1smartersite.com/${websiteId}`,
      adminUrl: `https://1smartersite.com/admin/${websiteId}`,
      generatedAt: new Date(),
      pages: ['home', 'about', 'services', 'contact', 'faq'],
      estimatedTime: 0,
    };
  }

  // ============================================
  // OpenAPI Specification
  // ============================================

  getOpenAPISpec(): object {
    return {
      openapi: '3.0.3',
      info: {
        title: '1SmarterSite Website Builder API',
        description: `
White-label API for generating professional websites using AI.

## Authentication
All API requests require an API key passed in the \`X-API-Key\` header.

\`\`\`
X-API-Key: wb_live_your_api_key_here
\`\`\`

## Rate Limits
- Default: 100 requests per minute
- Enterprise: Contact us for higher limits

## Webhooks
You can configure webhooks to receive notifications when websites are generated.
        `,
        version: '1.0.0',
        contact: {
          name: 'API Support',
          email: 'api@1smartersite.com',
        },
      },
      servers: [
        {
          url: 'https://api.1smartersite.com/v1',
          description: 'Production server',
        },
        {
          url: 'https://api-staging.1smartersite.com/v1',
          description: 'Staging server',
        },
      ],
      security: [{ apiKey: [] }],
      paths: {
        '/websites': {
          post: {
            summary: 'Generate a new website',
            description: 'Creates a new AI-generated website based on the provided business information.',
            operationId: 'createWebsite',
            tags: ['Websites'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/WebsiteGenerationRequest' },
                  example: {
                    businessName: 'Acme Corp',
                    industry: 'Technology',
                    description: 'Leading provider of innovative tech solutions',
                    contactEmail: 'hello@acme.com',
                    contactPhone: '+1 555-0123',
                    city: 'San Francisco',
                    state: 'CA',
                    stylePreset: 'modern',
                    accentColor: '#2563EB',
                    primaryCta: 'book',
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Website generation initiated',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/WebsiteGenerationResponse' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Invalid API key' },
              '429': { description: 'Rate limit exceeded' },
            },
          },
        },
        '/websites/{websiteId}': {
          get: {
            summary: 'Get website status',
            description: 'Retrieves the current status and details of a website.',
            operationId: 'getWebsite',
            tags: ['Websites'],
            parameters: [
              {
                name: 'websiteId',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': {
                description: 'Website details',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/WebsiteGenerationResponse' },
                  },
                },
              },
              '404': { description: 'Website not found' },
            },
          },
        },
        '/websites/{websiteId}/publish': {
          post: {
            summary: 'Publish website',
            description: 'Publishes the website to the live domain.',
            operationId: 'publishWebsite',
            tags: ['Websites'],
            parameters: [
              {
                name: 'websiteId',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': { description: 'Website published successfully' },
              '404': { description: 'Website not found' },
            },
          },
        },
        '/api-keys': {
          post: {
            summary: 'Create API key',
            description: 'Creates a new API key for your account.',
            operationId: 'createApiKey',
            tags: ['API Keys'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'A friendly name for the API key' },
                      permissions: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of permissions',
                      },
                      expiresInDays: { type: 'integer', description: 'Days until expiration (optional)' },
                    },
                    required: ['name'],
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'API key created',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        key: { type: 'string', description: 'The API key (only shown once)' },
                        name: { type: 'string' },
                        permissions: { type: 'array', items: { type: 'string' } },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
        },
        schemas: {
          WebsiteGenerationRequest: {
            type: 'object',
            required: ['businessName', 'industry', 'contactEmail', 'contactPhone'],
            properties: {
              businessName: { type: 'string', description: 'The name of the business' },
              industry: { type: 'string', description: 'The industry/niche of the business' },
              description: { type: 'string', description: 'Brief description of the business' },
              contactEmail: { type: 'string', format: 'email' },
              contactPhone: { type: 'string' },
              address: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              stylePreset: {
                type: 'string',
                enum: ['modern', 'classic', 'bold', 'minimal', 'playful', 'professional'],
                default: 'modern',
              },
              accentColor: { type: 'string', description: 'Hex color code (e.g., #8B5CF6)' },
              primaryCta: {
                type: 'string',
                enum: ['call', 'book', 'quote'],
                default: 'quote',
              },
              pages: {
                type: 'array',
                items: { type: 'string', enum: ['home', 'about', 'services', 'contact', 'faq'] },
                description: 'Pages to generate (default: all)',
              },
              ecommerce: { type: 'boolean', description: 'Enable WooCommerce e-commerce' },
            },
          },
          WebsiteGenerationResponse: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique website ID' },
              status: {
                type: 'string',
                enum: ['pending', 'generating', 'completed', 'failed'],
              },
              previewUrl: { type: 'string', format: 'uri' },
              adminUrl: { type: 'string', format: 'uri' },
              generatedAt: { type: 'string', format: 'date-time' },
              pages: { type: 'array', items: { type: 'string' } },
              estimatedTime: { type: 'integer', description: 'Estimated time in seconds' },
            },
          },
        },
      },
      tags: [
        { name: 'Websites', description: 'Website generation and management' },
        { name: 'API Keys', description: 'API key management' },
      ],
    };
  }

  // ============================================
  // SDK Code Examples
  // ============================================

  getSDKExamples(): object {
    return {
      javascript: `
// Install: npm install @1smartersite/sdk
import { WebsiteBuilder } from '@1smartersite/sdk';

const builder = new WebsiteBuilder({
  apiKey: 'wb_live_your_api_key'
});

// Generate a website
const website = await builder.websites.create({
  businessName: 'Acme Corp',
  industry: 'Technology',
  contactEmail: 'hello@acme.com',
  contactPhone: '+1 555-0123',
  stylePreset: 'modern'
});

console.log('Website ID:', website.id);
console.log('Preview URL:', website.previewUrl);

// Publish the website
await builder.websites.publish(website.id);
      `.trim(),

      python: `
# Install: pip install smartersite
from smartersite import WebsiteBuilder

builder = WebsiteBuilder(api_key='wb_live_your_api_key')

# Generate a website
website = builder.websites.create(
    business_name='Acme Corp',
    industry='Technology',
    contact_email='hello@acme.com',
    contact_phone='+1 555-0123',
    style_preset='modern'
)

print(f'Website ID: {website.id}')
print(f'Preview URL: {website.preview_url}')

# Publish the website
builder.websites.publish(website.id)
      `.trim(),

      curl: `
# Generate a website
curl -X POST https://api.1smartersite.com/v1/websites \\
  -H "X-API-Key: wb_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "businessName": "Acme Corp",
    "industry": "Technology",
    "contactEmail": "hello@acme.com",
    "contactPhone": "+1 555-0123",
    "stylePreset": "modern"
  }'

# Check status
curl https://api.1smartersite.com/v1/websites/{websiteId} \\
  -H "X-API-Key: wb_live_your_api_key"

# Publish
curl -X POST https://api.1smartersite.com/v1/websites/{websiteId}/publish \\
  -H "X-API-Key: wb_live_your_api_key"
      `.trim(),
    };
  }
}
