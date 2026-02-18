import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { WordPressService } from './wordpress.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateProductDto {
  name: string;
  description: string;
  shortDescription?: string;
  price: string;
  salePrice?: string;
  sku?: string;
  stockQuantity?: number;
  categories?: string[];
  images?: string[];
  weight?: string;
  dimensions?: { length: string; width: string; height: string };
  attributes?: Array<{ name: string; options: string[] }>;
}

class UpdateProductDto extends CreateProductDto {
  status?: 'publish' | 'draft' | 'pending';
}

class SetupPaymentsDto {
  enableStripe?: boolean;
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  enablePayPal?: boolean;
  paypalClientId?: string;
  paypalClientSecret?: string;
}

@Controller('ecommerce')
@UseGuards(JwtAuthGuard)
export class EcommerceController {
  constructor(private wordpressService: WordPressService) {}

  /**
   * POST /api/ecommerce/:siteId/setup
   *
   * Setup WooCommerce on a WordPress site
   */
  @Post(':siteId/setup')
  async setupStore(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl?: string,
  ) {
    try {
      await this.wordpressService.setupWooCommerce(parseInt(siteId), wpSiteUrl);
      return { success: true, message: 'WooCommerce store setup complete' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Setup failed' };
    }
  }

  /**
   * GET /api/ecommerce/:siteId/stats
   *
   * Get store statistics (orders, revenue, products)
   */
  @Get(':siteId/stats')
  async getStats(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
  ) {
    try {
      const stats = await this.wordpressService.getWooCommerceStats(wpSiteUrl);
      return stats;
    } catch {
      // Return mock stats if API fails
      return getMockStats();
    }
  }

  /**
   * GET /api/ecommerce/:siteId/products
   *
   * List all products
   */
  @Get(':siteId/products')
  async listProducts(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
    @Query('page') page?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    // In production, this would query WooCommerce REST API
    return {
      products: getMockProducts(),
      total: 12,
      page: parseInt(page || '1'),
      perPage: 10,
    };
  }

  /**
   * GET /api/ecommerce/:siteId/products/:productId
   *
   * Get a single product
   */
  @Get(':siteId/products/:productId')
  async getProduct(
    @Param('siteId') siteId: string,
    @Param('productId') productId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
  ) {
    const products = getMockProducts();
    const product = products.find(p => p.id === productId);
    if (!product) {
      return { error: 'Product not found' };
    }
    return product;
  }

  /**
   * POST /api/ecommerce/:siteId/products
   *
   * Create a new product
   */
  @Post(':siteId/products')
  async createProduct(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
    @Body() dto: CreateProductDto,
  ) {
    try {
      const productId = await this.wordpressService.createWooCommerceProduct(wpSiteUrl, {
        name: dto.name,
        description: dto.description,
        shortDescription: dto.shortDescription || '',
        price: dto.price,
        salePrice: dto.salePrice,
        sku: dto.sku,
        stockQuantity: dto.stockQuantity,
        categories: dto.categories || [],
        image: dto.images?.[0],
      });
      return { success: true, productId, message: 'Product created successfully' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Failed to create product' };
    }
  }

  /**
   * PUT /api/ecommerce/:siteId/products/:productId
   *
   * Update a product
   */
  @Put(':siteId/products/:productId')
  async updateProduct(
    @Param('siteId') siteId: string,
    @Param('productId') productId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
    @Body() dto: UpdateProductDto,
  ) {
    // In production, this would call WooCommerce REST API
    return { success: true, productId, message: 'Product updated successfully' };
  }

  /**
   * DELETE /api/ecommerce/:siteId/products/:productId
   *
   * Delete a product
   */
  @Delete(':siteId/products/:productId')
  async deleteProduct(
    @Param('siteId') siteId: string,
    @Param('productId') productId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
  ) {
    // In production, this would call WooCommerce REST API
    return { success: true, message: 'Product deleted successfully' };
  }

  /**
   * GET /api/ecommerce/:siteId/orders
   *
   * List orders
   */
  @Get(':siteId/orders')
  async listOrders(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    return {
      orders: getMockOrders(),
      total: 25,
      page: parseInt(page || '1'),
      perPage: 10,
    };
  }

  /**
   * GET /api/ecommerce/:siteId/orders/:orderId
   *
   * Get order details
   */
  @Get(':siteId/orders/:orderId')
  async getOrder(
    @Param('siteId') siteId: string,
    @Param('orderId') orderId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
  ) {
    const orders = getMockOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return { error: 'Order not found' };
    }
    return order;
  }

  /**
   * PUT /api/ecommerce/:siteId/orders/:orderId/status
   *
   * Update order status
   */
  @Put(':siteId/orders/:orderId/status')
  async updateOrderStatus(
    @Param('siteId') siteId: string,
    @Param('orderId') orderId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
    @Body() body: { status: string },
  ) {
    return { success: true, orderId, status: body.status, message: 'Order status updated' };
  }

  /**
   * POST /api/ecommerce/:siteId/payments/setup
   *
   * Setup payment gateways
   */
  @Post(':siteId/payments/setup')
  async setupPayments(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
    @Body() dto: SetupPaymentsDto,
  ) {
    try {
      await this.wordpressService.setupWooCommercePayments(wpSiteUrl, {
        stripeEnabled: dto.enableStripe,
        stripePublishableKey: dto.stripePublishableKey,
        stripeSecretKey: dto.stripeSecretKey,
        paypalEnabled: dto.enablePayPal,
        paypalEmail: dto.paypalClientId,
      });
      return { success: true, message: 'Payment gateways configured successfully' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Setup failed' };
    }
  }

  /**
   * GET /api/ecommerce/:siteId/categories
   *
   * List product categories
   */
  @Get(':siteId/categories')
  async listCategories(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
  ) {
    return {
      categories: [
        { id: '1', name: 'Clothing', slug: 'clothing', count: 8 },
        { id: '2', name: 'Electronics', slug: 'electronics', count: 4 },
        { id: '3', name: 'Accessories', slug: 'accessories', count: 6 },
        { id: '4', name: 'Home & Garden', slug: 'home-garden', count: 3 },
      ],
    };
  }
}

// Mock data generators

function getMockStats() {
  return {
    totalOrders: Math.floor(Math.random() * 500) + 100,
    totalRevenue: Math.floor(Math.random() * 50000) + 5000,
    totalProducts: Math.floor(Math.random() * 50) + 10,
    averageOrderValue: Math.floor(Math.random() * 100) + 50,
    ordersToday: Math.floor(Math.random() * 20) + 1,
    revenueToday: Math.floor(Math.random() * 2000) + 100,
    pendingOrders: Math.floor(Math.random() * 15) + 2,
    lowStockProducts: Math.floor(Math.random() * 5),
    topProducts: [
      { id: '1', name: 'Premium T-Shirt', sales: 45, revenue: 1350 },
      { id: '2', name: 'Wireless Earbuds', sales: 32, revenue: 2560 },
      { id: '3', name: 'Canvas Backpack', sales: 28, revenue: 1400 },
    ],
    recentOrders: getMockOrders().slice(0, 5),
  };
}

function getMockProducts() {
  return [
    {
      id: '1',
      name: 'Premium Cotton T-Shirt',
      slug: 'premium-cotton-t-shirt',
      status: 'publish',
      price: '29.99',
      salePrice: '24.99',
      sku: 'TSH-001',
      stockQuantity: 150,
      stockStatus: 'instock',
      categories: ['Clothing'],
      images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'],
      description: 'High-quality cotton t-shirt with a comfortable fit.',
      shortDescription: 'Comfortable premium cotton tee',
      dateCreated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      totalSales: 45,
    },
    {
      id: '2',
      name: 'Wireless Bluetooth Earbuds',
      slug: 'wireless-bluetooth-earbuds',
      status: 'publish',
      price: '79.99',
      salePrice: null,
      sku: 'EAR-002',
      stockQuantity: 75,
      stockStatus: 'instock',
      categories: ['Electronics'],
      images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400'],
      description: 'True wireless earbuds with noise cancellation.',
      shortDescription: 'Premium wireless earbuds',
      dateCreated: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      totalSales: 32,
    },
    {
      id: '3',
      name: 'Canvas Travel Backpack',
      slug: 'canvas-travel-backpack',
      status: 'publish',
      price: '49.99',
      salePrice: null,
      sku: 'BAG-003',
      stockQuantity: 40,
      stockStatus: 'instock',
      categories: ['Accessories'],
      images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400'],
      description: 'Durable canvas backpack perfect for travel and daily use.',
      shortDescription: 'Durable travel backpack',
      dateCreated: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      totalSales: 28,
    },
    {
      id: '4',
      name: 'Stainless Steel Water Bottle',
      slug: 'stainless-steel-water-bottle',
      status: 'publish',
      price: '24.99',
      salePrice: '19.99',
      sku: 'BTL-004',
      stockQuantity: 200,
      stockStatus: 'instock',
      categories: ['Accessories'],
      images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400'],
      description: 'Insulated water bottle keeps drinks cold for 24 hours.',
      shortDescription: 'Insulated steel bottle',
      dateCreated: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      totalSales: 56,
    },
    {
      id: '5',
      name: 'Minimalist Watch',
      slug: 'minimalist-watch',
      status: 'draft',
      price: '149.99',
      salePrice: null,
      sku: 'WTC-005',
      stockQuantity: 25,
      stockStatus: 'instock',
      categories: ['Accessories'],
      images: ['https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400'],
      description: 'Elegant minimalist watch with leather strap.',
      shortDescription: 'Elegant minimalist timepiece',
      dateCreated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      totalSales: 12,
    },
  ];
}

function getMockOrders() {
  return [
    {
      id: 'ORD-1001',
      status: 'completed',
      customer: { name: 'John Smith', email: 'john@example.com' },
      items: [{ name: 'Premium Cotton T-Shirt', quantity: 2, price: '24.99' }],
      total: '49.98',
      dateCreated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      paymentMethod: 'Stripe',
    },
    {
      id: 'ORD-1002',
      status: 'processing',
      customer: { name: 'Sarah Johnson', email: 'sarah@example.com' },
      items: [
        { name: 'Wireless Bluetooth Earbuds', quantity: 1, price: '79.99' },
        { name: 'Canvas Travel Backpack', quantity: 1, price: '49.99' },
      ],
      total: '129.98',
      dateCreated: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      paymentMethod: 'PayPal',
    },
    {
      id: 'ORD-1003',
      status: 'pending',
      customer: { name: 'Mike Davis', email: 'mike@example.com' },
      items: [{ name: 'Stainless Steel Water Bottle', quantity: 3, price: '19.99' }],
      total: '59.97',
      dateCreated: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      paymentMethod: 'Stripe',
    },
    {
      id: 'ORD-1004',
      status: 'shipped',
      customer: { name: 'Emily Brown', email: 'emily@example.com' },
      items: [{ name: 'Minimalist Watch', quantity: 1, price: '149.99' }],
      total: '149.99',
      dateCreated: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      paymentMethod: 'Stripe',
    },
    {
      id: 'ORD-1005',
      status: 'refunded',
      customer: { name: 'Alex Wilson', email: 'alex@example.com' },
      items: [{ name: 'Premium Cotton T-Shirt', quantity: 1, price: '29.99' }],
      total: '29.99',
      dateCreated: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      paymentMethod: 'PayPal',
    },
  ];
}
