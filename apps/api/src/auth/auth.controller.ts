import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AppConfig } from '../config/env';
import { AccessTokenGuard } from './access-token.guard';
import { clearAuthCookies, readCookie, REFRESH_COOKIE, setAuthCookies } from './auth-cookie';
import {
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
  UpdateProfileDto,
} from './auth.dto';
import { AuthService, type AuthTokens } from './auth.service';
import { AuthenticatedUser } from './auth.types';
import { CartService } from '../cart/cart.service';
import { clearGuestCartCookie, GUEST_CART_COOKIE } from '../cart/cart-cookie';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly carts: CartService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register and send an email verification link through Mailpit' })
  async register(@Body() body: RegisterDto) {
    await this.auth.register(body);
    return { message: 'Hãy kiểm tra Mailpit để xác minh email trước khi đăng nhập.' };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in and set HttpOnly access and refresh cookies' })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokens = await this.auth.login(body.email, body.password);
    const guestCartId = readCookie(request, GUEST_CART_COOKIE);
    try {
      await this.carts.mergeGuestCart(tokens.user.id, guestCartId);
    } catch (error) {
      await this.auth.logout(tokens.refreshToken);
      throw error;
    }
    setAuthCookies(response, this.config, tokens.accessToken, tokens.refreshToken);
    if (guestCartId) clearGuestCartCookie(response, this.config);
    return { user: tokens.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate the refresh token and renew the access cookie' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = readCookie(request, REFRESH_COOKIE);
    if (!rawToken) {
      clearAuthCookies(response, this.config);
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ.');
    }
    let tokens: AuthTokens;
    try {
      tokens = await this.auth.refresh(rawToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) clearAuthCookies(response, this.config);
      throw error;
    }
    setAuthCookies(response, this.config, tokens.accessToken, tokens.refreshToken);
    return { user: tokens.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh session and clear auth cookies' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(readCookie(request, REFRESH_COOKIE));
    clearAuthCookies(response, this.config);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Consume an email verification link sent through Mailpit' })
  async verifyEmail(@Body() body: TokenDto) {
    await this.auth.verifyEmail(body.token);
    return { message: 'Email đã được xác minh. Bạn có thể đăng nhập.' };
  }

  @Post('verification/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Resend a verification email without revealing account existence' })
  async resendVerification(@Body() body: EmailDto) {
    await this.auth.resendVerification(body.email);
    return { message: 'Nếu tài khoản cần xác minh, email hướng dẫn sẽ được gửi qua Mailpit.' };
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset email through Mailpit' })
  async forgotPassword(@Body() body: EmailDto) {
    await this.auth.requestPasswordReset(body.email);
    return {
      message: 'Nếu email thuộc tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi qua Mailpit.',
    };
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Set a new password with a one-time reset link' })
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.resetPassword(body.token, body.password);
    clearAuthCookies(response, this.config);
    return { message: 'Mật khẩu đã được cập nhật. Hãy đăng nhập lại.' };
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiCookieAuth('jf_access')
  @ApiOperation({ summary: 'Get the current authenticated profile' })
  me(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.auth.getProfile(request.user.id);
  }

  @Patch('profile')
  @UseGuards(AccessTokenGuard)
  @ApiCookieAuth('jf_access')
  @ApiOperation({ summary: 'Update the current user display name' })
  updateProfile(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() body: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(request.user.id, body.name);
  }
}
