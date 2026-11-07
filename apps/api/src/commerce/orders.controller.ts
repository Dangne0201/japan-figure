import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  AddWishlistItemDto,
  CreateReturnRequestDto,
  CreateReviewDto,
  PaymentOutcomeDto,
} from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller()
@UseGuards(AccessTokenGuard)
@ApiCookieAuth('jf_access')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('orders')
  @ApiOperation({ summary: 'List the authenticated customer’s orders' })
  list(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.orders.list(request.user.id);
  }

  @Get('orders/:orderId/invoice')
  @ApiOperation({ summary: 'Get a clearly labeled simulated order invoice' })
  invoice(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('orderId') orderId: string,
  ) {
    return this.orders.invoice(request.user.id, orderId);
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Get an owned order and its payment/status history' })
  detail(@Req() request: Request & { user: AuthenticatedUser }, @Param('orderId') orderId: string) {
    return this.orders.detail(request.user.id, orderId);
  }

  @Post('orders/:orderId/payment-outcome')
  @ApiOperation({ summary: 'Record an idempotent simulated payment outcome' })
  paymentOutcome(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('orderId') orderId: string,
    @Body() body: PaymentOutcomeDto,
  ) {
    return this.orders.recordPaymentOutcome(request.user.id, orderId, body);
  }

  @Post('orders/:orderId/cancel')
  @ApiOperation({ summary: 'Cancel an eligible simulated order and release its commitments' })
  cancel(@Req() request: Request & { user: AuthenticatedUser }, @Param('orderId') orderId: string) {
    return this.orders.cancel(request.user.id, orderId);
  }

  @Post('orders/:orderId/return')
  @ApiOperation({ summary: 'Request a simulated return for a delivered order' })
  requestReturn(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('orderId') orderId: string,
    @Body() body: CreateReturnRequestDto,
  ) {
    return this.orders.requestReturn(request.user.id, orderId, body);
  }

  @Get('wishlist')
  @ApiOperation({ summary: 'List the authenticated customer’s wishlist' })
  wishlist(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.orders.wishlist(request.user.id);
  }

  @Post('wishlist')
  @ApiOperation({ summary: 'Add a published product to the wishlist' })
  addWishlistItem(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() body: AddWishlistItemDto,
  ) {
    return this.orders.addWishlistItem(request.user.id, body);
  }

  @Delete('wishlist/:productSlug')
  @ApiOperation({ summary: 'Remove a product from the wishlist' })
  removeWishlistItem(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('productSlug') productSlug: string,
  ) {
    return this.orders.removeWishlistItem(request.user.id, productSlug);
  }

  @Post('reviews')
  @ApiOperation({ summary: 'Create a pending review for a delivered purchase' })
  createReview(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() body: CreateReviewDto,
  ) {
    return this.orders.createReview(request.user.id, body);
  }
}
