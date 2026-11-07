import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CheckoutQuoteDto } from './checkout.dto';
import { CheckoutService } from './checkout.service';

@ApiTags('checkout')
@Controller('checkout')
@UseGuards(AccessTokenGuard)
@ApiCookieAuth('jf_access')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('quote')
  @ApiOperation({
    summary: 'Calculate shipping, voucher, loyalty, and total without placing an order',
  })
  quote(@Req() request: Request & { user: AuthenticatedUser }, @Body() body: CheckoutQuoteDto) {
    return this.checkout.quote(request.user.id, body);
  }

  @Post('place')
  @ApiOperation({ summary: 'Place a simulated order; no payment or real transaction occurs' })
  place(@Req() request: Request & { user: AuthenticatedUser }, @Body() body: CheckoutQuoteDto) {
    return this.checkout.placeOrder(request.user.id, body);
  }
}
