import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check the API and its dependencies' })
  @ApiResponse({ status: 200, description: 'Database and Redis are available.' })
  @ApiResponse({ status: 503, description: 'A required dependency is unavailable.' })
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const result = await this.health.check();
    if (result.status !== 'ok') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
