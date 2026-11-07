import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogQueryDto, SearchSuggestionQueryDto } from './dto/catalog-query.dto';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  @ApiOperation({
    summary: 'List products with Vietnamese search, filters, sorting, and pagination',
  })
  list(@Query() query: CatalogQueryDto) {
    return this.catalog.list(query);
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Get product detail and related products by slug' })
  detail(@Param('slug') slug: string) {
    return this.catalog.detail(slug);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Suggest matching products for a search query' })
  suggestions(@Query() query: SearchSuggestionQueryDto) {
    return this.catalog.suggestions(query.q);
  }

  @Get('facets')
  @ApiOperation({ summary: 'Get catalog filter options' })
  facets() {
    return this.catalog.facets();
  }

  @Get('home')
  @ApiOperation({ summary: 'Get products for the storefront home sections' })
  home() {
    return this.catalog.home();
  }
}
