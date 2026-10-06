import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

Money = Numeric(12, 2)


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    image: Mapped[str | None] = mapped_column(String(500))
    cover: Mapped[str | None] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=500)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    source_url: Mapped[str | None] = mapped_column(String(500), unique=True)
    meta_title: Mapped[str | None] = mapped_column(String(255))
    meta_description: Mapped[str | None] = mapped_column(String(500))

    parent: Mapped["Category | None"] = relationship(remote_side="Category.id", lazy="raise")


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )
    name: Mapped[str] = mapped_column(String(500))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    sku: Mapped[str | None] = mapped_column(String(120), index=True)
    brand: Mapped[str | None] = mapped_column(String(120))
    short_description: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)

    price: Mapped[Decimal] = mapped_column(Money, default=0)
    old_price: Mapped[Decimal | None] = mapped_column(Money)
    wholesale_price: Mapped[Decimal | None] = mapped_column(Money)
    source_price: Mapped[Decimal | None] = mapped_column(Money)
    price_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    content_locked: Mapped[bool] = mapped_column(Boolean, default=False)

    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    stock_qty: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=500)
    views: Mapped[int] = mapped_column(Integer, default=0)

    documents: Mapped[list | None] = mapped_column(JSON)
    highlights: Mapped[list | None] = mapped_column(JSON)
    meta_title: Mapped[str | None] = mapped_column(String(255))
    meta_description: Mapped[str | None] = mapped_column(String(500))

    source_id: Mapped[str | None] = mapped_column(String(64), index=True)
    source_url: Mapped[str | None] = mapped_column(String(500), unique=True)
    # Ид товара в 1С (CommerceML) — по нему сопоставляются товары при обмене
    external_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    category: Mapped[Category | None] = relationship(lazy="raise")
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.sort_order",
        lazy="raise",
    )
    attributes: Mapped[list["ProductAttribute"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductAttribute.sort_order",
        lazy="raise",
    )


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    url: Mapped[str] = mapped_column(String(500))
    source_url: Mapped[str | None] = mapped_column(String(500))
    alt: Mapped[str | None] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="images", lazy="raise")


class ProductAttribute(Base):
    """Характеристика товара. Используется и для отображения, и для фасетных фильтров."""

    __tablename__ = "product_attributes"
    __table_args__ = (Index("ix_product_attributes_name_value", "name", "value"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    group: Mapped[str | None] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    value: Mapped[str] = mapped_column(String(1000))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="attributes", lazy="raise")


class OrderStatus(str, enum.Enum):
    new = "new"
    processing = "processing"
    confirmed = "confirmed"
    shipped = "shipped"
    completed = "completed"
    cancelled = "cancelled"


class CustomerType(str, enum.Enum):
    retail = "retail"
    wholesale = "wholesale"


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, native_enum=False, length=20), default=OrderStatus.new, index=True
    )
    customer_type: Mapped[CustomerType] = mapped_column(
        Enum(CustomerType, native_enum=False, length=20), default=CustomerType.retail
    )
    name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(64))
    email: Mapped[str | None] = mapped_column(String(255))
    company: Mapped[str | None] = mapped_column(String(255))
    inn: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(String(1000))
    delivery_method: Mapped[str | None] = mapped_column(String(64))
    payment_method: Mapped[str | None] = mapped_column(String(64))
    comment: Mapped[str | None] = mapped_column(Text)
    manager_note: Mapped[str | None] = mapped_column(Text)
    subtotal: Mapped[Decimal] = mapped_column(Money, default=0)
    discount: Mapped[Decimal] = mapped_column(Money, default=0)
    total: Mapped[Decimal] = mapped_column(Money, default=0)

    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), index=True
    )
    price_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("price_types.id", ondelete="SET NULL")
    )
    # обмен с 1С: Ид документа и момент выгрузки (orders.xml)
    external_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    exported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="raise"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(500))
    sku: Mapped[str | None] = mapped_column(String(120))
    image: Mapped[str | None] = mapped_column(String(500))
    price: Mapped[Decimal] = mapped_column(Money)
    quantity: Mapped[int] = mapped_column(Integer)
    total: Mapped[Decimal] = mapped_column(Money)
    is_wholesale_price: Mapped[bool] = mapped_column(Boolean, default=False)
    # retail / wholesale / partner — какая цена применена
    price_kind: Mapped[str] = mapped_column(String(20), default="retail", server_default="retail")

    order: Mapped[Order] = relationship(back_populates="items", lazy="raise")


class LeadType(str, enum.Enum):
    callback = "callback"
    wholesale = "wholesale"
    question = "question"
    preorder = "preorder"


class LeadStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    done = "done"
    rejected = "rejected"


class Lead(TimestampMixin, Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[LeadType] = mapped_column(Enum(LeadType, native_enum=False, length=20), index=True)
    status: Mapped[LeadStatus] = mapped_column(
        Enum(LeadStatus, native_enum=False, length=20), default=LeadStatus.new, index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(64))
    email: Mapped[str | None] = mapped_column(String(255))
    company: Mapped[str | None] = mapped_column(String(255))
    message: Mapped[str | None] = mapped_column(Text)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    page_url: Mapped[str | None] = mapped_column(String(1000))
    manager_note: Mapped[str | None] = mapped_column(Text)


class Review(TimestampMixin, Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    author: Mapped[str] = mapped_column(String(255))
    rating: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class SiteSetting(Base):
    __tablename__ = "site_settings"
    __mapper_args__ = {"eager_defaults": True}

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ImportStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"
    cancelled = "cancelled"


class ImportJob(TimestampMixin, Base):
    __tablename__ = "import_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[ImportStatus] = mapped_column(
        Enum(ImportStatus, native_enum=False, length=20), default=ImportStatus.pending, index=True
    )
    mode: Mapped[str] = mapped_column(String(20), default="full")
    trigger: Mapped[str] = mapped_column(String(20), default="manual")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    stats: Mapped[dict | None] = mapped_column(JSON)
    log: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Page(TimestampMixin, Base):
    """Простые контентные страницы (доставка, оплата, о компании) — редактируются в админке."""

    __tablename__ = "pages"
    __table_args__ = (UniqueConstraint("slug"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text, default="")
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    show_in_footer: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=500)
    meta_description: Mapped[str | None] = mapped_column(String(500))


# ---------------------------------------------------------------------------
#  Клиенты сайта (покупатели и партнёры) — отдельно от сотрудников (User)
# ---------------------------------------------------------------------------


class ClientKind(str, enum.Enum):
    retail = "retail"
    partner = "partner"


class PartnerStatus(str, enum.Enum):
    none = "none"  # обычный покупатель
    pending = "pending"  # подал заявку на партнёрство
    approved = "approved"
    rejected = "rejected"


class PriceType(TimestampMixin, Base):
    """Тип цен (вид цены 1С: «Оптовая», «Дилерская» и т.д.)."""

    __tablename__ = "price_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    # Ид типа цены в 1С (CommerceML: Классификатор/ТипыЦен/ТипЦены/Ид)
    external_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    currency: Mapped[str] = mapped_column(String(10), default="RUB")
    is_default_partner: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ProductPrice(Base):
    """Цена товара по типу цен. Наполняется обменом с 1С (offers.xml) или вручную."""

    __tablename__ = "product_prices"
    __table_args__ = (UniqueConstraint("product_id", "price_type_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    price_type_id: Mapped[int] = mapped_column(
        ForeignKey("price_types.id", ondelete="CASCADE"), index=True
    )
    price: Mapped[Decimal] = mapped_column(Money)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __mapper_args__ = {"eager_defaults": True}


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(64))
    kind: Mapped[ClientKind] = mapped_column(
        Enum(ClientKind, native_enum=False, length=20), default=ClientKind.retail, index=True
    )
    partner_status: Mapped[PartnerStatus] = mapped_column(
        Enum(PartnerStatus, native_enum=False, length=20), default=PartnerStatus.none, index=True
    )
    company: Mapped[str | None] = mapped_column(String(255))
    inn: Mapped[str | None] = mapped_column(String(20))
    kpp: Mapped[str | None] = mapped_column(String(20))
    legal_address: Mapped[str | None] = mapped_column(String(1000))
    city: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(String(1000))
    price_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("price_types.id", ondelete="SET NULL")
    )
    discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    manager_note: Mapped[str | None] = mapped_column(Text)
    # Ид контрагента в 1С
    external_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    price_type: Mapped[PriceType | None] = relationship(lazy="raise")

    @property
    def is_partner(self) -> bool:
        return self.kind == ClientKind.partner and self.partner_status == PartnerStatus.approved


# ---------------------------------------------------------------------------
#  Сессии: refresh-токены (хранится только хеш), ротация и отзыв
# ---------------------------------------------------------------------------


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    # цепочка ротаций одного входа; access-токен ссылается на неё (sid)
    family_id: Mapped[str] = mapped_column(String(64), index=True)
    subject_type: Mapped[str] = mapped_column(String(20))  # user | customer
    subject_id: Mapped[int] = mapped_column(Integer, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    ip: Mapped[str | None] = mapped_column(String(64))

    __mapper_args__ = {"eager_defaults": True}
