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
