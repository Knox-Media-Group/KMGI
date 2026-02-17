// ============================================
// CORE TYPES
// ============================================

export type TenantRole = 'owner' | 'admin' | 'member';

export interface Tenant {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export interface Membership {
  userId: string;
  tenantId: string;
  role: TenantRole;
}

export type SiteStatus = 'provisioning' | 'generating' | 'draft' | 'published' | 'error';

export interface Site {
  id: string;
  tenantId: string;
  ownerUserId: string;
  name: string;
  status: SiteStatus;
  wpSiteId: number | null;
  wpAdminUrl: string | null;
  wpSiteUrl: string | null;
  currentVersionId: string | null;
  publishedVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SiteVersion {
  id: string;
  siteId: string;
  versionNumber: number;
  pageJson: SiteContent;
  createdAt: Date;
}

export type JobType = 'provision' | 'generate' | 'publish' | 'rollback';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  siteId: string;
  type: JobType;
  status: JobStatus;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface JobLog {
  id: string;
  jobId: string;
  message: string;
  createdAt: Date;
}

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';

export interface StripeSubscription {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
}

// ============================================
// PAGE SCHEMA - Platform Agnostic JSON
// ============================================

// Extended section types for 5-page website
export type SectionType =
  | 'hero'
  | 'about'
  | 'services'
  | 'testimonials'
  | 'contact'
  | 'footer'
  | 'navigation'
  | 'features'
  | 'cta'
  | 'team'
  | 'timeline'
  | 'faq'
  | 'contactForm'
  | 'map'
  | 'gallery'
  | 'socialLinks'
  | 'businessHours'
  | 'products'
  | 'stats'
  | 'pricing';

// Extended block types
export type BlockType =
  | 'text'
  | 'image'
  | 'button'
  | 'list'
  | 'form'
  | 'accordion'
  | 'map'
  | 'social'
  | 'hours'
  | 'card'
  | 'stat'
  | 'teamMember'
  | 'timelineItem'
  | 'video'
  | 'divider'
  | 'spacer';

// ============================================
// BLOCK PROPS - Data structures for each block
// ============================================

export interface TextProps {
  content: string;
  variant: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'lead' | 'small' | 'caption';
  align?: 'left' | 'center' | 'right';
}

export interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  objectFit?: 'cover' | 'contain' | 'fill';
  rounded?: boolean;
  shadow?: boolean;
}

export interface ButtonProps {
  text: string;
  href: string;
  variant: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  fullWidth?: boolean;
}

export interface ListItem {
  id: string;
  title: string;
  description: string;
  icon?: string;
  image?: string;
  link?: string;
}

export interface ListProps {
  items: ListItem[];
  layout: 'grid' | 'list' | 'cards' | 'carousel';
  columns?: 2 | 3 | 4;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For select fields
}

export interface FormProps {
  fields: FormField[];
  submitText: string;
  successMessage: string;
  recipientEmail?: string;
}

export interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}

export interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
}

export interface MapProps {
  address: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  height?: number;
}

export interface SocialLink {
  id: string;
  platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'pinterest' | 'yelp' | 'google';
  url: string;
}

export interface SocialProps {
  links: SocialLink[];
  style?: 'icons' | 'buttons' | 'text';
}

export interface BusinessDay {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  open: string;
  close: string;
  closed?: boolean;
}

export interface HoursProps {
  hours: BusinessDay[];
  timezone?: string;
  note?: string;
}

export interface CardProps {
  title: string;
  description: string;
  image?: string;
  icon?: string;
  price?: string;
  features?: string[];
  link?: string;
  linkText?: string;
  highlighted?: boolean;
}

export interface StatProps {
  value: string;
  label: string;
  icon?: string;
  prefix?: string;
  suffix?: string;
}

export interface TeamMemberProps {
  name: string;
  role: string;
  bio?: string;
  image: string;
  email?: string;
  phone?: string;
  social?: SocialLink[];
}

export interface TimelineItemProps {
  year: string;
  title: string;
  description: string;
  icon?: string;
}

export interface VideoProps {
  src: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export interface DividerProps {
  style: 'line' | 'dots' | 'gradient' | 'wave';
  color?: string;
}

export interface SpacerProps {
  height: 'sm' | 'md' | 'lg' | 'xl';
}

export type BlockProps =
  | TextProps
  | ImageProps
  | ButtonProps
  | ListProps
  | FormProps
  | AccordionProps
  | MapProps
  | SocialProps
  | HoursProps
  | CardProps
  | StatProps
  | TeamMemberProps
  | TimelineItemProps
  | VideoProps
  | DividerProps
  | SpacerProps;

export interface Block {
  id: string;
  type: BlockType;
  props: BlockProps;
}

// ============================================
// SECTION SCHEMA
// ============================================

export interface SectionStyle {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundOverlay?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  darkMode?: boolean;
}

export interface Section {
  id: string;
  type: SectionType;
  variant: 1 | 2 | 3;
  blocks: Block[];
  style?: SectionStyle;
}

// ============================================
// PAGE SCHEMA
// ============================================

export interface PageMeta {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  noIndex?: boolean;
}

export interface Page {
  title: string;
  slug: string;
  sections: Section[];
  meta?: PageMeta;
}

// ============================================
// SITE CONTENT & SETTINGS
// ============================================

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  children?: NavigationItem[];
}

export interface FooterColumn {
  id: string;
  title: string;
  links: NavigationItem[];
}

export interface SiteNavigation {
  logo?: string;
  logoText?: string;
  items: NavigationItem[];
  ctaButton?: ButtonProps;
}

export interface SiteFooter {
  columns: FooterColumn[];
  copyright: string;
  social?: SocialLink[];
  showBackToTop?: boolean;
}

export interface SiteContent {
  pages: Page[];
  settings: SiteSettings;
  navigation?: SiteNavigation;
  footer?: SiteFooter;
  globalMeta?: PageMeta;
}

export interface SiteSettings {
  businessName: string;
  industry: string;
  description?: string;
  stylePreset: StylePreset;
  accentColor: string;
  primaryCta: PrimaryCta;
  contactEmail: string;
  contactPhone: string;
  // Extended settings for 5-page generator
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  tagline?: string;
  foundedYear?: string;
  socialLinks?: SocialLink[];
  businessHours?: BusinessDay[];
  darkMode?: boolean;
  animations?: boolean;
}

export type StylePreset = 'modern' | 'classic' | 'bold' | 'minimal' | 'playful' | 'professional';
export type PrimaryCta = 'call' | 'book' | 'quote';

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

// Auth
export interface SignupRequest {
  email: string;
  password: string;
  tenantId?: string; // Optional - uses default tenant if not provided
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantId?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  tenant: Tenant;
}

export interface MeResponse {
  user: User;
  tenant: Tenant;
  membership: Membership;
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
  } | null;
}

// Sites
export interface CreateSiteRequest {
  settings: SiteSettings;
}

export interface CreateSiteResponse {
  site: Site;
  jobId: string;
}

export interface GenerateSiteRequest {
  sectionId?: string; // Optional - regenerate specific section
}

export interface GenerateSiteResponse {
  jobId: string;
}

export interface SaveDraftRequest {
  pages: Page[];
}

export interface SaveDraftResponse {
  version: SiteVersion;
}

export interface PublishResponse {
  jobId: string;
}

export interface RollbackRequest {
  versionId: string;
}

export interface RollbackResponse {
  jobId: string;
}

export interface SiteDetailResponse {
  site: Site;
  currentVersion: SiteVersion | null;
  versions: SiteVersion[];
  activeJob: Job | null;
}

// Billing
export interface BillingStatusResponse {
  hasSubscription: boolean;
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
  } | null;
}

export interface CreateCheckoutResponse {
  checkoutUrl: string;
}

export interface CreatePortalResponse {
  portalUrl: string;
}

// Jobs
export interface JobStatusResponse {
  job: Job;
  logs: JobLog[];
}

// ============================================
// ONBOARDING WIZARD TYPES
// ============================================

export interface WizardStep1 {
  businessName: string;
}

export interface WizardStep2 {
  industry: string;
}

export interface WizardStep3 {
  description: string;
}

export interface WizardStep4 {
  stylePreset: StylePreset;
}

export interface WizardStep5 {
  accentColor: string;
}

export interface WizardStep6 {
  primaryCta: PrimaryCta;
}

export interface WizardStep7 {
  contactEmail: string;
  contactPhone: string;
}

export type WizardData = WizardStep1 & WizardStep2 & WizardStep3 & WizardStep4 & WizardStep5 & WizardStep6 & WizardStep7;

// ============================================
// CONSTANTS
// ============================================

export const STYLE_PRESETS: { value: StylePreset; label: string; description: string }[] = [
  { value: 'modern', label: 'Modern', description: 'Clean lines, lots of whitespace' },
  { value: 'classic', label: 'Classic', description: 'Timeless, elegant design' },
  { value: 'bold', label: 'Bold', description: 'Strong colors, impactful' },
  { value: 'minimal', label: 'Minimal', description: 'Simple and focused' },
  { value: 'playful', label: 'Playful', description: 'Fun, vibrant energy' },
  { value: 'professional', label: 'Professional', description: 'Corporate, trustworthy' },
];

export const INDUSTRIES = [
  'Restaurant',
  'Retail',
  'Healthcare',
  'Real Estate',
  'Legal',
  'Consulting',
  'Fitness',
  'Beauty & Spa',
  'Photography',
  'Construction',
  'Technology',
  'Education',
  'Automotive',
  'Financial Services',
  'Home Services',
  'Marketing Agency',
  'Non-Profit',
  'Other',
];

export const PRIMARY_CTA_OPTIONS: { value: PrimaryCta; label: string }[] = [
  { value: 'call', label: 'Call Us' },
  { value: 'book', label: 'Book Appointment' },
  { value: 'quote', label: 'Get a Quote' },
];

export const SECTION_LIBRARY: { type: SectionType; name: string; description: string; pages: string[] }[] = [
  // Navigation & Footer (global)
  { type: 'navigation', name: 'Navigation', description: 'Main navigation bar', pages: ['all'] },
  { type: 'footer', name: 'Footer', description: 'Footer with links and info', pages: ['all'] },

  // Home page sections
  { type: 'hero', name: 'Hero', description: 'Main banner with headline', pages: ['home'] },
  { type: 'features', name: 'Features', description: 'Key features or benefits', pages: ['home', 'services'] },
  { type: 'services', name: 'Services', description: 'List your services', pages: ['home', 'services'] },
  { type: 'testimonials', name: 'Testimonials', description: 'Customer reviews', pages: ['home', 'about'] },
  { type: 'cta', name: 'Call to Action', description: 'Conversion section', pages: ['home', 'services', 'about'] },
  { type: 'stats', name: 'Statistics', description: 'Key numbers and metrics', pages: ['home', 'about'] },

  // About page sections
  { type: 'about', name: 'About', description: 'About your business', pages: ['about', 'home'] },
  { type: 'team', name: 'Team', description: 'Team members with photos', pages: ['about'] },
  { type: 'timeline', name: 'Timeline', description: 'Company milestones', pages: ['about'] },
  { type: 'gallery', name: 'Gallery', description: 'Image gallery', pages: ['about', 'services'] },

  // Contact page sections
  { type: 'contact', name: 'Contact Info', description: 'Contact information', pages: ['contact'] },
  { type: 'contactForm', name: 'Contact Form', description: 'Working contact form', pages: ['contact'] },
  { type: 'map', name: 'Map', description: 'Embedded Google Map', pages: ['contact'] },
  { type: 'businessHours', name: 'Business Hours', description: 'Operating hours', pages: ['contact'] },
  { type: 'socialLinks', name: 'Social Links', description: 'Social media links', pages: ['contact', 'about'] },

  // Services/Products page sections
  { type: 'products', name: 'Products', description: 'Product cards', pages: ['services'] },
  { type: 'pricing', name: 'Pricing', description: 'Pricing tables', pages: ['services'] },

  // FAQ page sections
  { type: 'faq', name: 'FAQ', description: 'Expandable questions', pages: ['faq'] },
];

export const DEFAULT_ACCENT_COLORS = [
  '#2563EB', // Blue
  '#DC2626', // Red
  '#16A34A', // Green
  '#9333EA', // Purple
  '#EA580C', // Orange
  '#0891B2', // Cyan
  '#0F766E', // Teal
  '#BE185D', // Pink
];

export const SOCIAL_PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: 'facebook' },
  { id: 'twitter', name: 'Twitter/X', icon: 'twitter' },
  { id: 'instagram', name: 'Instagram', icon: 'instagram' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'linkedin' },
  { id: 'youtube', name: 'YouTube', icon: 'youtube' },
  { id: 'tiktok', name: 'TikTok', icon: 'tiktok' },
  { id: 'pinterest', name: 'Pinterest', icon: 'pinterest' },
  { id: 'yelp', name: 'Yelp', icon: 'yelp' },
  { id: 'google', name: 'Google Business', icon: 'google' },
];

export const DEFAULT_BUSINESS_HOURS: BusinessDay[] = [
  { day: 'monday', open: '09:00', close: '17:00' },
  { day: 'tuesday', open: '09:00', close: '17:00' },
  { day: 'wednesday', open: '09:00', close: '17:00' },
  { day: 'thursday', open: '09:00', close: '17:00' },
  { day: 'friday', open: '09:00', close: '17:00' },
  { day: 'saturday', open: '10:00', close: '14:00' },
  { day: 'sunday', open: '00:00', close: '00:00', closed: true },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function createDefaultSection(type: SectionType, settings: SiteSettings): Section {
  const id = generateId();

  switch (type) {
    case 'navigation':
      return {
        id,
        type: 'navigation',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: settings.businessName, variant: 'h3' } as TextProps },
          { id: generateId(), type: 'button', props: { text: settings.primaryCta === 'call' ? 'Call Us' : settings.primaryCta === 'book' ? 'Book Now' : 'Get Quote', href: '#contact', variant: 'primary' } as ButtonProps },
        ],
      };

    case 'hero':
      return {
        id,
        type: 'hero',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: `Welcome to ${settings.businessName}`, variant: 'h1', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: settings.tagline || 'Your trusted partner for all your needs', variant: 'lead', align: 'center' } as TextProps },
          { id: generateId(), type: 'button', props: { text: settings.primaryCta === 'call' ? 'Call Us Today' : settings.primaryCta === 'book' ? 'Book Now' : 'Get a Quote', href: '#contact', variant: 'primary', size: 'lg' } as ButtonProps },
          { id: generateId(), type: 'image', props: { src: '/placeholder-hero.jpg', alt: 'Hero image', objectFit: 'cover' } as ImageProps },
        ],
      };

    case 'features':
      return {
        id,
        type: 'features',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Why Choose Us', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'list', props: {
            items: [
              { id: generateId(), title: 'Expert Team', description: 'Years of experience in the industry', icon: 'users' },
              { id: generateId(), title: 'Quality Service', description: 'We stand behind our work', icon: 'award' },
              { id: generateId(), title: 'Fast Turnaround', description: 'Efficient and timely delivery', icon: 'clock' },
              { id: generateId(), title: '24/7 Support', description: 'Always here when you need us', icon: 'headphones' },
            ],
            layout: 'grid',
            columns: 4,
          } as ListProps },
        ],
      };

    case 'about':
      return {
        id,
        type: 'about',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'About Us', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'text', props: { content: settings.description || `${settings.businessName} has been serving the ${settings.industry} industry with dedication and excellence.`, variant: 'body' } as TextProps },
          { id: generateId(), type: 'image', props: { src: '/placeholder-about.jpg', alt: 'About us', rounded: true, shadow: true } as ImageProps },
        ],
      };

    case 'services':
      return {
        id,
        type: 'services',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Services', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: 'Discover what we can do for you', variant: 'body', align: 'center' } as TextProps },
          { id: generateId(), type: 'list', props: { items: [
            { id: generateId(), title: 'Service 1', description: 'Description of service 1', icon: 'star' },
            { id: generateId(), title: 'Service 2', description: 'Description of service 2', icon: 'star' },
            { id: generateId(), title: 'Service 3', description: 'Description of service 3', icon: 'star' },
          ], layout: 'cards', columns: 3 } as ListProps },
        ],
      };

    case 'testimonials':
      return {
        id,
        type: 'testimonials',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'What Our Clients Say', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'list', props: { items: [
            { id: generateId(), title: 'John D.', description: 'Excellent service! Highly recommended.' },
            { id: generateId(), title: 'Sarah M.', description: 'Professional and reliable. Will use again.' },
          ], layout: 'carousel' } as ListProps },
        ],
      };

    case 'cta':
      return {
        id,
        type: 'cta',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Ready to Get Started?', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: 'Contact us today and let us help you achieve your goals.', variant: 'lead', align: 'center' } as TextProps },
          { id: generateId(), type: 'button', props: { text: settings.primaryCta === 'call' ? 'Call Us Now' : settings.primaryCta === 'book' ? 'Book Appointment' : 'Request a Quote', href: '#contact', variant: 'primary', size: 'lg' } as ButtonProps },
        ],
        style: { darkMode: true, padding: 'xl' },
      };

    case 'stats':
      return {
        id,
        type: 'stats',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'stat', props: { value: '500', label: 'Happy Clients', suffix: '+' } as StatProps },
          { id: generateId(), type: 'stat', props: { value: '10', label: 'Years Experience', suffix: '+' } as StatProps },
          { id: generateId(), type: 'stat', props: { value: '50', label: 'Projects Completed', suffix: '+' } as StatProps },
          { id: generateId(), type: 'stat', props: { value: '24', label: 'Support', suffix: '/7' } as StatProps },
        ],
      };

    case 'team':
      return {
        id,
        type: 'team',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Meet Our Team', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'text', props: { content: 'The people behind our success', variant: 'body', align: 'center' } as TextProps },
          { id: generateId(), type: 'teamMember', props: { name: 'John Smith', role: 'CEO & Founder', image: '/placeholder-team-1.jpg', bio: 'Leading our company with vision and expertise.' } as TeamMemberProps },
          { id: generateId(), type: 'teamMember', props: { name: 'Jane Doe', role: 'Operations Manager', image: '/placeholder-team-2.jpg', bio: 'Ensuring smooth operations every day.' } as TeamMemberProps },
          { id: generateId(), type: 'teamMember', props: { name: 'Mike Johnson', role: 'Lead Specialist', image: '/placeholder-team-3.jpg', bio: 'Expert in delivering quality results.' } as TeamMemberProps },
        ],
      };

    case 'timeline':
      return {
        id,
        type: 'timeline',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Journey', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'timelineItem', props: { year: settings.foundedYear || '2010', title: 'Company Founded', description: `${settings.businessName} was established with a mission to serve.` } as TimelineItemProps },
          { id: generateId(), type: 'timelineItem', props: { year: '2015', title: 'Major Expansion', description: 'Expanded our services and team significantly.' } as TimelineItemProps },
          { id: generateId(), type: 'timelineItem', props: { year: '2020', title: 'Industry Recognition', description: 'Received awards for excellence in our field.' } as TimelineItemProps },
          { id: generateId(), type: 'timelineItem', props: { year: 'Today', title: 'Continued Growth', description: 'Serving more clients than ever before.' } as TimelineItemProps },
        ],
      };

    case 'contact':
      return {
        id,
        type: 'contact',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Contact Us', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'text', props: { content: `Email: ${settings.contactEmail}`, variant: 'body' } as TextProps },
          { id: generateId(), type: 'text', props: { content: `Phone: ${settings.contactPhone}`, variant: 'body' } as TextProps },
          settings.address ? { id: generateId(), type: 'text', props: { content: `Address: ${settings.address}${settings.city ? `, ${settings.city}` : ''}${settings.state ? `, ${settings.state}` : ''} ${settings.zip || ''}`, variant: 'body' } as TextProps } : null,
          { id: generateId(), type: 'button', props: { text: settings.primaryCta === 'call' ? 'Call Now' : settings.primaryCta === 'book' ? 'Book Appointment' : 'Request Quote', href: `tel:${settings.contactPhone}`, variant: 'primary' } as ButtonProps },
        ].filter(Boolean) as Block[],
      };

    case 'contactForm':
      return {
        id,
        type: 'contactForm',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Send Us a Message', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'form', props: {
            fields: [
              { id: generateId(), name: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'Your name' },
              { id: generateId(), name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'your@email.com' },
              { id: generateId(), name: 'phone', label: 'Phone Number', type: 'phone', required: false, placeholder: '(555) 555-5555' },
              { id: generateId(), name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'How can we help you?' },
            ],
            submitText: 'Send Message',
            successMessage: 'Thank you! We\'ll get back to you soon.',
            recipientEmail: settings.contactEmail,
          } as FormProps },
        ],
      };

    case 'map':
      return {
        id,
        type: 'map',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Find Us', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'map', props: {
            address: settings.address ? `${settings.address}, ${settings.city || ''}, ${settings.state || ''} ${settings.zip || ''}` : 'Enter your address',
            zoom: 15,
            height: 400,
          } as MapProps },
        ],
      };

    case 'businessHours':
      return {
        id,
        type: 'businessHours',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Business Hours', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'hours', props: {
            hours: settings.businessHours || DEFAULT_BUSINESS_HOURS,
            note: 'Hours may vary on holidays',
          } as HoursProps },
        ],
      };

    case 'socialLinks':
      return {
        id,
        type: 'socialLinks',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Follow Us', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'social', props: {
            links: settings.socialLinks || [
              { id: generateId(), platform: 'facebook', url: '#' },
              { id: generateId(), platform: 'instagram', url: '#' },
              { id: generateId(), platform: 'twitter', url: '#' },
            ],
            style: 'icons',
          } as SocialProps },
        ],
      };

    case 'products':
      return {
        id,
        type: 'products',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Products', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'card', props: { title: 'Product 1', description: 'Description of product 1', price: '$99', image: '/placeholder-product-1.jpg' } as CardProps },
          { id: generateId(), type: 'card', props: { title: 'Product 2', description: 'Description of product 2', price: '$149', image: '/placeholder-product-2.jpg' } as CardProps },
          { id: generateId(), type: 'card', props: { title: 'Product 3', description: 'Description of product 3', price: '$199', image: '/placeholder-product-3.jpg' } as CardProps },
        ],
      };

    case 'pricing':
      return {
        id,
        type: 'pricing',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Pricing Plans', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'card', props: { title: 'Basic', description: 'Perfect for getting started', price: '$29/mo', features: ['Feature 1', 'Feature 2', 'Feature 3'], linkText: 'Get Started' } as CardProps },
          { id: generateId(), type: 'card', props: { title: 'Professional', description: 'Most popular choice', price: '$79/mo', features: ['All Basic features', 'Feature 4', 'Feature 5', 'Feature 6'], highlighted: true, linkText: 'Get Started' } as CardProps },
          { id: generateId(), type: 'card', props: { title: 'Enterprise', description: 'For large organizations', price: 'Custom', features: ['All Pro features', 'Feature 7', 'Feature 8', 'Priority support'], linkText: 'Contact Us' } as CardProps },
        ],
      };

    case 'faq':
      return {
        id,
        type: 'faq',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Frequently Asked Questions', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'accordion', props: {
            items: [
              { id: generateId(), question: 'What services do you offer?', answer: 'We offer a comprehensive range of services tailored to meet your specific needs.' },
              { id: generateId(), question: 'How can I schedule an appointment?', answer: 'You can schedule an appointment by calling us or using our online booking system.' },
              { id: generateId(), question: 'What are your business hours?', answer: 'We are open Monday through Friday, 9 AM to 5 PM. Weekend hours vary.' },
              { id: generateId(), question: 'Do you offer free consultations?', answer: 'Yes, we offer free initial consultations to discuss your needs and how we can help.' },
            ],
            allowMultiple: false,
          } as AccordionProps },
        ],
      };

    case 'gallery':
      return {
        id,
        type: 'gallery',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Work', variant: 'h2', align: 'center' } as TextProps },
          { id: generateId(), type: 'list', props: {
            items: [
              { id: generateId(), title: 'Project 1', description: '', image: '/placeholder-gallery-1.jpg' },
              { id: generateId(), title: 'Project 2', description: '', image: '/placeholder-gallery-2.jpg' },
              { id: generateId(), title: 'Project 3', description: '', image: '/placeholder-gallery-3.jpg' },
              { id: generateId(), title: 'Project 4', description: '', image: '/placeholder-gallery-4.jpg' },
            ],
            layout: 'grid',
            columns: 4,
          } as ListProps },
        ],
      };

    case 'footer':
      return {
        id,
        type: 'footer',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: `© ${new Date().getFullYear()} ${settings.businessName}. All rights reserved.`, variant: 'small', align: 'center' } as TextProps },
        ],
      };

    default:
      return {
        id,
        type: type,
        variant: 1,
        blocks: [],
      };
  }
}

// Generate default pages for 5-page website
export function createDefaultPages(settings: SiteSettings): Page[] {
  return [
    // Home Page
    {
      title: 'Home',
      slug: 'home',
      sections: [
        createDefaultSection('hero', settings),
        createDefaultSection('features', settings),
        createDefaultSection('services', settings),
        createDefaultSection('testimonials', settings),
        createDefaultSection('cta', settings),
      ],
      meta: {
        title: `${settings.businessName} | ${settings.industry}`,
        description: settings.description || `${settings.businessName} provides quality ${settings.industry.toLowerCase()} services.`,
      },
    },
    // About Page
    {
      title: 'About Us',
      slug: 'about',
      sections: [
        createDefaultSection('about', settings),
        createDefaultSection('timeline', settings),
        createDefaultSection('team', settings),
        createDefaultSection('stats', settings),
      ],
      meta: {
        title: `About Us | ${settings.businessName}`,
        description: `Learn about ${settings.businessName} and our commitment to excellence in ${settings.industry.toLowerCase()}.`,
      },
    },
    // Services Page
    {
      title: 'Services',
      slug: 'services',
      sections: [
        createDefaultSection('services', settings),
        createDefaultSection('gallery', settings),
        createDefaultSection('cta', settings),
      ],
      meta: {
        title: `Our Services | ${settings.businessName}`,
        description: `Discover the ${settings.industry.toLowerCase()} services offered by ${settings.businessName}.`,
      },
    },
    // Contact Page
    {
      title: 'Contact',
      slug: 'contact',
      sections: [
        createDefaultSection('contact', settings),
        createDefaultSection('contactForm', settings),
        createDefaultSection('map', settings),
        createDefaultSection('businessHours', settings),
        createDefaultSection('socialLinks', settings),
      ],
      meta: {
        title: `Contact Us | ${settings.businessName}`,
        description: `Get in touch with ${settings.businessName}. Call ${settings.contactPhone} or email ${settings.contactEmail}.`,
      },
    },
    // FAQ Page
    {
      title: 'FAQ',
      slug: 'faq',
      sections: [
        createDefaultSection('faq', settings),
        createDefaultSection('cta', settings),
      ],
      meta: {
        title: `FAQ | ${settings.businessName}`,
        description: `Frequently asked questions about ${settings.businessName} and our ${settings.industry.toLowerCase()} services.`,
      },
    },
  ];
}

// Create site navigation
export function createDefaultNavigation(settings: SiteSettings): SiteNavigation {
  return {
    logoText: settings.businessName,
    items: [
      { id: generateId(), label: 'Home', href: '/' },
      { id: generateId(), label: 'About', href: '/about' },
      { id: generateId(), label: 'Services', href: '/services' },
      { id: generateId(), label: 'FAQ', href: '/faq' },
      { id: generateId(), label: 'Contact', href: '/contact' },
    ],
    ctaButton: {
      text: settings.primaryCta === 'call' ? 'Call Us' : settings.primaryCta === 'book' ? 'Book Now' : 'Get Quote',
      href: `tel:${settings.contactPhone}`,
      variant: 'primary',
    },
  };
}

// Create site footer
export function createDefaultFooter(settings: SiteSettings): SiteFooter {
  return {
    columns: [
      {
        id: generateId(),
        title: settings.businessName,
        links: [
          { id: generateId(), label: 'About Us', href: '/about' },
          { id: generateId(), label: 'Our Services', href: '/services' },
          { id: generateId(), label: 'Contact', href: '/contact' },
        ],
      },
      {
        id: generateId(),
        title: 'Contact',
        links: [
          { id: generateId(), label: settings.contactEmail, href: `mailto:${settings.contactEmail}` },
          { id: generateId(), label: settings.contactPhone, href: `tel:${settings.contactPhone}` },
        ],
      },
    ],
    copyright: `© ${new Date().getFullYear()} ${settings.businessName}. All rights reserved.`,
    social: settings.socialLinks,
    showBackToTop: true,
  };
}
