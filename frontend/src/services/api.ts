/**
 * API Service for Al-Ghazaly Auto Parts
 * Handles all API calls with axios
 */
import axios from 'axios';
import Constants from 'expo-constants';

const API_BASE_URL = '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Auth APIs
export const authApi = {
  exchangeSession: (sessionId: string) => api.post('/auth/session', { session_id: sessionId }),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Car Brand APIs
export const carBrandApi = {
  getAll: () => api.get('/car-brands'),
  create: (data: any) => api.post('/car-brands', data),
  delete: (id: string) => api.delete(`/car-brands/${id}`),
};

// Car Model APIs
export const carModelApi = {
  getAll: (brandId?: string) => api.get('/car-models', { params: { brand_id: brandId } }),
  getById: (id: string) => api.get(`/car-models/${id}`),
  create: (data: any) => api.post('/car-models', data),
  update: (id: string, data: any) => api.put(`/car-models/${id}`, data),
  delete: (id: string) => api.delete(`/car-models/${id}`),
};

// Product Brand APIs
export const productBrandApi = {
  getAll: () => api.get('/product-brands'),
  create: (data: any) => api.post('/product-brands', data),
  delete: (id: string) => api.delete(`/product-brands/${id}`),
};

// Category APIs
export const categoryApi = {
  getAll: () => api.get('/categories/all'),
  getTree: () => api.get('/categories/tree'),
  create: (data: any) => api.post('/categories', data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Product APIs
export const productApi = {
  getAll: (params?: any) => api.get('/products', { params }),
  getAllAdmin: () => api.get('/products/all'),
  getById: (id: string) => api.get(`/products/${id}`),
  search: (q: string) => api.get('/products/search', { params: { q } }),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  updatePrice: (id: string, price: number) => api.patch(`/products/${id}/price`, { price }),
  updateHidden: (id: string, hidden: boolean) => api.patch(`/products/${id}/hidden`, { hidden_status: hidden }),
  delete: (id: string) => api.delete(`/products/${id}`),
};

// Cart APIs (Unified Server-Side Cart)
export const cartApi = {
  get: () => api.get('/cart'),
  add: (productId: string, quantity: number, options?: {
    bundle_group_id?: string;
    bundle_offer_id?: string;
    bundle_discount_percentage?: number;
  }) => api.post('/cart/add', { 
    product_id: productId, 
    quantity,
    ...options
  }),
  addItem: (productId: string, quantity: number) => api.post('/cart/add', { product_id: productId, quantity }),
  addEnhanced: (item: {
    product_id: string;
    quantity: number;
    original_unit_price?: number;
    final_unit_price?: number;
    discount_details?: any;
    bundle_group_id?: string;
    added_by_admin_id?: string;
  }) => api.post('/cart/add-enhanced', item),
  update: (productId: string, quantity: number) => api.put('/cart/update', { product_id: productId, quantity }),
  updateItem: (productId: string, quantity: number) => api.put('/cart/update', { product_id: productId, quantity }),
  voidBundle: (bundleGroupId: string) => api.delete(`/cart/void-bundle/${bundleGroupId}`),
  clear: () => api.delete('/cart/clear'),
};

// Order APIs (Enhanced with Admin-Assisted Orders)
export const orderApi = {
  getAll: () => api.get('/orders'),
  getAllAdmin: () => api.get('/orders/all'),
  create: (data: any) => api.post('/orders', data),
  createAdminAssisted: (data: {
    customer_id: string;
    items: Array<{
      product_id: string;
      quantity: number;
      original_unit_price?: number;
      final_unit_price?: number;
      discount_details?: any;
      bundle_group_id?: string;
    }>;
    shipping_address: string;
    phone: string;
    notes?: string;
  }) => api.post('/orders/admin-assisted', data),
  updateStatus: (id: string, status: string) => api.patch(`/orders/${id}/status`, null, { params: { status } }),
  delete: (id: string) => api.delete(`/orders/${id}`),
  getPendingCount: (userId: string) => api.get(`/orders/pending-count/${userId}`),
};

// Legacy aliases
export const ordersApi = orderApi;

// Customer APIs
export const customerApi = {
  getAll: (sortBy?: string) => api.get('/customers', { params: { sort_by: sortBy } }),
  getById: (id: string) => api.get(`/customers/${id}`),
};

// Favorite APIs
export const favoriteApi = {
  getAll: () => api.get('/favorites'),
  check: (productId: string) => api.get(`/favorites/check/${productId}`),
  toggle: (productId: string) => api.post('/favorites/toggle', { product_id: productId }),
};

// Comment APIs
export const commentApi = {
  getForProduct: (productId: string) => api.get(`/products/${productId}/comments`),
  create: (productId: string, text: string, rating?: number) => 
    api.post(`/products/${productId}/comments`, { text, rating }),
};

// Partner APIs
export const partnerApi = {
  getAll: () => api.get('/partners'),
  create: (email: string) => api.post('/partners', { email }),
  delete: (id: string) => api.delete(`/partners/${id}`),
};

// Admin APIs
export const adminApi = {
  getAll: () => api.get('/admins'),
  create: (email: string, name?: string) => api.post('/admins', { email, name }),
  delete: (id: string) => api.delete(`/admins/${id}`),
  getProducts: (adminId: string) => api.get(`/admins/${adminId}/products`),
  settleRevenue: (adminId: string, productIds: string[], totalAmount: number) =>
    api.post(`/admins/${adminId}/settle`, { admin_id: adminId, product_ids: productIds, total_amount: totalAmount }),
  clearRevenue: (adminId: string) => api.post(`/admins/${adminId}/clear-revenue`),
};

// Supplier APIs
export const supplierApi = {
  getAll: () => api.get('/suppliers'),
  getById: (id: string) => api.get(`/suppliers/${id}`),
  create: (data: any) => api.post('/suppliers', data),
  update: (id: string, data: any) => api.put(`/suppliers/${id}`, data),
  delete: (id: string) => api.delete(`/suppliers/${id}`),
};

// Distributor APIs
export const distributorApi = {
  getAll: () => api.get('/distributors'),
  getById: (id: string) => api.get(`/distributors/${id}`),
  create: (data: any) => api.post('/distributors', data),
  update: (id: string, data: any) => api.put(`/distributors/${id}`, data),
  delete: (id: string) => api.delete(`/distributors/${id}`),
};

// Subscriber APIs
export const subscriberApi = {
  getAll: () => api.get('/subscribers'),
  create: (email: string) => api.post('/subscribers', { email }),
  delete: (id: string) => api.delete(`/subscribers/${id}`),
};

// Subscription Request APIs
export const subscriptionRequestApi = {
  getAll: () => api.get('/subscription-requests'),
  create: (data: any) => api.post('/subscription-requests', data),
  approve: (id: string) => api.patch(`/subscription-requests/${id}/approve`),
  delete: (id: string) => api.delete(`/subscription-requests/${id}`),
};

// Notification APIs
export const notificationApi = {
  getAll: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/mark-all-read'),
};

// Analytics APIs
export const analyticsApi = {
  getOverview: (startDate?: string, endDate?: string) => 
    api.get('/analytics/overview', { params: { start_date: startDate, end_date: endDate } }),
};

// Collection APIs
export const collectionApi = {
  getAll: (adminId?: string) => api.get('/collections', { params: { admin_id: adminId } }),
};

// Sync APIs
export const syncApi = {
  pull: (lastPulledAt?: number, tables?: string[]) => 
    api.post('/sync/pull', { last_pulled_at: lastPulledAt, tables }),
};

// ==================== Marketing System APIs ====================

// Promotion APIs
export const promotionApi = {
  getAll: (promotionType?: string, activeOnly?: boolean) => 
    api.get('/promotions', { params: { promotion_type: promotionType, active_only: activeOnly } }),
  getById: (id: string) => api.get(`/promotions/${id}`),
  create: (data: any) => api.post('/promotions', data),
  update: (id: string, data: any) => api.put(`/promotions/${id}`, data),
  reorder: (id: string, sortOrder: number) => api.patch(`/promotions/${id}/reorder`, { sort_order: sortOrder }),
  delete: (id: string) => api.delete(`/promotions/${id}`),
};

// Bundle Offer APIs
export const bundleOfferApi = {
  getAll: (activeOnly?: boolean) => api.get('/bundle-offers', { params: { active_only: activeOnly } }),
  getById: (id: string) => api.get(`/bundle-offers/${id}`),
  create: (data: any) => api.post('/bundle-offers', data),
  update: (id: string, data: any) => api.put(`/bundle-offers/${id}`, data),
  delete: (id: string) => api.delete(`/bundle-offers/${id}`),
};

// Combined Marketing APIs
export const marketingApi = {
  getHomeSlider: () => api.get('/marketing/home-slider'),
};

// Legacy aliases for backwards compatibility
export const categoriesApi = {
  getAll: categoryApi.getAll,
  getTree: categoryApi.getTree,
  create: categoryApi.create,
  delete: categoryApi.delete,
};

export const carBrandsApi = carBrandApi;
export const carModelsApi = carModelApi;
export const productBrandsApi = productBrandApi;
export const productsApi = productApi;
export const favoritesApi = favoriteApi;

export default api;
