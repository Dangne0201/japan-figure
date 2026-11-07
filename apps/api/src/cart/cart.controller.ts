import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppConfig } from '../config/env';
import { OptionalAccessTokenGuard } from '../auth/access-token.guard';
import { AddCartItemDto, SetCartItemQuantityDto } from './cart.dto';
import { getOrCreateGuestCartId } from './cart-cookie';
import { CartService } from './cart.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('cart')
@Controller('cart')
@UseGuards(OptionalAccessTokenGuard)
export class CartController {
  constructor(
    private readonly carts: CartService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the current user or guest cart' })
  get(
    @Req() request: Request & { user?: AuthenticatedUser },
    @Res({ passthrough: true }) response: Response,
  ) {
    const guestId = request.user
      ? undefined
      : getOrCreateGuestCartId(request, response, this.config);
    return this.carts.getCart(request.user?.id, guestId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an in-stock product variant to the cart' })
  add(
    @Req() request: Request & { user?: AuthenticatedUser },
    @Res({ passthrough: true }) response: Response,
    @Body() body: AddCartItemDto,
  ) {
    const guestId = request.user
      ? undefined
      : getOrCreateGuestCartId(request, response, this.config);
    return this.carts.addItem(request.user?.id, guestId, body.variantId, body.quantity);
  }

  @Put('items/:variantId')
  @ApiOperation({ summary: 'Set an item quantity after checking current stock' })
  update(
    @Req() request: Request & { user?: AuthenticatedUser },
    @Res({ passthrough: true }) response: Response,
    @Param('variantId') variantId: string,
    @Body() body: SetCartItemQuantityDto,
  ) {
    const guestId = request.user
      ? undefined
      : getOrCreateGuestCartId(request, response, this.config);
    return this.carts.setQuantity(request.user?.id, guestId, variantId, body.quantity);
  }

  @Delete('items/:variantId')
  @ApiOperation({ summary: 'Remove a product variant from the cart' })
  remove(
    @Req() request: Request & { user?: AuthenticatedUser },
    @Res({ passthrough: true }) response: Response,
    @Param('variantId') variantId: string,
  ) {
    const guestId = request.user
      ? undefined
      : getOrCreateGuestCartId(request, response, this.config);
    return this.carts.removeItem(request.user?.id, guestId, variantId);
  }
}
