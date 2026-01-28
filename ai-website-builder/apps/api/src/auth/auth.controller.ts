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
