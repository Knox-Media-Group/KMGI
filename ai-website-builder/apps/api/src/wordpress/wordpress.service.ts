import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  SiteContent,
  Page,
  Section,
  Block,
  TextProps,
  ImageProps,
  ButtonProps,
  ListProps,
  ListItem,
  SiteSettings,
  FormProps,
  FormField,
  AccordionProps,
  AccordionItem,
  MapProps,
  SocialProps,
  SocialLink,
  HoursProps,
  BusinessDay,
  CardProps,
  StatProps,
  TeamMemberProps,
  TimelineItemProps,
  VideoProps,
  DividerProps,
  SpacerProps,
  SiteNavigation,
  SiteFooter,
  PageMeta,
} from '@builder/shared';
import { StylesService } from './styles.service';

const execAsync = promisify(exec);

interface Site {
  id: string;
  name: string;
  owner: { email: string };
  tenant: { slug: string };
}

interface ProvisionResult {
  wpSiteId: number;
  wpAdminUrl: string;
  wpSiteUrl: string;
}

@Injectable()
export class WordPressService {
  private wpCliPath: string;
  private wpMultisiteUrl: string;
  private mockMode: boolean;

  private wpPublicUrl: string;

  constructor(
    private configService: ConfigService,
    private stylesService: StylesService,
  ) {
    this.wpCliPath = this.configService.get('WP_CLI_PATH') || 'wp';
    this.wpMultisiteUrl = this.configService.get('WP_MULTISITE_URL') || 'http://localhost:8080';
    // Public URL for WP-CLI commands (must match WordPress DOMAIN_CURRENT_SITE)
    this.wpPublicUrl = this.configService.get('WP_PUBLIC_URL') || this.configService.get('FRONTEND_URL') || 'https://1smartersite.com';
    // Mock mode ONLY when explicitly set via WP_MOCK_MODE=true (not auto-triggered by NODE_ENV)
    const wpMock = this.configService.get('WP_MOCK_MODE');
    this.mockMode = wpMock === 'true' || wpMock === '1';

    if (this.mockMode) {
      console.log('WordPress Service: Running in MOCK MODE (WP_MOCK_MODE=true)');
    } else {
      console.log(`WordPress Service: Real mode - WP_PUBLIC_URL=${this.wpPublicUrl}`);
    }
  }

  private async runWpCli(command: string): Promise<string> {
    const wpPath = this.configService.get('WP_PATH') || '/var/www/html';
    const fullCommand = `${this.wpCliPath} ${command} --path=${wpPath} --allow-root`;

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        env: { ...process.env },
        timeout: 60000,
      });
      if (stderr && !stderr.includes('Warning')) {
        console.error('WP-CLI stderr:', stderr);
      }
      return stdout.trim();
    } catch (error) {
      console.error('WP-CLI error:', error);
      throw error;
    }
  }

  async provisionSite(site: Site): Promise<ProvisionResult> {
    // Generate slug from site name
    const slug = site.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 50);

    const siteSlug = `${slug}-${site.id.substring(0, 8)}`;
    // Use public URL for returned URLs (what users will see)
    const siteUrl = `${this.wpPublicUrl}/${siteSlug}`;
    const adminEmail = site.owner.email;
    const siteTitle = site.name;

    try {
      // Create the subsite
      const createOutput = await this.runWpCli(
        `site create --slug="${siteSlug}" --title="${siteTitle}" --email="${adminEmail}" --porcelain`,
      );

      const wpSiteId = parseInt(createOutput, 10);
      if (isNaN(wpSiteId)) {
        throw new Error(`Failed to parse site ID from output: ${createOutput}`);
      }

      return {
        wpSiteId,
        wpAdminUrl: `${siteUrl}/wp-admin`,
        wpSiteUrl: siteUrl,
      };
    } catch (error) {
      if (this.mockMode) {
        console.log('MOCK MODE: Simulating WordPress site creation');
        const mockSiteId = Math.floor(Math.random() * 10000);
        return {
          wpSiteId: mockSiteId,
          wpAdminUrl: `${this.wpMultisiteUrl}/${siteSlug}/wp-admin`,
          wpSiteUrl: `${this.wpMultisiteUrl}/${siteSlug}`,
        };
      }
      throw error;
    }
  }

  async applyThemeAndPlugins(wpSiteId: number, wpSiteUrl?: string): Promise<void> {
    try {
      // Switch to the site context using the site URL (required for multisite)
      const urlFlag = wpSiteUrl ? `--url=${wpSiteUrl}` : `--url=${this.wpPublicUrl}`;

      // Activate a clean theme (Twenty Twenty-Four or similar)
      await this.runWpCli(`theme activate twentytwentyfour ${urlFlag}`);

      // Optional: Install and activate a simple page builder plugin if needed
      // For MVP, we'll use plain Gutenberg blocks

      console.log(`Theme and plugins applied for site ${wpSiteId}`);
    } catch (error) {
      if (this.mockMode) {
        console.log('MOCK MODE: Simulating theme/plugin setup');
        return;
      }
      throw error;
    }
  }

  // ============================================
  // WooCommerce E-commerce Integration
  // ============================================

  async setupWooCommerce(wpSiteId: number, wpSiteUrl?: string): Promise<void> {
    try {
      const urlFlag = wpSiteUrl ? `--url=${wpSiteUrl}` : `--url=${this.wpPublicUrl}`;

      // Install and activate WooCommerce
      await this.runWpCli(`plugin install woocommerce --activate ${urlFlag}`);

      // Run WooCommerce setup wizard silently
      await this.runWpCli(`option update woocommerce_onboarding_profile '{"skipped":true}' ${urlFlag}`);

      // Set default WooCommerce settings
      await this.runWpCli(`option update woocommerce_currency 'USD' ${urlFlag}`);
      await this.runWpCli(`option update woocommerce_currency_pos 'left' ${urlFlag}`);
      await this.runWpCli(`option update woocommerce_price_thousand_sep ',' ${urlFlag}`);
      await this.runWpCli(`option update woocommerce_price_decimal_sep '.' ${urlFlag}`);
      await this.runWpCli(`option update woocommerce_price_num_decimals '2' ${urlFlag}`);

      // Create essential WooCommerce pages
      await this.runWpCli(`wc --user=1 tool run install_pages ${urlFlag}`);

      // Enable guest checkout
      await this.runWpCli(`option update woocommerce_enable_guest_checkout 'yes' ${urlFlag}`);

      // Set up payment gateway (manual payments for MVP)
      await this.runWpCli(`option update woocommerce_cod_enabled 'yes' ${urlFlag}`);

      console.log(`WooCommerce setup complete for site ${wpSiteId}`);
    } catch (error) {
      if (this.mockMode) {
        console.log('MOCK MODE: Simulating WooCommerce setup');
        return;
      }
      console.error('WooCommerce setup error:', error);
      throw error;
    }
  }

  async createWooCommerceProduct(
    wpSiteUrl: string,
    product: {
      name: string;
      price: string;
      description: string;
      shortDescription?: string;
      image?: string;
      categories?: string[];
      sku?: string;
      stockQuantity?: number;
      salePrice?: string;
    },
  ): Promise<number> {
    try {
      const urlFlag = `--url=${wpSiteUrl}`;

      // Build product creation command
      let productCmd = `wc product create --user=1`;
      productCmd += ` --name="${this.escapeShell(product.name)}"`;
      productCmd += ` --regular_price="${product.price}"`;
      productCmd += ` --description="${this.escapeShell(product.description)}"`;

      if (product.shortDescription) {
        productCmd += ` --short_description="${this.escapeShell(product.shortDescription)}"`;
      }
      if (product.sku) {
        productCmd += ` --sku="${product.sku}"`;
      }
      if (product.stockQuantity !== undefined) {
        productCmd += ` --manage_stock=true --stock_quantity=${product.stockQuantity}`;
      }
      if (product.salePrice) {
        productCmd += ` --sale_price="${product.salePrice}"`;
      }

      productCmd += ` --porcelain ${urlFlag}`;

      const productId = await this.runWpCli(productCmd);

      // Add product image if provided
      if (product.image) {
        await this.runWpCli(
          `post meta update ${productId} _thumbnail_id "${product.image}" ${urlFlag}`,
        );
      }

      // Add categories if provided
      if (product.categories && product.categories.length > 0) {
        for (const category of product.categories) {
          // Create or get category
          try {
            await this.runWpCli(
              `wc product_cat create --user=1 --name="${this.escapeShell(category)}" ${urlFlag}`,
            );
          } catch {
            // Category might already exist, continue
          }
        }
      }

      console.log(`Created WooCommerce product ${productId}: ${product.name}`);
      return parseInt(productId, 10);
    } catch (error) {
      if (this.mockMode) {
        console.log('MOCK MODE: Simulating product creation:', product.name);
        return Math.floor(Math.random() * 10000);
      }
      throw error;
    }
  }

  async setupWooCommercePayments(
    wpSiteUrl: string,
    settings: {
      stripeEnabled?: boolean;
      stripePublishableKey?: string;
      stripeSecretKey?: string;
      paypalEnabled?: boolean;
      paypalEmail?: string;
    },
  ): Promise<void> {
    try {
      const urlFlag = `--url=${wpSiteUrl}`;

      // Setup Stripe if configured
      if (settings.stripeEnabled && settings.stripePublishableKey && settings.stripeSecretKey) {
        // Install Stripe gateway
        await this.runWpCli(`plugin install woocommerce-gateway-stripe --activate ${urlFlag}`);

        // Configure Stripe settings
        await this.runWpCli(`option update woocommerce_stripe_settings '${JSON.stringify({
          enabled: 'yes',
          testmode: 'no',
          publishable_key: settings.stripePublishableKey,
          secret_key: settings.stripeSecretKey,
          payment_request: 'yes',
          saved_cards: 'yes',
        })}' ${urlFlag}`);

        console.log('Stripe payment gateway configured');
      }

      // Setup PayPal if configured
      if (settings.paypalEnabled && settings.paypalEmail) {
        // Install PayPal gateway
        await this.runWpCli(`plugin install woocommerce-paypal-payments --activate ${urlFlag}`);

        // Configure PayPal settings
        await this.runWpCli(`option update woocommerce_ppcp-gateway_settings '${JSON.stringify({
          enabled: 'yes',
          merchant_email: settings.paypalEmail,
        })}' ${urlFlag}`);

        console.log('PayPal payment gateway configured');
      }
    } catch (error) {
      if (this.mockMode) {
        console.log('MOCK MODE: Simulating payment setup');
        return;
      }
      console.error('Payment setup error:', error);
    }
  }

  async getWooCommerceStats(wpSiteUrl: string): Promise<{
    totalOrders: number;
    totalRevenue: string;
    totalProducts: number;
    pendingOrders: number;
  }> {
    try {
      const urlFlag = `--url=${wpSiteUrl}`;

      const [ordersCount, productsCount, revenue] = await Promise.all([
        this.runWpCli(`wc report orders_totals --user=1 ${urlFlag} --format=json`),
        this.runWpCli(`post list --post_type=product --post_status=publish --format=count ${urlFlag}`),
        this.runWpCli(`wc report sales --user=1 ${urlFlag} --format=json`),
      ]);

      const orders = JSON.parse(ordersCount || '[]');
      const salesReport = JSON.parse(revenue || '{}');

      return {
        totalOrders: orders.reduce((acc: number, o: { count: number }) => acc + (o.count || 0), 0),
        totalRevenue: salesReport.total_sales || '0.00',
        totalProducts: parseInt(productsCount, 10) || 0,
        pendingOrders: orders.find((o: { slug: string }) => o.slug === 'pending')?.count || 0,
      };
    } catch (error) {
      if (this.mockMode) {
        return {
          totalOrders: 0,
          totalRevenue: '0.00',
          totalProducts: 0,
          pendingOrders: 0,
        };
      }
      throw error;
    }
  }

  async publishVersion(wpSiteId: number, content: SiteContent, wpSiteUrl?: string): Promise<void> {
    try {
      const urlFlag = wpSiteUrl ? `--url=${wpSiteUrl}` : `--url=${this.wpPublicUrl}`;

      // Inject premium CSS first
      await this.injectPremiumCSS(content.settings, urlFlag);

      // Publish all pages
      for (const page of content.pages) {
        const gutenbergBlocks = this.compilePageToGutenberg(page, content.settings);

        // Check if page exists
        const existingPages = await this.runWpCli(
          `post list --post_type=page --name="${page.slug}" --format=ids ${urlFlag}`,
        );

        if (existingPages) {
          // Update existing page
          const pageId = existingPages.split(' ')[0];
          await this.runWpCli(
            `post update ${pageId} --post_content='${this.escapeShell(gutenbergBlocks)}' --post_status=publish ${urlFlag}`,
          );
        } else {
          // Create new page
          await this.runWpCli(
            `post create --post_type=page --post_title="${page.title}" --post_name="${page.slug}" --post_content='${this.escapeShell(gutenbergBlocks)}' --post_status=publish ${urlFlag}`,
          );
        }

        // Set SEO meta tags if available
        if (page.meta) {
          await this.setPageMeta(page.slug, page.meta, urlFlag);
        }
      }

      // Set home page
      const homePage = content.pages.find((p: Page) => p.slug === 'home');
      if (homePage) {
        const homePageId = await this.runWpCli(
          `post list --post_type=page --name="home" --format=ids ${urlFlag}`,
        );
        if (homePageId) {
          await this.runWpCli(`option update show_on_front page ${urlFlag}`);
          await this.runWpCli(`option update page_on_front ${homePageId.split(' ')[0]} ${urlFlag}`);
        }
      }

      // Create navigation menu
      if (content.navigation) {
        await this.createNavigationMenu(content.navigation, urlFlag);
      }

      console.log(`Published ${content.pages.length} pages to WordPress site ${wpSiteId}`);
    } catch (error) {
      if (this.mockMode) {
        console.log('MOCK MODE: Simulating publish to WordPress');
        console.log('Pages to publish:', content.pages.map((p: Page) => p.title));
        console.log('Premium CSS would be injected for style:', content.settings.stylePreset);
        return;
      }
      throw error;
    }
  }

  /**
   * Inject premium CSS into WordPress via the Customizer
   */
  private async injectPremiumCSS(settings: SiteSettings, urlFlag: string): Promise<void> {
    try {
      // Generate premium CSS based on settings
      const premiumCSS = this.stylesService.generatePremiumCSS(settings);

      // Escape CSS for shell command
      const escapedCSS = this.escapeShell(premiumCSS);

      // Update additional CSS in WordPress customizer
      await this.runWpCli(
        `option update custom_css_post_content '${escapedCSS}' ${urlFlag}`,
      );

      // Also set it via theme mod for better compatibility
      await this.runWpCli(
        `theme mod set custom_css '${escapedCSS}' ${urlFlag}`,
      );

      console.log('Premium CSS injected successfully');
    } catch (error) {
      console.error('Failed to inject premium CSS:', error);
      // Don't throw - CSS injection failure shouldn't block publishing
    }
  }

  /**
   * Set page SEO meta tags
   */
  private async setPageMeta(slug: string, meta: PageMeta, urlFlag: string): Promise<void> {
    try {
      const pageId = await this.runWpCli(
        `post list --post_type=page --name="${slug}" --format=ids ${urlFlag}`,
      );
      if (pageId) {
        const id = pageId.split(' ')[0];
        // Set Yoast SEO fields if available, otherwise use post meta
        await this.runWpCli(`post meta update ${id} _yoast_wpseo_title '${this.escapeShell(meta.title)}' ${urlFlag}`);
        await this.runWpCli(`post meta update ${id} _yoast_wpseo_metadesc '${this.escapeShell(meta.description)}' ${urlFlag}`);
      }
    } catch (error) {
      console.error('Failed to set page meta:', error);
    }
  }

  /**
   * Create navigation menu in WordPress
   */
  private async createNavigationMenu(navigation: SiteNavigation, urlFlag: string): Promise<void> {
    try {
      // Create or get primary menu
      const menuName = 'Primary Menu';
      let menuId: string;

      try {
        const existingMenu = await this.runWpCli(
          `menu list --format=ids ${urlFlag}`,
        );
        if (existingMenu) {
          menuId = existingMenu.split(' ')[0];
        } else {
          menuId = await this.runWpCli(
            `menu create "${menuName}" --porcelain ${urlFlag}`,
          );
        }
      } catch {
        menuId = await this.runWpCli(
          `menu create "${menuName}" --porcelain ${urlFlag}`,
        );
      }

      // Add menu items
      for (const item of navigation.items) {
        await this.runWpCli(
          `menu item add-custom ${menuId} "${item.label}" "${item.href}" ${urlFlag}`,
        );
      }

      // Assign to primary location
      await this.runWpCli(
        `menu location assign ${menuId} primary ${urlFlag}`,
      );

      console.log('Navigation menu created successfully');
    } catch (error) {
      console.error('Failed to create navigation menu:', error);
    }
  }

  private escapeShell(str: string): string {
    return str.replace(/'/g, "'\\''");
  }

  private compilePageToGutenberg(page: Page, settings: SiteSettings): string {
    return page.sections.map((section: Section) => this.compileSectionToGutenberg(section, settings)).join('\n\n');
  }

  private compileSectionToGutenberg(section: Section, settings: SiteSettings): string {
    const sectionClass = `section-${section.type}`;
    const styleClass = section.style?.darkMode ? ' dark-mode' : '';
    const paddingClass = section.style?.padding ? ` padding-${section.style.padding}` : '';
    const classes = `${sectionClass}${styleClass}${paddingClass}`;

    // Build blocks with proper layout structure per section type
    const blocks = section.blocks.map((block: Block) => this.compileBlockToGutenberg(block, settings));

    // Separate blocks by type for layout purposes
    const headings = blocks.filter((_b, i) => {
      const block = section.blocks[i];
      return block.type === 'text' && ['h1', 'h2', 'h3', 'h4'].includes((block.props as TextProps).variant);
    });
    const paragraphs = blocks.filter((_b, i) => {
      const block = section.blocks[i];
      return block.type === 'text' && !['h1', 'h2', 'h3', 'h4'].includes((block.props as TextProps).variant);
    });
    const images = blocks.filter((_b, i) => section.blocks[i].type === 'image');
    const buttons = blocks.filter((_b, i) => section.blocks[i].type === 'button');
    const lists = blocks.filter((_b, i) => section.blocks[i].type === 'list');
    const cards = blocks.filter((_b, i) => section.blocks[i].type === 'card');
    const stats = blocks.filter((_b, i) => section.blocks[i].type === 'stat');
    const teamMembers = blocks.filter((_b, i) => section.blocks[i].type === 'teamMember');
    const timelineItems = blocks.filter((_b, i) => section.blocks[i].type === 'timelineItem');
    const otherBlocks = blocks.filter((_b, i) => {
      const t = section.blocks[i].type;
      return !['text', 'image', 'button', 'list', 'card', 'stat', 'teamMember', 'timelineItem'].includes(t);
    });

    switch (section.type) {
      case 'hero':
        return this.compileHeroSection(classes, headings, paragraphs, images, buttons, otherBlocks);
      case 'features':
        return this.compileFeaturesSection(classes, headings, paragraphs, lists, cards, otherBlocks);
      case 'services':
        return this.compileServicesSection(classes, headings, paragraphs, lists, cards, otherBlocks);
      case 'about':
        return this.compileAboutSection(classes, headings, paragraphs, images, buttons, otherBlocks);
      case 'testimonials':
        return this.compileTestimonialsSection(classes, headings, paragraphs, lists, cards, otherBlocks);
      case 'team':
        return this.compileTeamSection(classes, headings, paragraphs, teamMembers, otherBlocks);
      case 'stats':
        return this.compileStatsSection(classes, headings, stats, otherBlocks);
      case 'timeline':
        return this.compileTimelineSection(classes, headings, paragraphs, timelineItems, otherBlocks);
      case 'cta':
        return this.compileCtaSection(classes, headings, paragraphs, buttons, otherBlocks);
      case 'contact':
      case 'contactForm':
        return this.compileContactSection(classes, section.type, headings, paragraphs, blocks, otherBlocks);
      case 'gallery':
        return this.compileGallerySection(classes, headings, images, otherBlocks);
      case 'products':
      case 'pricing':
        return this.compilePricingSection(classes, headings, paragraphs, cards, otherBlocks);
      default: {
        // Fallback: wrap with container
        const allBlocks = blocks.join('\n');
        return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">${allBlocks}</div>
</div>
<!-- /wp:group -->`;
      }
    }
  }

  // =============================================
  // Premium Section Layout Compilers
  // =============================================

  private compileHeroSection(classes: string, headings: string[], paragraphs: string[], images: string[], buttons: string[], others: string[]): string {
    const bgImage = images.length > 0 ? images[0] : '';
    const buttonGroup = buttons.length > 0
      ? `<div class="hero-buttons">${buttons.join('\n')}</div>`
      : '';

    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
${bgImage}
<div class="hero-overlay"></div>
<div class="section-container">
<div class="hero-content">
<div class="hero-badge"><span>Welcome</span></div>
${headings.join('\n')}
${paragraphs.join('\n')}
${buttonGroup}
</div>
${images.length > 1 ? `<div class="hero-visual">${images.slice(1).join('\n')}</div>` : ''}
</div>
${others.join('\n')}
</div>
<!-- /wp:group -->`;
  }

  private compileFeaturesSection(classes: string, headings: string[], paragraphs: string[], lists: string[], cards: string[], others: string[]): string {
    const headerBlock = headings.length > 0 || paragraphs.length > 0
      ? `<div class="section-header">${headings.join('\n')}${paragraphs.join('\n')}</div>`
      : '';

    const gridContent = cards.length > 0
      ? `<div class="features-grid">${cards.join('\n')}</div>`
      : lists.length > 0
        ? `<div class="features-grid">${lists.join('\n')}</div>`
        : '';

    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">
${headerBlock}
${gridContent}
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
  }

  private compileServicesSection(classes: string, headings: string[], paragraphs: string[], lists: string[], cards: string[], others: string[]): string {
    const headerBlock = headings.length > 0 || paragraphs.length > 0
      ? `<div class="section-header">${headings.join('\n')}${paragraphs.join('\n')}</div>`
      : '';

    const gridContent = cards.length > 0
      ? `<div class="services-grid">${cards.join('\n')}</div>`
      : lists.length > 0
        ? `<div class="services-grid">${lists.join('\n')}</div>`
        : '';

    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">
${headerBlock}
${gridContent}
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
  }

  private compileAboutSection(classes: string, headings: string[], paragraphs: string[], images: string[], buttons: string[], others: string[]): string {
    const hasImage = images.length > 0;

    if (hasImage) {
      return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">
<div class="about-layout">
<div class="about-image-col">
<div class="about-image-wrapper">
${images[0]}
<div class="about-image-accent"></div>
</div>
</div>
<div class="about-content-col">
${headings.join('\n')}
${paragraphs.join('\n')}
${buttons.length > 0 ? `<div class="about-buttons">${buttons.join('\n')}</div>` : ''}
</div>
</div>
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
    }

    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">
<div class="section-header">
${headings.join('\n')}
</div>
${paragraphs.join('\n')}
${buttons.length > 0 ? `<div class="about-buttons">${buttons.join('\n')}</div>` : ''}
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
  }

  private compileTestimonialsSection(classes: string, headings: string[], paragraphs: string[], lists: string[], cards: string[], others: string[]): string {
    const headerBlock = headings.length > 0
      ? `<div class="section-header">${headings.join('\n')}${paragraphs.join('\n')}</div>`
      : '';

    const gridContent = cards.length > 0
      ? `<div class="testimonials-grid">${cards.join('\n')}</div>`
      : lists.length > 0
        ? `<div class="testimonials-grid">${lists.join('\n')}</div>`
        : '';

    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">
${headerBlock}
${gridContent}
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
  }

  private compileTeamSection(classes: string, headings: string[], paragraphs: string[], teamMembers: string[], others: string[]): string {
    const headerBlock = headings.length > 0 || paragraphs.length > 0
      ? `<div class="section-header">${headings.join('\n')}${paragraphs.join('\n')}</div>`
      : '';

    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">
${headerBlock}
<div class="team-grid">${teamMembers.join('\n')}</div>
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
  }

  private compileStatsSection(classes: string, headings: string[], stats: string[], others: string[]): string {
    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">
${headings.join('\n')}
<div class="stats-grid">${stats.join('\n')}</div>
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
  }

  private compileTimelineSection(classes: string, headings: string[], paragraphs: string[], timelineItems: string[], others: string[]): string {
    const headerBlock = headings.length > 0 || paragraphs.length > 0
      ? `<div class="section-header">${headings.join('\n')}${paragraphs.join('\n')}</div>`
      : '';

    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">
${headerBlock}
<div class="timeline">${timelineItems.join('\n')}</div>
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
  }

  private compileCtaSection(classes: string, headings: string[], paragraphs: string[], buttons: string[], others: string[]): string {
    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="cta-pattern"></div>
<div class="section-container">
<div class="cta-content">
${headings.join('\n')}
${paragraphs.join('\n')}
${buttons.length > 0 ? `<div class="cta-buttons">${buttons.join('\n')}</div>` : ''}
</div>
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
  }

  private compileContactSection(classes: string, _type: string, headings: string[], paragraphs: string[], allBlocks: string[], others: string[]): string {
    // For contact, keep all blocks but wrap in container
    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">
<div class="section-header">${headings.join('\n')}${paragraphs.join('\n')}</div>
<div class="contact-layout">
${allBlocks.filter(b => !headings.includes(b) && !paragraphs.includes(b)).join('\n')}
</div>
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
  }

  private compileGallerySection(classes: string, headings: string[], images: string[], others: string[]): string {
    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">
${headings.length > 0 ? `<div class="section-header">${headings.join('\n')}</div>` : ''}
<div class="gallery-grid">${images.join('\n')}</div>
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
  }

  private compilePricingSection(classes: string, headings: string[], paragraphs: string[], cards: string[], others: string[]): string {
    const headerBlock = headings.length > 0 || paragraphs.length > 0
      ? `<div class="section-header">${headings.join('\n')}${paragraphs.join('\n')}</div>`
      : '';

    return `<!-- wp:group {"className":"${classes}"} -->
<div class="wp-block-group ${classes}">
<div class="section-container">
${headerBlock}
<div class="pricing-grid">${cards.join('\n')}</div>
${others.join('\n')}
</div>
</div>
<!-- /wp:group -->`;
  }

  private compileBlockToGutenberg(block: Block, settings: SiteSettings): string {
    switch (block.type) {
      case 'text':
        return this.compileTextBlock(block.props as TextProps);

      case 'image':
        return this.compileImageBlock(block.props as ImageProps);

      case 'button':
        return this.compileButtonBlock(block.props as ButtonProps, settings.accentColor);

      case 'list':
        return this.compileListBlock(block.props as ListProps);

      case 'form':
        return this.compileFormBlock(block.props as FormProps);

      case 'accordion':
        return this.compileAccordionBlock(block.props as AccordionProps);

      case 'map':
        return this.compileMapBlock(block.props as MapProps);

      case 'social':
        return this.compileSocialBlock(block.props as SocialProps);

      case 'hours':
        return this.compileHoursBlock(block.props as HoursProps);

      case 'card':
        return this.compileCardBlock(block.props as CardProps, settings.accentColor);

      case 'stat':
        return this.compileStatBlock(block.props as StatProps);

      case 'teamMember':
        return this.compileTeamMemberBlock(block.props as TeamMemberProps);

      case 'timelineItem':
        return this.compileTimelineItemBlock(block.props as TimelineItemProps);

      case 'video':
        return this.compileVideoBlock(block.props as VideoProps);

      case 'divider':
        return this.compileDividerBlock(block.props as DividerProps);

      case 'spacer':
        return this.compileSpacerBlock(block.props as SpacerProps);

      default:
        return '';
    }
  }

  private compileTextBlock(props: TextProps): string {
    const align = props.align ? ` has-text-align-${props.align}` : '';

    switch (props.variant) {
      case 'h1':
        return `<!-- wp:heading {"level":1,"className":"${align}"} -->
<h1 class="wp-block-heading${align}">${this.escapeHtml(props.content)}</h1>
<!-- /wp:heading -->`;

      case 'h2':
        return `<!-- wp:heading {"className":"${align}"} -->
<h2 class="wp-block-heading${align}">${this.escapeHtml(props.content)}</h2>
<!-- /wp:heading -->`;

      case 'h3':
        return `<!-- wp:heading {"level":3,"className":"${align}"} -->
<h3 class="wp-block-heading${align}">${this.escapeHtml(props.content)}</h3>
<!-- /wp:heading -->`;

      case 'h4':
        return `<!-- wp:heading {"level":4,"className":"${align}"} -->
<h4 class="wp-block-heading${align}">${this.escapeHtml(props.content)}</h4>
<!-- /wp:heading -->`;

      case 'lead':
        return `<!-- wp:paragraph {"fontSize":"large","className":"lead${align}"} -->
<p class="has-large-font-size lead${align}">${this.escapeHtml(props.content)}</p>
<!-- /wp:paragraph -->`;

      case 'small':
      case 'caption':
        return `<!-- wp:paragraph {"fontSize":"small","className":"${props.variant}${align}"} -->
<p class="has-small-font-size ${props.variant}${align}">${this.escapeHtml(props.content)}</p>
<!-- /wp:paragraph -->`;

      default:
        return `<!-- wp:paragraph {"className":"${align}"} -->
<p class="${align}">${this.escapeHtml(props.content)}</p>
<!-- /wp:paragraph -->`;
    }
  }

  private compileImageBlock(props: ImageProps): string {
    const classes = [];
    if (props.rounded) classes.push('rounded');
    if (props.shadow) classes.push('has-shadow');
    const className = classes.length ? ` class="${classes.join(' ')}"` : '';

    return `<!-- wp:image -->
<figure class="wp-block-image"><img src="${props.src}" alt="${this.escapeHtml(props.alt)}"${className}/></figure>
<!-- /wp:image -->`;
  }

  private compileButtonBlock(props: ButtonProps, accentColor: string): string {
    const sizeClass = props.size ? ` size-${props.size}` : '';
    const variantClass = props.variant === 'outline' || props.variant === 'ghost' ? ' is-style-outline' : '';
    const fullWidthClass = props.fullWidth ? ' has-full-width' : '';

    return `<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button {"className":"${variantClass}${sizeClass}${fullWidthClass}"} -->
<div class="wp-block-button${variantClass}${sizeClass}${fullWidthClass}"><a class="wp-block-button__link wp-element-button" href="${props.href}">${this.escapeHtml(props.text)}</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;
  }

  private compileListBlock(props: ListProps): string {
    const columnsAttr = props.columns ? ` columns-${props.columns}` : '';
    const layoutClass = `layout-${props.layout}${columnsAttr}`;

    const items = props.items.map((item: ListItem) => {
      const icon = item.icon ? `<span class="icon icon-${item.icon}"></span>` : '';
      const image = item.image ? `<img src="${item.image}" alt="${this.escapeHtml(item.title)}" class="item-image"/>` : '';

      return `<li class="list-item">
${image}${icon}
<strong class="item-title">${this.escapeHtml(item.title)}</strong>
<span class="item-description">${this.escapeHtml(item.description)}</span>
</li>`;
    }).join('\n');

    return `<!-- wp:list {"className":"${layoutClass}"} -->
<ul class="wp-block-list ${layoutClass}">${items}</ul>
<!-- /wp:list -->`;
  }

  private compileFormBlock(props: FormProps): string {
    const fields = props.fields.map((field: FormField) => {
      const required = field.required ? ' required' : '';
      const placeholder = field.placeholder ? ` placeholder="${this.escapeHtml(field.placeholder)}"` : '';

      switch (field.type) {
        case 'textarea':
          return `<div class="form-group">
<label for="${field.name}">${this.escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
<textarea name="${field.name}" id="${field.name}"${placeholder}${required}></textarea>
</div>`;

        case 'select':
          const options = field.options ? field.options.map(opt =>
            `<option value="${this.escapeHtml(opt)}">${this.escapeHtml(opt)}</option>`
          ).join('') : '';
          return `<div class="form-group">
<label for="${field.name}">${this.escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
<select name="${field.name}" id="${field.name}"${required}><option value="">Select...</option>${options}</select>
</div>`;

        case 'checkbox':
          return `<div class="form-group form-check">
<input type="checkbox" name="${field.name}" id="${field.name}"${required}/>
<label for="${field.name}">${this.escapeHtml(field.label)}</label>
</div>`;

        default:
          return `<div class="form-group">
<label for="${field.name}">${this.escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
<input type="${field.type}" name="${field.name}" id="${field.name}"${placeholder}${required}/>
</div>`;
      }
    }).join('\n');

    return `<!-- wp:html -->
<form class="contact-form" action="#" method="POST" data-recipient="${props.recipientEmail || ''}">
${fields}
<div class="form-group">
<button type="submit" class="wp-block-button__link wp-element-button">${this.escapeHtml(props.submitText)}</button>
</div>
<div class="form-message" style="display:none;">${this.escapeHtml(props.successMessage)}</div>
</form>
<!-- /wp:html -->`;
  }

  private compileAccordionBlock(props: AccordionProps): string {
    const items = props.items.map((item: AccordionItem, index: number) => {
      return `<div class="faq-item" data-index="${index}">
<div class="faq-question">${this.escapeHtml(item.question)}</div>
<div class="faq-answer">${this.escapeHtml(item.answer)}</div>
</div>`;
    }).join('\n');

    return `<!-- wp:html -->
<div class="faq-list" data-allow-multiple="${props.allowMultiple ? 'true' : 'false'}">
${items}
</div>
<script>
document.querySelectorAll('.faq-question').forEach(function(q) {
  q.addEventListener('click', function() {
    var item = this.parentElement;
    var list = item.parentElement;
    var allowMultiple = list.dataset.allowMultiple === 'true';
    if (!allowMultiple) {
      list.querySelectorAll('.faq-item').forEach(function(i) {
        if (i !== item) i.classList.remove('open');
      });
    }
    item.classList.toggle('open');
  });
});
</script>
<!-- /wp:html -->`;
  }

  private compileMapBlock(props: MapProps): string {
    const address = encodeURIComponent(props.address);
    const zoom = props.zoom || 15;
    const height = props.height || 400;

    return `<!-- wp:html -->
<div class="map-container" style="height:${height}px;">
<iframe
  src="https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${address}&zoom=${zoom}"
  width="100%"
  height="${height}"
  style="border:0;"
  allowfullscreen=""
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade">
</iframe>
</div>
<!-- /wp:html -->`;
  }

  private compileSocialBlock(props: SocialProps): string {
    const icons: Record<string, string> = {
      facebook: '📘',
      twitter: '🐦',
      instagram: '📷',
      linkedin: '💼',
      youtube: '▶️',
      tiktok: '🎵',
      pinterest: '📌',
      yelp: '⭐',
      google: '🔍',
    };

    const links = props.links.map((link: SocialLink) => {
      const icon = icons[link.platform] || '🔗';
      return `<a href="${link.url}" class="social-icon social-${link.platform}" target="_blank" rel="noopener noreferrer" aria-label="${link.platform}">${icon}</a>`;
    }).join('\n');

    return `<!-- wp:html -->
<div class="social-icons style-${props.style || 'icons'}">
${links}
</div>
<!-- /wp:html -->`;
  }

  private compileHoursBlock(props: HoursProps): string {
    const dayNames: Record<string, string> = {
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
    };

    const rows = props.hours.map((day: BusinessDay) => {
      const dayName = dayNames[day.day] || day.day;
      const time = day.closed ? '<span class="hours-closed">Closed</span>' : `${day.open} - ${day.close}`;
      return `<div class="hours-row">
<span class="hours-day">${dayName}</span>
<span class="hours-time">${time}</span>
</div>`;
    }).join('\n');

    const note = props.note ? `<p class="hours-note">${this.escapeHtml(props.note)}</p>` : '';

    return `<!-- wp:html -->
<div class="hours-table">
${rows}
</div>
${note}
<!-- /wp:html -->`;
  }

  private compileCardBlock(props: CardProps, accentColor: string): string {
    const image = props.image ? `<div class="product-image"><img src="${props.image}" alt="${this.escapeHtml(props.title)}"/></div>` : '';
    const icon = props.icon ? `<span class="card-icon icon-${props.icon}"></span>` : '';
    const price = props.price ? `<div class="product-price">${this.escapeHtml(props.price)}</div>` : '';
    const features = props.features ? `<ul class="pricing-features">${props.features.map(f => `<li>${this.escapeHtml(f)}</li>`).join('')}</ul>` : '';
    const link = props.linkText ? `<a href="${props.link || '#'}" class="wp-block-button__link">${this.escapeHtml(props.linkText)}</a>` : '';
    const highlighted = props.highlighted ? ' featured' : '';

    return `<!-- wp:html -->
<div class="product-card pricing-card${highlighted}">
${image}
<div class="product-info pricing-info">
${icon}
<h3 class="product-title pricing-title">${this.escapeHtml(props.title)}</h3>
${price}
<p>${this.escapeHtml(props.description)}</p>
${features}
${link}
</div>
</div>
<!-- /wp:html -->`;
  }

  private compileStatBlock(props: StatProps): string {
    const prefix = props.prefix || '';
    const suffix = props.suffix || '';
    const icon = props.icon ? `<span class="stat-icon icon-${props.icon}"></span>` : '';

    return `<!-- wp:html -->
<div class="stat-item">
${icon}
<div class="stat-value">${prefix}${this.escapeHtml(props.value)}${suffix}</div>
<div class="stat-label">${this.escapeHtml(props.label)}</div>
</div>
<!-- /wp:html -->`;
  }

  private compileTeamMemberBlock(props: TeamMemberProps): string {
    const bio = props.bio ? `<p class="team-member-bio">${this.escapeHtml(props.bio)}</p>` : '';
    const email = props.email ? `<a href="mailto:${props.email}" class="team-contact">${props.email}</a>` : '';

    return `<!-- wp:html -->
<div class="team-member">
<img src="${props.image}" alt="${this.escapeHtml(props.name)}" class="team-member-photo"/>
<div class="team-member-info">
<h3 class="team-member-name">${this.escapeHtml(props.name)}</h3>
<p class="team-member-role">${this.escapeHtml(props.role)}</p>
${bio}
${email}
</div>
</div>
<!-- /wp:html -->`;
  }

  private compileTimelineItemBlock(props: TimelineItemProps): string {
    const icon = props.icon ? `<span class="timeline-icon icon-${props.icon}"></span>` : '';

    return `<!-- wp:html -->
<div class="timeline-item">
${icon}
<div class="timeline-year">${this.escapeHtml(props.year)}</div>
<h4 class="timeline-title">${this.escapeHtml(props.title)}</h4>
<p class="timeline-description">${this.escapeHtml(props.description)}</p>
</div>
<!-- /wp:html -->`;
  }

  private compileVideoBlock(props: VideoProps): string {
    const autoplay = props.autoplay ? ' autoplay' : '';
    const loop = props.loop ? ' loop' : '';
    const muted = props.muted ? ' muted' : '';
    const poster = props.poster ? ` poster="${props.poster}"` : '';

    return `<!-- wp:html -->
<div class="video-container">
<video src="${props.src}"${poster}${autoplay}${loop}${muted} controls playsinline>
Your browser does not support the video tag.
</video>
</div>
<!-- /wp:html -->`;
  }

  private compileDividerBlock(props: DividerProps): string {
    const style = props.style || 'line';
    const color = props.color ? ` style="--divider-color:${props.color}"` : '';

    return `<!-- wp:separator {"className":"divider-${style}"} -->
<hr class="wp-block-separator divider-${style}"${color}/>
<!-- /wp:separator -->`;
  }

  private compileSpacerBlock(props: SpacerProps): string {
    const heights: Record<string, string> = {
      sm: '24px',
      md: '48px',
      lg: '80px',
      xl: '120px',
    };
    const height = heights[props.height] || heights.md;

    return `<!-- wp:spacer {"height":"${height}"} -->
<div style="height:${height}" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================
  // Staging Environment Support
  // ============================================

  async createStagingSite(wpSiteId: number, wpSiteUrl: string): Promise<{
    stagingSiteId: number;
    stagingUrl: string;
  }> {
    try {
      // Get original site slug
      const originalSlug = wpSiteUrl.split('/').pop() || 'site';
      const stagingSlug = `staging-${originalSlug}`;
      const stagingUrl = `${this.wpPublicUrl}/${stagingSlug}`;

      // Create staging subsite
      const createOutput = await this.runWpCli(
        `site create --slug="${stagingSlug}" --title="Staging - ${originalSlug}" --email="staging@1smartersite.com" --porcelain`,
      );

      const stagingSiteId = parseInt(createOutput, 10);
      if (isNaN(stagingSiteId)) {
        throw new Error(`Failed to create staging site: ${createOutput}`);
      }

      // Copy content from production to staging
      await this.copySiteContent(wpSiteUrl, stagingUrl);

      // Set staging flag
      await this.runWpCli(`option update is_staging_site 1 --url=${stagingUrl}`);

      console.log(`Created staging site ${stagingSiteId} at ${stagingUrl}`);

      return { stagingSiteId, stagingUrl };
    } catch (error) {
      if (this.mockMode) {
        console.log('MOCK MODE: Simulating staging site creation');
        return {
          stagingSiteId: Math.floor(Math.random() * 10000),
          stagingUrl: `${this.wpMultisiteUrl}/staging-site`,
        };
      }
      throw error;
    }
  }

  async copySiteContent(sourceUrl: string, targetUrl: string): Promise<void> {
    try {
      // Export content from source
      const exportFile = `/tmp/site-export-${Date.now()}.xml`;
      await this.runWpCli(`export --url=${sourceUrl} --output=${exportFile}`);

      // Import content to target
      await this.runWpCli(`import ${exportFile} --authors=skip --url=${targetUrl}`);

      // Copy theme mods and custom CSS
      const themeMods = await this.runWpCli(`theme mod list --url=${sourceUrl} --format=json`);
      if (themeMods) {
        const mods = JSON.parse(themeMods);
        for (const mod of mods) {
          await this.runWpCli(`theme mod set ${mod.key} '${this.escapeShell(mod.value)}' --url=${targetUrl}`);
        }
      }

      console.log(`Content copied from ${sourceUrl} to ${targetUrl}`);
    } catch (error) {
      console.error('Failed to copy site content:', error);
      if (!this.mockMode) throw error;
    }
  }

  async promoteStagingToProduction(
    stagingSiteUrl: string,
    productionSiteUrl: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Copy staging content to production
      await this.copySiteContent(stagingSiteUrl, productionSiteUrl);

      // Clear production cache
      await this.runWpCli(`cache flush --url=${productionSiteUrl}`);

      console.log(`Promoted staging ${stagingSiteUrl} to production ${productionSiteUrl}`);

      return {
        success: true,
        message: 'Staging site promoted to production successfully',
      };
    } catch (error) {
      if (this.mockMode) {
        return {
          success: true,
          message: 'MOCK: Staging site would be promoted to production',
        };
      }
      return {
        success: false,
        message: `Failed to promote staging: ${error}`,
      };
    }
  }

  async deleteStagingSite(stagingSiteId: number): Promise<void> {
    try {
      await this.runWpCli(`site delete ${stagingSiteId} --yes`);
      console.log(`Deleted staging site ${stagingSiteId}`);
    } catch (error) {
      if (this.mockMode) {
        console.log('MOCK MODE: Simulating staging site deletion');
        return;
      }
      throw error;
    }
  }

  async getStagingStatus(wpSiteUrl: string): Promise<{
    hasStagingSite: boolean;
    stagingUrl?: string;
    stagingCreatedAt?: Date;
    lastSyncedAt?: Date;
  }> {
    try {
      const originalSlug = wpSiteUrl.split('/').pop() || 'site';
      const stagingSlug = `staging-${originalSlug}`;

      // Check if staging site exists
      const stagingSites = await this.runWpCli(`site list --field=url`);

      if (stagingSites && stagingSites.includes(stagingSlug)) {
        return {
          hasStagingSite: true,
          stagingUrl: `${this.wpPublicUrl}/${stagingSlug}`,
          stagingCreatedAt: new Date(),
          lastSyncedAt: new Date(),
        };
      }

      return { hasStagingSite: false };
    } catch {
      return { hasStagingSite: false };
    }
  }
}
