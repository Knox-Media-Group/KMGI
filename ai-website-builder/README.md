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
