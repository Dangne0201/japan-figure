import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '../generated/prisma/client';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import {
  AdminProductListDto,
  CreateAdminProductDto,
  SetProductStockDto,
  UpdateAdminProductDto,
} from './admin.dto';
import {
  AdminAuditListDto,
  AdminBannerFieldsDto,
  AdminChatConversationListDto,
  AdminCustomerListDto,
  AdminOrderActionDto,
  AdminOrderListDto,
  AdminReviewListDto,
  AdminVoucherFieldsDto,
  ResolveAdminReturnDto,
  SetCustomerDisabledDto,
  UpdateAdminBannerDto,
  UpdateAdminVoucherDto,
  UpdateReviewStatusDto,
} from './admin-operations.dto';
import { AdminOperationsService } from './admin-operations.service';
import { AdminService } from './admin.service';
import type { UploadedWebpFile } from './admin.service';

const imageUploadOptions = {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (
    _request: Request,
    file: { mimetype: string },
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (file.mimetype !== 'image/webp') {
      callback(new BadRequestException('Chỉ chấp nhận ảnh WebP.'), false);
      return;
    }
    callback(null, true);
  },
};

@ApiTags('admin')
@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiCookieAuth('jf_access')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly operations: AdminOperationsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard counts' })
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('catalog-options')
  @ApiOperation({ summary: 'List brands, series, and categories for product editing' })
  catalogOptions() {
    return this.admin.productOptions();
  }

  @Get('products')
  @ApiOperation({ summary: 'List published and draft products for administration' })
  listProducts(@Query() query: AdminProductListDto) {
    return this.admin.listProducts(query);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a product with its first inventory variant' })
  createProduct(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() body: CreateAdminProductDto,
  ) {
    return this.admin.createProduct(request.user.id, body);
  }

  @Patch('products/:productId')
  @ApiOperation({ summary: 'Update product data or publication state' })
  updateProduct(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('productId') productId: string,
    @Body() body: UpdateAdminProductDto,
  ) {
    return this.admin.updateProduct(request.user.id, productId, body);
  }

  @Patch('products/:productId/variants/:variantId/stock')
  @ApiOperation({ summary: 'Set stock without reducing below active reservations' })
  setVariantStock(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() body: SetProductStockDto,
  ) {
    return this.admin.setVariantStock(request.user.id, productId, variantId, body);
  }

  @Post('products/:productId/image')
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
      required: ['image'],
    },
  })
  @ApiOperation({ summary: 'Upload a local WebP product image up to 5 MiB' })
  uploadProductImage(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('productId') productId: string,
    @UploadedFile() file: UploadedWebpFile | undefined,
  ) {
    if (!file) throw new BadRequestException('Chọn một ảnh WebP để tải lên.');
    return this.admin.uploadProductImage(request.user.id, productId, file);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List orders for administration' })
  listOrders(@Query() query: AdminOrderListDto) {
    return this.operations.listOrders(query);
  }

  @Post('orders/:orderId/cancel')
  @ApiOperation({ summary: 'Cancel an eligible simulated order' })
  cancelOrder(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('orderId') orderId: string,
    @Body() body: AdminOrderActionDto,
  ) {
    return this.operations.cancelOrder(request.user.id, orderId, body.reason);
  }

  @Patch('orders/:orderId/return')
  @ApiOperation({ summary: 'Complete or reject a pending return request' })
  resolveReturn(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('orderId') orderId: string,
    @Body() body: ResolveAdminReturnDto,
  ) {
    return this.operations.resolveReturn(request.user.id, orderId, body.status, body.reason);
  }

  @Get('vouchers')
  @ApiOperation({ summary: 'List vouchers and redemption counts' })
  listVouchers() {
    return this.operations.listVouchers();
  }

  @Post('vouchers')
  @ApiOperation({ summary: 'Create a voucher' })
  createVoucher(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() body: AdminVoucherFieldsDto,
  ) {
    return this.operations.createVoucher(request.user.id, body);
  }

  @Patch('vouchers/:voucherId')
  @ApiOperation({ summary: 'Update voucher settings' })
  updateVoucher(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('voucherId') voucherId: string,
    @Body() body: UpdateAdminVoucherDto,
  ) {
    return this.operations.updateVoucher(request.user.id, voucherId, body);
  }

  @Get('banners')
  @ApiOperation({ summary: 'List storefront banners' })
  listBanners() {
    return this.operations.listBanners();
  }

  @Post('banners')
  @ApiOperation({ summary: 'Create a storefront banner' })
  createBanner(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() body: AdminBannerFieldsDto,
  ) {
    return this.operations.createBanner(request.user.id, body);
  }

  @Patch('banners/:bannerId')
  @ApiOperation({ summary: 'Update a storefront banner' })
  updateBanner(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('bannerId') bannerId: string,
    @Body() body: UpdateAdminBannerDto,
  ) {
    return this.operations.updateBanner(request.user.id, bannerId, body);
  }

  @Delete('banners/:bannerId')
  @ApiOperation({ summary: 'Delete a storefront banner' })
  deleteBanner(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('bannerId') bannerId: string,
  ) {
    return this.operations.deleteBanner(request.user.id, bannerId);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'List customer reviews for moderation' })
  listReviews(@Query() query: AdminReviewListDto) {
    return this.operations.listReviews(query);
  }

  @Patch('reviews/:reviewId')
  @ApiOperation({ summary: 'Approve or reject a pending review' })
  updateReviewStatus(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('reviewId') reviewId: string,
    @Body() body: UpdateReviewStatusDto,
  ) {
    return this.operations.updateReviewStatus(request.user.id, reviewId, body);
  }

  @Get('customers')
  @ApiOperation({ summary: 'List customer accounts' })
  listCustomers(@Query() query: AdminCustomerListDto) {
    return this.operations.listCustomers(query);
  }

  @Patch('customers/:customerId/status')
  @ApiOperation({ summary: 'Disable or enable a customer account' })
  setCustomerDisabled(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('customerId') customerId: string,
    @Body() body: SetCustomerDisabledDto,
  ) {
    return this.operations.setCustomerDisabled(request.user.id, customerId, body);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Browse admin audit history' })
  listAuditLogs(@Query() query: AdminAuditListDto) {
    return this.operations.listAuditLogs(query);
  }

  @Get('chat/conversations')
  @ApiOperation({ summary: 'List customer chatbot conversations for administration' })
  listChatConversations(@Query() query: AdminChatConversationListDto) {
    return this.operations.listChatConversations(query);
  }

  @Get('chat/conversations/:conversationId')
  @ApiOperation({ summary: 'Read a customer chatbot conversation for administration' })
  getChatConversation(@Param('conversationId') conversationId: string) {
    return this.operations.getChatConversation(conversationId);
  }
}
