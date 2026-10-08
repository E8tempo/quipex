from datetime import datetime
from decimal import Decimal
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import CustomerType, ImportStatus, LeadStatus, LeadType, OrderStatus

T = TypeVar("T")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    pages: int
    per_page: int


# ---------- Каталог ----------


class CategoryBrief(ORM):
    id: int
    name: str
    slug: str
    parent_id: int | None = None
    image: str | None = None


class CategoryNode(CategoryBrief):
    cover: str | None = None
    sort_order: int = 500
    is_active: bool = True
    product_count: int = 0
    children: list["CategoryNode"] = []


class CategoryOut(CategoryBrief):
    cover: str | None = None
    description: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    product_count: int = 0
    breadcrumbs: list[CategoryBrief] = []
    children: list[CategoryNode] = []


class ImageOut(ORM):
    id: int
    url: str
    alt: str | None = None
    sort_order: int = 0


class AttributeOut(ORM):
    group: str | None = None
    name: str
    value: str


class DocumentOut(BaseModel):
    title: str
    url: str
    size: str | None = None


class ProductCard(ORM):
    id: int
    name: str
    slug: str
    sku: str | None = None
    brand: str | None = None
    price: Decimal
    old_price: Decimal | None = None
    wholesale_price: Decimal | None = None
    in_stock: bool
    is_new: bool = False
    is_featured: bool = False
    image: str | None = None
    images: list[str] = []
    category: CategoryBrief | None = None
    highlights: list[AttributeOut] = []
    rating: float | None = None
    reviews_count: int = 0


class SpecGroup(BaseModel):
    name: str | None
    items: list[AttributeOut]


class ProductDetail(ProductCard):
    description: str | None = None
    short_description: str | None = None
    stock_qty: int | None = None
    gallery: list[ImageOut] = []
    specs: list[SpecGroup] = []
    documents: list[DocumentOut] = []
    breadcrumbs: list[CategoryBrief] = []
    meta_title: str | None = None
    meta_description: str | None = None


class FacetValue(BaseModel):
    value: str
    count: int


class Facet(BaseModel):
    name: str
    values: list[FacetValue]


class ProductListOut(Page[ProductCard]):
    facets: list[Facet] = []
    price_min: Decimal | None = None
    price_max: Decimal | None = None


class SearchSuggestion(BaseModel):
    products: list[ProductCard]
    categories: list[CategoryBrief]


# ---------- Отзывы ----------


class ReviewCreate(BaseModel):
    author: str = Field(min_length=2, max_length=100)
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=5, max_length=3000)


class ReviewOut(ORM):
    id: int
    author: str
    rating: int
    text: str
    created_at: datetime


class ReviewAdminOut(ReviewOut):
    product_id: int
    is_published: bool
    product_name: str | None = None


class ReviewUpdate(BaseModel):
    is_published: bool | None = None
    text: str | None = None


# ---------- Заказы ----------

PHONE_MIN_DIGITS = 10


def _check_phone(v: str) -> str:
    digits = "".join(ch for ch in v if ch.isdigit())
    if len(digits) < PHONE_MIN_DIGITS:
        raise ValueError("Укажите корректный номер телефона")
    return v.strip()


class CartLine(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, le=10000)


class CartQuote(BaseModel):
    items: list[CartLine] = Field(max_length=200)


class QuoteLine(BaseModel):
    product: ProductCard
    quantity: int
    price: Decimal
    total: Decimal
    is_wholesale_price: bool
    price_kind: str = "retail"


class QuoteOut(BaseModel):
    items: list[QuoteLine]
    subtotal: Decimal
    retail_total: Decimal
    savings: Decimal
    total: Decimal
    count: int
    missing: list[int] = []
    is_partner: bool = False


class OrderCreate(BaseModel):
    items: list[CartLine] = Field(min_length=1, max_length=200)
    customer_type: CustomerType = CustomerType.retail
    name: str = Field(min_length=2, max_length=255)
    phone: str = Field(max_length=64)
    email: EmailStr | None = None
    company: str | None = Field(default=None, max_length=255)
    inn: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=1000)
    delivery_method: str | None = Field(default=None, max_length=64)
    payment_method: str | None = Field(default=None, max_length=64)
    comment: str | None = Field(default=None, max_length=3000)
    website: str | None = None  # honeypot

    _phone = field_validator("phone")(_check_phone)


class OrderItemOut(ORM):
    id: int
    product_id: int | None
    name: str
    sku: str | None
    image: str | None
    price: Decimal
    quantity: int
    total: Decimal
    is_wholesale_price: bool
    price_kind: str = "retail"


class OrderPublicOut(ORM):
    number: str
    status: OrderStatus
    total: Decimal
    created_at: datetime


class OrderOut(ORM):
    id: int
    number: str
    status: OrderStatus
    customer_type: CustomerType
    name: str
    phone: str
    email: str | None
    company: str | None
    inn: str | None
    city: str | None
    address: str | None
    delivery_method: str | None
    payment_method: str | None
    comment: str | None
    manager_note: str | None
    subtotal: Decimal
    discount: Decimal
    total: Decimal
    customer_id: int | None = None
    external_id: str | None = None
    exported_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut] = []


class OrderListItem(ORM):
    id: int
    number: str
    status: OrderStatus
    customer_type: CustomerType
    name: str
    phone: str
    company: str | None
    total: Decimal
    created_at: datetime
    items_count: int = 0


class OrderUpdate(BaseModel):
    status: OrderStatus | None = None
    manager_note: str | None = None
    discount: Decimal | None = Field(default=None, ge=0)


# ---------- Заявки ----------


class LeadCreate(BaseModel):
    type: LeadType = LeadType.callback
    name: str = Field(min_length=2, max_length=255)
    phone: str = Field(max_length=64)
    email: EmailStr | None = None
    company: str | None = Field(default=None, max_length=255)
    message: str | None = Field(default=None, max_length=3000)
    product_id: int | None = None
    page_url: str | None = Field(default=None, max_length=1000)
    website: str | None = None  # honeypot

    _phone = field_validator("phone")(_check_phone)


class LeadOut(ORM):
    id: int
    type: LeadType
    status: LeadStatus
    name: str
    phone: str
    email: str | None
    company: str | None
    message: str | None
    product_id: int | None
    page_url: str | None
    manager_note: str | None
    created_at: datetime


class LeadUpdate(BaseModel):
    status: LeadStatus | None = None
    manager_note: str | None = None


# ---------- Авторизация ----------


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(ORM):
    id: int
    email: str
    full_name: str | None
    is_active: bool
    is_superuser: bool
    last_login_at: datetime | None = None
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    is_superuser: bool = False


class UserUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_active: bool | None = None
    is_superuser: bool | None = None


# ---------- Админка: товары и категории ----------


class AttributeIn(BaseModel):
    group: str | None = None
    name: str = Field(min_length=1, max_length=255)
    value: str = Field(min_length=1, max_length=1000)


class ProductAdminListItem(ORM):
    id: int
    name: str
    slug: str
    sku: str | None
    price: Decimal
    old_price: Decimal | None
    wholesale_price: Decimal | None
    in_stock: bool
    is_active: bool
    is_featured: bool
    price_locked: bool
    content_locked: bool
    image: str | None = None
    category: CategoryBrief | None = None
    updated_at: datetime
    synced_at: datetime | None = None


class ProductAdminOut(ProductAdminListItem):
    category_id: int | None
    brand: str | None
    short_description: str | None
    description: str | None
    source_price: Decimal | None
    stock_qty: int | None
    is_new: bool
    sort_order: int
    views: int
    documents: list[DocumentOut] | None = None
    meta_title: str | None
    meta_description: str | None
    source_url: str | None
    gallery: list[ImageOut] = []
    attributes: list[AttributeOut] = []
    highlights: list[AttributeOut] | None = None


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    slug: str | None = Field(default=None, max_length=255)
    category_id: int | None = None
    sku: str | None = None
    brand: str | None = None
    short_description: str | None = None
    description: str | None = None
    price: Decimal = Field(ge=0)
    old_price: Decimal | None = Field(default=None, ge=0)
    wholesale_price: Decimal | None = Field(default=None, ge=0)
    price_locked: bool = False
    content_locked: bool = False
    in_stock: bool = True
    stock_qty: int | None = None
    is_active: bool = True
    is_featured: bool = False
    is_new: bool = False
    sort_order: int = 500
    documents: list[DocumentOut] | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    attributes: list[AttributeIn] | None = None
    highlights: list[AttributeIn] | None = None


class ProductPatch(BaseModel):
    """Частичное обновление (быстрое редактирование из таблицы)."""

    name: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
    old_price: Decimal | None = None
    wholesale_price: Decimal | None = None
    in_stock: bool | None = None
    is_active: bool | None = None
    is_featured: bool | None = None
    is_new: bool | None = None
    price_locked: bool | None = None
    content_locked: bool | None = None
    category_id: int | None = None


class BulkAction(BaseModel):
    ids: list[int] = Field(min_length=1)
    action: Literal[
        "activate",
        "deactivate",
        "feature",
        "unfeature",
        "in_stock",
        "out_of_stock",
        "lock_price",
        "unlock_price",
        "delete",
        "price_percent",
        "wholesale_percent",
        "move",
    ]
    value: float | None = None


class ImageOrder(BaseModel):
    ids: list[int]


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str | None = None
    parent_id: int | None = None
    description: str | None = None
    image: str | None = None
    cover: str | None = None
    sort_order: int = 500
    is_active: bool = True
    meta_title: str | None = None
    meta_description: str | None = None


class CategoryAdminOut(ORM):
    id: int
    name: str
    slug: str
    parent_id: int | None
    description: str | None
    image: str | None
    cover: str | None = None
    sort_order: int
    is_active: bool
    meta_title: str | None
    meta_description: str | None
    source_url: str | None
    product_count: int = 0


# ---------- Импорт ----------


class ImportStart(BaseModel):
    mode: Literal["full", "prices"] = "full"
    download_images: bool | None = None


class ImportSchedule(BaseModel):
    enabled: bool
    mode: Literal["full", "prices"] = "full"
    every_hours: Literal[6, 12, 24, 48, 72, 168] = 24
    hour: int = Field(4, ge=0, le=23)


class ImportScheduleOut(ImportSchedule):
    next_run: datetime | None = None
    min_interval_minutes: int


class ImportJobOut(ORM):
    id: int
    status: ImportStatus
    mode: str
    trigger: str
    progress: int
    total: int
    stats: dict[str, Any] | None
    log: str | None
    error: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime


# ---------- Контентные страницы ----------


class PageBrief(ORM):
    slug: str
    title: str


class PageOut(ORM):
    id: int
    slug: str
    title: str
    content: str
    is_published: bool
    show_in_footer: bool
    sort_order: int
    meta_description: str | None
    updated_at: datetime


class PageIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=255)
    content: str = ""
    is_published: bool = True
    show_in_footer: bool = True
    sort_order: int = 500
    meta_description: str | None = None


# ---------- Дашборд ----------


class DayPoint(BaseModel):
    date: str
    orders: int
    revenue: Decimal


class DashboardOut(BaseModel):
    orders_total: int
    orders_new: int
    revenue_30d: Decimal
    orders_30d: int
    avg_check_30d: Decimal
    products_total: int
    products_active: int
    products_out_of_stock: int
    leads_new: int
    reviews_pending: int
    chart: list[DayPoint]
    recent_orders: list[OrderListItem]
    top_products: list[dict[str, Any]]
    last_import: ImportJobOut | None = None


# ---------- Клиенты и личный кабинет ----------

from app.models import ClientKind, PartnerStatus  # noqa: E402


class CustomerRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=255)
    phone: str = Field(max_length=64)
    as_partner: bool = False
    company: str | None = Field(default=None, max_length=255)
    inn: str | None = Field(default=None, max_length=20)
    website: str | None = None  # honeypot

    _phone = field_validator("phone")(_check_phone)


class CustomerLogin(BaseModel):
    email: str
    password: str


class CustomerOut(ORM):
    id: int
    email: str
    name: str
    phone: str | None
    kind: ClientKind
    partner_status: PartnerStatus
    company: str | None
    inn: str | None
    kpp: str | None
    legal_address: str | None
    city: str | None
    address: str | None
    is_partner: bool
    price_type_name: str | None = None
    discount_percent: Decimal | None = None
    created_at: datetime


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    company: str | None = Field(default=None, max_length=255)
    inn: str | None = Field(default=None, max_length=20)
    kpp: str | None = Field(default=None, max_length=20)
    legal_address: str | None = Field(default=None, max_length=1000)
    city: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=1000)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class PartnerRequest(BaseModel):
    company: str = Field(min_length=2, max_length=255)
    inn: str = Field(min_length=10, max_length=12, pattern=r"^\d{10}(\d{2})?$")
    kpp: str | None = Field(default=None, max_length=20)
    legal_address: str | None = Field(default=None, max_length=1000)
    message: str | None = Field(default=None, max_length=2000)


class PersonalPrice(BaseModel):
    price: Decimal
    kind: str


class CustomerAdminOut(CustomerOut):
    is_active: bool
    price_type_id: int | None
    manager_note: str | None
    external_id: str | None
    last_login_at: datetime | None
    orders_count: int = 0
    orders_total: Decimal = Decimal(0)


class CustomerAdminUpdate(BaseModel):
    kind: ClientKind | None = None
    partner_status: PartnerStatus | None = None
    price_type_id: int | None = None
    discount_percent: Decimal | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None
    manager_note: str | None = None
    external_id: str | None = None
    name: str | None = None
    phone: str | None = None
    company: str | None = None
    inn: str | None = None


class PriceTypeIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    external_id: str | None = Field(default=None, max_length=100)
    currency: str = "RUB"
    is_default_partner: bool = False
    is_active: bool = True


class PriceTypeOut(ORM):
    id: int
    name: str
    external_id: str | None
    currency: str
    is_default_partner: bool
    is_active: bool
    prices_count: int = 0
    customers_count: int = 0


class ProductPriceIn(BaseModel):
    price_type_id: int
    price: Decimal | None = Field(default=None, ge=0)


class ProductPriceOut(BaseModel):
    price_type_id: int
    price_type_name: str
    price: Decimal | None
