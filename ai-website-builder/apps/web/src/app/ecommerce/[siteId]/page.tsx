'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ShoppingCart, Package, DollarSign, TrendingUp, Plus,
  Search, Filter, MoreVertical, Edit2, Trash2, Eye, Loader2,
  ChevronDown, CheckCircle, Clock, Truck, XCircle, RefreshCw,
  AlertTriangle, CreditCard, Settings
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { ecommerceApi, EcommerceStats, Product, Order } from '@/lib/api';

type Tab = 'overview' | 'products' | 'orders' | 'settings';

export default function EcommerceDashboard() {
  const params = useParams();
  const siteId = params.siteId as string;
  const { token } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<EcommerceStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const wpSiteUrl = 'https://example.com'; // Would come from site data

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [statsData, productsData, ordersData] = await Promise.all([
        ecommerceApi.getStats(siteId, wpSiteUrl, token),
        ecommerceApi.listProducts(siteId, wpSiteUrl, 1, token),
        ecommerceApi.listOrders(siteId, wpSiteUrl, 1, token),
      ]);
      setStats(statsData);
      setProducts(productsData.products);
      setOrders(ordersData.orders);
    } catch {
      // Use mock data
      setStats(getMockStats());
      setProducts(getMockProducts());
      setOrders(getMockOrders());
    } finally {
      setLoading(false);
    }
  }, [siteId, token]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-gray-500">Loading store data...</p>
        </div>
      </div>
    );
  }

  const s = stats || getMockStats();

  const tabs: { id: Tab; label: string; icon: typeof ShoppingCart }[] = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">E-Commerce</h1>
                <p className="text-xs text-gray-500">Manage your online store</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition">
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                activeTab === tab.id
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={DollarSign} label="Total Revenue" value={`$${s.totalRevenue.toLocaleString()}`} sublabel={`$${s.revenueToday} today`} color="green" />
              <StatCard icon={ShoppingCart} label="Total Orders" value={s.totalOrders.toString()} sublabel={`${s.ordersToday} today`} color="blue" />
              <StatCard icon={Package} label="Products" value={s.totalProducts.toString()} sublabel={`${s.lowStockProducts} low stock`} color="purple" />
              <StatCard icon={TrendingUp} label="Avg. Order" value={`$${s.averageOrderValue}`} sublabel={`${s.pendingOrders} pending`} color="amber" />
            </div>

            {/* Top products and recent orders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Products */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h2>
                <div className="space-y-4">
                  {s.topProducts.map((product, i) => (
                    <div key={product.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">{i + 1}</span>
                        <span className="text-sm text-gray-900">{product.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">${product.revenue}</p>
                        <p className="text-xs text-gray-500">{product.sales} sales</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
                <div className="space-y-3">
                  {s.recentOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{order.id}</p>
                        <p className="text-xs text-gray-500">{order.customer.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <OrderStatusBadge status={order.status} />
                        <span className="text-sm font-medium text-gray-900">${order.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Search and filters */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>

            {/* Products grid */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Product</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Price</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Stock</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Sales</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          product.status === 'publish' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {product.status === 'publish' ? 'Active' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          {product.salePrice ? (
                            <>
                              <span className="text-sm font-medium text-gray-900">${product.salePrice}</span>
                              <span className="text-xs text-gray-400 line-through ml-1">${product.price}</span>
                            </>
                          ) : (
                            <span className="text-sm font-medium text-gray-900">${product.price}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm ${product.stockQuantity < 10 ? 'text-amber-600' : 'text-gray-900'}`}>
                          {product.stockQuantity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{product.totalSales}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Quick filters */}
            <div className="flex items-center gap-2">
              {['All', 'Pending', 'Processing', 'Shipped', 'Completed'].map((filter) => (
                <button
                  key={filter}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Orders table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Order</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Customer</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Items</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Total</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-indigo-600">{order.id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{order.customer.name}</p>
                          <p className="text-xs text-gray-500">{order.customer.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{order.items.length} item{order.items.length > 1 ? 's' : ''}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">${order.total}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">{new Date(order.dateCreated).toLocaleDateString()}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Gateways</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Stripe</p>
                      <p className="text-xs text-gray-500">Accept credit card payments</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">Configure</button>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">PayPal</p>
                      <p className="text-xs text-gray-500">Accept PayPal payments</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">Configure</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components

function StatCard({ icon: Icon, label, value, sublabel, color }: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sublabel: string;
  color: 'green' | 'blue' | 'purple' | 'amber';
}) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sublabel}</p>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: Order['status'] }) {
  const config = {
    pending: { icon: Clock, color: 'bg-amber-100 text-amber-700', label: 'Pending' },
    processing: { icon: Loader2, color: 'bg-blue-100 text-blue-700', label: 'Processing' },
    shipped: { icon: Truck, color: 'bg-purple-100 text-purple-700', label: 'Shipped' },
    completed: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
    refunded: { icon: RefreshCw, color: 'bg-gray-100 text-gray-700', label: 'Refunded' },
    cancelled: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Cancelled' },
  };

  const { icon: StatusIcon, color, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <StatusIcon className="w-3 h-3" />
      {label}
    </span>
  );
}

// Mock data

function getMockStats(): EcommerceStats {
  return {
    totalOrders: 256,
    totalRevenue: 24850,
    totalProducts: 42,
    averageOrderValue: 97,
    ordersToday: 8,
    revenueToday: 782,
    pendingOrders: 5,
    lowStockProducts: 3,
    topProducts: [
      { id: '1', name: 'Premium T-Shirt', sales: 45, revenue: 1350 },
      { id: '2', name: 'Wireless Earbuds', sales: 32, revenue: 2560 },
      { id: '3', name: 'Canvas Backpack', sales: 28, revenue: 1400 },
    ],
    recentOrders: getMockOrders(),
  };
}

function getMockProducts(): Product[] {
  return [
    { id: '1', name: 'Premium Cotton T-Shirt', slug: 'premium-cotton-t-shirt', status: 'publish', price: '29.99', salePrice: '24.99', sku: 'TSH-001', stockQuantity: 150, stockStatus: 'instock', categories: ['Clothing'], images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'], description: '', shortDescription: '', dateCreated: '', totalSales: 45 },
    { id: '2', name: 'Wireless Bluetooth Earbuds', slug: 'wireless-earbuds', status: 'publish', price: '79.99', salePrice: null, sku: 'EAR-002', stockQuantity: 75, stockStatus: 'instock', categories: ['Electronics'], images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400'], description: '', shortDescription: '', dateCreated: '', totalSales: 32 },
    { id: '3', name: 'Canvas Travel Backpack', slug: 'canvas-backpack', status: 'publish', price: '49.99', salePrice: null, sku: 'BAG-003', stockQuantity: 8, stockStatus: 'instock', categories: ['Accessories'], images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400'], description: '', shortDescription: '', dateCreated: '', totalSales: 28 },
    { id: '4', name: 'Stainless Steel Water Bottle', slug: 'water-bottle', status: 'publish', price: '24.99', salePrice: '19.99', sku: 'BTL-004', stockQuantity: 200, stockStatus: 'instock', categories: ['Accessories'], images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400'], description: '', shortDescription: '', dateCreated: '', totalSales: 56 },
    { id: '5', name: 'Minimalist Watch', slug: 'minimalist-watch', status: 'draft', price: '149.99', salePrice: null, sku: 'WTC-005', stockQuantity: 25, stockStatus: 'instock', categories: ['Accessories'], images: ['https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400'], description: '', shortDescription: '', dateCreated: '', totalSales: 12 },
  ];
}

function getMockOrders(): Order[] {
  return [
    { id: 'ORD-1001', status: 'completed', customer: { name: 'John Smith', email: 'john@example.com' }, items: [{ name: 'Premium Cotton T-Shirt', quantity: 2, price: '24.99' }], total: '49.98', dateCreated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), paymentMethod: 'Stripe' },
    { id: 'ORD-1002', status: 'processing', customer: { name: 'Sarah Johnson', email: 'sarah@example.com' }, items: [{ name: 'Wireless Bluetooth Earbuds', quantity: 1, price: '79.99' }], total: '129.98', dateCreated: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), paymentMethod: 'PayPal' },
    { id: 'ORD-1003', status: 'pending', customer: { name: 'Mike Davis', email: 'mike@example.com' }, items: [{ name: 'Stainless Steel Water Bottle', quantity: 3, price: '19.99' }], total: '59.97', dateCreated: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), paymentMethod: 'Stripe' },
    { id: 'ORD-1004', status: 'shipped', customer: { name: 'Emily Brown', email: 'emily@example.com' }, items: [{ name: 'Minimalist Watch', quantity: 1, price: '149.99' }], total: '149.99', dateCreated: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), paymentMethod: 'Stripe' },
    { id: 'ORD-1005', status: 'refunded', customer: { name: 'Alex Wilson', email: 'alex@example.com' }, items: [{ name: 'Premium Cotton T-Shirt', quantity: 1, price: '29.99' }], total: '29.99', dateCreated: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), paymentMethod: 'PayPal' },
  ];
}
