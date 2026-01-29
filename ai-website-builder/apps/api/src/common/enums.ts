// Local enum constants matching Prisma schema definitions.
// These allow compilation without a fully generated Prisma client.
// When Prisma client is generated, these are compatible as string values.

export const SiteStatus = {
  provisioning: 'provisioning',
  generating: 'generating',
  draft: 'draft',
  published: 'published',
  error: 'error',
} as const;
export type SiteStatus = (typeof SiteStatus)[keyof typeof SiteStatus];

export const JobType = {
  provision: 'provision',
  generate: 'generate',
  publish: 'publish',
  rollback: 'rollback',
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const SubscriptionStatus = {
  active: 'active',
  canceled: 'canceled',
  past_due: 'past_due',
  trialing: 'trialing',
  incomplete: 'incomplete',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const MembershipRole = {
  owner: 'owner',
  admin: 'admin',
  member: 'member',
} as const;
export type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];
