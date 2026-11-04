-- =============================================================
-- SavdoShop sample data: 5 categories, 10 customers, 12 products,
-- 3 orders, 5 order lines, 2 payments.
-- Run after 01_schema.sql in the same Query Tool (F5).
-- Safe to re-run: it clears the rows and restarts the counters.
-- =============================================================

TRUNCATE payments, order_items, orders, products, categories, customers RESTART IDENTITY CASCADE;

INSERT INTO categories (category_id, name) VALUES
   (1, 'Clothing'), (2, 'Shoes'), (3, 'Beauty'), (4, 'Jewelry'), (5, 'Electronics');

INSERT INTO customers (customer_id, full_name, email, phone, city) VALUES
   (1, 'Aziza Karimova',   'aziza@example.uz',   '+998901112233', 'Tashkent'),
   (2, 'Bekzod Tursunov',  'bekzod@example.uz',  '+998935556677', 'Samarkand'),
   (3, 'Dilnoza Rahimova', 'dilnoza@example.uz', '+998977778899', 'Bukhara'),
   (4, 'Jasur Aliyev',     'jasur@example.uz',   '+998901234567', 'Tashkent'),
   (5, 'Malika Yusupova',  'malika@example.uz',  '+998991112244', 'Namangan'),
   (6, 'Otabek Ergashev',  'otabek@example.uz',  '+998903334455', 'Andijan'),
   (7, 'Sevara Nazarova',  'sevara@example.uz',  '+998946667788', 'Khiva'),
   (8, 'Timur Saidov',     'timur@example.uz',   '+998909998877', 'Tashkent'),
   (9, 'Zarina Islomova',  'zarina@example.uz',  '+998931231231', 'Fergana'),
   (10,'Sardor Qodirov',   'sardor@example.uz',  '+998977445566', 'Samarkand');

INSERT INTO products (product_id, category_id, name, description, price, stock, image_url) VALUES
   (1,  1, 'Atlas silk dress',       'Hand-woven Margilan atlas pattern',      650000,  15, '/placeholder.svg?text=Atlas+dress'),
   (2,  1, 'Cotton shirt',           'Breathable everyday shirt',              180000,  40, '/placeholder.svg?text=Shirt'),
   (3,  1, 'Winter chapan',          'Warm padded chapan, handmade',           950000,   8, '/placeholder.svg?text=Chapan'),
   (4,  2, 'Leather sneakers',       'Genuine leather, city sole',             420000,  25, '/placeholder.svg?text=Sneakers'),
   (5,  2, 'Running shoes',          'Light mesh sport shoes',                 380000,  30, '/placeholder.svg?text=Running'),
   (6,  2, 'Classic boots',          'Winter boots, natural fur lining',       560000,  12, '/placeholder.svg?text=Boots'),
   (7,  3, 'Argan hair oil',         'Moroccan argan oil, 100 ml',              95000,  60, '/placeholder.svg?text=Hair+oil'),
   (8,  3, 'Rose face cream',        'Moisturising cream with rose water',     120000,  45, '/placeholder.svg?text=Face+cream'),
   (9,  4, 'Silver earrings',        '925 silver with pearl',                  310000,  20, '/placeholder.svg?text=Earrings'),
   (10, 4, 'Gold ring 585',          'Yellow gold with certificate',          2400000,   5, '/placeholder.svg?text=Gold+ring'),
   (11, 5, 'Wireless earbuds',       'Bluetooth 5.3, 30 h with case',          350000,  35, '/placeholder.svg?text=Earbuds'),
   (12, 5, 'Power bank 20000 mAh',   'Fast charge 22.5 W, USB-C',              280000,  50, '/placeholder.svg?text=Power+bank');

INSERT INTO orders (order_id, customer_id, status, total) VALUES
   (1, 1, 'paid',    830000),
   (2, 2, 'shipped', 515000),
   (3, 4, 'new',     2400000);

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
   (1, 1,  1, 650000),
   (1, 2,  1, 180000),
   (2, 7,  1,  95000),
   (2, 4,  1, 420000),
   (3, 10, 1, 2400000);

INSERT INTO payments (order_id, method, amount) VALUES
   (1, 'payme', 830000),
   (2, 'card',  515000);

-- Keep the SERIAL counters after the explicit ids used above.
SELECT setval('customers_customer_id_seq',   (SELECT MAX(customer_id) FROM customers));
SELECT setval('categories_category_id_seq',  (SELECT MAX(category_id)  FROM categories));
SELECT setval('products_product_id_seq',     (SELECT MAX(product_id)   FROM products));
SELECT setval('orders_order_id_seq',         (SELECT MAX(order_id)     FROM orders));
SELECT setval('payments_payment_id_seq',     (SELECT MAX(payment_id)   FROM payments));
