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
