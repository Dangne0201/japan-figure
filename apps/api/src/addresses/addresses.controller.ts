import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AddressInputDto } from './addresses.dto';
import { AddressesService } from './addresses.service';

@ApiTags('addresses')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get('reference')
  @ApiOperation({ summary: 'Get the bundled Vietnam province and commune reference list' })
  reference() {
    return this.addresses.getReferenceData();
  }

  @Get()
  @UseGuards(AccessTokenGuard)
  @ApiCookieAuth('jf_access')
  list(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.addresses.list(request.user.id);
  }

  @Post()
  @UseGuards(AccessTokenGuard)
  @ApiCookieAuth('jf_access')
  create(@Req() request: Request & { user: AuthenticatedUser }, @Body() body: AddressInputDto) {
    return this.addresses.create(request.user.id, body);
  }

  @Patch(':id')
  @UseGuards(AccessTokenGuard)
  @ApiCookieAuth('jf_access')
  update(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: AddressInputDto,
  ) {
    return this.addresses.update(request.user.id, id, body);
  }

  @Post(':id/default')
  @UseGuards(AccessTokenGuard)
  @ApiCookieAuth('jf_access')
  setDefault(@Req() request: Request & { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.addresses.setDefault(request.user.id, id);
  }

  @Delete(':id')
  @UseGuards(AccessTokenGuard)
  @ApiCookieAuth('jf_access')
  async remove(@Req() request: Request & { user: AuthenticatedUser }, @Param('id') id: string) {
    await this.addresses.remove(request.user.id, id);
    return { message: 'Đã xóa địa chỉ.' };
  }
}
