/**
 * Static Offers Data
 * Fallback data for bundle offers when API is unavailable
 */

// Offer images - optimized URLs
const OFFER_IMAGES = [
  'https://customer-assets.emergentagent.com/job_run-al-project/artifacts/04kxu3h3_car-brake-parts-and-components-displayed-on-a-whit-2025-12-08-16-53-24-utc.jpg',
  'https://customer-assets.emergentagent.com/job_run-al-project/artifacts/e0wpx2r9_car-parts-2025-02-25-15-02-08-utc.jpg',
  'https://customer-assets.emergentagent.com/job_run-al-project/artifacts/yt3zfrnf_car-parts-2025-02-24-20-10-48-utc%20%282%29.jpg',
];

export interface StaticOffer {
  id: string;
  title: string;
  title_ar: string;
  subtitle: string;
  subtitle_ar: string;
  car: string;
  car_ar: string;
  car_model_id: string;
  gradient: string[];
  overlayGradient: string[];
  products: string[];
  originalPrice: number;
  discount: number;
  finalPrice: number;
  image: string;
  accentColor: string;
  iconBg: string;
}

// Calculate discount based on price tier
const calculateDiscount = (price: number): number => {
  if (price > 1000) return 15;
  if (price > 500) return 13;
  if (price > 100) return 10;
  return 0;
};

// Calculate final price after discount
const calculateFinalPrice = (originalPrice: number, discount: number): number => {
  return +(originalPrice * (1 - discount / 100)).toFixed(2);
};

// Static offers data
export const staticOffers: StaticOffer[] = [
  {
    id: 'offer-1',
    title: 'Brake System Bundle',
    title_ar: 'حزمة نظام الفرامل',
    subtitle: 'Oil Filter + Air Filter + Spark Plugs',
    subtitle_ar: 'فلتر زيت + فلتر هواء + شمعات',
    car: 'Toyota Camry (2018-2024)',
    car_ar: 'تويوتا كامري (2018-2024)',
    car_model_id: 'cm_camry',
    gradient: ['rgba(102, 126, 234, 0.85)', 'rgba(118, 75, 162, 0.9)'],
    overlayGradient: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.75)'],
    products: ['prod_oil_filter_1', 'prod_air_filter_1', 'prod_spark_plug_1'],
    originalPrice: 171.48,
    get discount() { return calculateDiscount(this.originalPrice); },
    get finalPrice() { return calculateFinalPrice(this.originalPrice, this.discount); },
    image: OFFER_IMAGES[0],
    accentColor: '#667EEA',
    iconBg: '#FF6B35',
  },
  {
    id: 'offer-2',
    title: 'Power Pack Bundle',
    title_ar: 'حزمة الطاقة المتكاملة',
    subtitle: 'Shock Absorber + Battery + Oil Filter',
    subtitle_ar: 'ممتص صدمات + بطارية + فلتر زيت',
    car: 'Toyota Hilux (2016-2024)',
    car_ar: 'تويوتا هايلكس (2016-2024)',
    car_model_id: 'cm_hilux',
    gradient: ['rgba(17, 153, 142, 0.85)', 'rgba(56, 239, 125, 0.9)'],
    overlayGradient: ['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.7)'],
    products: ['prod_shock_1', 'prod_battery_1', 'prod_oil_filter_1'],
    originalPrice: 355.99,
    get discount() { return calculateDiscount(this.originalPrice); },
    get finalPrice() { return calculateFinalPrice(this.originalPrice, this.discount); },
    image: OFFER_IMAGES[1],
    accentColor: '#11998E',
    iconBg: '#FFD93D',
  },
  {
    id: 'offer-3',
    title: 'Premium Combo Deal',
    title_ar: 'صفقة الكومبو المميزة',
    subtitle: 'Battery + Spark Plugs + Air Filter',
    subtitle_ar: 'بطارية + شمعات + فلتر هواء',
    car: 'Mitsubishi Lancer (2015-2020)',
    car_ar: 'ميتسوبيشي لانسر (2015-2020)',
    car_model_id: 'cm_lancer',
    gradient: ['rgba(255, 107, 107, 0.85)', 'rgba(255, 142, 83, 0.9)'],
    overlayGradient: ['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.65)'],
    products: ['prod_battery_1', 'prod_spark_plug_1', 'prod_air_filter_1'],
    originalPrice: 310.49,
    get discount() { return calculateDiscount(this.originalPrice); },
    get finalPrice() { return calculateFinalPrice(this.originalPrice, this.discount); },
    image: OFFER_IMAGES[2],
    accentColor: '#FF6B6B',
    iconBg: '#4ECDC4',
  },
];

// Export for backwards compatibility
export const offers = staticOffers;

export default staticOffers;
