import {
  BadRequestException,
  Body,
  Controller,
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
import { UserRole } from '@prisma/client';
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
  constructor(private readonly admin: AdminService) {}

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
}
