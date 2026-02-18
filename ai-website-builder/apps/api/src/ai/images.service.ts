import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface AIImageRequest {
  prompt: string;
  style?: 'natural' | 'vivid';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

export interface AIImageResult {
  url: string;
  revisedPrompt: string;
  source: 'ai-generated' | 'unsplash' | 'fallback';
}

// Industry to search term mappings for better image results
const INDUSTRY_SEARCH_TERMS: Record<string, string[]> = {
  'Restaurant': ['restaurant interior', 'gourmet food', 'chef cooking', 'dining table'],
  'Retail': ['modern store', 'shopping bags', 'retail display', 'boutique interior'],
  'Healthcare': ['modern hospital', 'doctor patient', 'medical team', 'healthcare professional'],
  'Real Estate': ['luxury home', 'modern architecture', 'house interior', 'real estate agent'],
  'Legal': ['law office', 'legal books', 'courthouse', 'professional meeting'],
  'Finance': ['financial charts', 'business meeting', 'modern office', 'investment growth'],
  'Technology': ['tech workspace', 'coding laptop', 'modern technology', 'digital innovation'],
  'Education': ['classroom learning', 'students studying', 'library books', 'education campus'],
  'Fitness': ['gym workout', 'fitness training', 'yoga studio', 'healthy lifestyle'],
  'Beauty': ['beauty salon', 'spa treatment', 'cosmetics', 'skincare products'],
  'Construction': ['construction site', 'building architecture', 'contractor work', 'home renovation'],
  'Automotive': ['car showroom', 'auto repair', 'luxury vehicles', 'mechanic workshop'],
  'Other': ['professional business', 'modern office', 'team collaboration', 'business success'],
};

// Section type to search context
const SECTION_SEARCH_CONTEXT: Record<string, string> = {
  'hero': 'professional business banner',
  'about': 'team professional portrait',
  'services': 'business service quality',
  'testimonials': 'happy customer client',
  'contact': 'customer service support',
  'gallery': 'portfolio showcase',
};

interface UnsplashImage {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string;
  user: {
    name: string;
  };
}

@Injectable()
export class ImagesService {
  private unsplashAccessKey: string | null;
  private openai: OpenAI | null;
  private cache: Map<string, string[]> = new Map();
  private aiImageCache: Map<string, AIImageResult> = new Map();

  constructor(private configService: ConfigService) {
    this.unsplashAccessKey = this.configService.get('UNSPLASH_ACCESS_KEY') || null;
    const openaiKey = this.configService.get('OPENAI_API_KEY');
    this.openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

    if (!this.unsplashAccessKey) {
      console.log('ImagesService: No Unsplash API key, will use curated fallback images');
    }
    if (this.openai) {
      console.log('ImagesService: AI image generation enabled (DALL-E 3)');
    }
  }

  // ============================================
  // AI Image Generation (DALL-E 3)
  // ============================================

  /**
   * Generate a custom AI image using DALL-E 3
   */
  async generateAIImage(request: AIImageRequest): Promise<AIImageResult> {
    const cacheKey = `ai-${request.prompt}-${request.style}-${request.size}`;
    if (this.aiImageCache.has(cacheKey)) {
      return this.aiImageCache.get(cacheKey)!;
    }

    if (!this.openai) {
      // Fallback to Unsplash-style image if no OpenAI key
      return {
        url: await this.getFallbackImage('default', 'hero'),
        revisedPrompt: request.prompt,
        source: 'fallback',
      };
    }

    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: request.prompt,
        n: 1,
        size: request.size || '1792x1024',
        quality: request.quality || 'hd',
        style: request.style || 'natural',
      });

      const imageData = response.data?.[0];
      if (!imageData?.url) {
        throw new Error('No image data returned');
      }

      const result: AIImageResult = {
        url: imageData.url,
        revisedPrompt: imageData.revised_prompt || request.prompt,
        source: 'ai-generated',
      };

      this.aiImageCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('DALL-E generation failed:', error);
      return {
        url: await this.getFallbackImage('default', 'hero'),
        revisedPrompt: request.prompt,
        source: 'fallback',
      };
    }
  }

  /**
   * Generate a website-specific image based on business context
   */
  async generateBusinessImage(
    businessName: string,
    industry: string,
    sectionType: string,
    style: 'photorealistic' | 'illustration' | 'abstract' | 'minimal' = 'photorealistic',
  ): Promise<AIImageResult> {
    const styleMap = {
      photorealistic: 'Professional photorealistic image,',
      illustration: 'Modern flat illustration style,',
      abstract: 'Abstract geometric art style,',
      minimal: 'Clean minimal design with whitespace,',
    };

    const sectionPrompts: Record<string, string> = {
      hero: `${styleMap[style]} stunning hero banner for a ${industry} business called "${businessName}". Wide panoramic composition, premium quality, bright and inviting, no text or logos.`,
      about: `${styleMap[style]} professional team or workplace photo for a ${industry} company. Shows competence and trust, warm lighting, no text.`,
      services: `${styleMap[style]} visual representation of ${industry} services being performed. High quality, professional setting, no text.`,
      testimonials: `${styleMap[style]} happy satisfied customer or client in a ${industry} context. Genuine and warm, no text.`,
      gallery: `${styleMap[style]} portfolio showcase image for a ${industry} business. Shows quality work or products, no text.`,
      contact: `${styleMap[style]} welcoming office or storefront for a ${industry} business. Professional and approachable, no text.`,
      team: `${styleMap[style]} diverse professional team working together in a ${industry} setting. Collaborative and friendly, no text.`,
      features: `${styleMap[style]} key feature or benefit visualization for a ${industry} company. Clean and modern, no text.`,
    };

    const prompt = sectionPrompts[sectionType] || sectionPrompts.hero;

    return this.generateAIImage({
      prompt,
      style: style === 'photorealistic' ? 'natural' : 'vivid',
      size: sectionType === 'hero' ? '1792x1024' : '1024x1024',
      quality: 'hd',
    });
  }

  /**
   * Generate a logo concept for a business
   */
  async generateLogoConcept(
    businessName: string,
    industry: string,
    colorScheme: string = 'modern blue and white',
  ): Promise<AIImageResult> {
    return this.generateAIImage({
      prompt: `Professional minimalist logo design for "${businessName}", a ${industry} business. ${colorScheme} color scheme. Clean vector style on white background. Simple iconic symbol that represents ${industry}. No text in the logo.`,
      style: 'vivid',
      size: '1024x1024',
      quality: 'hd',
    });
  }

  /**
   * Generate a favicon/icon for a business
   */
  async generateIcon(
    businessName: string,
    industry: string,
    primaryColor: string = '#6366f1',
  ): Promise<AIImageResult> {
    return this.generateAIImage({
      prompt: `Simple app icon or favicon for a ${industry} business called "${businessName}". Single clean symbol on ${primaryColor} background. Minimal design, works at small sizes. Square format.`,
      style: 'vivid',
      size: '1024x1024',
      quality: 'standard',
    });
  }

  /**
   * Get a relevant image URL for a given industry and section type
   */
  async getImage(industry: string, sectionType: string, index: number = 0): Promise<string> {
    // Build search query
    const industryTerms = INDUSTRY_SEARCH_TERMS[industry] || INDUSTRY_SEARCH_TERMS['Other'];
    const sectionContext = SECTION_SEARCH_CONTEXT[sectionType] || '';
    const searchTerm = `${industryTerms[index % industryTerms.length]} ${sectionContext}`.trim();

    // Check cache first
    const cacheKey = `${industry}-${sectionType}-${index}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return cached[0];
    }

    // If no API key, use curated fallback
    if (!this.unsplashAccessKey) {
      return this.getFallbackImage(industry, sectionType);
    }

    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&per_page=5&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${this.unsplashAccessKey}`,
          },
        }
      );

      if (!response.ok) {
        console.warn('Unsplash API error:', response.status);
        return this.getFallbackImage(industry, sectionType);
      }

      const data = await response.json();
      const images: UnsplashImage[] = data.results;

      if (images.length === 0) {
        return this.getFallbackImage(industry, sectionType);
      }

      // Cache the results
      const urls = images.map(img => img.urls.regular);
      this.cache.set(cacheKey, urls);

      return urls[0];
    } catch (error) {
      console.error('Failed to fetch from Unsplash:', error);
      return this.getFallbackImage(industry, sectionType);
    }
  }

  /**
   * Get multiple images for a section (e.g., gallery, team)
   */
  async getImages(industry: string, sectionType: string, count: number): Promise<string[]> {
    const images: string[] = [];
    for (let i = 0; i < count; i++) {
      const url = await this.getImage(industry, sectionType, i);
      images.push(url);
    }
    return images;
  }

  /**
   * Curated fallback images by industry (high-quality stock photos)
   */
  private getFallbackImage(industry: string, sectionType: string): string {
    // These are direct Unsplash source URLs that work without API key
    const fallbackImages: Record<string, Record<string, string>> = {
      'Restaurant': {
        hero: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=600&fit=crop',
      },
      'Technology': {
        hero: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop',
      },
      'Healthcare': {
        hero: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&h=600&fit=crop',
      },
      'Real Estate': {
        hero: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
      },
      'Fitness': {
        hero: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&h=600&fit=crop',
      },
      'Beauty': {
        hero: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&h=600&fit=crop',
      },
      'Legal': {
        hero: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1521791055366-0d553872125f?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&h=600&fit=crop',
      },
      'Finance': {
        hero: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=800&h=600&fit=crop',
      },
      'Education': {
        hero: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&h=600&fit=crop',
      },
      'Construction': {
        hero: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1581094794329-c8112c4e5190?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&h=600&fit=crop',
      },
      'Retail': {
        hero: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=800&h=600&fit=crop',
      },
      'Automotive': {
        hero: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop',
      },
      'default': {
        hero: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=600&fit=crop',
        about: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop',
        services: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop',
        default: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop',
      },
    };

    const industryImages = fallbackImages[industry] || fallbackImages['default'];
    return industryImages[sectionType] || industryImages['default'];
  }
}
