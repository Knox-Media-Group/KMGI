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

