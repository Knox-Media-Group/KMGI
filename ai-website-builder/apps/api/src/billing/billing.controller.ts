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
