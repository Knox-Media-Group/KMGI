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

    const blocks = section.blocks.map((block: Block) => this.compileBlockToGutenberg(block, settings)).join('\n');

    return `<!-- wp:group {"className":"${sectionClass}${styleClass}${paddingClass}"} -->
<div class="wp-block-group ${sectionClass}${styleClass}${paddingClass}">${blocks}</div>
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
}
