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

export type SectionType = 'hero' | 'about' | 'services' | 'testimonials' | 'contact' | 'footer';
export type BlockType = 'text' | 'image' | 'button' | 'list';

export interface TextProps {
  content: string;
  variant: 'h1' | 'h2' | 'h3' | 'body' | 'small';
}

export interface ImageProps {
  src: string;
  alt: string;
}

export interface ButtonProps {
  text: string;
  href: string;
  variant: 'primary' | 'secondary';
}

export interface ListItem {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

export interface ListProps {
  items: ListItem[];
  layout: 'grid' | 'list';
}

export type BlockProps = TextProps | ImageProps | ButtonProps | ListProps;

export interface Block {
  id: string;
  type: BlockType;
  props: BlockProps;
}

export interface Section {
  id: string;
  type: SectionType;
  variant: 1 | 2 | 3;
  blocks: Block[];
}

export interface Page {
  title: string;
  slug: string;
  sections: Section[];
}

export interface SiteContent {
  pages: Page[];
  settings: SiteSettings;
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
  'Other',
];

export const PRIMARY_CTA_OPTIONS: { value: PrimaryCta; label: string }[] = [
  { value: 'call', label: 'Call Us' },
  { value: 'book', label: 'Book Appointment' },
  { value: 'quote', label: 'Get a Quote' },
];

export const SECTION_LIBRARY: { type: SectionType; name: string; description: string }[] = [
  { type: 'hero', name: 'Hero', description: 'Main banner with headline' },
  { type: 'about', name: 'About', description: 'About your business' },
  { type: 'services', name: 'Services', description: 'List your services' },
  { type: 'testimonials', name: 'Testimonials', description: 'Customer reviews' },
  { type: 'contact', name: 'Contact', description: 'Contact information' },
  { type: 'footer', name: 'Footer', description: 'Footer with links' },
];

export const DEFAULT_ACCENT_COLORS = [
  '#2563EB', // Blue
  '#DC2626', // Red
  '#16A34A', // Green
  '#9333EA', // Purple
  '#EA580C', // Orange
  '#0891B2', // Cyan
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
    case 'hero':
      return {
        id,
        type: 'hero',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: `Welcome to ${settings.businessName}`, variant: 'h1' } as TextProps },
          { id: generateId(), type: 'text', props: { content: 'Your trusted partner for all your needs', variant: 'body' } as TextProps },
          { id: generateId(), type: 'button', props: { text: settings.primaryCta === 'call' ? 'Call Us Today' : settings.primaryCta === 'book' ? 'Book Now' : 'Get a Quote', href: '#contact', variant: 'primary' } as ButtonProps },
          { id: generateId(), type: 'image', props: { src: '/placeholder-hero.jpg', alt: 'Hero image' } as ImageProps },
        ],
      };
    case 'about':
      return {
        id,
        type: 'about',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'About Us', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'text', props: { content: `${settings.businessName} has been serving the ${settings.industry} industry with dedication and excellence.`, variant: 'body' } as TextProps },
          { id: generateId(), type: 'image', props: { src: '/placeholder-about.jpg', alt: 'About us' } as ImageProps },
        ],
      };
    case 'services':
      return {
        id,
        type: 'services',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Services', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'list', props: { items: [
            { id: generateId(), title: 'Service 1', description: 'Description of service 1' },
            { id: generateId(), title: 'Service 2', description: 'Description of service 2' },
            { id: generateId(), title: 'Service 3', description: 'Description of service 3' },
          ], layout: 'grid' } as ListProps },
        ],
      };
    case 'testimonials':
      return {
        id,
        type: 'testimonials',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'What Our Clients Say', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'list', props: { items: [
            { id: generateId(), title: 'John D.', description: 'Excellent service! Highly recommended.' },
            { id: generateId(), title: 'Sarah M.', description: 'Professional and reliable. Will use again.' },
          ], layout: 'list' } as ListProps },
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
          { id: generateId(), type: 'button', props: { text: settings.primaryCta === 'call' ? 'Call Now' : settings.primaryCta === 'book' ? 'Book Appointment' : 'Request Quote', href: `tel:${settings.contactPhone}`, variant: 'primary' } as ButtonProps },
        ],
      };
    case 'footer':
      return {
        id,
        type: 'footer',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: `© ${new Date().getFullYear()} ${settings.businessName}. All rights reserved.`, variant: 'small' } as TextProps },
        ],
      };
  }
}
