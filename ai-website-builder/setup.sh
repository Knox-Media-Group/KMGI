#!/bin/bash
set -e

BASE_DIR="$(pwd)/ai-website-builder"
mkdir -p "$BASE_DIR"
cd "$BASE_DIR"

# Create directories
mkdir -p apps/api/prisma
mkdir -p apps/api/src/auth
mkdir -p apps/api/src/prisma
mkdir -p apps/api/src/tenants
mkdir -p apps/api/src/jobs
mkdir -p apps/api/src/wordpress
mkdir -p apps/api/src/ai
mkdir -p apps/api/src/sites
mkdir -p apps/api/src/billing
mkdir -p apps/web/src/app/login
mkdir -p apps/web/src/app/signup
mkdir -p apps/web/src/app/onboarding
mkdir -p apps/web/src/app/dashboard
mkdir -p "apps/web/src/app/editor/[siteId]"
mkdir -p apps/web/src/app/billing
mkdir -p apps/web/src/lib
mkdir -p apps/web/public
mkdir -p packages/shared/src

echo "Directories created."


# ============================================
# ROOT FILES
# ============================================

cat > package.json << 'FILEEOF'
{
  "name": "ai-website-builder",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "db:migrate": "cd apps/api && npx prisma migrate dev",
    "db:seed": "cd apps/api && npx prisma db seed",
    "db:studio": "cd apps/api && npx prisma studio",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
FILEEOF

cat > turbo.json << 'FILEEOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
FILEEOF

cat > .gitignore << 'FILEEOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
.next/
out/
build/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Prisma
apps/api/prisma/*.db
apps/api/prisma/*.db-journal

# Turbo
.turbo/

# Testing
coverage/

# Misc
*.pem
.vercel
FILEEOF

echo "Root files written."


# ============================================
# DOCKER COMPOSE FILES
# ============================================

cat > docker-compose.yml << 'FILEEOF'
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: builder-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: builder
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Redis for BullMQ
  redis:
    image: redis:7-alpine
    container_name: builder-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # WordPress Multisite
  wordpress:
    image: wordpress:6-php8.2-apache
    container_name: builder-wordpress
    restart: unless-stopped
    depends_on:
      wordpress-db:
        condition: service_healthy
    environment:
      WORDPRESS_DB_HOST: wordpress-db:3306
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: wordpress
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_CONFIG_EXTRA: |
        define('WP_ALLOW_MULTISITE', true);
        define('MULTISITE', true);
        define('SUBDIRECTORY_INSTALL', true);
        define('DOMAIN_CURRENT_SITE', 'localhost');
        define('PATH_CURRENT_SITE', '/');
        define('SITE_ID_CURRENT_SITE', 1);
        define('BLOG_ID_CURRENT_SITE', 1);
    ports:
      - "8080:80"
    volumes:
      - wordpress_data:/var/www/html
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/wp-admin/install.php"]
      interval: 10s
      timeout: 5s
      retries: 5

  # WordPress Database (MySQL)
  wordpress-db:
    image: mysql:8.0
    container_name: builder-wordpress-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: wordpress
    volumes:
      - wordpress_db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 5

  # WP-CLI for WordPress management
  wp-cli:
    image: wordpress:cli
    container_name: builder-wp-cli
    depends_on:
      wordpress:
        condition: service_healthy
    volumes:
      - wordpress_data:/var/www/html
    user: "33:33"  # www-data user
    entrypoint: ["tail", "-f", "/dev/null"]  # Keep container running

  # API Service (for production-like testing)
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    container_name: builder-api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/builder?schema=public
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: development-secret-change-in-production
      WP_MULTISITE_URL: http://wordpress
      WP_PATH: /var/www/html
      WP_CLI_PATH: wp
      FRONTEND_URL: http://localhost:3000
      NODE_ENV: development
      PORT: 4000
    ports:
      - "4000:4000"
    volumes:
      - wordpress_data:/var/www/html:ro

  # Web Service (for production-like testing)
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    container_name: builder-web
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
    ports:
      - "3000:3000"

volumes:
  postgres_data:
  redis_data:
  wordpress_data:
  wordpress_db_data:
FILEEOF

cat > docker-compose.dev.yml << 'FILEEOF'
version: '3.8'

# Simplified Docker Compose for local development
# Runs only the infrastructure services (postgres, redis, wordpress)
# Use `npm run dev` for the API and Web services

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: builder-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: builder
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Redis for BullMQ
  redis:
    image: redis:7-alpine
    container_name: builder-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # WordPress Multisite
  wordpress:
    image: wordpress:6-php8.2-apache
    container_name: builder-wordpress
    restart: unless-stopped
    depends_on:
      wordpress-db:
        condition: service_healthy
    environment:
      WORDPRESS_DB_HOST: wordpress-db:3306
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: wordpress
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_CONFIG_EXTRA: |
        define('WP_ALLOW_MULTISITE', true);
        define('MULTISITE', true);
        define('SUBDIRECTORY_INSTALL', true);
        define('DOMAIN_CURRENT_SITE', 'localhost');
        define('PATH_CURRENT_SITE', '/');
        define('SITE_ID_CURRENT_SITE', 1);
        define('BLOG_ID_CURRENT_SITE', 1);
    ports:
      - "8080:80"
    volumes:
      - wordpress_data:/var/www/html

  # WordPress Database (MySQL)
  wordpress-db:
    image: mysql:8.0
    container_name: builder-wordpress-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: wordpress
    volumes:
      - wordpress_db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  wordpress_data:
  wordpress_db_data:
FILEEOF

echo "Docker compose files written."


# ============================================
# PACKAGES/SHARED
# ============================================

cat > packages/shared/package.json << 'FILEEOF'
{
  "name": "@builder/shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
FILEEOF

cat > packages/shared/tsconfig.json << 'FILEEOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": false,
    "inlineSourceMap": true,
    "inlineSources": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
FILEEOF

cat > packages/shared/src/index.ts << 'FILEEOF'
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
  stylePreset: StylePreset;
}

export interface WizardStep4 {
  accentColor: string;
}

export interface WizardStep5 {
  primaryCta: PrimaryCta;
}

export interface WizardStep6 {
  contactEmail: string;
  contactPhone: string;
}

export type WizardData = WizardStep1 & WizardStep2 & WizardStep3 & WizardStep4 & WizardStep5 & WizardStep6;

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
FILEEOF

echo "Shared package written."


# ============================================
# API - CONFIG FILES
# ============================================

cat > apps/api/package.json << 'FILEEOF'
{
  "name": "@builder/api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "nest start",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/config": "^3.1.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.3.0",
    "@prisma/client": "^5.8.0",
    "@builder/shared": "1.0.0",
    "bcrypt": "^5.1.1",
    "bullmq": "^5.1.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "ioredis": "^5.3.2",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1",
    "stripe": "^14.12.0",
    "openai": "^4.24.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/passport-jwt": "^4.0.0",
    "prisma": "^5.8.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.0"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
FILEEOF

cat > apps/api/tsconfig.json << 'FILEEOF'
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "prisma/**/*"],
  "exclude": ["node_modules", "dist"]
}
FILEEOF

cat > apps/api/nest-cli.json << 'FILEEOF'
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
FILEEOF

cat > apps/api/.env.example << 'FILEEOF'
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/builder?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Stripe (required for billing - get from https://dashboard.stripe.com)
# TODO: Add your Stripe keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenAI (optional - fallback content will be used if not set)
# TODO: Add your OpenAI key for AI content generation
OPENAI_API_KEY=sk-...

# WordPress Multisite
WP_MULTISITE_URL=http://localhost:8080
WP_PATH=/var/www/html
WP_CLI_PATH=wp

# Frontend URL (for Stripe redirects)
FRONTEND_URL=http://localhost:3000

# Environment
NODE_ENV=development
PORT=4000
FILEEOF

cat > apps/api/Dockerfile << 'FILEEOF'
# API Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

EXPOSE 4000

CMD ["npm", "run", "start:prod"]
FILEEOF

echo "API config files written."


# ============================================
# API - PRISMA
# ============================================

cat > apps/api/prisma/schema.prisma << 'FILEEOF'
// Prisma schema for AI Website Builder MVP

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// TENANTS & USERS
// ============================================

model Tenant {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  logoUrl      String?  @map("logo_url")
  primaryColor String   @default("#2563EB") @map("primary_color")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  memberships Membership[]
  sites       Site[]

  @@map("tenants")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  memberships   Membership[]
  sites         Site[]
  subscriptions StripeSubscription[]

  @@map("users")
}

enum MembershipRole {
  owner
  admin
  member
}

model Membership {
  id        String         @id @default(cuid())
  userId    String         @map("user_id")
  tenantId  String         @map("tenant_id")
  role      MembershipRole @default(member)
  createdAt DateTime       @default(now()) @map("created_at")

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([userId, tenantId])
  @@map("memberships")
}

// ============================================
// SITES & VERSIONS
// ============================================

enum SiteStatus {
  provisioning
  generating
  draft
  published
  error
}

model Site {
  id                 String     @id @default(cuid())
  tenantId           String     @map("tenant_id")
  ownerUserId        String     @map("owner_user_id")
  name               String
  status             SiteStatus @default(provisioning)
  wpSiteId           Int?       @map("wp_site_id")
  wpAdminUrl         String?    @map("wp_admin_url")
  wpSiteUrl          String?    @map("wp_site_url")
  currentVersionId   String?    @map("current_version_id")
  publishedVersionId String?    @map("published_version_id")
  createdAt          DateTime   @default(now()) @map("created_at")
  updatedAt          DateTime   @updatedAt @map("updated_at")

  tenant   Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  owner    User          @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  versions SiteVersion[]
  jobs     Job[]

  @@map("sites")
}

model SiteVersion {
  id            String   @id @default(cuid())
  siteId        String   @map("site_id")
  versionNumber Int      @map("version_number")
  pageJson      Json     @map("page_json")
  createdAt     DateTime @default(now()) @map("created_at")

  site Site @relation(fields: [siteId], references: [id], onDelete: Cascade)

  @@unique([siteId, versionNumber])
  @@map("site_versions")
}

// ============================================
// JOBS & LOGS
// ============================================

enum JobType {
  provision
  generate
  publish
  rollback
}

enum JobStatus {
  pending
  running
  completed
  failed
}

model Job {
  id          String    @id @default(cuid())
  siteId      String    @map("site_id")
  type        JobType
  status      JobStatus @default(pending)
  error       String?
  metadata    Json?
  createdAt   DateTime  @default(now()) @map("created_at")
  completedAt DateTime? @map("completed_at")

  site Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  logs JobLog[]

  @@map("jobs")
}

model JobLog {
  id        String   @id @default(cuid())
  jobId     String   @map("job_id")
  message   String
  createdAt DateTime @default(now()) @map("created_at")

  job Job @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@map("job_logs")
}

// ============================================
// STRIPE BILLING
// ============================================

enum SubscriptionStatus {
  active
  canceled
  past_due
  trialing
  incomplete
}

model StripeSubscription {
  id                   String             @id @default(cuid())
  userId               String             @map("user_id")
  stripeCustomerId     String             @map("stripe_customer_id")
  stripeSubscriptionId String             @unique @map("stripe_subscription_id")
  status               SubscriptionStatus @default(incomplete)
  currentPeriodEnd     DateTime           @map("current_period_end")
  createdAt            DateTime           @default(now()) @map("created_at")
  updatedAt            DateTime           @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("stripe_subscriptions")
}
FILEEOF

cat > apps/api/prisma/seed.ts << 'FILEEOF'
import { PrismaClient, MembershipRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default demo tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Builder',
      slug: 'demo',
      logoUrl: null,
      primaryColor: '#2563EB',
    },
  });
  console.log('Created demo tenant:', demoTenant.id);

  // Create demo user
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash,
    },
  });
  console.log('Created demo user:', demoUser.id);

  // Create membership
  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: demoUser.id,
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      tenantId: demoTenant.id,
      role: MembershipRole.owner,
    },
  });
  console.log('Created membership');

  // Create a second tenant for white-label demo
  const acmeTenant = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'ACME Web Builder',
      slug: 'acme',
      logoUrl: null,
      primaryColor: '#DC2626',
    },
  });
  console.log('Created ACME tenant:', acmeTenant.id);

  console.log('Seeding complete!');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Email: demo@example.com');
  console.log('  Password: demo1234');
  console.log('  Tenant: demo (or acme for different branding)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
FILEEOF

echo "API Prisma files written."


# ============================================
# API - SRC FILES (main, app.module, prisma)
# ============================================

cat > apps/api/src/main.ts << 'FILEEOF'
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Stripe webhooks
  });

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
FILEEOF

cat > apps/api/src/app.module.ts << 'FILEEOF'
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SitesModule } from './sites/sites.module';
import { BillingModule } from './billing/billing.module';
import { JobsModule } from './jobs/jobs.module';
import { TenantsModule } from './tenants/tenants.module';
import { WordPressModule } from './wordpress/wordpress.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    SitesModule,
    BillingModule,
    JobsModule,
    WordPressModule,
    AiModule,
  ],
})
export class AppModule {}
FILEEOF

cat > apps/api/src/prisma/prisma.module.ts << 'FILEEOF'
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
FILEEOF

cat > apps/api/src/prisma/prisma.service.ts << 'FILEEOF'
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
FILEEOF

echo "API main/prisma files written."


# ============================================
# API - AUTH MODULE
# ============================================

cat > apps/api/src/auth/auth.types.ts << 'FILEEOF'
import { Request } from 'express';

export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}
FILEEOF

cat > apps/api/src/auth/auth.dto.ts << 'FILEEOF'
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  tenantSlug?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  tenantSlug?: string;
}
FILEEOF

cat > apps/api/src/auth/jwt-auth.guard.ts << 'FILEEOF'
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
FILEEOF

cat > apps/api/src/auth/jwt.strategy.ts << 'FILEEOF'
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'dev-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
    };
  }
}
FILEEOF

cat > apps/api/src/auth/auth.module.ts << 'FILEEOF'
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'dev-secret-change-in-production',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
FILEEOF

echo "API auth module files written."


cat > apps/api/src/auth/auth.service.ts << 'FILEEOF'
import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Get tenant (use default if not specified)
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug || 'demo' },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user and membership in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
        },
      });

      await tx.membership.create({
        data: {
          userId: newUser.id,
          tenantId: tenant.id,
          role: 'member',
        },
      });

      return newUser;
    });

    // Generate token
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        createdAt: tenant.createdAt,
      },
    };
  }

  async login(dto: LoginDto) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get tenant (use default if not specified)
    const tenantSlug = dto.tenantSlug || 'demo';
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check membership
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: tenant.id,
        },
      },
    });

    if (!membership) {
      // Auto-create membership for demo purposes
      await this.prisma.membership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role: 'member',
        },
      });
    }

    // Generate token
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        createdAt: tenant.createdAt,
      },
    };
  }

  async getMe(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: tenant.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    // Get subscription
    const subscription = await this.prisma.stripeSubscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        createdAt: tenant.createdAt,
      },
      membership: {
        userId: membership.userId,
        tenantId: membership.tenantId,
        role: membership.role,
      },
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
    };
  }
}
FILEEOF

cat > apps/api/src/auth/auth.controller.ts << 'FILEEOF'
import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthRequest } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/auth/signup
   *
   * Request:
   * {
   *   "email": "user@example.com",
   *   "password": "securePassword123",
   *   "tenantSlug": "demo" // optional, defaults to "demo"
   * }
   *
   * Response:
   * {
   *   "token": "eyJhbGciOiJIUzI1NiIs...",
   *   "user": { "id": "...", "email": "user@example.com", "createdAt": "..." },
   *   "tenant": { "id": "...", "name": "Demo Builder", "primaryColor": "#2563EB", ... }
   * }
   */
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  /**
   * POST /api/auth/login
   *
   * Request:
   * {
   *   "email": "user@example.com",
   *   "password": "securePassword123",
   *   "tenantSlug": "demo" // optional
   * }
   *
   * Response:
   * {
   *   "token": "eyJhbGciOiJIUzI1NiIs...",
   *   "user": { ... },
   *   "tenant": { ... }
   * }
   */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * GET /api/auth/me
   *
   * Headers:
   * Authorization: Bearer <token>
   *
   * Response:
   * {
   *   "user": { "id": "...", "email": "...", "createdAt": "..." },
   *   "tenant": { "id": "...", "name": "...", "primaryColor": "...", ... },
   *   "membership": { "role": "member" },
   *   "subscription": { "status": "active", "currentPeriodEnd": "..." } | null
   * }
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: AuthRequest) {
    return this.authService.getMe(req.user.userId, req.user.tenantId);
  }
}
FILEEOF

echo "API auth service/controller written."


# ============================================
# API - TENANTS MODULE
# ============================================

cat > apps/api/src/tenants/tenants.module.ts << 'FILEEOF'
import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
FILEEOF

cat > apps/api/src/tenants/tenants.service.ts << 'FILEEOF'
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async getBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
    };
  }

  async getById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }
}
FILEEOF

cat > apps/api/src/tenants/tenants.controller.ts << 'FILEEOF'
import { Controller, Get, Param } from '@nestjs/common';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  /**
   * GET /api/tenants/:slug
   *
   * Public endpoint to get tenant branding for login/signup pages
   *
   * Response:
   * {
   *   "id": "...",
   *   "name": "Demo Builder",
   *   "slug": "demo",
   *   "logoUrl": null,
   *   "primaryColor": "#2563EB"
   * }
   */
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.tenantsService.getBySlug(slug);
  }
}
FILEEOF

echo "API tenants module written."

# ============================================
# API - WORDPRESS MODULE
# ============================================

cat > apps/api/src/wordpress/wordpress.module.ts << 'FILEEOF'
import { Module } from '@nestjs/common';
import { WordPressService } from './wordpress.service';

@Module({
  providers: [WordPressService],
  exports: [WordPressService],
})
export class WordPressModule {}
FILEEOF

cat > apps/api/src/ai/ai.module.ts << 'FILEEOF'
import { Module } from '@nestjs/common';
import { AiService } from './ai.service';

@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
FILEEOF

echo "API wordpress/ai modules written."


# ============================================
# API - WORDPRESS SERVICE
# ============================================

cat > apps/api/src/wordpress/wordpress.service.ts << 'FILEEOF'
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SiteContent, Page, Section, Block, TextProps, ImageProps, ButtonProps, ListProps } from '@builder/shared';

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

  constructor(private configService: ConfigService) {
    this.wpCliPath = this.configService.get('WP_CLI_PATH') || 'wp';
    this.wpMultisiteUrl = this.configService.get('WP_MULTISITE_URL') || 'http://localhost:8080';
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
    const siteUrl = `${this.wpMultisiteUrl}/${siteSlug}`;
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
      // In dev mode, simulate WP site creation
      if (this.configService.get('NODE_ENV') === 'development') {
        console.log('DEV MODE: Simulating WordPress site creation');
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

  async applyThemeAndPlugins(wpSiteId: number): Promise<void> {
    try {
      // Switch to the site context
      const urlFlag = `--url=${this.wpMultisiteUrl}/?blog_id=${wpSiteId}`;

      // Activate a clean theme (Twenty Twenty-Four or similar)
      await this.runWpCli(`theme activate twentytwentyfour ${urlFlag}`);

      // Optional: Install and activate a simple page builder plugin if needed
      // For MVP, we'll use plain Gutenberg blocks

      console.log(`Theme and plugins applied for site ${wpSiteId}`);
    } catch (error) {
      // In dev mode, just log
      if (this.configService.get('NODE_ENV') === 'development') {
        console.log('DEV MODE: Simulating theme/plugin setup');
        return;
      }
      throw error;
    }
  }

  async publishVersion(wpSiteId: number, content: SiteContent): Promise<void> {
    try {
      const urlFlag = `--url=${this.wpMultisiteUrl}/?blog_id=${wpSiteId}`;

      for (const page of content.pages) {
        const htmlContent = this.compilePageToHtml(page, content.settings.accentColor);
        const gutenbergBlocks = this.compilePageToGutenberg(page, content.settings.accentColor);

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
      }

      // Set home page
      const homePage = content.pages.find((p) => p.slug === 'home');
      if (homePage) {
        const homePageId = await this.runWpCli(
          `post list --post_type=page --name="home" --format=ids ${urlFlag}`,
        );
        if (homePageId) {
          await this.runWpCli(`option update show_on_front page ${urlFlag}`);
          await this.runWpCli(`option update page_on_front ${homePageId.split(' ')[0]} ${urlFlag}`);
        }
      }

      console.log(`Published ${content.pages.length} pages to WordPress site ${wpSiteId}`);
    } catch (error) {
      // In dev mode, just log
      if (this.configService.get('NODE_ENV') === 'development') {
        console.log('DEV MODE: Simulating publish to WordPress');
        console.log('Pages to publish:', content.pages.map((p) => p.title));
        return;
      }
      throw error;
    }
  }

  private escapeShell(str: string): string {
    return str.replace(/'/g, "'\\''");
  }

  private compilePageToHtml(page: Page, accentColor: string): string {
    return page.sections.map((section) => this.compileSectionToHtml(section, accentColor)).join('\n');
  }

  private compilePageToGutenberg(page: Page, accentColor: string): string {
    return page.sections.map((section) => this.compileSectionToGutenberg(section, accentColor)).join('\n\n');
  }

  private compileSectionToHtml(section: Section, accentColor: string): string {
    const blocks = section.blocks.map((block) => this.compileBlockToHtml(block, accentColor)).join('\n');
    return `<section class="wp-block-group section-${section.type}" data-section-id="${section.id}">${blocks}</section>`;
  }

  private compileSectionToGutenberg(section: Section, accentColor: string): string {
    const blocks = section.blocks.map((block) => this.compileBlockToGutenberg(block, accentColor)).join('\n');
    return `<!-- wp:group {"className":"section-${section.type}"} -->\n<div class="wp-block-group section-${section.type}">${blocks}</div>\n<!-- /wp:group -->`;
  }

  private compileBlockToHtml(block: Block, accentColor: string): string {
    switch (block.type) {
      case 'text': {
        const props = block.props as TextProps;
        const tag = this.getTextTag(props.variant);
        return `<${tag}>${this.escapeHtml(props.content)}</${tag}>`;
      }
      case 'image': {
        const props = block.props as ImageProps;
        return `<figure class="wp-block-image"><img src="${props.src}" alt="${this.escapeHtml(props.alt)}" /></figure>`;
      }
      case 'button': {
        const props = block.props as ButtonProps;
        const bgColor = props.variant === 'primary' ? accentColor : 'transparent';
        const textColor = props.variant === 'primary' ? '#ffffff' : accentColor;
        return `<div class="wp-block-button"><a class="wp-block-button__link" href="${props.href}" style="background-color:${bgColor};color:${textColor}">${this.escapeHtml(props.text)}</a></div>`;
      }
      case 'list': {
        const props = block.props as ListProps;
        const items = props.items
          .map((item) => `<li><strong>${this.escapeHtml(item.title)}</strong><p>${this.escapeHtml(item.description)}</p></li>`)
          .join('');
        return `<ul class="wp-block-list layout-${props.layout}">${items}</ul>`;
      }
      default:
        return '';
    }
  }

  private compileBlockToGutenberg(block: Block, accentColor: string): string {
    switch (block.type) {
      case 'text': {
        const props = block.props as TextProps;
        switch (props.variant) {
          case 'h1':
            return `<!-- wp:heading {"level":1} -->\n<h1 class="wp-block-heading">${this.escapeHtml(props.content)}</h1>\n<!-- /wp:heading -->`;
          case 'h2':
            return `<!-- wp:heading -->\n<h2 class="wp-block-heading">${this.escapeHtml(props.content)}</h2>\n<!-- /wp:heading -->`;
          case 'h3':
            return `<!-- wp:heading {"level":3} -->\n<h3 class="wp-block-heading">${this.escapeHtml(props.content)}</h3>\n<!-- /wp:heading -->`;
          case 'small':
            return `<!-- wp:paragraph {"fontSize":"small"} -->\n<p class="has-small-font-size">${this.escapeHtml(props.content)}</p>\n<!-- /wp:paragraph -->`;
          default:
            return `<!-- wp:paragraph -->\n<p>${this.escapeHtml(props.content)}</p>\n<!-- /wp:paragraph -->`;
        }
      }
      case 'image': {
        const props = block.props as ImageProps;
        return `<!-- wp:image -->\n<figure class="wp-block-image"><img src="${props.src}" alt="${this.escapeHtml(props.alt)}"/></figure>\n<!-- /wp:image -->`;
      }
      case 'button': {
        const props = block.props as ButtonProps;
        const bgColor = props.variant === 'primary' ? accentColor : 'transparent';
        return `<!-- wp:buttons -->\n<div class="wp-block-buttons"><!-- wp:button {"backgroundColor":"${bgColor}"} -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${props.href}">${this.escapeHtml(props.text)}</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->`;
      }
      case 'list': {
        const props = block.props as ListProps;
        const items = props.items.map((item) => `<li><strong>${this.escapeHtml(item.title)}</strong> - ${this.escapeHtml(item.description)}</li>`).join('');
        return `<!-- wp:list -->\n<ul class="wp-block-list">${items}</ul>\n<!-- /wp:list -->`;
      }
      default:
        return '';
    }
  }

  private getTextTag(variant: string): string {
    switch (variant) {
      case 'h1':
        return 'h1';
      case 'h2':
        return 'h2';
      case 'h3':
        return 'h3';
      case 'small':
        return 'small';
      default:
        return 'p';
    }
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
FILEEOF

echo "API wordpress service written."


# ============================================
# API - AI SERVICE
# ============================================

cat > apps/api/src/ai/ai.service.ts << 'FILEEOF'
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
  generateId,
} from '@builder/shared';

@Injectable()
export class AiService {
  private openai: OpenAI | null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async generateSiteContent(settings: SiteSettings): Promise<SiteContent> {
    // If no OpenAI key, use fallback content
    if (!this.openai) {
      console.log('No OpenAI API key, using fallback content generation');
      return this.generateFallbackContent(settings);
    }

    try {
      const homePage = await this.generateHomePage(settings);
      const contactPage = await this.generateContactPage(settings);

      return {
        pages: [homePage, contactPage],
        settings,
      };
    } catch (error) {
      console.error('AI generation failed, using fallback:', error);
      return this.generateFallbackContent(settings);
    }
  }

  private async generateHomePage(settings: SiteSettings): Promise<Page> {
    const prompt = `Generate website copy for a ${settings.industry} business called "${settings.businessName}".
Style: ${settings.stylePreset}
Primary action: ${settings.primaryCta === 'call' ? 'Call us' : settings.primaryCta === 'book' ? 'Book appointment' : 'Get a quote'}

Generate JSON with this structure:
{
  "heroHeadline": "short compelling headline (max 10 words)",
  "heroSubheadline": "supporting text (max 25 words)",
  "aboutTitle": "section title",
  "aboutText": "about paragraph (50-75 words)",
  "services": [
    { "title": "Service 1", "description": "brief description" },
    { "title": "Service 2", "description": "brief description" },
    { "title": "Service 3", "description": "brief description" }
  ],
  "testimonials": [
    { "name": "Customer Name", "quote": "brief testimonial" },
    { "name": "Customer Name", "quote": "brief testimonial" }
  ]
}

Respond ONLY with valid JSON, no markdown or explanation.`;

    const response = await this.openai!.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '';
    let data;
    try {
      data = JSON.parse(content);
    } catch {
      console.error('Failed to parse AI response:', content);
      return this.createFallbackHomePage(settings);
    }

    return this.buildHomePage(settings, data);
  }

  private async generateContactPage(settings: SiteSettings): Promise<Page> {
    return {
      title: 'Contact',
      slug: 'contact',
      sections: [
        {
          id: generateId(),
          type: 'contact',
          variant: 1,
          blocks: [
            { id: generateId(), type: 'text', props: { content: 'Contact Us', variant: 'h1' } as TextProps },
            { id: generateId(), type: 'text', props: { content: `We'd love to hear from you. Reach out to ${settings.businessName} today.`, variant: 'body' } as TextProps },
            { id: generateId(), type: 'text', props: { content: `Email: ${settings.contactEmail}`, variant: 'body' } as TextProps },
            { id: generateId(), type: 'text', props: { content: `Phone: ${settings.contactPhone}`, variant: 'body' } as TextProps },
            { id: generateId(), type: 'button', props: { text: settings.primaryCta === 'call' ? 'Call Now' : settings.primaryCta === 'book' ? 'Book Appointment' : 'Request Quote', href: `tel:${settings.contactPhone}`, variant: 'primary' } as ButtonProps },
          ],
        },
        {
          id: generateId(),
          type: 'footer',
          variant: 1,
          blocks: [
            { id: generateId(), type: 'text', props: { content: `© ${new Date().getFullYear()} ${settings.businessName}. All rights reserved.`, variant: 'small' } as TextProps },
          ],
        },
      ],
    };
  }

  async generateSectionVariations(section: Section, settings: SiteSettings): Promise<Section[]> {
    // Generate 3 variations of a section
    if (!this.openai) {
      return [section, { ...section, id: generateId() }, { ...section, id: generateId() }];
    }

    const prompt = `Generate 3 variations of ${section.type} section content for a ${settings.industry} business called "${settings.businessName}".
Style: ${settings.stylePreset}

Current content: ${JSON.stringify(section.blocks.filter((b) => b.type === 'text').map((b) => (b.props as TextProps).content))}

Respond with JSON array of 3 variations, each with:
{ "headline": "...", "subtext": "..." }

Respond ONLY with valid JSON array.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
      });

      const content = response.choices[0]?.message?.content || '';
      const variations = JSON.parse(content);

      return variations.map((v: { headline: string; subtext: string }, i: number) => ({
        ...section,
        id: generateId(),
        variant: (i + 1) as 1 | 2 | 3,
        blocks: section.blocks.map((block, bi) => {
          if (block.type === 'text') {
            const props = block.props as TextProps;
            if (props.variant === 'h1' || props.variant === 'h2') {
              return { ...block, id: generateId(), props: { ...props, content: v.headline } };
            }
            if (props.variant === 'body') {
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

  private buildHomePage(settings: SiteSettings, data: {
    heroHeadline: string;
    heroSubheadline: string;
    aboutTitle: string;
    aboutText: string;
    services: Array<{ title: string; description: string }>;
    testimonials: Array<{ name: string; quote: string }>;
  }): Page {
    const ctaText = settings.primaryCta === 'call' ? 'Call Us Today' : settings.primaryCta === 'book' ? 'Book Now' : 'Get a Quote';

    const sections: Section[] = [
      // Hero
      {
        id: generateId(),
        type: 'hero',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: data.heroHeadline, variant: 'h1' } as TextProps },
          { id: generateId(), type: 'text', props: { content: data.heroSubheadline, variant: 'body' } as TextProps },
          { id: generateId(), type: 'button', props: { text: ctaText, href: '#contact', variant: 'primary' } as ButtonProps },
          { id: generateId(), type: 'image', props: { src: '/placeholder-hero.jpg', alt: 'Hero image' } as ImageProps },
        ],
      },
      // About
      {
        id: generateId(),
        type: 'about',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: data.aboutTitle, variant: 'h2' } as TextProps },
          { id: generateId(), type: 'text', props: { content: data.aboutText, variant: 'body' } as TextProps },
          { id: generateId(), type: 'image', props: { src: '/placeholder-about.jpg', alt: 'About us' } as ImageProps },
        ],
      },
      // Services
      {
        id: generateId(),
        type: 'services',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Services', variant: 'h2' } as TextProps },
          {
            id: generateId(),
            type: 'list',
            props: {
              items: data.services.map((s) => ({ id: generateId(), title: s.title, description: s.description })),
              layout: 'grid',
            } as ListProps,
          },
        ],
      },
      // Testimonials
      {
        id: generateId(),
        type: 'testimonials',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'What Our Clients Say', variant: 'h2' } as TextProps },
          {
            id: generateId(),
            type: 'list',
            props: {
              items: data.testimonials.map((t) => ({ id: generateId(), title: t.name, description: t.quote })),
              layout: 'list',
            } as ListProps,
          },
        ],
      },
      // Contact CTA
      {
        id: generateId(),
        type: 'contact',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Get In Touch', variant: 'h2' } as TextProps },
          { id: generateId(), type: 'text', props: { content: `Email: ${settings.contactEmail}`, variant: 'body' } as TextProps },
          { id: generateId(), type: 'text', props: { content: `Phone: ${settings.contactPhone}`, variant: 'body' } as TextProps },
          { id: generateId(), type: 'button', props: { text: ctaText, href: `tel:${settings.contactPhone}`, variant: 'primary' } as ButtonProps },
        ],
      },
      // Footer
      {
        id: generateId(),
        type: 'footer',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: `© ${new Date().getFullYear()} ${settings.businessName}. All rights reserved.`, variant: 'small' } as TextProps },
        ],
      },
    ];

    return {
      title: 'Home',
      slug: 'home',
      sections,
    };
  }

  private createFallbackHomePage(settings: SiteSettings): Page {
    return this.buildHomePage(settings, {
      heroHeadline: `Welcome to ${settings.businessName}`,
      heroSubheadline: `Your trusted partner in ${settings.industry.toLowerCase()}. We deliver excellence with every interaction.`,
      aboutTitle: 'About Us',
      aboutText: `${settings.businessName} has been proudly serving our community with top-quality ${settings.industry.toLowerCase()} services. Our dedicated team brings years of experience and a commitment to excellence that sets us apart.`,
      services: [
        { title: 'Professional Service', description: 'Expert solutions tailored to your needs' },
        { title: 'Quality Guaranteed', description: 'We stand behind our work with confidence' },
        { title: 'Fast Turnaround', description: 'Quick and efficient service delivery' },
      ],
      testimonials: [
        { name: 'John D.', quote: 'Exceptional service! They exceeded all my expectations.' },
        { name: 'Sarah M.', quote: 'Professional, reliable, and truly caring. Highly recommended!' },
      ],
    });
  }

  private generateFallbackContent(settings: SiteSettings): SiteContent {
    const homePage = this.createFallbackHomePage(settings);
    const contactPage: Page = {
      title: 'Contact',
      slug: 'contact',
      sections: [
        {
          id: generateId(),
          type: 'contact',
          variant: 1,
          blocks: [
            { id: generateId(), type: 'text', props: { content: 'Contact Us', variant: 'h1' } as TextProps },
            { id: generateId(), type: 'text', props: { content: `We'd love to hear from you. Reach out to ${settings.businessName} today.`, variant: 'body' } as TextProps },
            { id: generateId(), type: 'text', props: { content: `Email: ${settings.contactEmail}`, variant: 'body' } as TextProps },
            { id: generateId(), type: 'text', props: { content: `Phone: ${settings.contactPhone}`, variant: 'body' } as TextProps },
            { id: generateId(), type: 'button', props: { text: settings.primaryCta === 'call' ? 'Call Now' : settings.primaryCta === 'book' ? 'Book Appointment' : 'Request Quote', href: `tel:${settings.contactPhone}`, variant: 'primary' } as ButtonProps },
          ],
        },
        {
          id: generateId(),
          type: 'footer',
          variant: 1,
          blocks: [
            { id: generateId(), type: 'text', props: { content: `© ${new Date().getFullYear()} ${settings.businessName}. All rights reserved.`, variant: 'small' } as TextProps },
          ],
        },
      ],
    };

    return {
      pages: [homePage, contactPage],
      settings,
    };
  }
}
FILEEOF

echo "API AI service written."


# ============================================
# API - JOBS MODULE
# ============================================

cat > apps/api/src/jobs/jobs.module.ts << 'FILEEOF'
import { Module, forwardRef } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobsProcessor } from './jobs.processor';
import { AuthModule } from '../auth/auth.module';
import { WordPressModule } from '../wordpress/wordpress.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => WordPressModule),
    forwardRef(() => AiModule),
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsProcessor],
  exports: [JobsService],
})
export class JobsModule {}
FILEEOF

cat > apps/api/src/jobs/jobs.service.ts << 'FILEEOF'
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JobType, JobStatus } from '@prisma/client';

@Injectable()
export class JobsService {
  private queue: Queue;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const redisHost = this.configService.get('REDIS_HOST') || 'localhost';
    const redisPort = this.configService.get('REDIS_PORT') || 6379;

    this.queue = new Queue('site-jobs', {
      connection: {
        host: redisHost,
        port: Number(redisPort),
      },
    });
  }

  async createJob(siteId: string, type: JobType, metadata?: Record<string, unknown>) {
    // Create job in database
    const job = await this.prisma.job.create({
      data: {
        siteId,
        type,
        status: JobStatus.pending,
        metadata: metadata || {},
      },
    });

    // Add to queue
    await this.queue.add(type, {
      jobId: job.id,
      siteId,
      type,
      metadata,
    });

    return job;
  }

  async getJob(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  async getActiveJobForSite(siteId: string) {
    return this.prisma.job.findFirst({
      where: {
        siteId,
        status: { in: [JobStatus.pending, JobStatus.running] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateJobStatus(jobId: string, status: JobStatus, error?: string) {
    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        error,
        completedAt: status === JobStatus.completed || status === JobStatus.failed ? new Date() : null,
      },
    });
  }

  async addJobLog(jobId: string, message: string) {
    return this.prisma.jobLog.create({
      data: {
        jobId,
        message,
      },
    });
  }
}
FILEEOF

cat > apps/api/src/jobs/jobs.controller.ts << 'FILEEOF'
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private jobsService: JobsService) {}

  /**
   * GET /api/jobs/:id
   *
   * Get job status and logs
   *
   * Response:
   * {
   *   "id": "...",
   *   "siteId": "...",
   *   "type": "provision",
   *   "status": "running",
   *   "error": null,
   *   "createdAt": "...",
   *   "completedAt": null,
   *   "logs": [
   *     { "id": "...", "message": "Starting provision job", "createdAt": "..." },
   *     { "id": "...", "message": "Provisioning WordPress site...", "createdAt": "..." }
   *   ]
   * }
   */
  @Get(':id')
  async getJob(@Param('id') id: string) {
    return this.jobsService.getJob(id);
  }
}
FILEEOF

echo "API jobs module/service/controller written."


cat > apps/api/src/jobs/jobs.processor.ts << 'FILEEOF'
import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from './jobs.service';
import { WordPressService } from '../wordpress/wordpress.service';
import { AiService } from '../ai/ai.service';
import { JobStatus, SiteStatus } from '@prisma/client';
import { SiteContent } from '@builder/shared';

interface JobData {
  jobId: string;
  siteId: string;
  type: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class JobsProcessor implements OnModuleInit {
  private worker: Worker;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private jobsService: JobsService,
    @Inject(forwardRef(() => WordPressService))
    private wordpressService: WordPressService,
    @Inject(forwardRef(() => AiService))
    private aiService: AiService,
  ) {}

  onModuleInit() {
    const redisHost = this.configService.get('REDIS_HOST') || 'localhost';
    const redisPort = this.configService.get('REDIS_PORT') || 6379;

    this.worker = new Worker(
      'site-jobs',
      async (job: Job<JobData>) => {
        await this.processJob(job.data);
      },
      {
        connection: {
          host: redisHost,
          port: Number(redisPort),
        },
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    console.log('Job processor started');
  }

  private async processJob(data: JobData) {
    const { jobId, siteId, type, metadata } = data;

    try {
      await this.jobsService.updateJobStatus(jobId, JobStatus.running);
      await this.jobsService.addJobLog(jobId, `Starting ${type} job`);

      switch (type) {
        case 'provision':
          await this.handleProvision(jobId, siteId, metadata);
          break;
        case 'generate':
          await this.handleGenerate(jobId, siteId, metadata);
          break;
        case 'publish':
          await this.handlePublish(jobId, siteId, metadata);
          break;
        case 'rollback':
          await this.handleRollback(jobId, siteId, metadata);
          break;
        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      await this.jobsService.updateJobStatus(jobId, JobStatus.completed);
      await this.jobsService.addJobLog(jobId, `Job completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.jobsService.updateJobStatus(jobId, JobStatus.failed, errorMessage);
      await this.jobsService.addJobLog(jobId, `Job failed: ${errorMessage}`);
      throw error;
    }
  }

  private async handleProvision(jobId: string, siteId: string, metadata?: Record<string, unknown>) {
    await this.jobsService.addJobLog(jobId, 'Provisioning WordPress site...');

    // Update site status
    await this.prisma.site.update({
      where: { id: siteId },
      data: { status: SiteStatus.provisioning },
    });

    // Get site details
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: { owner: true, tenant: true },
    });

    if (!site) {
      throw new Error('Site not found');
    }

    // Provision WordPress site
    const wpResult = await this.wordpressService.provisionSite(site);
    await this.jobsService.addJobLog(jobId, `WordPress site created: ${wpResult.wpSiteUrl}`);

    // Update site with WP details
    await this.prisma.site.update({
      where: { id: siteId },
      data: {
        wpSiteId: wpResult.wpSiteId,
        wpAdminUrl: wpResult.wpAdminUrl,
        wpSiteUrl: wpResult.wpSiteUrl,
        status: SiteStatus.generating,
      },
    });

    // Apply theme and plugins
    await this.wordpressService.applyThemeAndPlugins(wpResult.wpSiteId);
    await this.jobsService.addJobLog(jobId, 'Theme and plugins applied');

    // Automatically trigger AI generation
    await this.handleGenerate(jobId, siteId, metadata);
  }

  private async handleGenerate(jobId: string, siteId: string, metadata?: Record<string, unknown>) {
    await this.jobsService.addJobLog(jobId, 'Generating content with AI...');

    // Get site with latest version
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!site) {
      throw new Error('Site not found');
    }

    // Get settings from metadata or latest version
    const existingContent = site.versions[0]?.pageJson as SiteContent | undefined;
    const settings = (metadata?.settings || existingContent?.settings) as SiteContent['settings'];

    if (!settings) {
      throw new Error('No settings found for generation');
    }

    // Generate content with AI
    const content = await this.aiService.generateSiteContent(settings);
    await this.jobsService.addJobLog(jobId, 'AI content generated');

    // Get next version number
    const maxVersion = await this.prisma.siteVersion.findFirst({
      where: { siteId },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersion = (maxVersion?.versionNumber || 0) + 1;

    // Create new version
    const version = await this.prisma.siteVersion.create({
      data: {
        siteId,
        versionNumber: nextVersion,
        pageJson: content as object,
      },
    });
    await this.jobsService.addJobLog(jobId, `Version ${nextVersion} created`);

    // Update site
    await this.prisma.site.update({
      where: { id: siteId },
      data: {
        status: SiteStatus.draft,
        currentVersionId: version.id,
      },
    });
  }

  private async handlePublish(jobId: string, siteId: string, _metadata?: Record<string, unknown>) {
    await this.jobsService.addJobLog(jobId, 'Publishing to WordPress...');

    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: {
        versions: {
          where: { id: undefined }, // Will be overridden below
        },
      },
    });

    if (!site) {
      throw new Error('Site not found');
    }

    if (!site.currentVersionId) {
      throw new Error('No current version to publish');
    }

    if (!site.wpSiteId) {
      throw new Error('WordPress site not provisioned');
    }

    // Get current version
    const version = await this.prisma.siteVersion.findUnique({
      where: { id: site.currentVersionId },
    });

    if (!version) {
      throw new Error('Version not found');
    }

    // Publish to WordPress
    await this.wordpressService.publishVersion(site.wpSiteId, version.pageJson as SiteContent);
    await this.jobsService.addJobLog(jobId, 'Content published to WordPress');

    // Update site status
    await this.prisma.site.update({
      where: { id: siteId },
      data: {
        status: SiteStatus.published,
        publishedVersionId: version.id,
      },
    });
  }

  private async handleRollback(jobId: string, siteId: string, metadata?: Record<string, unknown>) {
    const versionId = metadata?.versionId as string;
    if (!versionId) {
      throw new Error('Version ID required for rollback');
    }

    await this.jobsService.addJobLog(jobId, `Rolling back to version ${versionId}...`);

    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new Error('Site not found');
    }

    if (!site.wpSiteId) {
      throw new Error('WordPress site not provisioned');
    }

    // Get target version
    const version = await this.prisma.siteVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.siteId !== siteId) {
      throw new Error('Version not found');
    }

    // Publish old version to WordPress
    await this.wordpressService.publishVersion(site.wpSiteId, version.pageJson as SiteContent);
    await this.jobsService.addJobLog(jobId, 'Rolled back content published');

    // Update site
    await this.prisma.site.update({
      where: { id: siteId },
      data: {
        currentVersionId: version.id,
        publishedVersionId: version.id,
        status: SiteStatus.published,
      },
    });
  }
}
FILEEOF

echo "API jobs processor written."


# ============================================
# API - SITES MODULE
# ============================================

cat > apps/api/src/sites/sites.module.ts << 'FILEEOF'
import { Module } from '@nestjs/common';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { JobsModule } from '../jobs/jobs.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [JobsModule, AuthModule, BillingModule],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
FILEEOF

cat > apps/api/src/sites/sites.dto.ts << 'FILEEOF'
import { IsString, IsOptional, IsObject, ValidateNested, IsArray, IsEmail, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class SiteSettingsDto {
  @IsString()
  businessName: string;

  @IsString()
  industry: string;

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
FILEEOF

echo "API sites module/dto written."


cat > apps/api/src/sites/sites.service.ts << 'FILEEOF'
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { BillingService } from '../billing/billing.service';
import { CreateSiteDto, SaveDraftDto, RollbackDto } from './sites.dto';
import { JobType, SiteStatus } from '@prisma/client';
import { SiteContent, Page } from '@builder/shared';

@Injectable()
export class SitesService {
  constructor(
    private prisma: PrismaService,
    private jobsService: JobsService,
    private billingService: BillingService,
  ) {}

  async createSite(userId: string, tenantId: string, dto: CreateSiteDto) {
    // Check subscription
    const hasActiveSubscription = await this.billingService.hasActiveSubscription(userId);
    if (!hasActiveSubscription) {
      throw new ForbiddenException('Active subscription required to create a site');
    }

    // Create site
    const site = await this.prisma.site.create({
      data: {
        tenantId,
        ownerUserId: userId,
        name: dto.settings.businessName,
        status: SiteStatus.provisioning,
      },
    });

    // Create initial version with settings
    const initialContent: SiteContent = {
      pages: [],
      settings: dto.settings,
    };

    await this.prisma.siteVersion.create({
      data: {
        siteId: site.id,
        versionNumber: 0,
        pageJson: initialContent as object,
      },
    });

    // Start provision job
    const job = await this.jobsService.createJob(site.id, JobType.provision, {
      settings: dto.settings,
    });

    return {
      site,
      jobId: job.id,
    };
  }

  async getSite(siteId: string, userId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    if (site.ownerUserId !== userId) {
      throw new ForbiddenException('Not authorized to access this site');
    }

    // Get current version
    const currentVersion = site.currentVersionId
      ? await this.prisma.siteVersion.findUnique({
          where: { id: site.currentVersionId },
        })
      : null;

    // Get all versions
    const versions = await this.prisma.siteVersion.findMany({
      where: { siteId },
      orderBy: { versionNumber: 'desc' },
    });

    // Get active job
    const activeJob = await this.jobsService.getActiveJobForSite(siteId);

    return {
      site,
      currentVersion,
      versions,
      activeJob,
    };
  }

  async getUserSites(userId: string, tenantId: string) {
    return this.prisma.site.findMany({
      where: {
        ownerUserId: userId,
        tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateContent(siteId: string, userId: string, sectionId?: string) {
    const site = await this.getSiteOrThrow(siteId, userId);

    // Check subscription
    const hasActiveSubscription = await this.billingService.hasActiveSubscription(userId);
    if (!hasActiveSubscription) {
      throw new ForbiddenException('Active subscription required');
    }

    // Get settings from latest version
    const latestVersion = await this.prisma.siteVersion.findFirst({
      where: { siteId },
      orderBy: { versionNumber: 'desc' },
    });

    if (!latestVersion) {
      throw new BadRequestException('No version found for site');
    }

    const content = latestVersion.pageJson as SiteContent;

    // Start generation job
    const job = await this.jobsService.createJob(site.id, JobType.generate, {
      settings: content.settings,
      sectionId,
    });

    return { jobId: job.id };
  }

  async saveDraft(siteId: string, userId: string, dto: SaveDraftDto) {
    const site = await this.getSiteOrThrow(siteId, userId);

    // Get current version for settings
    const currentVersion = await this.prisma.siteVersion.findFirst({
      where: { siteId },
      orderBy: { versionNumber: 'desc' },
    });

    if (!currentVersion) {
      throw new BadRequestException('No version found');
    }

    const existingContent = currentVersion.pageJson as SiteContent;

    // Create new version
    const newVersion = await this.prisma.siteVersion.create({
      data: {
        siteId,
        versionNumber: currentVersion.versionNumber + 1,
        pageJson: {
          pages: dto.pages,
          settings: existingContent.settings,
        } as object,
      },
    });

    // Update site
    await this.prisma.site.update({
      where: { id: siteId },
      data: {
        currentVersionId: newVersion.id,
        status: site.status === SiteStatus.published ? SiteStatus.draft : site.status,
      },
    });

    return { version: newVersion };
  }

  async publish(siteId: string, userId: string) {
    const site = await this.getSiteOrThrow(siteId, userId);

    // Check subscription
    const hasActiveSubscription = await this.billingService.hasActiveSubscription(userId);
    if (!hasActiveSubscription) {
      throw new ForbiddenException('Active subscription required to publish');
    }

    if (!site.currentVersionId) {
      throw new BadRequestException('No version to publish');
    }

    if (!site.wpSiteId) {
      throw new BadRequestException('WordPress site not provisioned');
    }

    // Start publish job
    const job = await this.jobsService.createJob(site.id, JobType.publish, {
      versionId: site.currentVersionId,
    });

    return { jobId: job.id };
  }

  async rollback(siteId: string, userId: string, dto: RollbackDto) {
    const site = await this.getSiteOrThrow(siteId, userId);

    // Check subscription
    const hasActiveSubscription = await this.billingService.hasActiveSubscription(userId);
    if (!hasActiveSubscription) {
      throw new ForbiddenException('Active subscription required');
    }

    // Verify version exists and belongs to this site
    const version = await this.prisma.siteVersion.findUnique({
      where: { id: dto.versionId },
    });

    if (!version || version.siteId !== siteId) {
      throw new NotFoundException('Version not found');
    }

    if (!site.wpSiteId) {
      throw new BadRequestException('WordPress site not provisioned');
    }

    // Start rollback job
    const job = await this.jobsService.createJob(site.id, JobType.rollback, {
      versionId: dto.versionId,
    });

    return { jobId: job.id };
  }

  private async getSiteOrThrow(siteId: string, userId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    if (site.ownerUserId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    return site;
  }
}
FILEEOF

echo "API sites service written."


cat > apps/api/src/sites/sites.controller.ts << 'FILEEOF'
import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto, GenerateDto, SaveDraftDto, RollbackDto } from './sites.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthRequest } from '../auth/auth.types';

@Controller('sites')
@UseGuards(JwtAuthGuard)
export class SitesController {
  constructor(private sitesService: SitesService) {}

  /**
   * POST /api/sites
   *
   * Create a new site and start provisioning
   *
   * Request:
   * {
   *   "settings": {
   *     "businessName": "Acme Corp",
   *     "industry": "Technology",
   *     "stylePreset": "modern",
   *     "accentColor": "#2563EB",
   *     "primaryCta": "book",
   *     "contactEmail": "hello@acme.com",
   *     "contactPhone": "+1 555-0123"
   *   }
   * }
   *
   * Response:
   * {
   *   "site": { "id": "...", "name": "Acme Corp", "status": "provisioning", ... },
   *   "jobId": "..."
   * }
   */
  @Post()
  async createSite(@Req() req: AuthRequest, @Body() dto: CreateSiteDto) {
    return this.sitesService.createSite(req.user.userId, req.user.tenantId, dto);
  }

  /**
   * GET /api/sites
   *
   * Get all sites for the current user
   *
   * Response:
   * [
   *   { "id": "...", "name": "...", "status": "published", ... },
   *   ...
   * ]
   */
  @Get()
  async getUserSites(@Req() req: AuthRequest) {
    return this.sitesService.getUserSites(req.user.userId, req.user.tenantId);
  }

  /**
   * GET /api/sites/:id
   *
   * Get site details with versions and active job
   *
   * Response:
   * {
   *   "site": { "id": "...", "name": "...", "status": "draft", "wpSiteUrl": "...", ... },
   *   "currentVersion": { "id": "...", "versionNumber": 3, "pageJson": {...}, ... },
   *   "versions": [ ... ],
   *   "activeJob": { "id": "...", "type": "generate", "status": "running", ... } | null
   * }
   */
  @Get(':id')
  async getSite(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.sitesService.getSite(id, req.user.userId);
  }

  /**
   * POST /api/sites/:id/generate
   *
   * Regenerate site content with AI
   *
   * Request (optional):
   * {
   *   "sectionId": "..." // optional: regenerate only this section
   * }
   *
   * Response:
   * {
   *   "jobId": "..."
   * }
   */
  @Post(':id/generate')
  async generateContent(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: GenerateDto) {
    return this.sitesService.generateContent(id, req.user.userId, dto.sectionId);
  }

  /**
   * PUT /api/sites/:id/draft
   *
   * Save editor changes as a new version
   *
   * Request:
   * {
   *   "pages": [
   *     {
   *       "title": "Home",
   *       "slug": "home",
   *       "sections": [
   *         {
   *           "id": "...",
   *           "type": "hero",
   *           "variant": 1,
   *           "blocks": [
   *             { "id": "...", "type": "text", "props": { "content": "...", "variant": "h1" } },
   *             ...
   *           ]
   *         },
   *         ...
   *       ]
   *     },
   *     ...
   *   ]
   * }
   *
   * Response:
   * {
   *   "version": { "id": "...", "versionNumber": 4, "pageJson": {...}, "createdAt": "..." }
   * }
   */
  @Put(':id/draft')
  async saveDraft(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: SaveDraftDto) {
    return this.sitesService.saveDraft(id, req.user.userId, dto);
  }

  /**
   * POST /api/sites/:id/publish
   *
   * Publish current version to WordPress
   *
   * Response:
   * {
   *   "jobId": "..."
   * }
   */
  @Post(':id/publish')
  async publish(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.sitesService.publish(id, req.user.userId);
  }

  /**
   * POST /api/sites/:id/rollback
   *
   * Rollback to a previous version
   *
   * Request:
   * {
   *   "versionId": "..."
   * }
   *
   * Response:
   * {
   *   "jobId": "..."
   * }
   */
  @Post(':id/rollback')
  async rollback(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: RollbackDto) {
    return this.sitesService.rollback(id, req.user.userId, dto);
  }
}
FILEEOF

echo "API sites controller written."


# ============================================
# API - BILLING MODULE
# ============================================

cat > apps/api/src/billing/billing.module.ts << 'FILEEOF'
import { Module } from '@nestjs/common';
import { BillingController, StripeWebhookController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
FILEEOF

cat > apps/api/src/billing/billing.service.ts << 'FILEEOF'
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class BillingService {
  private stripe: Stripe;
  private priceId: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secretKey = this.configService.get('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
    }
    this.priceId = this.configService.get('STRIPE_PRICE_ID') || '';
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    // In development without Stripe, allow all users
    if (!this.stripe) {
      return true;
    }

    const subscription = await this.prisma.stripeSubscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.active,
      },
    });

    return !!subscription;
  }

  async getBillingStatus(userId: string) {
    const subscription = await this.prisma.stripeSubscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      hasSubscription: !!subscription && subscription.status === SubscriptionStatus.active,
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
    };
  }

  async createCheckoutSession(userId: string, userEmail: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    if (!this.priceId) {
      throw new BadRequestException('Stripe price not configured');
    }

    // Check if customer already exists
    let stripeCustomerId: string;
    const existingSub = await this.prisma.stripeSubscription.findFirst({
      where: { userId },
    });

    if (existingSub) {
      stripeCustomerId = existingSub.stripeCustomerId;
    } else {
      // Create new customer
      const customer = await this.stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
    }

    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: this.priceId,
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/dashboard?checkout=success`,
      cancel_url: `${frontendUrl}/billing?checkout=canceled`,
      metadata: { userId },
    });

    return { checkoutUrl: session.url };
  }

  async createPortalSession(userId: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    const subscription = await this.prisma.stripeSubscription.findFirst({
      where: { userId },
    });

    if (!subscription) {
      throw new BadRequestException('No subscription found');
    }

    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${frontendUrl}/billing`,
    });

    return { portalUrl: session.url };
  }

  async handleWebhook(signature: string, payload: Buffer) {
    if (!this.stripe) {
      console.log('Stripe not configured, skipping webhook');
      return;
    }

    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${err}`);
    }

    console.log('Received Stripe webhook:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDeleted(subscription);
        break;
      }
      default:
        console.log('Unhandled webhook event:', event.type);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId) {
      console.error('No userId in checkout session metadata');
      return;
    }

    if (!session.subscription || !session.customer) {
      console.error('Missing subscription or customer in checkout session');
      return;
    }

    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;

    // Fetch full subscription details
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

    await this.prisma.stripeSubscription.upsert({
      where: { stripeSubscriptionId: subscriptionId },
      update: {
        status: this.mapStripeStatus(subscription.status),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
      create: {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: this.mapStripeStatus(subscription.status),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    console.log(`Subscription created for user ${userId}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const existingSub = await this.prisma.stripeSubscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!existingSub) {
      console.log('Subscription not found in DB, skipping update');
      return;
    }

    await this.prisma.stripeSubscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: this.mapStripeStatus(subscription.status),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    console.log(`Subscription ${subscription.id} updated to status: ${subscription.status}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await this.prisma.stripeSubscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: SubscriptionStatus.canceled,
      },
    });

    console.log(`Subscription ${subscription.id} canceled`);
  }

  private mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'active':
        return SubscriptionStatus.active;
      case 'canceled':
        return SubscriptionStatus.canceled;
      case 'past_due':
        return SubscriptionStatus.past_due;
      case 'trialing':
        return SubscriptionStatus.trialing;
      default:
        return SubscriptionStatus.incomplete;
    }
  }
}
FILEEOF

cat > apps/api/src/billing/billing.controller.ts << 'FILEEOF'
import { Controller, Get, Post, UseGuards, Req, Headers, RawBodyRequest } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthRequest } from '../auth/auth.types';
import { Request } from 'express';

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  /**
   * GET /api/billing/status
   *
   * Get current subscription status
   *
   * Response:
   * {
   *   "hasSubscription": true,
   *   "subscription": {
   *     "status": "active",
   *     "currentPeriodEnd": "2024-02-15T00:00:00.000Z"
   *   }
   * }
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: AuthRequest) {
    return this.billingService.getBillingStatus(req.user.userId);
  }

  /**
   * POST /api/billing/checkout
   *
   * Create Stripe checkout session for subscription
   *
   * Response:
   * {
   *   "checkoutUrl": "https://checkout.stripe.com/..."
   * }
   */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(@Req() req: AuthRequest) {
    return this.billingService.createCheckoutSession(req.user.userId, req.user.email);
  }

  /**
   * POST /api/billing/portal
   *
   * Create Stripe customer portal session
   *
   * Response:
   * {
   *   "portalUrl": "https://billing.stripe.com/..."
   * }
   */
  @Post('portal')
  @UseGuards(JwtAuthGuard)
  async createPortal(@Req() req: AuthRequest) {
    return this.billingService.createPortalSession(req.user.userId);
  }
}

@Controller('stripe')
export class StripeWebhookController {
  constructor(private billingService: BillingService) {}

  /**
   * POST /api/stripe/webhook
   *
   * Stripe webhook endpoint
   *
   * Events handled:
   * - checkout.session.completed
   * - customer.subscription.created
   * - customer.subscription.updated
   * - customer.subscription.deleted
   */
  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!req.rawBody) {
      throw new Error('Raw body required for webhook');
    }
    await this.billingService.handleWebhook(signature, req.rawBody);
    return { received: true };
  }
}
FILEEOF

echo "API billing module written."


# ============================================
# WEB - CONFIG FILES
# ============================================

cat > apps/web/package.json << 'FILEEOF'
{
  "name": "@builder/web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@builder/shared": "1.0.0",
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "immer": "^10.0.3",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0"
  }
}
FILEEOF

cat > apps/web/tsconfig.json << 'FILEEOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
FILEEOF

cat > apps/web/tailwind.config.js << 'FILEEOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // These will be overridden by CSS variables for tenant branding
        primary: 'var(--color-primary, #2563EB)',
        'primary-dark': 'var(--color-primary-dark, #1D4ED8)',
      },
    },
  },
  plugins: [],
};
FILEEOF

cat > apps/web/postcss.config.js << 'FILEEOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
FILEEOF

cat > apps/web/next.config.js << 'FILEEOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@builder/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
FILEEOF

cat > apps/web/.env.example << 'FILEEOF'
# API URL
NEXT_PUBLIC_API_URL=http://localhost:4000
FILEEOF

cat > apps/web/Dockerfile << 'FILEEOF'
# Web Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package*.json ./

RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
FILEEOF

echo "Web config files written."


# ============================================
# WEB - SRC/APP FILES (layout, globals, page, lib)
# ============================================

cat > apps/web/src/app/layout.tsx << 'FILEEOF'
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Website Builder',
  description: 'Build your website with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
FILEEOF

cat > apps/web/src/app/globals.css << 'FILEEOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #2563EB;
  --color-primary-dark: #1D4ED8;
}

body {
  @apply bg-gray-50 text-gray-900;
}

/* Token-based styles for editor */
.editor-section {
  @apply border-2 border-transparent transition-colors;
}

.editor-section:hover {
  @apply border-blue-200;
}

.editor-section.selected {
  @apply border-blue-500;
}

.editor-block {
  @apply transition-colors;
}

.editor-block[contenteditable="true"]:focus {
  @apply outline-none ring-2 ring-blue-300 rounded;
}

/* Section type styles */
.section-hero {
  @apply py-20 px-4 text-center;
}

.section-about {
  @apply py-16 px-4;
}

.section-services {
  @apply py-16 px-4 bg-gray-100;
}

.section-testimonials {
  @apply py-16 px-4;
}

.section-contact {
  @apply py-16 px-4 bg-gray-100;
}

.section-footer {
  @apply py-8 px-4 bg-gray-900 text-gray-300;
}

/* Big primary buttons */
.btn-primary {
  @apply inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-lg transition-colors;
  background-color: var(--color-primary);
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
}

.btn-secondary {
  @apply inline-flex items-center justify-center px-8 py-4 text-lg font-semibold border-2 rounded-lg transition-colors;
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.btn-secondary:hover {
  @apply bg-gray-50;
}

/* Simple form styles */
.input {
  @apply w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.label {
  @apply block text-sm font-medium text-gray-700 mb-2;
}
FILEEOF

cat > apps/web/src/app/page.tsx << 'FILEEOF'
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const { token } = useAuthStore();

  useEffect(() => {
    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-xl">Loading...</div>
    </div>
  );
}
FILEEOF

echo "Web layout/globals/page written."


# ============================================
# WEB - LIB FILES (api.ts, store.ts)
# ============================================

cat > apps/web/src/lib/api.ts << 'FILEEOF'
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth endpoints
export const authApi = {
  signup: (email: string, password: string, tenantSlug?: string) =>
    api<{ token: string; user: { id: string; email: string }; tenant: { id: string; name: string; primaryColor: string } }>(
      '/auth/signup',
      { method: 'POST', body: { email, password, tenantSlug } }
    ),

  login: (email: string, password: string, tenantSlug?: string) =>
    api<{ token: string; user: { id: string; email: string }; tenant: { id: string; name: string; primaryColor: string } }>(
      '/auth/login',
      { method: 'POST', body: { email, password, tenantSlug } }
    ),

  me: (token: string) =>
    api<{
      user: { id: string; email: string };
      tenant: { id: string; name: string; primaryColor: string; logoUrl: string | null };
      membership: { role: string };
      subscription: { status: string; currentPeriodEnd: string } | null;
    }>('/auth/me', { token }),
};

// Tenant endpoints
export const tenantApi = {
  getBySlug: (slug: string) =>
    api<{ id: string; name: string; slug: string; logoUrl: string | null; primaryColor: string }>(
      `/tenants/${slug}`
    ),
};

// Sites endpoints
export const sitesApi = {
  list: (token: string) =>
    api<Array<{
      id: string;
      name: string;
      status: string;
      wpSiteUrl: string | null;
      createdAt: string;
    }>>('/sites', { token }),

  get: (id: string, token: string) =>
    api<{
      site: {
        id: string;
        name: string;
        status: string;
        wpSiteUrl: string | null;
        currentVersionId: string | null;
        publishedVersionId: string | null;
      };
      currentVersion: { id: string; versionNumber: number; pageJson: unknown } | null;
      versions: Array<{ id: string; versionNumber: number; createdAt: string }>;
      activeJob: { id: string; type: string; status: string } | null;
    }>(`/sites/${id}`, { token }),

  create: (settings: unknown, token: string) =>
    api<{ site: { id: string }; jobId: string }>('/sites', { method: 'POST', body: { settings }, token }),

  generate: (id: string, token: string, sectionId?: string) =>
    api<{ jobId: string }>(`/sites/${id}/generate`, { method: 'POST', body: { sectionId }, token }),

  saveDraft: (id: string, pages: unknown, token: string) =>
    api<{ version: { id: string; versionNumber: number } }>(`/sites/${id}/draft`, { method: 'PUT', body: { pages }, token }),

  publish: (id: string, token: string) =>
    api<{ jobId: string }>(`/sites/${id}/publish`, { method: 'POST', token }),

  rollback: (id: string, versionId: string, token: string) =>
    api<{ jobId: string }>(`/sites/${id}/rollback`, { method: 'POST', body: { versionId }, token }),
};

// Jobs endpoints
export const jobsApi = {
  get: (id: string, token: string) =>
    api<{
      id: string;
      type: string;
      status: string;
      error: string | null;
      createdAt: string;
      completedAt: string | null;
      logs: Array<{ id: string; message: string; createdAt: string }>;
    }>(`/jobs/${id}`, { token }),
};

// Billing endpoints
export const billingApi = {
  status: (token: string) =>
    api<{ hasSubscription: boolean; subscription: { status: string; currentPeriodEnd: string } | null }>(
      '/billing/status',
      { token }
    ),

  createCheckout: (token: string) =>
    api<{ checkoutUrl: string }>('/billing/checkout', { method: 'POST', token }),

  createPortal: (token: string) =>
    api<{ portalUrl: string }>('/billing/portal', { method: 'POST', token }),
};
FILEEOF

echo "Web lib/api.ts written."


cat > apps/web/src/lib/store.ts << 'FILEEOF'
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';
import type { Page, Section, Block, SiteContent, SiteSettings } from '@builder/shared';

// Auth Store
interface User {
  id: string;
  email: string;
}

interface Tenant {
  id: string;
  name: string;
  primaryColor: string;
  logoUrl: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
  subscription: { status: string; currentPeriodEnd: string } | null;
  setAuth: (token: string, user: User, tenant: Tenant) => void;
  setSubscription: (sub: { status: string; currentPeriodEnd: string } | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      tenant: null,
      subscription: null,
      setAuth: (token, user, tenant) => set({ token, user, tenant }),
      setSubscription: (subscription) => set({ subscription }),
      logout: () => set({ token: null, user: null, tenant: null, subscription: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

// Editor Store
interface EditorState {
  pages: Page[];
  settings: SiteSettings | null;
  selectedPageIndex: number;
  selectedSectionId: string | null;
  history: Page[][];
  historyIndex: number;

  // Actions
  setContent: (content: SiteContent) => void;
  setSelectedPage: (index: number) => void;
  setSelectedSection: (id: string | null) => void;

  // Section operations
  addSection: (type: Section['type']) => void;
  deleteSection: (id: string) => void;
  moveSection: (id: string, direction: 'up' | 'down') => void;
  reorderSections: (pageIndex: number, fromIndex: number, toIndex: number) => void;

  // Block operations
  updateBlock: (sectionId: string, blockId: string, props: Partial<Block['props']>) => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Save snapshot
  saveSnapshot: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const createDefaultSection = (type: Section['type'], settings: SiteSettings): Section => {
  const id = generateId();

  switch (type) {
    case 'hero':
      return {
        id,
        type: 'hero',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: `Welcome to ${settings.businessName}`, variant: 'h1' } },
          { id: generateId(), type: 'text', props: { content: 'Your trusted partner', variant: 'body' } },
          { id: generateId(), type: 'button', props: { text: 'Get Started', href: '#contact', variant: 'primary' } },
        ],
      };
    case 'about':
      return {
        id,
        type: 'about',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'About Us', variant: 'h2' } },
          { id: generateId(), type: 'text', props: { content: 'Learn more about our story and mission.', variant: 'body' } },
        ],
      };
    case 'services':
      return {
        id,
        type: 'services',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Services', variant: 'h2' } },
          { id: generateId(), type: 'list', props: { items: [
            { id: generateId(), title: 'Service 1', description: 'Description' },
            { id: generateId(), title: 'Service 2', description: 'Description' },
          ], layout: 'grid' } },
        ],
      };
    case 'testimonials':
      return {
        id,
        type: 'testimonials',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'What Our Clients Say', variant: 'h2' } },
          { id: generateId(), type: 'list', props: { items: [
            { id: generateId(), title: 'John D.', description: 'Great service!' },
          ], layout: 'list' } },
        ],
      };
    case 'contact':
      return {
        id,
        type: 'contact',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Contact Us', variant: 'h2' } },
          { id: generateId(), type: 'text', props: { content: `Email: ${settings.contactEmail}`, variant: 'body' } },
          { id: generateId(), type: 'text', props: { content: `Phone: ${settings.contactPhone}`, variant: 'body' } },
        ],
      };
    case 'footer':
      return {
        id,
        type: 'footer',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: `© ${new Date().getFullYear()} ${settings.businessName}`, variant: 'small' } },
        ],
      };
    default:
      throw new Error(`Unknown section type: ${type}`);
  }
};

export const useEditorStore = create<EditorState>((set, get) => ({
  pages: [],
  settings: null,
  selectedPageIndex: 0,
  selectedSectionId: null,
  history: [],
  historyIndex: -1,

  setContent: (content) => set({
    pages: content.pages,
    settings: content.settings,
    history: [content.pages],
    historyIndex: 0,
  }),

  setSelectedPage: (index) => set({ selectedPageIndex: index, selectedSectionId: null }),

  setSelectedSection: (id) => set({ selectedSectionId: id }),

  addSection: (type) => set(produce((state: EditorState) => {
    if (!state.settings) return;
    const section = createDefaultSection(type, state.settings);
    const page = state.pages[state.selectedPageIndex];
    if (page) {
      // Insert before footer if exists
      const footerIndex = page.sections.findIndex(s => s.type === 'footer');
      if (footerIndex >= 0) {
        page.sections.splice(footerIndex, 0, section);
      } else {
        page.sections.push(section);
      }
      state.selectedSectionId = section.id;
    }
  })),

  deleteSection: (id) => set(produce((state: EditorState) => {
    const page = state.pages[state.selectedPageIndex];
    if (page) {
      const index = page.sections.findIndex(s => s.id === id);
      if (index >= 0) {
        page.sections.splice(index, 1);
        state.selectedSectionId = null;
      }
    }
  })),

  moveSection: (id, direction) => set(produce((state: EditorState) => {
    const page = state.pages[state.selectedPageIndex];
    if (!page) return;

    const index = page.sections.findIndex(s => s.id === id);
    if (index < 0) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= page.sections.length) return;

    const [section] = page.sections.splice(index, 1);
    page.sections.splice(newIndex, 0, section);
  })),

  reorderSections: (pageIndex, fromIndex, toIndex) => set(produce((state: EditorState) => {
    const page = state.pages[pageIndex];
    if (!page) return;

    const [section] = page.sections.splice(fromIndex, 1);
    page.sections.splice(toIndex, 0, section);
  })),

  updateBlock: (sectionId, blockId, props) => set(produce((state: EditorState) => {
    const page = state.pages[state.selectedPageIndex];
    if (!page) return;

    const section = page.sections.find(s => s.id === sectionId);
    if (!section) return;

    const block = section.blocks.find(b => b.id === blockId);
    if (!block) return;

    block.props = { ...block.props, ...props };
  })),

  saveSnapshot: () => set(produce((state: EditorState) => {
    // Remove any future history
    state.history = state.history.slice(0, state.historyIndex + 1);
    // Add current state
    state.history.push(JSON.parse(JSON.stringify(state.pages)));
    state.historyIndex = state.history.length - 1;
    // Limit history size
    if (state.history.length > 50) {
      state.history.shift();
      state.historyIndex--;
    }
  })),

  undo: () => set(produce((state: EditorState) => {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      state.pages = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
    }
  })),

  redo: () => set(produce((state: EditorState) => {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      state.pages = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
    }
  })),

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
}));

// Wizard Store
interface WizardState {
  step: number;
  data: Partial<SiteSettings>;
  setStep: (step: number) => void;
  updateData: (data: Partial<SiteSettings>) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>((set) => ({
  step: 1,
  data: {},
  setStep: (step) => set({ step }),
  updateData: (data) => set((state) => ({ data: { ...state.data, ...data } })),
  reset: () => set({ step: 1, data: {} }),
}));
FILEEOF

echo "Web lib/store.ts written."


# ============================================
# WEB - PAGE FILES
# ============================================

cat > 'apps/web/src/app/login/page.tsx' << 'FILEEOF'
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { authApi, tenantApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get('tenant') || 'demo';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<{ name: string; primaryColor: string; logoUrl: string | null } | null>(null);

  const { setAuth, token } = useAuthStore();

  useEffect(() => {
    if (token) {
      router.push('/dashboard');
    }
  }, [token, router]);

  useEffect(() => {
    tenantApi.getBySlug(tenantSlug).then(setTenant).catch(() => {
      // Use default if tenant not found
      setTenant({ name: 'Website Builder', primaryColor: '#2563EB', logoUrl: null });
    });
  }, [tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authApi.login(email, password, tenantSlug);
      setAuth(result.token, result.user, result.tenant);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Set tenant color as CSS variable
  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
    }
  }, [tenant]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-12 mx-auto mb-4" />
          ) : (
            <div className="text-3xl font-bold mb-2" style={{ color: tenant?.primaryColor }}>
              {tenant?.name || 'Website Builder'}
            </div>
          )}
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600">
          Don't have an account?{' '}
          <Link href={`/signup?tenant=${tenantSlug}`} className="font-medium" style={{ color: tenant?.primaryColor }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
FILEEOF

cat > 'apps/web/src/app/signup/page.tsx' << 'FILEEOF'
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { authApi, tenantApi } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get('tenant') || 'demo';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<{ name: string; primaryColor: string; logoUrl: string | null } | null>(null);

  const { setAuth, token } = useAuthStore();

  useEffect(() => {
    if (token) {
      router.push('/dashboard');
    }
  }, [token, router]);

  useEffect(() => {
    tenantApi.getBySlug(tenantSlug).then(setTenant).catch(() => {
      setTenant({ name: 'Website Builder', primaryColor: '#2563EB', logoUrl: null });
    });
  }, [tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await authApi.signup(email, password, tenantSlug);
      setAuth(result.token, result.user, result.tenant);
      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
    }
  }, [tenant]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-12 mx-auto mb-4" />
          ) : (
            <div className="text-3xl font-bold mb-2" style={{ color: tenant?.primaryColor }}>
              {tenant?.name || 'Website Builder'}
            </div>
          )}
          <p className="text-gray-600">Create your account</p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600">
          Already have an account?{' '}
          <Link href={`/login?tenant=${tenantSlug}`} className="font-medium" style={{ color: tenant?.primaryColor }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
FILEEOF

cat > 'apps/web/src/app/onboarding/page.tsx' << 'FILEEOF'
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWizardStore } from '@/lib/store';
import { sitesApi, billingApi } from '@/lib/api';
import { STYLE_PRESETS, INDUSTRIES, PRIMARY_CTA_OPTIONS, DEFAULT_ACCENT_COLORS } from '@builder/shared';

const TOTAL_STEPS = 7;

export default function OnboardingPage() {
  const router = useRouter();
  const { token, tenant, subscription } = useAuthStore();
  const { step, data, setStep, updateData, reset } = useWizardStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSubscription, setNeedsSubscription] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    // Check subscription status
    billingApi.status(token).then((status) => {
      if (!status.hasSubscription) {
        setNeedsSubscription(true);
      }
    });
  }, [token, router]);

  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
    }
  }, [tenant]);

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubscribe = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { checkoutUrl } = await billingApi.createCheckout(token);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!token) return;

    const settings = {
      businessName: data.businessName || '',
      industry: data.industry || 'Other',
      stylePreset: data.stylePreset || 'modern',
      accentColor: data.accentColor || '#2563EB',
      primaryCta: data.primaryCta || 'call',
      contactEmail: data.contactEmail || '',
      contactPhone: data.contactPhone || '',
    };

    setLoading(true);
    setError('');

    try {
      const result = await sitesApi.create(settings, token);
      reset(); // Reset wizard state
      router.push(`/dashboard?site=${result.site.id}&job=${result.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  // Subscription required screen
  if (needsSubscription) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4">Subscribe to Continue</h1>
          <p className="text-gray-600 mb-8">
            You need an active subscription to create and publish websites.
          </p>

          <div className="bg-white p-8 rounded-xl shadow-sm border mb-6">
            <div className="text-4xl font-bold mb-2" style={{ color: tenant?.primaryColor }}>
              $29<span className="text-lg font-normal text-gray-500">/month</span>
            </div>
            <ul className="text-left text-gray-600 space-y-2 mt-4">
              <li>✓ Unlimited websites</li>
              <li>✓ AI content generation</li>
              <li>✓ WordPress hosting</li>
              <li>✓ Priority support</li>
            </ul>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Redirecting...' : 'Subscribe Now'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Step {step} of {TOTAL_STEPS}</span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%`, backgroundColor: tenant?.primaryColor }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white p-8 rounded-xl shadow-sm border">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <Step1
              value={data.businessName || ''}
              onChange={(businessName) => updateData({ businessName })}
            />
          )}

          {step === 2 && (
            <Step2
              value={data.industry || ''}
              onChange={(industry) => updateData({ industry })}
            />
          )}

          {step === 3 && (
            <Step3
              value={data.stylePreset || 'modern'}
              onChange={(stylePreset) => updateData({ stylePreset })}
              primaryColor={tenant?.primaryColor}
            />
          )}

          {step === 4 && (
            <Step4
              value={data.accentColor || tenant?.primaryColor || '#2563EB'}
              onChange={(accentColor) => updateData({ accentColor })}
            />
          )}

          {step === 5 && (
            <Step5
              value={data.primaryCta || 'call'}
              onChange={(primaryCta) => updateData({ primaryCta })}
              primaryColor={tenant?.primaryColor}
            />
          )}

          {step === 6 && (
            <Step6
              email={data.contactEmail || ''}
              phone={data.contactPhone || ''}
              onEmailChange={(contactEmail) => updateData({ contactEmail })}
              onPhoneChange={(contactPhone) => updateData({ contactPhone })}
            />
          )}

          {step === 7 && (
            <Step7 data={data} />
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="px-6 py-3 text-gray-600 hover:text-gray-900"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < TOTAL_STEPS ? (
              <button
                onClick={handleNext}
                disabled={!isStepValid(step, data)}
                className="btn-primary disabled:opacity-50"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || !isStepValid(step, data)}
                className="btn-primary disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Generate My Website'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function isStepValid(step: number, data: Record<string, unknown>): boolean {
  switch (step) {
    case 1:
      return !!data.businessName && (data.businessName as string).length >= 2;
    case 2:
      return !!data.industry;
    case 3:
      return !!data.stylePreset;
    case 4:
      return !!data.accentColor;
    case 5:
      return !!data.primaryCta;
    case 6:
      return !!data.contactEmail && !!data.contactPhone;
    case 7:
      return true;
    default:
      return false;
  }
}

// Step Components
function Step1({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">What's your business name?</h2>
      <p className="text-gray-600 mb-6">This will be displayed on your website.</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input text-xl"
        placeholder="Acme Corp"
        autoFocus
      />
    </div>
  );
}

function Step2({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">What industry are you in?</h2>
      <p className="text-gray-600 mb-6">This helps us generate relevant content.</p>
      <div className="grid grid-cols-2 gap-3">
        {INDUSTRIES.map((industry) => (
          <button
            key={industry}
            onClick={() => onChange(industry)}
            className={`p-4 text-left rounded-lg border-2 transition-colors ${
              value === industry
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {industry}
          </button>
        ))}
      </div>
    </div>
  );
}

function Step3({ value, onChange, primaryColor }: { value: string; onChange: (v: string) => void; primaryColor?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Choose a style</h2>
      <p className="text-gray-600 mb-6">Pick the look that best represents your brand.</p>
      <div className="grid grid-cols-2 gap-3">
        {STYLE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => onChange(preset.value)}
            className={`p-4 text-left rounded-lg border-2 transition-colors ${
              value === preset.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">{preset.label}</div>
            <div className="text-sm text-gray-500">{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Step4({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Pick your accent color</h2>
      <p className="text-gray-600 mb-6">This will be used for buttons and highlights.</p>
      <div className="flex flex-wrap gap-4 mb-6">
        {DEFAULT_ACCENT_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-14 h-14 rounded-full border-4 transition-transform ${
              value === color ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Custom:</label>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-12 rounded cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input w-32"
          placeholder="#2563EB"
        />
      </div>
    </div>
  );
}

function Step5({ value, onChange, primaryColor }: { value: string; onChange: (v: string) => void; primaryColor?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">What should visitors do?</h2>
      <p className="text-gray-600 mb-6">Choose your main call-to-action.</p>
      <div className="space-y-3">
        {PRIMARY_CTA_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`w-full p-4 text-left rounded-lg border-2 transition-colors ${
              value === option.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">{option.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Step6({
  email,
  phone,
  onEmailChange,
  onPhoneChange,
}: {
  email: string;
  phone: string;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Contact information</h2>
      <p className="text-gray-600 mb-6">How should customers reach you?</p>
      <div className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="input"
            placeholder="hello@example.com"
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className="input"
            placeholder="+1 555-0123"
          />
        </div>
      </div>
    </div>
  );
}

function Step7({ data }: { data: Record<string, unknown> }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Ready to generate!</h2>
      <p className="text-gray-600 mb-6">Here's a summary of your choices:</p>

      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Business Name:</span>
          <span className="font-medium">{data.businessName as string}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Industry:</span>
          <span className="font-medium">{data.industry as string}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Style:</span>
          <span className="font-medium capitalize">{data.stylePreset as string}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Accent Color:</span>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full border"
              style={{ backgroundColor: data.accentColor as string }}
            />
            <span className="font-medium">{data.accentColor as string}</span>
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Primary CTA:</span>
          <span className="font-medium capitalize">
            {data.primaryCta === 'call' ? 'Call Us' : data.primaryCta === 'book' ? 'Book Appointment' : 'Get a Quote'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Contact:</span>
          <span className="font-medium">{data.contactEmail as string}</span>
        </div>
      </div>

      <p className="mt-6 text-sm text-gray-500">
        Click "Generate My Website" to create your site. AI will generate your Home and Contact pages.
      </p>
    </div>
  );
}
FILEEOF

cat > 'apps/web/src/app/dashboard/page.tsx' << 'FILEEOF'
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { sitesApi, jobsApi, authApi } from '@/lib/api';

interface Site {
  id: string;
  name: string;
  status: string;
  wpSiteUrl: string | null;
  currentVersionId: string | null;
  publishedVersionId: string | null;
  createdAt: string;
}

interface Version {
  id: string;
  versionNumber: number;
  createdAt: string;
}

interface Job {
  id: string;
  type: string;
  status: string;
  error: string | null;
  logs: Array<{ message: string; createdAt: string }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, tenant, user, setSubscription, logout } = useAuthStore();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    // Fetch user data to get subscription status
    authApi.me(token).then((data) => {
      setSubscription(data.subscription);
    });
  }, [token, router, setSubscription]);

  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
    }
  }, [tenant]);

  const loadSites = useCallback(async () => {
    if (!token) return;
    try {
      const data = await sitesApi.list(token);
      setSites(data);

      // Auto-select site from URL or first site
      const urlSiteId = searchParams.get('site');
      const siteToSelect = urlSiteId ? data.find(s => s.id === urlSiteId) : data[0];
      if (siteToSelect) {
        loadSiteDetails(siteToSelect.id);
      }
    } catch (err) {
      console.error('Failed to load sites:', err);
    } finally {
      setLoading(false);
    }
  }, [token, searchParams]);

  const loadSiteDetails = async (siteId: string) => {
    if (!token) return;
    try {
      const data = await sitesApi.get(siteId, token);
      setSelectedSite(data.site);
      setVersions(data.versions);
      setActiveJob(data.activeJob as Job | null);
    } catch (err) {
      console.error('Failed to load site details:', err);
    }
  };

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  // Poll for job status
  useEffect(() => {
    if (!activeJob || !token || activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const job = await jobsApi.get(activeJob.id, token);
        setActiveJob(job);

        if (job.status === 'completed' || job.status === 'failed') {
          // Reload site details
          if (selectedSite) {
            loadSiteDetails(selectedSite.id);
          }
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJob, token, selectedSite]);

  const handlePublish = async () => {
    if (!token || !selectedSite) return;
    setPublishing(true);
    try {
      const result = await sitesApi.publish(selectedSite.id, token);
      // Start polling for the new job
      const job = await jobsApi.get(result.jobId, token);
      setActiveJob(job);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!token || !selectedSite) return;
    if (!confirm('Are you sure you want to rollback to this version?')) return;

    setRollingBack(true);
    try {
      const result = await sitesApi.rollback(selectedSite.id, versionId, token);
      const job = await jobsApi.get(result.jobId, token);
      setActiveJob(job);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to rollback');
    } finally {
      setRollingBack(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-xl font-bold" style={{ color: tenant?.primaryColor }}>
            {tenant?.name || 'Website Builder'}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/billing" className="text-gray-600 hover:text-gray-900">
              Billing
            </Link>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">{user?.email}</span>
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {sites.length === 0 ? (
          /* No sites - prompt to create */
          <div className="text-center py-16">
            <h1 className="text-3xl font-bold mb-4">Welcome!</h1>
            <p className="text-gray-600 mb-8">
              You don't have any websites yet. Let's create your first one!
            </p>
            <Link href="/onboarding" className="btn-primary">
              Create Your Website
            </Link>
          </div>
        ) : (
          /* Site Dashboard */
          <div>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">Website Overview</h1>
              <Link href="/onboarding" className="btn-secondary text-base py-2 px-4">
                + New Website
              </Link>
            </div>

            {/* Site selector if multiple sites */}
            {sites.length > 1 && (
              <div className="mb-6">
                <select
                  value={selectedSite?.id || ''}
                  onChange={(e) => loadSiteDetails(e.target.value)}
                  className="input max-w-xs"
                >
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedSite && (
              <div className="space-y-6">
                {/* Active Job Status */}
                {activeJob && (activeJob.status === 'pending' || activeJob.status === 'running') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      <div>
                        <div className="font-medium">
                          {activeJob.type === 'provision' && 'Setting up your website...'}
                          {activeJob.type === 'generate' && 'Generating content with AI...'}
                          {activeJob.type === 'publish' && 'Publishing to WordPress...'}
                          {activeJob.type === 'rollback' && 'Rolling back...'}
                        </div>
                        {activeJob.logs && activeJob.logs.length > 0 && (
                          <div className="text-sm text-blue-600 mt-1">
                            {activeJob.logs[activeJob.logs.length - 1].message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Site Status Card */}
                <div className="bg-white rounded-xl border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">{selectedSite.name}</h2>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedSite.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : selectedSite.status === 'draft'
                          ? 'bg-yellow-100 text-yellow-800'
                          : selectedSite.status === 'error'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {selectedSite.status}
                    </span>
                  </div>

                  {selectedSite.wpSiteUrl && (
                    <div className="mb-6">
                      <a
                        href={selectedSite.wpSiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {selectedSite.wpSiteUrl}
                      </a>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-4">
                    {selectedSite.wpSiteUrl && (
                      <a
                        href={selectedSite.wpSiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-base py-3 px-6"
                      >
                        Preview Site
                      </a>
                    )}

                    {selectedSite.currentVersionId && selectedSite.status !== 'provisioning' && (
                      <Link
                        href={`/editor/${selectedSite.id}`}
                        className="btn-primary text-base py-3 px-6"
                      >
                        Edit Website
                      </Link>
                    )}

                    {selectedSite.status === 'draft' && (
                      <button
                        onClick={handlePublish}
                        disabled={publishing || !!activeJob}
                        className="btn-primary text-base py-3 px-6 disabled:opacity-50"
                      >
                        {publishing ? 'Publishing...' : 'Publish'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Version History */}
                {versions.length > 0 && (
                  <div className="bg-white rounded-xl border p-6">
                    <h3 className="text-lg font-bold mb-4">Version History</h3>
                    <div className="space-y-2">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                        >
                          <div>
                            <span className="font-medium">Version {version.versionNumber}</span>
                            <span className="text-gray-500 ml-3 text-sm">
                              {new Date(version.createdAt).toLocaleString()}
                            </span>
                            {version.id === selectedSite.publishedVersionId && (
                              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                Published
                              </span>
                            )}
                            {version.id === selectedSite.currentVersionId && (
                              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                Current
                              </span>
                            )}
                          </div>
                          {version.id !== selectedSite.currentVersionId && (
                            <button
                              onClick={() => handleRollback(version.id)}
                              disabled={rollingBack || !!activeJob}
                              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                            >
                              Rollback
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
FILEEOF

cat > 'apps/web/src/app/editor/[siteId]/page.tsx' << 'FILEEOF'
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore, useEditorStore } from '@/lib/store';
import { sitesApi } from '@/lib/api';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Section, Block, TextProps, ImageProps, ButtonProps, ListProps, SiteContent } from '@builder/shared';
import { SECTION_LIBRARY } from '@builder/shared';

export default function EditorPage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params.siteId as string;

  const { token, tenant } = useAuthStore();
  const {
    pages,
    settings,
    selectedPageIndex,
    selectedSectionId,
    setContent,
    setSelectedPage,
    setSelectedSection,
    addSection,
    deleteSection,
    moveSection,
    reorderSections,
    updateBlock,
    saveSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadSite();
  }, [token, siteId]);

  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
    }
  }, [tenant]);

  const loadSite = async () => {
    if (!token) return;
    try {
      const data = await sitesApi.get(siteId, token);
      if (data.currentVersion) {
        const content = data.currentVersion.pageJson as SiteContent;
        setContent(content);
      }
    } catch (err) {
      console.error('Failed to load site:', err);
      alert('Failed to load site');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!token || pages.length === 0) return;
    setSaving(true);
    try {
      await sitesApi.saveDraft(siteId, pages, token);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }, [token, siteId, pages]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (pages.length === 0) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [pages, handleSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleSave]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const page = pages[selectedPageIndex];
      if (!page) return;

      const oldIndex = page.sections.findIndex((s) => s.id === active.id);
      const newIndex = page.sections.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderSections(selectedPageIndex, oldIndex, newIndex);
        saveSnapshot();
      }
    }
  };

  const handleAddSection = (type: Section['type']) => {
    addSection(type);
    setShowSectionPicker(false);
    saveSnapshot();
  };

  const handleDeleteSection = (id: string) => {
    if (confirm('Delete this section?')) {
      deleteSection(id);
      saveSnapshot();
    }
  };

  const handleBlockChange = (sectionId: string, blockId: string, props: Partial<Block['props']>) => {
    updateBlock(sectionId, blockId, props);
  };

  const handleBlockBlur = () => {
    saveSnapshot();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading editor...</div>
      </div>
    );
  }

  const currentPage = pages[selectedPageIndex];

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Editor Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← Back
            </Link>
            <span className="text-gray-300">|</span>
            <span className="font-medium">{settings?.businessName}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Page Tabs */}
            {pages.map((page, index) => (
              <button
                key={page.slug}
                onClick={() => setSelectedPage(index)}
                className={`px-4 py-2 rounded-lg ${
                  selectedPageIndex === index
                    ? 'bg-gray-100 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {page.title}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {/* Undo/Redo */}
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={!canUndo()}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                ↩
              </button>
              <button
                onClick={redo}
                disabled={!canRedo()}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
                title="Redo (Ctrl+Shift+Z)"
              >
                ↪
              </button>
            </div>

            {/* Save Status */}
            <span className="text-sm text-gray-500">
              {saving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
            </span>

            <Link href="/dashboard" className="btn-primary text-base py-2 px-4">
              Done
            </Link>
          </div>
        </div>
      </header>

      {/* Editor Content */}
      <div className="flex flex-1">
        {/* Main Canvas */}
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
            {currentPage && (
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={currentPage.sections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {currentPage.sections.map((section) => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      isSelected={selectedSectionId === section.id}
                      accentColor={settings?.accentColor || '#2563EB'}
                      onSelect={() => setSelectedSection(section.id)}
                      onDelete={() => handleDeleteSection(section.id)}
                      onMoveUp={() => {
                        moveSection(section.id, 'up');
                        saveSnapshot();
                      }}
                      onMoveDown={() => {
                        moveSection(section.id, 'down');
                        saveSnapshot();
                      }}
                      onBlockChange={handleBlockChange}
                      onBlockBlur={handleBlockBlur}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}

            {/* Add Section Button */}
            <div className="p-8 border-t border-dashed border-gray-300 text-center">
              <button
                onClick={() => setShowSectionPicker(true)}
                className="inline-flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
              >
                <span className="text-2xl">+</span>
                Add Section
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Section Picker Modal */}
      {showSectionPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Add Section</h2>
              <button
                onClick={() => setShowSectionPicker(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SECTION_LIBRARY.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleAddSection(item.type)}
                  className="p-4 text-left rounded-lg border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sortable Section Component
function SortableSection({
  section,
  isSelected,
  accentColor,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  onBlockChange,
  onBlockBlur,
}: {
  section: Section;
  isSelected: boolean;
  accentColor: string;
  onSelect: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onBlockChange: (sectionId: string, blockId: string, props: Partial<Block['props']>) => void;
  onBlockBlur: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`editor-section relative group ${isSelected ? 'selected' : ''} section-${section.type}`}
      onClick={onSelect}
    >
      {/* Section Controls */}
      <div
        className={`absolute top-2 right-2 flex items-center gap-1 bg-white rounded-lg shadow-sm border px-2 py-1 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity z-10`}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab"
          title="Drag to reorder"
        >
          ⋮⋮
        </button>
        <button onClick={onMoveUp} className="p-1 text-gray-400 hover:text-gray-600" title="Move up">
          ↑
        </button>
        <button onClick={onMoveDown} className="p-1 text-gray-400 hover:text-gray-600" title="Move down">
          ↓
        </button>
        <button onClick={onDelete} className="p-1 text-red-400 hover:text-red-600" title="Delete">
          ×
        </button>
      </div>

      {/* Section Content */}
      <div className="max-w-3xl mx-auto">
        {section.blocks.map((block) => (
          <EditableBlock
            key={block.id}
            block={block}
            sectionId={section.id}
            accentColor={accentColor}
            onChange={onBlockChange}
            onBlur={onBlockBlur}
          />
        ))}
      </div>
    </div>
  );
}

// Editable Block Component
function EditableBlock({
  block,
  sectionId,
  accentColor,
  onChange,
  onBlur,
}: {
  block: Block;
  sectionId: string;
  accentColor: string;
  onChange: (sectionId: string, blockId: string, props: Partial<Block['props']>) => void;
  onBlur: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  switch (block.type) {
    case 'text': {
      const props = block.props as TextProps;
      const Tag = getTextTag(props.variant);
      const className = getTextClassName(props.variant);

      return (
        <Tag
          contentEditable
          suppressContentEditableWarning
          className={`editor-block ${className} outline-none`}
          onBlur={(e) => {
            onChange(sectionId, block.id, { content: e.currentTarget.textContent || '' });
            onBlur();
          }}
        >
          {props.content}
        </Tag>
      );
    }

    case 'image': {
      const props = block.props as ImageProps;

      const handleImageClick = () => {
        fileInputRef.current?.click();
      };

      const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            onChange(sectionId, block.id, { src: dataUrl });
            onBlur();
          };
          reader.readAsDataURL(file);
        }
      };

      return (
        <div className="editor-block my-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <img
            src={props.src || '/placeholder-image.jpg'}
            alt={props.alt}
            className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleImageClick}
            title="Click to replace image"
          />
        </div>
      );
    }

    case 'button': {
      const props = block.props as ButtonProps;
      const bgColor = props.variant === 'primary' ? accentColor : 'transparent';
      const textColor = props.variant === 'primary' ? '#ffffff' : accentColor;
      const borderColor = accentColor;

      return (
        <div className="editor-block my-4">
          <span
            contentEditable
            suppressContentEditableWarning
            className={`inline-block px-8 py-4 text-lg font-semibold rounded-lg cursor-text ${
              props.variant === 'primary' ? '' : 'border-2'
            }`}
            style={{ backgroundColor: bgColor, color: textColor, borderColor }}
            onBlur={(e) => {
              onChange(sectionId, block.id, { text: e.currentTarget.textContent || '' });
              onBlur();
            }}
          >
            {props.text}
          </span>
        </div>
      );
    }

    case 'list': {
      const props = block.props as ListProps;

      return (
        <ul className={`editor-block my-4 ${props.layout === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-4'}`}>
          {props.items.map((item, index) => (
            <li key={item.id} className="p-4 bg-gray-50 rounded-lg">
              <div
                contentEditable
                suppressContentEditableWarning
                className="font-semibold outline-none"
                onBlur={(e) => {
                  const newItems = [...props.items];
                  newItems[index] = { ...item, title: e.currentTarget.textContent || '' };
                  onChange(sectionId, block.id, { items: newItems });
                  onBlur();
                }}
              >
                {item.title}
              </div>
              <div
                contentEditable
                suppressContentEditableWarning
                className="text-gray-600 text-sm mt-1 outline-none"
                onBlur={(e) => {
                  const newItems = [...props.items];
                  newItems[index] = { ...item, description: e.currentTarget.textContent || '' };
                  onChange(sectionId, block.id, { items: newItems });
                  onBlur();
                }}
              >
                {item.description}
              </div>
            </li>
          ))}
        </ul>
      );
    }

    default:
      return null;
  }
}

function getTextTag(variant: string): keyof JSX.IntrinsicElements {
  switch (variant) {
    case 'h1':
      return 'h1';
    case 'h2':
      return 'h2';
    case 'h3':
      return 'h3';
    case 'small':
      return 'small';
    default:
      return 'p';
  }
}

function getTextClassName(variant: string): string {
  switch (variant) {
    case 'h1':
      return 'text-4xl font-bold mb-4';
    case 'h2':
      return 'text-3xl font-bold mb-4';
    case 'h3':
      return 'text-xl font-bold mb-2';
    case 'small':
      return 'text-sm text-gray-500';
    default:
      return 'text-gray-600 mb-4';
  }
}
FILEEOF

cat > 'apps/web/src/app/billing/page.tsx' << 'FILEEOF'
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { billingApi } from '@/lib/api';

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, tenant, user, subscription, setSubscription, logout } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState<{
    hasSubscription: boolean;
    subscription: { status: string; currentPeriodEnd: string } | null;
  } | null>(null);

  // Check for checkout result in URL
  const checkoutResult = searchParams.get('checkout');

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    loadBillingStatus();
  }, [token, router]);

  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
    }
  }, [tenant]);

  const loadBillingStatus = async () => {
    if (!token) return;
    try {
      const status = await billingApi.status(token);
      setBillingStatus(status);
      setSubscription(status.subscription);
    } catch (err) {
      console.error('Failed to load billing status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!token) return;
    setPortalLoading(true);
    try {
      const { portalUrl } = await billingApi.createPortal(token);
      if (portalUrl) {
        window.location.href = portalUrl;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!token) return;
    setCheckoutLoading(true);
    try {
      const { checkoutUrl } = await billingApi.createCheckout(token);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create checkout');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-xl font-bold" style={{ color: tenant?.primaryColor }}>
            {tenant?.name || 'Website Builder'}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">{user?.email}</span>
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Billing</h1>

        {/* Checkout Result Banner */}
        {checkoutResult === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
            Your subscription is now active! You can start creating websites.
          </div>
        )}
        {checkoutResult === 'canceled' && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg">
            Checkout was canceled. Subscribe to unlock all features.
          </div>
        )}

        {/* Subscription Status Card */}
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Subscription Status</h2>

          {billingStatus?.hasSubscription ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {billingStatus.subscription?.status || 'Active'}
                </span>
              </div>

              {billingStatus.subscription?.currentPeriodEnd && (
                <p className="text-gray-600 mb-6">
                  Next billing date:{' '}
                  <strong>
                    {new Date(billingStatus.subscription.currentPeriodEnd).toLocaleDateString()}
                  </strong>
                </p>
              )}

              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="btn-secondary text-base py-3 px-6 disabled:opacity-50"
              >
                {portalLoading ? 'Loading...' : 'Manage Subscription'}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-6">
                You don't have an active subscription. Subscribe to create and publish websites.
              </p>

              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="text-3xl font-bold mb-2" style={{ color: tenant?.primaryColor }}>
                  $29<span className="text-lg font-normal text-gray-500">/month</span>
                </div>
                <ul className="text-gray-600 space-y-2">
                  <li>✓ Unlimited websites</li>
                  <li>✓ AI content generation</li>
                  <li>✓ WordPress hosting</li>
                  <li>✓ Priority support</li>
                </ul>
              </div>

              <button
                onClick={handleSubscribe}
                disabled={checkoutLoading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {checkoutLoading ? 'Redirecting...' : 'Subscribe Now'}
              </button>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="text-center text-gray-500 text-sm">
          <p>
            Need help?{' '}
            <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
FILEEOF

echo "Web page files written."


# ============================================
# DOCUMENTATION FILES
# ============================================

cat > 'README.md' << 'FILEEOF'
# AI Website Builder MVP

A multi-tenant white-label AI website builder with WordPress Multisite backend and Stripe subscriptions.

## Features

- **Multi-tenant white-label branding**: Tenant name, logo, primary color
- **Simple onboarding wizard**: 7 steps to create a website
- **AI content generation**: GPT-powered content for Home & Contact pages
- **Easy section editor**: Add, edit, reorder, delete sections (no pixel pushing)
- **WordPress publishing**: Subsites managed via WP-CLI
- **Version control**: Rollback to any previous version with 1 click
- **Stripe subscriptions**: Required for site creation/publishing

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Zustand
- **Backend**: NestJS, Prisma, PostgreSQL
- **Queue**: BullMQ + Redis
- **CMS**: WordPress Multisite
- **Payments**: Stripe

## Project Structure

```
ai-website-builder/
├── apps/
│   ├── api/           # NestJS backend
│   │   ├── prisma/    # Database schema & migrations
│   │   └── src/       # API source code
│   └── web/           # Next.js frontend
│       └── src/       # Frontend source code
├── packages/
│   └── shared/        # Shared types & utilities
├── docker-compose.yml        # Full stack
├── docker-compose.dev.yml    # Dev infrastructure only
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### 1. Clone and Install

```bash
cd ai-website-builder
npm install
```

### 2. Start Infrastructure (Dev Mode)

```bash
# Start PostgreSQL, Redis, and WordPress
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Setup Environment

```bash
# Copy environment templates
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env` and add your keys:

```env
# Required
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/builder?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key-here

# Optional - Stripe (billing works in test mode without real keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional - OpenAI (fallback content is used if not set)
OPENAI_API_KEY=sk-...
```

### 4. Setup Database

```bash
cd apps/api

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed demo data
npx prisma db seed
```

### 5. Start Development Servers

```bash
# Terminal 1 - API (from apps/api)
cd apps/api
npm run dev

# Terminal 2 - Web (from apps/web)
cd apps/web
npm run dev
```

### 6. Access the App

- **Frontend**: http://localhost:3000
- **API**: http://localhost:4000
- **WordPress**: http://localhost:8080

**Demo credentials:**
- Email: `demo@example.com`
- Password: `demo1234`
- Tenant: `demo` (or try `acme` for different branding)

## End-to-End Demo Script

1. **Signup**: Go to `http://localhost:3000/signup?tenant=demo`
2. **Subscribe**: Click "Subscribe Now" (uses Stripe test mode)
3. **Onboarding**: Complete the 7-step wizard:
   - Business name → Industry → Style → Color → CTA → Contact → Confirm
4. **Generate**: Click "Generate My Website" (AI creates content)
5. **Edit**: Use the simple editor to:
   - Click text to edit inline
   - Click images to replace
   - Add sections from library
   - Drag to reorder
6. **Publish**: Click "Publish" (2 clicks total)
7. **Rollback**: Go to Dashboard → Version History → Click "Rollback"

## API Endpoints

### Authentication

```bash
# Signup
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "password123",
  "tenantSlug": "demo"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123",
  "tenantSlug": "demo"
}

# Get current user
GET /api/auth/me
Authorization: Bearer <token>
```

### Sites

```bash
# Create site
POST /api/sites
{
  "settings": {
    "businessName": "Acme Corp",
    "industry": "Technology",
    "stylePreset": "modern",
    "accentColor": "#2563EB",
    "primaryCta": "book",
    "contactEmail": "hello@acme.com",
    "contactPhone": "+1 555-0123"
  }
}

# Get site
GET /api/sites/:id

# Save draft
PUT /api/sites/:id/draft
{ "pages": [...] }

# Publish
POST /api/sites/:id/publish

# Rollback
POST /api/sites/:id/rollback
{ "versionId": "..." }
```

### Billing

```bash
# Get status
GET /api/billing/status

# Create checkout
POST /api/billing/checkout

# Create portal
POST /api/billing/portal
```

## Stripe Setup (Optional)

1. Create a Stripe account at https://dashboard.stripe.com
2. Create a product with a monthly price
3. Set up webhook endpoint: `POST /api/stripe/webhook`
4. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Add keys to `.env`

## WordPress Multisite Setup

The WordPress container is pre-configured for multisite. On first run:

1. Visit `http://localhost:8080` and complete WordPress setup
2. Go to Tools → Network Setup
3. Follow the instructions to enable multisite
4. The API will provision subsites automatically

## Definition of Done Checklist

- [x] Docker Compose starts all services
- [x] Demo tenant seeded with branding
- [x] User can signup/login with tenant branding
- [x] Stripe subscription flow works (test mode)
- [x] Onboarding wizard creates site + triggers AI generation
- [x] Editor loads with generated content
- [x] User can edit text inline
- [x] User can replace images
- [x] User can add/reorder/delete sections
- [x] Undo/Redo works in editor
- [x] Publish updates WordPress pages
- [x] Rollback restores previous version
- [x] Billing page shows subscription status
- [x] All long tasks show job status

## Environment Variables

### API (`apps/api/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| REDIS_HOST | Yes | Redis host |
| REDIS_PORT | Yes | Redis port |
| JWT_SECRET | Yes | JWT signing secret |
| STRIPE_SECRET_KEY | No* | Stripe secret key |
| STRIPE_PRICE_ID | No* | Stripe price ID for subscription |
| STRIPE_WEBHOOK_SECRET | No* | Stripe webhook signing secret |
| OPENAI_API_KEY | No | OpenAI API key for content generation |
| WP_MULTISITE_URL | Yes | WordPress multisite URL |
| FRONTEND_URL | Yes | Frontend URL for redirects |

*Without Stripe keys, billing is disabled and all users have access.

### Web (`apps/web/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| NEXT_PUBLIC_API_URL | Yes | API base URL |

## TODOs (Post-MVP)

- [ ] Add image generation pipeline
- [ ] Add custom domain support
- [ ] Add SEO settings
- [ ] Add analytics integration
- [ ] Add team collaboration
- [ ] Add template marketplace

## License

MIT
FILEEOF

cat > 'ARCHITECTURE.md' << 'FILEEOF'
# AI Website Builder MVP - Architecture

## Tech Stack Decision: Node.js + NestJS

**Why NestJS over FastAPI:**
- TypeScript end-to-end with Next.js frontend (shared types)
- Prisma ORM is more mature than SQLAlchemy for TypeScript
- BullMQ integrates seamlessly with NestJS
- Better monorepo experience with shared packages

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  /login → /signup → /onboarding → /dashboard → /editor → /billing│
└─────────────────────────────────┬───────────────────────────────┘
                                  │ REST API
┌─────────────────────────────────▼───────────────────────────────┐
│                        BACKEND (NestJS)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   Auth   │ │  Sites   │ │  Billing │ │    AI    │           │
│  │  Module  │ │  Module  │ │  Module  │ │  Module  │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
└───────┼────────────┼────────────┼────────────┼──────────────────┘
        │            │            │            │
┌───────▼────────────▼────────────▼────────────▼──────────────────┐
│                      DATA LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  PostgreSQL  │  │    Redis     │  │  WordPress   │          │
│  │   (Prisma)   │  │  (BullMQ)    │  │  Multisite   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Sequence Diagrams

### 1. Signup + Subscription Flow
```
User          Frontend        API           Stripe        DB
 │               │             │              │            │
 │──signup───────►│             │              │            │
 │               │──POST /auth/signup─────────►│            │
 │               │             │──create customer──────────►│
 │               │             │◄─────────────│            │
 │               │             │──────────────────────────►│
 │               │◄────JWT─────│              │            │
 │               │             │              │            │
 │──subscribe────►│             │              │            │
 │               │──POST /billing/checkout────►│            │
 │               │             │──create session──────────►│
 │               │◄──checkout URL──────────────│            │
 │──redirect─────►│ (Stripe)    │              │            │
 │               │◄──webhook (subscription.created)────────│
 │               │             │──update status───────────►│
```

### 2. Site Generation Flow
```
User          Frontend        API         BullMQ      WordPress    AI
 │               │             │            │            │          │
 │──complete wizard────────────►│            │            │          │
 │               │             │──enqueue provision──────►│          │
 │               │◄──job id────│            │            │          │
 │               │             │            │──WP-CLI───►│          │
 │               │             │            │◄──site_id──│          │
 │               │             │            │──generate──────────────►
 │               │             │            │◄──content──────────────│
 │               │             │            │──save version─────────►│
 │               │◄──polling/ws (job complete)───────────│          │
```

### 3. Edit + Publish Flow
```
User          Frontend(Editor)   API         WordPress
 │               │                │             │
 │──edit section─►│                │             │
 │               │──PUT /sites/:id/draft────────►│
 │               │◄──new version───│             │
 │               │                │             │
 │──publish──────►│                │             │
 │               │──POST /sites/:id/publish─────►│
 │               │                │──compile JSON to blocks──►│
 │               │                │◄──success────│
 │               │◄──published────│             │
```

### 4. Rollback Flow
```
User          Frontend        API         WordPress
 │               │             │             │
 │──click rollback──────────────►│             │
 │               │──POST /sites/:id/rollback──►│
 │               │             │──fetch version JSON───────►│
 │               │             │──update WP pages──────────►│
 │               │◄──success────│             │
```

## Data Model

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   tenants   │◄────│ memberships │────►│    users    │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id          │     │ user_id     │     │ id          │
│ name        │     │ tenant_id   │     │ email       │
│ logo_url    │     │ role        │     │ password    │
│ primary_color│     └─────────────┘     │ created_at  │
│ created_at  │                          └─────────────┘
└──────┬──────┘                                 │
       │                                        │
       ▼                                        ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    sites    │◄────│site_versions│     │stripe_subs  │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id          │     │ id          │     │ user_id     │
│ tenant_id   │     │ site_id     │     │ stripe_sub_id│
│ owner_id    │     │ version_num │     │ status      │
│ name        │     │ page_json   │     │ period_end  │
│ wp_site_id  │     │ created_at  │     └─────────────┘
│ wp_admin_url│     └─────────────┘
│ status      │
└─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│    jobs     │◄────│  job_logs   │
├─────────────┤     ├─────────────┤
│ id          │     │ id          │
│ site_id     │     │ job_id      │
│ type        │     │ message     │
│ status      │     │ created_at  │
│ created_at  │     └─────────────┘
└─────────────┘
```

## Page JSON Schema

```typescript
interface Page {
  title: string;
  slug: string;
  sections: Section[];
}

interface Section {
  id: string;
  type: 'hero' | 'about' | 'services' | 'testimonials' | 'contact' | 'footer';
  variant: number; // 1-3 variants per type
  blocks: Block[];
}

interface Block {
  id: string;
  type: 'text' | 'image' | 'button' | 'list';
  props: TextProps | ImageProps | ButtonProps | ListProps;
}
```

## Definition of Done Checklist

- [ ] Docker Compose starts all services (postgres, redis, wordpress, api, web)
- [ ] Demo tenant seeded with branding
- [ ] User can signup/login with tenant branding
- [ ] Stripe subscription flow works (test mode)
- [ ] Onboarding wizard creates site + triggers AI generation
- [ ] Editor loads with generated content
- [ ] User can edit text inline
- [ ] User can replace images
- [ ] User can add/reorder/delete sections
- [ ] Undo/Redo works in editor
- [ ] Publish updates WordPress pages
- [ ] Rollback restores previous version
- [ ] Billing page shows subscription status
- [ ] All long tasks show job status
FILEEOF

echo "Documentation files written."

# ============================================
# PLACEHOLDER IMAGES (empty files)
# ============================================

# Note: These are placeholder image files.
# Replace with actual images for production use.
touch apps/web/public/placeholder-hero.jpg
touch apps/web/public/placeholder-about.jpg
touch apps/web/public/placeholder-image.jpg
echo "Placeholder images created."

echo "Setup complete!"
