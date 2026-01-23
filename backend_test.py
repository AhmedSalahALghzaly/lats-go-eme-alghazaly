#!/usr/bin/env python3
"""
Al-Ghazaly Auto Parts Backend API v4.1.0 - Comprehensive Testing Suite

This test suite covers all critical backend endpoints for the auto parts e-commerce system:
1. Health Check & Version Info
2. Product Management APIs
3. Cart System APIs (requires authentication)
4. Order Management APIs
5. Marketing APIs (Promotions & Bundle Offers)
6. Analytics APIs
7. Authentication & Authorization
8. Admin & Owner Panel APIs

Backend URL: http://localhost:8001
API Prefix: /api
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional

class AlGhazalyAPITester:
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session = requests.Session()
        self.test_results = []
        self.auth_token = None
        
        # Test data for creating resources
        self.test_product_data = {
            "name": "Test Brake Pad",
            "name_ar": "فرامل اختبار",
            "description": "High quality brake pad for testing",
            "description_ar": "فرامل عالية الجودة للاختبار",
            "sku": f"TEST-BP-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "price": 150.00,
            "stock_quantity": 50,
            "category_id": "cat_brake_parts",
            "product_brand_id": "pb_bosch",
            "compatible_car_models": ["cm_corolla", "cm_camry"],
            "images": ["https://example.com/brake-pad.jpg"],
            "specifications": {
                "material": "Ceramic",
                "warranty": "2 years"
            }
        }
        
        self.test_cart_item = {
            "product_id": "prod_brake_pad_001",
            "quantity": 2,
            "notes": "Test cart item"
        }

    def log_test(self, test_name: str, success: bool, details: str, response_data: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        print(f"{status}: {test_name} - {details}")

    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None, 
                    auth_required: bool = False) -> tuple[bool, Any, str]:
        """Make HTTP request and handle common patterns"""
        url = f"{self.api_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if auth_required and self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, params=params, headers=headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, params=params, headers=headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, params=params, headers=headers)
            elif method.upper() == "PATCH":
                response = self.session.patch(url, json=data, params=params, headers=headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers)
            else:
                return False, None, f"Unsupported method: {method}"
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return True, response, response_data
        except requests.exceptions.RequestException as e:
            return False, None, f"Request failed: {str(e)}"

    def test_health_check(self):
        """Test health check endpoint"""
        success, response, data = self.make_request("GET", "/health")
        
        if not success:
            self.log_test("Health Check", False, f"Request failed: {data}")
            return
        
        if response.status_code == 200:
            if isinstance(data, dict) and "status" in data and "api_version" in data:
                version = data.get("api_version", "unknown")
                status = data.get("status", "unknown")
                self.log_test("Health Check", True, f"API v{version} is {status}", data)
            else:
                self.log_test("Health Check", False, "Invalid response format", data)
        else:
            self.log_test("Health Check", False, f"HTTP {response.status_code}: {data}")

    def test_version_info(self):
        """Test version endpoint"""
        success, response, data = self.make_request("GET", "/version")
        
        if not success:
            self.log_test("Version Info", False, f"Request failed: {data}")
            return
        
        if response.status_code == 200:
            if isinstance(data, dict) and "api_version" in data:
                version = data.get("api_version", "unknown")
                features = data.get("features", [])
                self.log_test("Version Info", True, f"API v{version} with {len(features)} features", data)
            else:
                self.log_test("Version Info", False, "Invalid response format", data)
        else:
            self.log_test("Version Info", False, f"HTTP {response.status_code}: {data}")

    def test_root_endpoint(self):
        """Test root endpoint"""
        success, response, data = self.make_request("GET", "")
        
        if not success:
            # Try without /api prefix
            try:
                response = self.session.get(self.base_url)
                data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                success = True
            except:
                self.log_test("Root Endpoint", False, f"Request failed: {data}")
                return
        
        if response.status_code == 200:
            if isinstance(data, dict) and "message" in data:
                message = data.get("message", "")
                version = data.get("version", "unknown")
                self.log_test("Root Endpoint", True, f"'{message}' v{version}", data)
            else:
                self.log_test("Root Endpoint", True, "Root endpoint accessible", data)
        else:
            self.log_test("Root Endpoint", False, f"HTTP {response.status_code}: {data}")

    def test_products_api(self):
        """Test products API endpoints"""
        # Test GET /products
        success, response, data = self.make_request("GET", "/products")
        
        if not success:
            self.log_test("Products GET", False, f"Request failed: {data}")
            return
        
        if response.status_code == 200:
            if isinstance(data, dict):
                products = data.get("items", data.get("products", []))
                total = data.get("total", len(products) if isinstance(products, list) else 0)
                self.log_test("Products GET", True, f"Found {total} products", {"count": total})
            else:
                self.log_test("Products GET", False, "Invalid response format", data)
        else:
            self.log_test("Products GET", False, f"HTTP {response.status_code}: {data}")

        # Test POST /products (should require auth)
        success, response, data = self.make_request("POST", "/products", self.test_product_data)
        
        if not success:
            self.log_test("Products POST (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Products POST (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        elif response.status_code == 201:
            self.log_test("Products POST (No Auth)", False, "SECURITY ISSUE: Created product without authentication", data)
        else:
            self.log_test("Products POST (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

    def test_categories_api(self):
        """Test categories API endpoints"""
        success, response, data = self.make_request("GET", "/categories")
        
        if not success:
            self.log_test("Categories GET", False, f"Request failed: {data}")
            return
        
        if response.status_code == 200:
            if isinstance(data, list):
                count = len(data)
                self.log_test("Categories GET", True, f"Found {count} categories", {"count": count})
            elif isinstance(data, dict):
                categories = data.get("items", data.get("categories", []))
                count = len(categories) if isinstance(categories, list) else data.get("total", 0)
                self.log_test("Categories GET", True, f"Found {count} categories", {"count": count})
            else:
                self.log_test("Categories GET", False, "Invalid response format", data)
        else:
            self.log_test("Categories GET", False, f"HTTP {response.status_code}: {data}")

    def test_car_brands_api(self):
        """Test car brands API endpoints"""
        success, response, data = self.make_request("GET", "/car-brands")
        
        if not success:
            self.log_test("Car Brands GET", False, f"Request failed: {data}")
            return
        
        if response.status_code == 200:
            if isinstance(data, list):
                count = len(data)
                self.log_test("Car Brands GET", True, f"Found {count} car brands", {"count": count})
            elif isinstance(data, dict):
                brands = data.get("items", data.get("brands", []))
                count = len(brands) if isinstance(brands, list) else data.get("total", 0)
                self.log_test("Car Brands GET", True, f"Found {count} car brands", {"count": count})
            else:
                self.log_test("Car Brands GET", False, "Invalid response format", data)
        else:
            self.log_test("Car Brands GET", False, f"HTTP {response.status_code}: {data}")

    def test_car_models_api(self):
        """Test car models API endpoints"""
        success, response, data = self.make_request("GET", "/car-models")
        
        if not success:
            self.log_test("Car Models GET", False, f"Request failed: {data}")
            return
        
        if response.status_code == 200:
            if isinstance(data, list):
                count = len(data)
                self.log_test("Car Models GET", True, f"Found {count} car models", {"count": count})
            elif isinstance(data, dict):
                models = data.get("items", data.get("models", []))
                count = len(models) if isinstance(models, list) else data.get("total", 0)
                self.log_test("Car Models GET", True, f"Found {count} car models", {"count": count})
            else:
                self.log_test("Car Models GET", False, "Invalid response format", data)
        else:
            self.log_test("Car Models GET", False, f"HTTP {response.status_code}: {data}")

    def test_product_brands_api(self):
        """Test product brands API endpoints"""
        success, response, data = self.make_request("GET", "/product-brands")
        
        if not success:
            self.log_test("Product Brands GET", False, f"Request failed: {data}")
            return
        
        if response.status_code == 200:
            if isinstance(data, list):
                count = len(data)
                self.log_test("Product Brands GET", True, f"Found {count} product brands", {"count": count})
            elif isinstance(data, dict):
                brands = data.get("items", data.get("brands", []))
                count = len(brands) if isinstance(brands, list) else data.get("total", 0)
                self.log_test("Product Brands GET", True, f"Found {count} product brands", {"count": count})
            else:
                self.log_test("Product Brands GET", False, "Invalid response format", data)
        else:
            self.log_test("Product Brands GET", False, f"HTTP {response.status_code}: {data}")

    def test_cart_api(self):
        """Test cart API endpoints (should require authentication)"""
        # Test GET /cart
        success, response, data = self.make_request("GET", "/cart")
        
        if not success:
            self.log_test("Cart GET (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Cart GET (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        elif response.status_code == 200:
            self.log_test("Cart GET (No Auth)", False, "SECURITY ISSUE: Cart accessible without authentication", data)
        else:
            self.log_test("Cart GET (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

        # Test POST /cart/add
        success, response, data = self.make_request("POST", "/cart/add", self.test_cart_item)
        
        if not success:
            self.log_test("Cart ADD (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Cart ADD (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        elif response.status_code in [200, 201]:
            self.log_test("Cart ADD (No Auth)", False, "SECURITY ISSUE: Cart add accessible without authentication", data)
        else:
            self.log_test("Cart ADD (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

        # Test PUT /cart/update
        update_data = {"product_id": "prod_test", "quantity": 3}
        success, response, data = self.make_request("PUT", "/cart/update", update_data)
        
        if not success:
            self.log_test("Cart UPDATE (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Cart UPDATE (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        else:
            self.log_test("Cart UPDATE (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

        # Test DELETE /cart/clear
        success, response, data = self.make_request("DELETE", "/cart/clear")
        
        if not success:
            self.log_test("Cart CLEAR (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Cart CLEAR (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        else:
            self.log_test("Cart CLEAR (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

        # Test POST /cart/validate-stock
        stock_data = {"items": [{"product_id": "prod_test", "quantity": 1}]}
        success, response, data = self.make_request("POST", "/cart/validate-stock", stock_data)
        
        if not success:
            self.log_test("Cart VALIDATE-STOCK (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Cart VALIDATE-STOCK (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        else:
            self.log_test("Cart VALIDATE-STOCK (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

        # Test DELETE /cart/void-bundle/{bundle_group_id}
        success, response, data = self.make_request("DELETE", "/cart/void-bundle/test_bundle_123")
        
        if not success:
            self.log_test("Cart VOID-BUNDLE (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Cart VOID-BUNDLE (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        else:
            self.log_test("Cart VOID-BUNDLE (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

    def test_orders_api(self):
        """Test orders API endpoints"""
        # Test GET /orders (should require auth)
        success, response, data = self.make_request("GET", "/orders")
        
        if not success:
            self.log_test("Orders GET (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Orders GET (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        else:
            self.log_test("Orders GET (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

        # Test POST /orders (should require auth)
        order_data = {
            "first_name": "Ahmed",
            "last_name": "Hassan",
            "email": "ahmed.hassan@example.com",
            "phone": "+966501234567",
            "street_address": "123 King Fahd Road",
            "city": "Riyadh",
            "state": "Riyadh Province",
            "postal_code": "12345",
            "country": "Saudi Arabia",
            "order_source": "customer_app"
        }
        success, response, data = self.make_request("POST", "/orders", order_data)
        
        if not success:
            self.log_test("Orders POST (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Orders POST (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        elif response.status_code in [200, 201]:
            self.log_test("Orders POST (No Auth)", False, "SECURITY ISSUE: Order creation accessible without authentication", data)
        else:
            self.log_test("Orders POST (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

    def test_promotions_api(self):
        """Test promotions API endpoints"""
        # Test GET /promotions
        success, response, data = self.make_request("GET", "/promotions")
        
        if not success:
            self.log_test("Promotions GET", False, f"Request failed: {data}")
            return
        
        if response.status_code == 200:
            if isinstance(data, list):
                count = len(data)
                self.log_test("Promotions GET", True, f"Found {count} promotions", {"count": count})
            elif isinstance(data, dict):
                promotions = data.get("items", data.get("promotions", []))
                count = len(promotions) if isinstance(promotions, list) else data.get("total", 0)
                self.log_test("Promotions GET", True, f"Found {count} promotions", {"count": count})
            else:
                self.log_test("Promotions GET", False, "Invalid response format", data)
        else:
            self.log_test("Promotions GET", False, f"HTTP {response.status_code}: {data}")

        # Test POST /promotions (should require auth)
        promo_data = {
            "title": "Test Promotion",
            "title_ar": "عرض تجريبي",
            "description": "Test promotion for API testing",
            "description_ar": "عرض تجريبي لاختبار API",
            "discount_percentage": 15.0,
            "start_date": "2024-01-01T00:00:00Z",
            "end_date": "2024-12-31T23:59:59Z",
            "target_type": "all_products",
            "is_active": True
        }
        success, response, data = self.make_request("POST", "/promotions", promo_data)
        
        if not success:
            self.log_test("Promotions POST (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Promotions POST (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        else:
            self.log_test("Promotions POST (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

    def test_bundle_offers_api(self):
        """Test bundle offers API endpoints"""
        # Test GET /bundle-offers
        success, response, data = self.make_request("GET", "/bundle-offers")
        
        if not success:
            self.log_test("Bundle Offers GET", False, f"Request failed: {data}")
            return
        
        if response.status_code == 200:
            if isinstance(data, list):
                count = len(data)
                self.log_test("Bundle Offers GET", True, f"Found {count} bundle offers", {"count": count})
            elif isinstance(data, dict):
                bundles = data.get("items", data.get("bundle_offers", []))
                count = len(bundles) if isinstance(bundles, list) else data.get("total", 0)
                self.log_test("Bundle Offers GET", True, f"Found {count} bundle offers", {"count": count})
            else:
                self.log_test("Bundle Offers GET", False, "Invalid response format", data)
        else:
            self.log_test("Bundle Offers GET", False, f"HTTP {response.status_code}: {data}")

        # Test POST /bundle-offers (should require auth)
        bundle_data = {
            "name": "Test Bundle",
            "name_ar": "حزمة تجريبية",
            "description": "Test bundle for API testing",
            "description_ar": "حزمة تجريبية لاختبار API",
            "product_ids": ["prod_brake_pad_001", "prod_oil_filter_001"],
            "discount_percentage": 20.0,
            "target_car_model": "cm_corolla",
            "is_active": True
        }
        success, response, data = self.make_request("POST", "/bundle-offers", bundle_data)
        
        if not success:
            self.log_test("Bundle Offers POST (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Bundle Offers POST (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        else:
            self.log_test("Bundle Offers POST (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

    def test_marketing_home_slider(self):
        """Test marketing home slider endpoint"""
        success, response, data = self.make_request("GET", "/marketing/home-slider")
        
        if not success:
            self.log_test("Marketing Home Slider", False, f"Request failed: {data}")
            return
        
        if response.status_code == 200:
            if isinstance(data, list):
                count = len(data)
                self.log_test("Marketing Home Slider", True, f"Found {count} slider items", {"count": count})
            elif isinstance(data, dict):
                items = data.get("items", data.get("slider_items", []))
                count = len(items) if isinstance(items, list) else data.get("total", 0)
                self.log_test("Marketing Home Slider", True, f"Found {count} slider items", {"count": count})
            else:
                self.log_test("Marketing Home Slider", False, "Invalid response format", data)
        else:
            self.log_test("Marketing Home Slider", False, f"HTTP {response.status_code}: {data}")

    def test_analytics_api(self):
        """Test analytics API endpoints"""
        # Test GET /analytics/overview
        success, response, data = self.make_request("GET", "/analytics/overview")
        
        if not success:
            self.log_test("Analytics Overview (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Analytics Overview (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        elif response.status_code == 200:
            if isinstance(data, dict):
                metrics = list(data.keys())
                self.log_test("Analytics Overview (No Auth)", False, f"SECURITY ISSUE: Analytics accessible without auth - {len(metrics)} metrics", data)
            else:
                self.log_test("Analytics Overview (No Auth)", False, "SECURITY ISSUE: Analytics accessible without auth", data)
        else:
            self.log_test("Analytics Overview (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

        # Test other analytics endpoints
        analytics_endpoints = [
            "/analytics/customers",
            "/analytics/products", 
            "/analytics/orders",
            "/analytics/revenue",
            "/analytics/admin-performance"
        ]
        
        for endpoint in analytics_endpoints:
            success, response, data = self.make_request("GET", endpoint)
            endpoint_name = endpoint.split("/")[-1].title()
            
            if not success:
                self.log_test(f"Analytics {endpoint_name} (No Auth)", False, f"Request failed: {data}")
            elif response.status_code in [401, 403]:
                self.log_test(f"Analytics {endpoint_name} (No Auth)", True, f"Properly secured - HTTP {response.status_code}")
            elif response.status_code == 200:
                self.log_test(f"Analytics {endpoint_name} (No Auth)", False, f"SECURITY ISSUE: Analytics accessible without auth")
            else:
                self.log_test(f"Analytics {endpoint_name} (No Auth)", False, f"Unexpected response - HTTP {response.status_code}")

    def test_admin_endpoints(self):
        """Test admin-specific endpoints"""
        # Test GET /admins (should require auth)
        success, response, data = self.make_request("GET", "/admins")
        
        if not success:
            self.log_test("Admins GET (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Admins GET (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        else:
            self.log_test("Admins GET (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

        # Test GET /admins/check-access
        success, response, data = self.make_request("GET", "/admins/check-access")
        
        if not success:
            self.log_test("Admin Check Access (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Admin Check Access (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        else:
            self.log_test("Admin Check Access (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

    def test_subscribers_api(self):
        """Test subscribers API endpoints"""
        # Test GET /subscribers (should require auth)
        success, response, data = self.make_request("GET", "/subscribers")
        
        if not success:
            self.log_test("Subscribers GET (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Subscribers GET (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        else:
            self.log_test("Subscribers GET (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

        # Test GET /subscription-requests (should require auth)
        success, response, data = self.make_request("GET", "/subscription-requests")
        
        if not success:
            self.log_test("Subscription Requests GET (No Auth)", False, f"Request failed: {data}")
        elif response.status_code in [401, 403]:
            self.log_test("Subscription Requests GET (No Auth)", True, f"Properly secured - HTTP {response.status_code}", data)
        else:
            self.log_test("Subscription Requests GET (No Auth)", False, f"Unexpected response - HTTP {response.status_code}: {data}")

    def run_comprehensive_tests(self):
        """Run all backend API tests"""
        print("=" * 80)
        print("AL-GHAZALY AUTO PARTS BACKEND API v4.1.0 - COMPREHENSIVE TESTING")
        print("=" * 80)
        print(f"Testing Backend: {self.base_url}")
        print(f"API Endpoint: {self.api_url}")
        print(f"Test Started: {datetime.now().isoformat()}")
        print("=" * 80)
        
        # Core API Tests
        print("\n🔍 CORE API ENDPOINTS")
        self.test_root_endpoint()
        self.test_health_check()
        self.test_version_info()
        
        # Data API Tests
        print("\n📦 DATA API ENDPOINTS")
        self.test_products_api()
        self.test_categories_api()
        self.test_car_brands_api()
        self.test_car_models_api()
        self.test_product_brands_api()
        
        # Cart & Orders Tests
        print("\n🛒 CART & ORDER ENDPOINTS")
        self.test_cart_api()
        self.test_orders_api()
        
        # Marketing Tests
        print("\n📢 MARKETING ENDPOINTS")
        self.test_promotions_api()
        self.test_bundle_offers_api()
        self.test_marketing_home_slider()
        
        # Analytics Tests
        print("\n📊 ANALYTICS ENDPOINTS")
        self.test_analytics_api()
        
        # Admin Tests
        print("\n👨‍💼 ADMIN & USER MANAGEMENT ENDPOINTS")
        self.test_admin_endpoints()
        self.test_subscribers_api()
        
        # Generate Summary
        self.generate_summary()

    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['details']}")
        
        print(f"\n✅ PASSED TESTS ({passed_tests}):")
        for result in self.test_results:
            if result["success"]:
                print(f"  • {result['test']}: {result['details']}")
        
        # Security Analysis
        security_tests = [r for r in self.test_results if "No Auth" in r["test"]]
        secured_endpoints = sum(1 for r in security_tests if r["success"])
        total_security_tests = len(security_tests)
        
        if total_security_tests > 0:
            print(f"\n🔒 SECURITY ANALYSIS:")
            print(f"Authentication Tests: {total_security_tests}")
            print(f"Properly Secured: {secured_endpoints}")
            print(f"Security Issues: {total_security_tests - secured_endpoints}")
            
            if secured_endpoints < total_security_tests:
                print(f"\n⚠️  SECURITY ISSUES FOUND:")
                for result in security_tests:
                    if not result["success"] and "SECURITY ISSUE" in result["details"]:
                        print(f"  • {result['test']}: {result['details']}")
        
        print("=" * 80)
        return success_rate >= 75  # Consider 75%+ as acceptable

if __name__ == "__main__":
    # Allow custom backend URL via command line
    backend_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001"
    
    tester = AlGhazalyAPITester(backend_url)
    success = tester.run_comprehensive_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)