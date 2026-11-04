-- =============================================================
-- SavdoShop reference project - PostgreSQL schema
-- Run in pgAdmin: right-click database "savdoshop" > Query Tool,
-- open this file, press F5 (Execute script).
-- Safe to re-run: it drops the old tables first.
-- =============================================================

DROP TABLE IF EXISTS payments, order_items, orders, products, categories, customers CASCADE;

CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    full_name   VARCHAR(100) NOT NULL,
    email       VARCHAR(120) NOT NULL UNIQUE,
    phone       VARCHAR(20),
    city        VARCHAR(50) NOT NULL DEFAULT 'Tashkent',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name        VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE products (
    product_id  SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES categories(category_id),
    name        VARCHAR(120) NOT NULL,
    description TEXT,
    price       NUMERIC(12,2) NOT NULL CHECK (price >= 0), -- in UZS (so'm)
    stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    order_id    SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(customer_id),
    status      VARCHAR(20) NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'paid', 'shipped', 'delivered', 'cancelled')),
    total       NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction table: one order has many products, one product is in many orders  (M:N)
CREATE TABLE order_items (
    order_id   INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(product_id),
    quantity   INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (order_id, product_id)
);

CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    order_id   INT NOT NULL UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE,
    method     VARCHAR(20) NOT NULL CHECK (method IN ('cash', 'card', 'payme', 'click')),
    amount     NUMERIC(12,2) NOT NULL,
    paid_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes on foreign keys and columns we search/filter on
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_orders_customer   ON orders(customer_id);
CREATE INDEX idx_orders_created    ON orders(created_at);
