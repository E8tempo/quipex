export type Money = string | number;

export interface CategoryBrief {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  image: string | null;
}

export interface CategoryNode extends CategoryBrief {
  cover: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: number;
  children: CategoryNode[];
}

export interface CategoryDetail extends CategoryBrief {
  cover: string | null;
  description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  product_count: number;
  breadcrumbs: CategoryBrief[];
  children: CategoryNode[];
}

export interface Attribute {
  group?: string | null;
  name: string;
  value: string;
}

export interface ProductCard {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  brand: string | null;
  price: Money;
  old_price: Money | null;
  wholesale_price: Money | null;
  in_stock: boolean;
  is_new: boolean;
  is_featured: boolean;
  image: string | null;
  images: string[];
  category: CategoryBrief | null;
  highlights: Attribute[];
  rating: number | null;
  reviews_count: number;
}

export interface ImageItem {
  id: number;
  url: string;
  alt: string | null;
  sort_order: number;
}

export interface DocumentItem {
  title: string;
  url: string;
  size?: string | null;
}

export interface ProductDetail extends ProductCard {
  description: string | null;
  short_description: string | null;
  stock_qty: number | null;
  gallery: ImageItem[];
  specs: { name: string | null; items: Attribute[] }[];
  documents: DocumentItem[];
  breadcrumbs: CategoryBrief[];
  meta_title: string | null;
  meta_description: string | null;
}

export interface Facet {
  name: string;
  values: { value: string; count: number }[];
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface ProductList extends PageResult<ProductCard> {
  facets: Facet[];
  price_min: Money | null;
  price_max: Money | null;
}

export interface DeliveryMethod {
  id: string;
  title: string;
  price?: number;
}

export interface SiteSettings {
  site_name: string;
  tagline: string;
  phone: string;
  phone_secondary: string;
  email: string;
  address: string;
  work_hours: string;
  inn: string;
  legal_name: string;
  telegram: string;
  whatsapp: string;
  vk: string;
  map_embed_url: string;
  hero_title: string;
  hero_subtitle: string;
  announcement: string;
  free_delivery_from: number;
  wholesale_min_qty: number;
  wholesale_min_order_sum: number;
  wholesale_default_discount_percent: number;
  delivery_methods: DeliveryMethod[];
  payment_methods: DeliveryMethod[];
  seo_title: string;
  seo_description: string;
  pages: { slug: string; title: string }[];
}

export interface QuoteLine {
  product: ProductCard;
  quantity: number;
  price: Money;
  total: Money;
  is_wholesale_price: boolean;
  price_kind?: "retail" | "wholesale" | "partner";
}

export interface Quote {
  items: QuoteLine[];
  subtotal: Money;
  retail_total: Money;
  savings: Money;
  total: Money;
  count: number;
  missing: number[];
  is_partner?: boolean;
}

export interface Review {
  id: number;
  author: string;
  rating: number;
  text: string;
  created_at: string;
}

export interface ContentPage {
  id: number;
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  show_in_footer: boolean;
  sort_order: number;
  meta_description: string | null;
  updated_at: string;
}

// ---------- Админка ----------

export type OrderStatus = "new" | "processing" | "confirmed" | "shipped" | "completed" | "cancelled";
export type LeadType = "callback" | "wholesale" | "question" | "preorder";
export type LeadStatus = "new" | "in_progress" | "done" | "rejected";

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AdminProductListItem {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  price: Money;
  old_price: Money | null;
  wholesale_price: Money | null;
  in_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  price_locked: boolean;
  content_locked: boolean;
  image: string | null;
  category: CategoryBrief | null;
  updated_at: string;
  synced_at: string | null;
}

export interface AdminProduct extends AdminProductListItem {
  category_id: number | null;
  brand: string | null;
  short_description: string | null;
  description: string | null;
  source_price: Money | null;
  stock_qty: number | null;
  is_new: boolean;
  sort_order: number;
  views: number;
  documents: DocumentItem[] | null;
  meta_title: string | null;
  meta_description: string | null;
  source_url: string | null;
  gallery: ImageItem[];
  attributes: Attribute[];
  highlights: Attribute[] | null;
}

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  description: string | null;
  image: string | null;
  cover: string | null;
  sort_order: number;
  is_active: boolean;
  meta_title: string | null;
  meta_description: string | null;
  source_url: string | null;
  product_count: number;
}

export interface OrderItem {
  id: number;
  product_id: number | null;
  name: string;
  sku: string | null;
  image: string | null;
  price: Money;
  quantity: number;
  total: Money;
  is_wholesale_price: boolean;
  price_kind?: string;
}

export interface OrderListItem {
  id: number;
  number: string;
  status: OrderStatus;
  customer_type: "retail" | "wholesale";
  name: string;
  phone: string;
  company: string | null;
  total: Money;
  created_at: string;
  items_count: number;
}

export interface Order extends Omit<OrderListItem, "items_count"> {
  email: string | null;
  inn: string | null;
  city: string | null;
  address: string | null;
  delivery_method: string | null;
  payment_method: string | null;
  comment: string | null;
  manager_note: string | null;
  subtotal: Money;
  discount: Money;
  customer_id?: number | null;
  updated_at: string;
  items: OrderItem[];
}

export interface Lead {
  id: number;
  type: LeadType;
  status: LeadStatus;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  message: string | null;
  product_id: number | null;
  page_url: string | null;
  manager_note: string | null;
  created_at: string;
}

export interface AdminReview extends Review {
  product_id: number;
  is_published: boolean;
  product_name: string | null;
}

export interface ImportJob {
  id: number;
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  mode: string;
  trigger: string;
  progress: number;
  total: number;
  stats: Record<string, number> | null;
  log: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface Dashboard {
  orders_total: number;
  orders_new: number;
  revenue_30d: Money;
  orders_30d: number;
  avg_check_30d: Money;
  products_total: number;
  products_active: number;
  products_out_of_stock: number;
  leads_new: number;
  reviews_pending: number;
  chart: { date: string; orders: number; revenue: Money }[];
  recent_orders: OrderListItem[];
  top_products: { product_id: number | null; name: string; qty: number; sum: number }[];
  last_import: ImportJob | null;
}

// ---------- Клиенты ----------

export type PartnerStatus = "none" | "pending" | "approved" | "rejected";

export interface Customer {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  kind: "retail" | "partner";
  partner_status: PartnerStatus;
  company: string | null;
  inn: string | null;
  kpp: string | null;
  legal_address: string | null;
  city: string | null;
  address: string | null;
  is_partner: boolean;
  price_type_name: string | null;
  discount_percent: Money | null;
  created_at: string;
}

export interface AdminCustomer extends Customer {
  is_active: boolean;
  price_type_id: number | null;
  manager_note: string | null;
  external_id: string | null;
  last_login_at: string | null;
  orders_count: number;
  orders_total: Money;
}

export interface PriceType {
  id: number;
  name: string;
  external_id: string | null;
  currency: string;
  is_default_partner: boolean;
  is_active: boolean;
  prices_count: number;
  customers_count: number;
}
