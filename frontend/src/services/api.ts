/**
 * API Service for Al-Ghazaly Auto Parts
 * Handles all API calls with axios
 */
import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get API URL from environment or use default
const getApiBaseUrl = () => {
  // For web preview, use relative path (Kubernetes ingress handles /api routing)
  if (Platform.OS === 'web') {
    return '/api';
  }
  
  // For native apps, use the backend URL from environment
  const backendUrl = Constants.expoConfig?.extra?.EXPO_BACKEND_URL;
  if (backendUrl) {
    return `${backendUrl}/api`;
  }
  
  // Fallback for development
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Token storage for authorization header
let authToken: string | null = null;

// Function to set auth token (called from auth store)
export const setApiAuthToken = (token: string | null) => {
  authToken = token;
};

// Request interceptor to add authorization header
api.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
      console.log('API Request: Adding auth header for', config.url);
    } else {
      console.log('API Request: No auth token for', config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors for debugging
    if (error.response?.status === 401) {
      console.log('API: Unauthorized request - user may need to login');
    } else if (error.response?.status === 403) {
      console.log('API: Access denied - insufficient permissions');
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authApi = {
  exchangeSession: (sessionId: string) => api.post('/auth/session', { session_id: sessionId }),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  // التحقق من صلاحية الـ Token
  validateToken: async (): Promise<{ valid: boolean; user?: any }> => {
    try {
      const response = await api.get('/auth/me');
      return { valid: true, user: response.data };
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return { valid: false };
      }
      // في حالة خطأ آخر (مثل عدم الاتصال)، نفترض أن الـ token صالح
      return { valid: true };
    }
  },
};

// Car Brand APIs
export const carBrandApi = {
  getAll: () => api.get('/car-brands'),
  create: (data: any) => api.post('/car-brands', data),
  update: (id: string, data: any) => api.put(`/car-brands/${id}`, data),
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
  update: (id: string, data: any) => api.put(`/product-brands/${id}`, data),
  delete: (id: string) => api.delete(`/product-brands/${id}`),
};

// Category APIs
export const categoryApi = {
  getAll: () => api.get('/categories/all'),
  getTree: () => api.get('/categories/tree'),
  create: (data: any) => api.post('/categories', data),
  update: (id: string, data: any) => api.put(`/categories/${id}`, data),
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
  add: (productId: string, quantity: number = 1, options?: {
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
  // Remove item from cart - uses update with quantity 0 or dedicated endpoint
  remove: (productId: string) => api.delete(`/cart/remove/${productId}`),
  voidBundle: (bundleGroupId: string) => api.delete(`/cart/void-bundle/${bundleGroupId}`),
  clear: () => api.delete('/cart/clear'),
  // Stock validation before checkout
  validateStock: () => api.post('/cart/validate-stock'),
};

// Order APIs (Enhanced with Admin-Assisted Orders)
export const orderApi = {
  getAll: () => api.get('/orders'),
  getAllAdmin: () => api.get('/orders/admin'),
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
  updateDiscount: (id: string, discount: number) => api.patch(`/orders/${id}/discount`, { discount }),
  delete: (id: string) => api.delete(`/orders/${id}`),
  getPendingCount: (userId: string) => api.get(`/orders/pending-count/${userId}`),
  getById: (id: string) => api.get(`/orders/admin/${id}`),
};

// Legacy aliases
export const ordersApi = orderApi;

// Customer APIs
export const customerApi = {
  getAll: (sortBy?: string) => api.get('/customers', { params: { sort_by: sortBy } }),
  getById: (id: string) => api.get(`/customers/${id}`),
  delete: (id: string) => api.delete(`/customers/${id}`),
  // Admin customer management - use correct /customers/ prefix
  getFavorites: (userId: string) => api.get(`/customers/admin/customer/${userId}/favorites`),
  getCart: (userId: string) => api.get(`/customers/admin/customer/${userId}/cart`),
  getOrders: (userId: string) => api.get(`/customers/admin/customer/${userId}/orders`),
  markOrdersViewed: (userId: string) => api.patch(`/customers/admin/customer/${userId}/orders/mark-viewed`),
};

// Alias for existing code
export const customersApi = customerApi;

// Favorite APIs
export const favoriteApi = {
  getAll: () => api.get('/favorites'),
  check: (productId: string) => api.get(`/favorites/check/${productId}`),
  toggle: (productId: string) => api.post('/favorites/toggle', { product_id: productId }),
};

// Alias for existing code
export const favoritesApi = favoriteApi;

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
  getById: (id: string) => api.get(`/admins/${id}`),
  checkAccess: () => api.get('/admins/check-access'),  // Bug Fix #3: For access control checks
  create: (email: string, name?: string) => api.post('/admins', { email, name }),
  update: (id: string, data: { email: string; name?: string }) => api.put(`/admins/${id}`, data),
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

// Subscriber APIs - Extended with all CRUD operations
export const subscriberApi = {
  getAll: () => api.get('/subscribers'),
  getById: (id: string) => api.get(`/subscribers/${id}`),
  create: (email: string) => api.post('/subscribers', { email }),
  update: (id: string, data: any) => api.put(`/subscribers/${id}`, data),
  delete: (id: string) => api.delete(`/subscribers/${id}`),
};

// Subscription Request APIs - Extended with reject endpoint
export const subscriptionRequestApi = {
  getAll: () => api.get('/subscription-requests'),
  create: (data: any) => api.post('/subscription-requests', data),
  approve: (id: string) => api.patch(`/subscription-requests/${id}/approve`),
  reject: (id: string) => api.patch(`/subscription-requests/${id}/reject`),
  delete: (id: string) => api.delete(`/subscription-requests/${id}`),
  getStatus: (email?: string, phone?: string) => 
    api.get('/subscription-status', { params: { email, phone } }),
};

// Notification APIs
export const notificationApi = {
  getAll: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/mark-all-read'),
};

// Analytics API - Extended with all sub-endpoints
export const analyticsApi = {
  // Overview analytics (original)
  getOverview: (params?: { start_date?: string; end_date?: string }) => 
    api.get('/analytics/overview', { params }),
  
  // Collections analytics (original)
  getCollections: (params?: { admin_id?: string }) => 
    api.get('/analytics/collections', { params }),
  
  // NEW: Customer analytics
  getCustomers: (params?: { start_date?: string; end_date?: string }) => 
    api.get('/analytics/customers', { params }),
  
  // NEW: Product analytics
  getProducts: (params?: { start_date?: string; end_date?: string }) => 
    api.get('/analytics/products', { params }),
  
  // NEW: Order analytics
  getOrders: (params?: { start_date?: string; end_date?: string }) => 
    api.get('/analytics/orders', { params }),
  
  // NEW: Revenue analytics
  getRevenue: (params?: { start_date?: string; end_date?: string }) => 
    api.get('/analytics/revenue', { params }),
  
  // NEW: Admin performance analytics
  getAdminPerformance: (params?: { start_date?: string; end_date?: string }) => 
    api.get('/analytics/admin-performance', { params }),
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
  getAll: (promotionType?: string, activeOnly: boolean = true) => 
    api.get('/promotions', { params: { promotion_type: promotionType, active_only: activeOnly } }),
  getAllForAdmin: (promotionType?: string) => 
    api.get('/promotions', { params: { promotion_type: promotionType, active_only: false } }),
  getById: (id: string) => api.get(`/promotions/${id}`),
  create: (data: any) => api.post('/promotions', data),
  update: (id: string, data: any) => api.put(`/promotions/${id}`, data),
  reorder: (id: string, sortOrder: number) => api.patch(`/promotions/${id}/reorder`, { sort_order: sortOrder }),
  delete: (id: string) => api.delete(`/promotions/${id}`),
};

// Bundle Offer APIs
export const bundleOfferApi = {
  getAll: (activeOnly: boolean = true) => api.get('/bundle-offers', { params: { active_only: activeOnly } }),
  getAllForAdmin: () => api.get('/bundle-offers', { params: { active_only: false } }),
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

export default api;
