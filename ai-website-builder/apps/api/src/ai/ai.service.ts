import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  SiteContent,
  SiteSettings,
  Page,
  Section,
  Block,
  TextProps,
  ImageProps,
  ButtonProps,
  ListProps,
  AccordionProps,
  AccordionItem,
  TeamMemberProps,
  TimelineItemProps,
  StatProps,
  FormProps,
  MapProps,
  HoursProps,
  SocialProps,
  SiteNavigation,
  SiteFooter,
  PageMeta,
  generateId,
  createDefaultNavigation,
  createDefaultFooter,
  DEFAULT_BUSINESS_HOURS,
} from '@builder/shared';
import { ImagesService } from './images.service';

// AI Co-Pilot types
export interface CopilotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CopilotContext {
  siteSettings: SiteSettings;
  currentPage: Page;
  selectedSection?: Section;
}

export interface CopilotResponse {
  message: string;
  actions?: CopilotAction[];
  suggestions?: string[];
}

export interface CopilotAction {
  type: 'update_text' | 'update_style' | 'add_section' | 'remove_section' | 'reorder' | 'update_image';
  target: {
    sectionId?: string;
    blockId?: string;
    pageSlug?: string;
  };
  payload: Record<string, unknown>;
}

interface AIGeneratedContent {
  home: {
    heroHeadline: string;
    heroSubheadline: string;
    features: Array<{ title: string; description: string; icon: string }>;
    services: Array<{ title: string; description: string }>;
    testimonials: Array<{ name: string; role: string; quote: string; rating: number }>;
    ctaHeadline: string;
    ctaSubtext: string;
  };
  about: {
    headline: string;
    story: string;
    mission: string;
    vision: string;
    values: Array<{ title: string; description: string }>;
    team: Array<{ name: string; role: string; bio: string }>;
    timeline: Array<{ year: string; title: string; description: string }>;
    stats: Array<{ value: string; label: string; suffix?: string }>;
  };
  services: {
    headline: string;
    intro: string;
    services: Array<{ title: string; description: string; features: string[] }>;
    process: Array<{ step: number; title: string; description: string }>;
  };
  contact: {
    headline: string;
    intro: string;
    formIntro: string;
  };
  faq: {
    headline: string;
    intro: string;
    questions: Array<{ question: string; answer: string }>;
  };
  seo: {
    homeTitle: string;
    homeDescription: string;
    aboutTitle: string;
    aboutDescription: string;
    servicesTitle: string;
    servicesDescription: string;
    contactTitle: string;
    contactDescription: string;
    faqTitle: string;
    faqDescription: string;
  };
}

@Injectable()
export class AiService {
  private openai: OpenAI | null;

  constructor(
    private configService: ConfigService,
    private imagesService: ImagesService,
  ) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async generateSiteContent(settings: SiteSettings): Promise<SiteContent> {
    console.log('Generating comprehensive 5-page website for:', settings.businessName);

    // Generate AI content or use fallback
    let aiContent: AIGeneratedContent;
    if (this.openai) {
      try {
        aiContent = await this.generateAIContent(settings);
      } catch (error) {
        console.error('AI generation failed, using fallback:', error);
        aiContent = this.generateFallbackContent(settings);
      }
    } else {
      console.log('No OpenAI API key, using fallback content generation');
      aiContent = this.generateFallbackContent(settings);
    }

    // Build all 5 pages with AI content and real images
    const [homePage, aboutPage, servicesPage, contactPage, faqPage] = await Promise.all([
      this.buildHomePage(settings, aiContent),
      this.buildAboutPage(settings, aiContent),
      this.buildServicesPage(settings, aiContent),
      this.buildContactPage(settings, aiContent),
      this.buildFaqPage(settings, aiContent),
    ]);

    // Create navigation and footer
    const navigation = createDefaultNavigation(settings);
    const footer = createDefaultFooter(settings);

    return {
      pages: [homePage, aboutPage, servicesPage, contactPage, faqPage],
      settings,
      navigation,
      footer,
      globalMeta: {
        title: aiContent.seo.homeTitle,
        description: aiContent.seo.homeDescription,
        keywords: [settings.industry, settings.businessName, 'services', settings.city || ''].filter(Boolean),
      },
    };
  }

  private async generateAIContent(settings: SiteSettings): Promise<AIGeneratedContent> {
    const descriptionContext = settings.description
      ? `\nBusiness description: ${settings.description}`
      : '';

    const locationContext = settings.city && settings.state
      ? `\nLocation: ${settings.city}, ${settings.state}`
      : '';

    const prompt = `Generate comprehensive website content for a ${settings.industry} business called "${settings.businessName}".${descriptionContext}${locationContext}
Style: ${settings.stylePreset}
Primary action: ${settings.primaryCta === 'call' ? 'Call us' : settings.primaryCta === 'book' ? 'Book appointment' : 'Get a quote'}

Use the business description to create highly specific, relevant, and professional content. Generate content that sounds authentic and matches the industry.

Generate JSON with this EXACT structure:
{
  "home": {
    "heroHeadline": "compelling headline (max 8 words)",
    "heroSubheadline": "supporting text (max 20 words)",
    "features": [
      { "title": "feature name", "description": "brief description (15 words)", "icon": "one of: award, clock, shield, users, star, heart, check, zap" },
      { "title": "...", "description": "...", "icon": "..." },
      { "title": "...", "description": "...", "icon": "..." },
      { "title": "...", "description": "...", "icon": "..." }
    ],
    "services": [
      { "title": "Service Name", "description": "2-3 sentence description" },
      { "title": "...", "description": "..." },
      { "title": "...", "description": "..." }
    ],
    "testimonials": [
      { "name": "Customer Name", "role": "Their role/company", "quote": "testimonial (2-3 sentences)", "rating": 5 },
      { "name": "...", "role": "...", "quote": "...", "rating": 5 }
    ],
    "ctaHeadline": "call to action headline",
    "ctaSubtext": "supporting text for CTA"
  },
  "about": {
    "headline": "About section headline",
    "story": "Company story paragraph (75-100 words)",
    "mission": "Mission statement (25-30 words)",
    "vision": "Vision statement (25-30 words)",
    "values": [
      { "title": "Value Name", "description": "brief description" },
      { "title": "...", "description": "..." },
      { "title": "...", "description": "..." }
    ],
    "team": [
      { "name": "Team Member Name", "role": "Their Role", "bio": "Brief bio (20-30 words)" },
      { "name": "...", "role": "...", "bio": "..." },
      { "name": "...", "role": "...", "bio": "..." }
    ],
    "timeline": [
      { "year": "YYYY", "title": "Milestone Title", "description": "Brief description" },
      { "year": "...", "title": "...", "description": "..." },
      { "year": "...", "title": "...", "description": "..." },
      { "year": "Today", "title": "Current Status", "description": "..." }
    ],
    "stats": [
      { "value": "500", "label": "Happy Clients", "suffix": "+" },
      { "value": "10", "label": "Years Experience", "suffix": "+" },
      { "value": "98", "label": "Satisfaction Rate", "suffix": "%" },
      { "value": "24", "label": "Support Available", "suffix": "/7" }
    ]
  },
  "services": {
    "headline": "Services page headline",
    "intro": "Introduction paragraph (40-50 words)",
    "services": [
      { "title": "Service Name", "description": "Detailed description (50-75 words)", "features": ["feature 1", "feature 2", "feature 3"] },
      { "title": "...", "description": "...", "features": ["...", "...", "..."] },
      { "title": "...", "description": "...", "features": ["...", "...", "..."] },
      { "title": "...", "description": "...", "features": ["...", "...", "..."] }
    ],
    "process": [
      { "step": 1, "title": "Step Name", "description": "Brief description" },
      { "step": 2, "title": "...", "description": "..." },
      { "step": 3, "title": "...", "description": "..." },
      { "step": 4, "title": "...", "description": "..." }
    ]
  },
  "contact": {
    "headline": "Contact page headline",
    "intro": "Welcoming message for contact page (30-40 words)",
    "formIntro": "Brief intro for the contact form (15-20 words)"
  },
  "faq": {
    "headline": "FAQ page headline",
    "intro": "Brief intro for FAQ section (20-30 words)",
    "questions": [
      { "question": "Common question?", "answer": "Detailed answer (40-60 words)" },
      { "question": "...", "answer": "..." },
      { "question": "...", "answer": "..." },
      { "question": "...", "answer": "..." },
      { "question": "...", "answer": "..." },
      { "question": "...", "answer": "..." }
    ]
  },
  "seo": {
    "homeTitle": "Page title for home (60 chars max)",
    "homeDescription": "Meta description for home (155 chars max)",
    "aboutTitle": "Page title for about",
    "aboutDescription": "Meta description for about",
    "servicesTitle": "Page title for services",
    "servicesDescription": "Meta description for services",
    "contactTitle": "Page title for contact",
    "contactDescription": "Meta description for contact",
    "faqTitle": "Page title for FAQ",
    "faqDescription": "Meta description for FAQ"
  }
}

Respond ONLY with valid JSON, no markdown or explanation.`;

    const response = await this.openai!.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '';
    try {
      return JSON.parse(content) as AIGeneratedContent;
    } catch {
      console.error('Failed to parse AI response:', content);
      return this.generateFallbackContent(settings);
    }
  }

  private generateFallbackContent(settings: SiteSettings): AIGeneratedContent {
    const industry = settings.industry.toLowerCase();
    const name = settings.businessName;
    const year = settings.foundedYear || '2015';

    return {
      home: {
        heroHeadline: `Excellence in ${settings.industry}`,
        heroSubheadline: settings.tagline || `${name} delivers premium ${industry} services with dedication and expertise.`,
        features: [
          { title: 'Expert Team', description: 'Skilled professionals with years of industry experience', icon: 'users' },
          { title: 'Quality Guaranteed', description: 'We stand behind every project with our satisfaction guarantee', icon: 'award' },
          { title: 'Fast Turnaround', description: 'Efficient service delivery without compromising quality', icon: 'clock' },
          { title: 'Customer First', description: 'Your satisfaction is our top priority', icon: 'heart' },
        ],
        services: [
          { title: 'Premium Service', description: `Our flagship ${industry} service delivers exceptional results. We combine expertise with personalized attention to exceed your expectations.` },
          { title: 'Consultation', description: `Get expert advice tailored to your needs. Our team provides comprehensive ${industry} consultations to help you make informed decisions.` },
          { title: 'Ongoing Support', description: `We believe in building lasting relationships. Our support services ensure you always have access to professional assistance when needed.` },
        ],
        testimonials: [
          { name: 'John D.', role: 'Satisfied Customer', quote: `${name} exceeded all my expectations. Their professionalism and attention to detail made the entire process smooth and enjoyable. Highly recommended!`, rating: 5 },
          { name: 'Sarah M.', role: 'Local Business Owner', quote: `Working with ${name} was a fantastic experience. They truly understand ${industry} and delivered exactly what I needed.`, rating: 5 },
        ],
        ctaHeadline: 'Ready to Get Started?',
        ctaSubtext: `Contact ${name} today and discover the difference professional ${industry} services can make.`,
      },
      about: {
        headline: `About ${name}`,
        story: settings.description || `${name} was founded with a simple mission: to provide exceptional ${industry} services to our community. What started as a small operation has grown into a trusted name in the industry. Our journey has been defined by our commitment to quality, integrity, and customer satisfaction. Today, we continue to build on that foundation, serving clients with the same dedication that has driven us from day one.`,
        mission: `Our mission is to deliver outstanding ${industry} services that exceed expectations while building lasting relationships with our clients through trust and excellence.`,
        vision: `We envision being the most trusted ${industry} provider in our community, known for quality, reliability, and genuine care for every client we serve.`,
        values: [
          { title: 'Integrity', description: 'We operate with honesty and transparency in everything we do' },
          { title: 'Excellence', description: 'We strive for the highest standards in all our services' },
          { title: 'Customer Focus', description: 'Our clients are at the heart of every decision we make' },
        ],
        team: [
          { name: 'Alex Johnson', role: 'Founder & CEO', bio: `With over 15 years in ${industry}, Alex leads our team with passion and expertise, ensuring every client receives exceptional service.` },
          { name: 'Maria Garcia', role: 'Operations Director', bio: `Maria ensures smooth operations and maintains our high standards of quality across all services and client interactions.` },
          { name: 'David Chen', role: 'Senior Specialist', bio: `David brings deep expertise and a client-first approach to every project, consistently delivering outstanding results.` },
        ],
        timeline: [
          { year: year, title: 'Company Founded', description: `${name} was established with a vision to transform ${industry} services.` },
          { year: String(parseInt(year) + 3), title: 'Team Expansion', description: 'Grew our team and expanded service offerings to meet growing demand.' },
          { year: String(parseInt(year) + 6), title: 'Community Recognition', description: 'Received local recognition for excellence in service and community involvement.' },
          { year: 'Today', title: 'Continued Growth', description: 'Serving more satisfied clients than ever while maintaining our commitment to quality.' },
        ],
        stats: [
          { value: '500', label: 'Happy Clients', suffix: '+' },
          { value: String(new Date().getFullYear() - parseInt(year)), label: 'Years Experience', suffix: '+' },
          { value: '98', label: 'Satisfaction Rate', suffix: '%' },
          { value: '24', label: 'Support Available', suffix: '/7' },
        ],
      },
      services: {
        headline: 'Our Services',
        intro: `At ${name}, we offer a comprehensive range of ${industry} services designed to meet your unique needs. Each service is delivered with professionalism, expertise, and a commitment to excellence.`,
        services: [
          {
            title: 'Core Service Package',
            description: `Our comprehensive ${industry} service covers all your essential needs. We combine industry best practices with personalized attention to deliver results that exceed expectations. Trust our experienced team to handle every detail with care.`,
            features: ['Full-service solution', 'Expert consultation', 'Quality guarantee', 'Ongoing support']
          },
          {
            title: 'Premium Experience',
            description: `Elevate your experience with our premium offering. This enhanced service includes priority scheduling, dedicated support, and exclusive benefits designed for clients who demand the very best.`,
            features: ['Priority scheduling', 'Dedicated support team', 'Premium materials', 'Extended warranty']
          },
          {
            title: 'Consultation & Planning',
            description: `Not sure where to start? Our expert consultation service helps you understand your options and create a plan tailored to your specific needs and goals.`,
            features: ['In-depth assessment', 'Custom recommendations', 'Budget planning', 'Timeline development']
          },
          {
            title: 'Maintenance & Support',
            description: `Keep everything running smoothly with our ongoing maintenance and support services. We're here to ensure your continued satisfaction long after the initial service.`,
            features: ['Regular check-ins', 'Priority response', 'Preventive care', 'Expert guidance']
          },
        ],
        process: [
          { step: 1, title: 'Initial Consultation', description: 'We discuss your needs and goals to understand exactly what you\'re looking for.' },
          { step: 2, title: 'Custom Plan', description: 'We create a tailored plan that addresses your specific requirements and budget.' },
          { step: 3, title: 'Expert Execution', description: 'Our team delivers the service with precision and attention to detail.' },
          { step: 4, title: 'Follow-Up', description: 'We ensure your complete satisfaction and provide ongoing support.' },
        ],
      },
      contact: {
        headline: 'Get In Touch',
        intro: `We'd love to hear from you! Whether you have questions about our services, want to schedule a consultation, or just want to say hello, our team is here to help.`,
        formIntro: 'Fill out the form below and we\'ll get back to you promptly.',
      },
      faq: {
        headline: 'Frequently Asked Questions',
        intro: `Find answers to common questions about ${name} and our ${industry} services. Can't find what you're looking for? Contact us directly.`,
        questions: [
          { question: 'What services do you offer?', answer: `We offer a comprehensive range of ${industry} services tailored to meet your specific needs. From consultations to full-service solutions, we're equipped to handle projects of any size.` },
          { question: 'How do I schedule an appointment?', answer: `Scheduling is easy! You can call us directly at ${settings.contactPhone}, email us at ${settings.contactEmail}, or use our online booking system. We'll find a time that works best for you.` },
          { question: 'What are your business hours?', answer: 'We\'re open Monday through Friday from 9 AM to 5 PM, with Saturday hours from 10 AM to 2 PM. We\'re closed on Sundays, but you can always leave a message and we\'ll respond promptly.' },
          { question: 'Do you offer free consultations?', answer: 'Yes! We offer complimentary initial consultations to discuss your needs and how we can help. This no-obligation conversation helps us understand your goals and create the right plan for you.' },
          { question: 'What payment methods do you accept?', answer: 'We accept all major credit cards, cash, and checks. For larger projects, we can discuss flexible payment arrangements. Contact us to learn more about your options.' },
          { question: 'How long have you been in business?', answer: `${name} has been proudly serving our community since ${year}. With ${new Date().getFullYear() - parseInt(year)} years of experience, we have the expertise to deliver exceptional results.` },
        ],
      },
      seo: {
        homeTitle: `${name} | Professional ${settings.industry} Services`,
        homeDescription: `${name} provides expert ${industry} services with a commitment to quality and customer satisfaction. Contact us today for a free consultation.`,
        aboutTitle: `About Us | ${name}`,
        aboutDescription: `Learn about ${name}'s history, mission, and the dedicated team behind our ${industry} services. Serving our community since ${year}.`,
        servicesTitle: `Our Services | ${name}`,
        servicesDescription: `Explore ${name}'s comprehensive ${industry} services. From consultations to full-service solutions, we deliver excellence in everything we do.`,
        contactTitle: `Contact Us | ${name}`,
        contactDescription: `Get in touch with ${name}. Call ${settings.contactPhone} or email ${settings.contactEmail}. We're here to answer your questions and help you get started.`,
        faqTitle: `FAQ | ${name}`,
        faqDescription: `Find answers to common questions about ${name} and our ${industry} services. Learn about scheduling, pricing, and what to expect.`,
      },
    };
  }

  private async buildHomePage(settings: SiteSettings, content: AIGeneratedContent): Promise<Page> {
    const ctaText = settings.primaryCta === 'call' ? 'Call Us Today' : settings.primaryCta === 'book' ? 'Book Now' : 'Get a Quote';

    // Fetch images
    const heroImage = await this.imagesService.getImage(settings.industry, 'hero', 0);
    const aboutImage = await this.imagesService.getImage(settings.industry, 'about', 0);

    const sections: Section[] = [
      // Hero Section
      {
        id: generateId(),
        type: 'hero',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: content.home.heroHeadline, variant: 'h1', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: content.home.heroSubheadline, variant: 'lead', align: 'center' } as TextProps },
          { id: generateId(), type: 'button', props: { text: ctaText, href: '#contact', variant: 'primary', size: 'lg' } as ButtonProps },
          { id: generateId(), type: 'image', props: { src: heroImage, alt: `${settings.businessName} - ${settings.industry}`, objectFit: 'cover' } as ImageProps },
        ],
        style: { padding: 'xl' },
      },
      // Features Section
      {
        id: generateId(),
        type: 'features',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Why Choose Us', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'list', props: {
            items: content.home.features.map(f => ({
              id: generateId(),
              title: f.title,
              description: f.description,
              icon: f.icon,
            })),
            layout: 'grid',
            columns: 4,
          } as ListProps },
        ],
        style: { padding: 'lg', backgroundColor: '#f8fafc' },
      },
      // Services Preview Section
      {
        id: generateId(),
        type: 'services',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Services', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: 'Discover what we can do for you', variant: 'body', align: 'center' } as TextProps },
          { id: generateId(), type: 'list', props: {
            items: content.home.services.map(s => ({
              id: generateId(),
              title: s.title,
              description: s.description,
              icon: 'star',
            })),
            layout: 'cards',
            columns: 3,
          } as ListProps },
          { id: generateId(), type: 'button', props: { text: 'View All Services', href: '/services', variant: 'outline' } as ButtonProps },
        ],
        style: { padding: 'xl' },
      },
      // Testimonials Section
      {
        id: generateId(),
        type: 'testimonials',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'What Our Clients Say', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'list', props: {
            items: content.home.testimonials.map(t => ({
              id: generateId(),
              title: t.name,
              description: t.quote,
            })),
            layout: 'carousel',
          } as ListProps },
        ],
        style: { padding: 'xl', backgroundColor: '#f8fafc' },
      },
      // CTA Section
      {
        id: generateId(),
        type: 'cta',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: content.home.ctaHeadline, variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: content.home.ctaSubtext, variant: 'lead', align: 'center' } as TextProps },
          { id: generateId(), type: 'button', props: { text: ctaText, href: '/contact', variant: 'primary', size: 'lg' } as ButtonProps },
        ],
        style: { darkMode: true, padding: 'xl' },
      },
    ];

    return {
      title: 'Home',
      slug: 'home',
      sections,
      meta: {
        title: content.seo.homeTitle,
        description: content.seo.homeDescription,
      },
    };
  }

  private async buildAboutPage(settings: SiteSettings, content: AIGeneratedContent): Promise<Page> {
    // Fetch images
    const aboutImage = await this.imagesService.getImage(settings.industry, 'about', 0);
    const teamImages = await Promise.all([
      this.imagesService.getImage(settings.industry, 'team', 0),
      this.imagesService.getImage(settings.industry, 'team', 1),
      this.imagesService.getImage(settings.industry, 'team', 2),
    ]);

    const sections: Section[] = [
      // About Story Section
      {
        id: generateId(),
        type: 'about',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: content.about.headline, variant: 'h1', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: content.about.story, variant: 'lead', align: 'center' } as TextProps },
          { id: generateId(), type: 'image', props: { src: aboutImage, alt: `About ${settings.businessName}`, rounded: true, shadow: true } as ImageProps },
        ],
        style: { padding: 'xl' },
      },
      // Mission & Vision Section
      {
        id: generateId(),
        type: 'features',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Mission', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'text', props: { content: content.about.mission, variant: 'body' } as TextProps },
          { id: generateId(), type: 'text', props: { content: 'Our Vision', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'text', props: { content: content.about.vision, variant: 'body' } as TextProps },
          { id: generateId(), type: 'list', props: {
            items: content.about.values.map(v => ({
              id: generateId(),
              title: v.title,
              description: v.description,
              icon: 'heart',
            })),
            layout: 'grid',
            columns: 3,
          } as ListProps },
        ],
        style: { padding: 'xl', backgroundColor: '#f8fafc' },
      },
      // Timeline Section
      {
        id: generateId(),
        type: 'timeline',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Journey', variant: 'h2', align: 'center' } as TextProps },
          ...content.about.timeline.map(t => ({
            id: generateId(),
            type: 'timelineItem' as const,
            props: { year: t.year, title: t.title, description: t.description } as TimelineItemProps,
          })),
        ],
        style: { padding: 'xl' },
      },
      // Team Section
      {
        id: generateId(),
        type: 'team',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Meet Our Team', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: 'The people behind our success', variant: 'body', align: 'center' } as TextProps },
          ...content.about.team.map((t, i) => ({
            id: generateId(),
            type: 'teamMember' as const,
            props: { name: t.name, role: t.role, bio: t.bio, image: teamImages[i] || teamImages[0] } as TeamMemberProps,
          })),
        ],
        style: { padding: 'xl', backgroundColor: '#f8fafc' },
      },
      // Stats Section
      {
        id: generateId(),
        type: 'stats',
        variant: 1,
        blocks: content.about.stats.map(s => ({
          id: generateId(),
          type: 'stat' as const,
          props: { value: s.value, label: s.label, suffix: s.suffix } as StatProps,
        })),
        style: { padding: 'xl' },
      },
    ];

    return {
      title: 'About Us',
      slug: 'about',
      sections,
      meta: {
        title: content.seo.aboutTitle,
        description: content.seo.aboutDescription,
      },
    };
  }

  private async buildServicesPage(settings: SiteSettings, content: AIGeneratedContent): Promise<Page> {
    const ctaText = settings.primaryCta === 'call' ? 'Call Us Today' : settings.primaryCta === 'book' ? 'Book Now' : 'Get a Quote';

    // Fetch service images
    const serviceImages = await Promise.all(
      content.services.services.map((_, i) => this.imagesService.getImage(settings.industry, 'services', i))
    );

    const sections: Section[] = [
      // Services Header
      {
        id: generateId(),
        type: 'hero',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: content.services.headline, variant: 'h1', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: content.services.intro, variant: 'lead', align: 'center' } as TextProps },
        ],
        style: { padding: 'lg' },
      },
      // Services Grid
      {
        id: generateId(),
        type: 'services',
        variant: 1,
        blocks: [
          ...content.services.services.map((service, i) => ({
            id: generateId(),
            type: 'card' as const,
            props: {
              title: service.title,
              description: service.description,
              image: serviceImages[i],
              features: service.features,
              linkText: 'Learn More',
            },
          })),
        ],
        style: { padding: 'xl' },
      },
      // Process Section
      {
        id: generateId(),
        type: 'features',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Process', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: 'How we deliver exceptional results', variant: 'body', align: 'center' } as TextProps },
          { id: generateId(), type: 'list', props: {
            items: content.services.process.map(p => ({
              id: generateId(),
              title: `${p.step}. ${p.title}`,
              description: p.description,
            })),
            layout: 'grid',
            columns: 4,
          } as ListProps },
        ],
        style: { padding: 'xl', backgroundColor: '#f8fafc' },
      },
      // CTA Section
      {
        id: generateId(),
        type: 'cta',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Ready to Get Started?', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: 'Let us help you achieve your goals with our professional services.', variant: 'lead', align: 'center' } as TextProps },
          { id: generateId(), type: 'button', props: { text: ctaText, href: '/contact', variant: 'primary', size: 'lg' } as ButtonProps },
        ],
        style: { darkMode: true, padding: 'xl' },
      },
    ];

    return {
      title: 'Services',
      slug: 'services',
      sections,
      meta: {
        title: content.seo.servicesTitle,
        description: content.seo.servicesDescription,
      },
    };
  }

  private async buildContactPage(settings: SiteSettings, content: AIGeneratedContent): Promise<Page> {
    const ctaText = settings.primaryCta === 'call' ? 'Call Now' : settings.primaryCta === 'book' ? 'Book Appointment' : 'Request Quote';

    const sections: Section[] = [
      // Contact Header
      {
        id: generateId(),
        type: 'hero',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: content.contact.headline, variant: 'h1', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: content.contact.intro, variant: 'lead', align: 'center' } as TextProps },
        ],
        style: { padding: 'lg' },
      },
      // Contact Info + Form Section
      {
        id: generateId(),
        type: 'contact',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Contact Information', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'text', props: { content: `Email: ${settings.contactEmail}`, variant: 'body' } as TextProps },
          { id: generateId(), type: 'text', props: { content: `Phone: ${settings.contactPhone}`, variant: 'body' } as TextProps },
          ...(settings.address ? [{ id: generateId(), type: 'text' as const, props: { content: `Address: ${settings.address}${settings.city ? `, ${settings.city}` : ''}${settings.state ? `, ${settings.state}` : ''} ${settings.zip || ''}`, variant: 'body' } as TextProps }] : []),
          { id: generateId(), type: 'button', props: { text: ctaText, href: `tel:${settings.contactPhone}`, variant: 'primary' } as ButtonProps },
        ],
        style: { padding: 'lg' },
      },
      // Contact Form Section
      {
        id: generateId(),
        type: 'contactForm',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Send Us a Message', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'text', props: { content: content.contact.formIntro, variant: 'body' } as TextProps },
          { id: generateId(), type: 'form', props: {
            fields: [
              { id: generateId(), name: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'Your name' },
              { id: generateId(), name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'your@email.com' },
              { id: generateId(), name: 'phone', label: 'Phone Number', type: 'phone', required: false, placeholder: '(555) 555-5555' },
              { id: generateId(), name: 'service', label: 'Service Interested In', type: 'select', required: false, options: ['General Inquiry', ...content.services.services.map(s => s.title)] },
              { id: generateId(), name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'How can we help you?' },
            ],
            submitText: 'Send Message',
            successMessage: 'Thank you for reaching out! We\'ll get back to you within 24 hours.',
            recipientEmail: settings.contactEmail,
          } as FormProps },
        ],
        style: { padding: 'xl', backgroundColor: '#f8fafc' },
      },
      // Map Section
      {
        id: generateId(),
        type: 'map',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Find Us', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'map', props: {
            address: settings.address ? `${settings.address}, ${settings.city || ''}, ${settings.state || ''} ${settings.zip || ''}` : `${settings.city || 'Our Location'}, ${settings.state || ''}`,
            zoom: 15,
            height: 400,
          } as MapProps },
        ],
        style: { padding: 'lg' },
      },
      // Business Hours Section
      {
        id: generateId(),
        type: 'businessHours',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Business Hours', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'hours', props: {
            hours: settings.businessHours || DEFAULT_BUSINESS_HOURS,
            note: 'Hours may vary on holidays. Please call ahead to confirm.',
          } as HoursProps },
        ],
        style: { padding: 'lg', backgroundColor: '#f8fafc' },
      },
      // Social Links Section
      {
        id: generateId(),
        type: 'socialLinks',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Connect With Us', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'social', props: {
            links: settings.socialLinks || [
              { id: generateId(), platform: 'facebook', url: '#' },
              { id: generateId(), platform: 'instagram', url: '#' },
              { id: generateId(), platform: 'twitter', url: '#' },
              { id: generateId(), platform: 'linkedin', url: '#' },
            ],
            style: 'icons',
          } as SocialProps },
        ],
        style: { padding: 'lg' },
      },
    ];

    return {
      title: 'Contact',
      slug: 'contact',
      sections,
      meta: {
        title: content.seo.contactTitle,
        description: content.seo.contactDescription,
      },
    };
  }

  private async buildFaqPage(settings: SiteSettings, content: AIGeneratedContent): Promise<Page> {
    const ctaText = settings.primaryCta === 'call' ? 'Call Us Today' : settings.primaryCta === 'book' ? 'Book Now' : 'Get a Quote';

    const sections: Section[] = [
      // FAQ Header
      {
        id: generateId(),
        type: 'hero',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: content.faq.headline, variant: 'h1', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: content.faq.intro, variant: 'lead', align: 'center' } as TextProps },
        ],
        style: { padding: 'lg' },
      },
      // FAQ Accordion Section
      {
        id: generateId(),
        type: 'faq',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'accordion', props: {
            items: content.faq.questions.map(q => ({
              id: generateId(),
              question: q.question,
              answer: q.answer,
            })),
            allowMultiple: true,
          } as AccordionProps },
        ],
        style: { padding: 'xl' },
      },
      // Still Have Questions Section
      {
        id: generateId(),
        type: 'cta',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Still Have Questions?', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: `We're here to help! Contact us and we'll be happy to answer any questions you may have.`, variant: 'lead', align: 'center' } as TextProps },
          { id: generateId(), type: 'button', props: { text: 'Contact Us', href: '/contact', variant: 'primary', size: 'lg' } as ButtonProps },
          { id: generateId(), type: 'button', props: { text: ctaText, href: `tel:${settings.contactPhone}`, variant: 'outline', size: 'lg' } as ButtonProps },
        ],
        style: { darkMode: true, padding: 'xl' },
      },
    ];

    return {
      title: 'FAQ',
      slug: 'faq',
      sections,
      meta: {
        title: content.seo.faqTitle,
        description: content.seo.faqDescription,
      },
    };
  }

  async generateSectionVariations(section: Section, settings: SiteSettings): Promise<Section[]> {
    // Generate 3 variations of a section
    if (!this.openai) {
      return [section, { ...section, id: generateId() }, { ...section, id: generateId() }];
    }

    const prompt = `Generate 3 variations of ${section.type} section content for a ${settings.industry} business called "${settings.businessName}".
Style: ${settings.stylePreset}

Current content: ${JSON.stringify(section.blocks.filter((b: Block) => b.type === 'text').map((b: Block) => (b.props as TextProps).content))}

Respond with JSON array of 3 variations, each with:
{ "headline": "...", "subtext": "..." }

Respond ONLY with valid JSON array.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
      });

      const contentStr = response.choices[0]?.message?.content || '';
      const variations = JSON.parse(contentStr);

      return variations.map((v: { headline: string; subtext: string }, i: number) => ({
        ...section,
        id: generateId(),
        variant: (i + 1) as 1 | 2 | 3,
        blocks: section.blocks.map((block: Block) => {
          if (block.type === 'text') {
            const props = block.props as TextProps;
            if (props.variant === 'h1' || props.variant === 'h2') {
              return { ...block, id: generateId(), props: { ...props, content: v.headline } };
            }
            if (props.variant === 'body' || props.variant === 'lead') {
              return { ...block, id: generateId(), props: { ...props, content: v.subtext } };
            }
          }
          return { ...block, id: generateId() };
        }),
      }));
    } catch (error) {
      console.error('Failed to generate variations:', error);
      return [section, { ...section, id: generateId() }, { ...section, id: generateId() }];
    }
  }

  // ============================================
  // AI Co-Pilot - Real-time editing assistant
  // ============================================

  async copilotChat(
    messages: CopilotMessage[],
    context: CopilotContext,
  ): Promise<CopilotResponse> {
    if (!this.openai) {
      return this.handleCopilotFallback(messages, context);
    }

    const systemPrompt = this.buildCopilotSystemPrompt(context);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '';
      const parsed = JSON.parse(content);

      return {
        message: parsed.message || 'I can help you improve your website.',
        actions: parsed.actions || [],
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      console.error('Copilot chat error:', error);
      return this.handleCopilotFallback(messages, context);
    }
  }

  private buildCopilotSystemPrompt(context: CopilotContext): string {
    const sectionInfo = context.selectedSection
      ? `\nCurrently selected section: ${context.selectedSection.type} (ID: ${context.selectedSection.id})`
      : '';

    return `You are an AI Co-Pilot for a website builder. Help users edit and improve their website in real-time.

BUSINESS CONTEXT:
- Business: ${context.siteSettings.businessName}
- Industry: ${context.siteSettings.industry}
- Style: ${context.siteSettings.stylePreset}
- Description: ${context.siteSettings.description || 'Not provided'}

CURRENT PAGE: ${context.currentPage.title} (/${context.currentPage.slug})
Sections on page: ${context.currentPage.sections.map(s => s.type).join(', ')}${sectionInfo}

You can perform these actions:
1. update_text - Change text content in a block
2. update_style - Modify section styling (colors, padding, dark mode)
3. add_section - Add a new section to the page
4. remove_section - Remove a section
5. reorder - Move sections up or down
6. update_image - Suggest new image search terms

RESPONSE FORMAT (JSON only):
{
  "message": "Your helpful response to the user",
  "actions": [
    {
      "type": "update_text",
      "target": { "sectionId": "...", "blockId": "..." },
      "payload": { "content": "New text content" }
    }
  ],
  "suggestions": ["Quick suggestion 1", "Quick suggestion 2", "Quick suggestion 3"]
}

Be concise, helpful, and proactive. Suggest improvements based on industry best practices.
If the user asks to change text, provide the action with the exact new content.
If the user asks a question, answer it and suggest related improvements.
Always provide 2-3 quick suggestions for what they could do next.`;
  }

  private handleCopilotFallback(messages: CopilotMessage[], context: CopilotContext): CopilotResponse {
    const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';

    if (lastMessage.includes('headline') || lastMessage.includes('title')) {
      return {
        message: `I can help you improve your headlines! For ${context.siteSettings.industry} businesses, effective headlines should be clear, benefit-focused, and include your unique value proposition.`,
        suggestions: [
          'Make the headline more action-oriented',
          'Add your key differentiator',
          'Include a compelling benefit',
        ],
      };
    }

    if (lastMessage.includes('color') || lastMessage.includes('style')) {
      return {
        message: `Your current style preset is "${context.siteSettings.stylePreset}". I can help adjust colors and styling to better match your brand.`,
        suggestions: [
          'Try dark mode for this section',
          'Adjust the accent color',
          'Change the section padding',
        ],
      };
    }

    if (lastMessage.includes('add') || lastMessage.includes('new section')) {
      return {
        message: `I can help you add new sections! Based on your ${context.siteSettings.industry} business, I recommend adding sections that showcase your expertise and build trust.`,
        suggestions: [
          'Add a testimonials section',
          'Add a FAQ section',
          'Add a stats/numbers section',
        ],
      };
    }

    return {
      message: `I'm your AI Co-Pilot, ready to help you improve "${context.siteSettings.businessName}"! I can help you edit text, adjust styles, add sections, or suggest improvements.`,
      suggestions: [
        'Improve my headline',
        'Add a new section',
        'Make this section stand out',
      ],
    };
  }

  async copilotSuggestImprovements(context: CopilotContext): Promise<CopilotResponse> {
    if (!this.openai) {
      return {
        message: `Here are some suggestions to improve your ${context.currentPage.title} page:`,
        suggestions: this.getDefaultImprovementSuggestions(context),
      };
    }

    const prompt = `Analyze this website page and suggest 5 specific improvements.

Business: ${context.siteSettings.businessName}
Industry: ${context.siteSettings.industry}
Page: ${context.currentPage.title}
Current sections: ${JSON.stringify(context.currentPage.sections.map(s => ({
      type: s.type,
      hasText: s.blocks.some(b => b.type === 'text'),
      hasImage: s.blocks.some(b => b.type === 'image'),
    })))}

Respond with JSON:
{
  "message": "Brief analysis of the page",
  "suggestions": ["Specific improvement 1", "Specific improvement 2", ...]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '';
      return JSON.parse(content);
    } catch {
      return {
        message: `Here are some suggestions to improve your ${context.currentPage.title} page:`,
        suggestions: this.getDefaultImprovementSuggestions(context),
      };
    }
  }

  private getDefaultImprovementSuggestions(context: CopilotContext): string[] {
    const suggestions: string[] = [];
    const sectionTypes = context.currentPage.sections.map(s => s.type);

    if (!sectionTypes.includes('testimonials')) {
      suggestions.push('Add customer testimonials to build trust');
    }
    if (!sectionTypes.includes('faq')) {
      suggestions.push('Add a FAQ section to answer common questions');
    }
    if (!sectionTypes.includes('stats')) {
      suggestions.push('Add statistics to showcase your achievements');
    }
    if (!sectionTypes.includes('cta')) {
      suggestions.push('Add a clear call-to-action section');
    }
    suggestions.push('Ensure all images have descriptive alt text for SEO');
    suggestions.push('Make headlines more compelling with action words');

    return suggestions.slice(0, 5);
  }

  async copilotRewriteText(
    text: string,
    style: 'professional' | 'casual' | 'persuasive' | 'concise',
    context: CopilotContext,
  ): Promise<{ original: string; rewritten: string; alternatives: string[] }> {
    if (!this.openai) {
      return { original: text, rewritten: text, alternatives: [text] };
    }

    const prompt = `Rewrite this text for a ${context.siteSettings.industry} business website.
Style: ${style}
Original: "${text}"

Respond with JSON:
{
  "rewritten": "The best rewritten version",
  "alternatives": ["Alternative 1", "Alternative 2"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '';
      const parsed = JSON.parse(content);

      return {
        original: text,
        rewritten: parsed.rewritten || text,
        alternatives: parsed.alternatives || [],
      };
    } catch {
      return { original: text, rewritten: text, alternatives: [] };
    }
  }

  // ============================================
  // JSON-LD Schema Markup for SEO
  // ============================================

  generateSchemaMarkup(settings: SiteSettings, page: Page): Record<string, unknown>[] {
    const schemas: Record<string, unknown>[] = [];

    // Organization schema
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: settings.businessName,
      description: settings.description || `${settings.businessName} - ${settings.industry} services`,
      url: settings.websiteUrl || '',
      telephone: settings.contactPhone,
      email: settings.contactEmail,
      address: settings.address ? {
        '@type': 'PostalAddress',
        streetAddress: settings.address,
        addressLocality: settings.city,
        addressRegion: settings.state,
        postalCode: settings.zip,
        addressCountry: 'US',
      } : undefined,
      openingHoursSpecification: settings.businessHours?.map(day => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: day.day,
        opens: day.open,
        closes: day.close,
      })).filter(d => d.opens && d.closes),
      sameAs: settings.socialLinks?.map(l => l.url).filter(Boolean),
    });

    // Page-specific schemas
    if (page.slug === 'home') {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: settings.businessName,
        url: settings.websiteUrl || '',
      });
    }

    if (page.slug === 'services') {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'Service',
        provider: { '@type': 'LocalBusiness', name: settings.businessName },
        serviceType: settings.industry,
        areaServed: settings.city && settings.state ? {
          '@type': 'City',
          name: `${settings.city}, ${settings.state}`,
        } : undefined,
      });
    }

    if (page.slug === 'faq') {
      const faqSection = page.sections.find(s => s.type === 'faq');
      if (faqSection) {
        const accordionBlock = faqSection.blocks.find(b => b.type === 'accordion');
        if (accordionBlock) {
          const props = accordionBlock.props as AccordionProps;
          schemas.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: props.items.map(item => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          });
        }
      }
    }

    if (page.slug === 'contact') {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        mainEntity: {
          '@type': 'LocalBusiness',
          name: settings.businessName,
          telephone: settings.contactPhone,
          email: settings.contactEmail,
        },
      });
    }

    return schemas;
  }
}
