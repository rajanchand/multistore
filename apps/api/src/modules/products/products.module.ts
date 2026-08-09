import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CategoriesController } from './categories.controller';
import { BrandsController } from './brands.controller';
import { CatalogueService } from './catalogue.service';

@Module({
  providers: [ProductsService, CatalogueService],
  controllers: [ProductsController, CategoriesController, BrandsController],
  exports: [ProductsService, CatalogueService],
})
export class ProductsModule {}
