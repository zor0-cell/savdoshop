-- =============================================================
-- SavdoShop - Week 1 SQL practice, Q1-Q20
-- In pgAdmin: select ONE query with the mouse and press F5.
-- Only the selected text runs. Run them in order - Q4 deletes the
-- row that Q1 creates, Q3 changes prices used later by Q13.
--
-- Composition required by the guide (Step 1.15, item 3):
--   4 CRUD  -  5 JOIN (one LEFT JOIN)  -  4 GROUP BY (one HAVING)
--   1 view  -  2 window functions      -  1 sub-query   -  1 transaction
--   2 free
-- =============================================================

-- Q1 Business question: register a new customer so we can serve them?
-- Type: CRUD - CREATE
INSERT INTO customers (full_name, email, city)
VALUES ('Student Test', 'student@example.uz', 'Tashkent')
RETURNING customer_id;

-- Q2 Business question: which products are affordable (under 400 000 so'm)?
-- Type: CRUD - READ
SELECT product_id, name, price
FROM products
WHERE price < 400000
ORDER BY price ASC;

-- Q3 Business question: give Shoes a 10% discount before a sale week?
-- Type: CRUD - UPDATE
UPDATE products
SET price = price * 0.9
WHERE category_id = (SELECT category_id FROM categories WHERE name = 'Shoes');

-- Q4 Business question: remove the test row we no longer need?
-- Type: CRUD - DELETE
DELETE FROM customers WHERE email = 'student@example.uz';

-- Q5 Business question: show the catalogue with a readable category name?
-- Type: INNER JOIN (2 tables)
SELECT p.name AS product, c.name AS category, p.price
FROM products p
JOIN categories c ON c.category_id = p.category_id
ORDER BY c.name, p.name;

-- Q6 Business question: who bought what - the full order detail line?
-- Type: INNER JOIN (4 tables)
SELECT o.order_id, cu.full_name, p.name AS product, oi.quantity,
       oi.unit_price * oi.quantity AS line_total
FROM orders o
JOIN customers cu ON cu.customer_id = o.customer_id
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p ON p.product_id = oi.product_id
ORDER BY o.order_id;

-- Q7 Business question: which customers have NEVER ordered (to target them)?
-- Type: LEFT JOIN + IS NULL
SELECT cu.full_name, cu.city
FROM customers cu
LEFT JOIN orders o ON o.customer_id = cu.customer_id
WHERE o.order_id IS NULL;

-- Q8 Business question: how wide is the range and price level per category?
-- Type: LEFT JOIN + GROUP BY
SELECT c.name, COUNT(p.product_id) AS products, ROUND(AVG(p.price)) AS avg_price
FROM categories c
LEFT JOIN products p ON p.category_id = c.category_id
GROUP BY c.name
ORDER BY products DESC;

-- Q9 Business question: which cities bring real money (over 500 000 so'm)?
-- Type: GROUP BY + HAVING
SELECT cu.city, SUM(o.total) AS revenue, COUNT(*) AS orders
FROM orders o
JOIN customers cu ON cu.customer_id = o.customer_id
WHERE o.status <> 'cancelled'
GROUP BY cu.city
HAVING SUM(o.total) > 500000
ORDER BY revenue DESC;

-- Q10 Business question: what are our top 5 best-selling products?
-- Type: GROUP BY + ORDER BY + LIMIT
SELECT p.name, SUM(oi.quantity) AS sold
FROM order_items oi
JOIN products p ON p.product_id = oi.product_id
GROUP BY p.name
ORDER BY sold DESC
LIMIT 5;

-- Q11 Business question: give the website one reusable catalogue query?
-- Type: VIEW (CREATE OR REPLACE)
CREATE OR REPLACE VIEW v_product_catalog AS
SELECT p.product_id, p.name, p.price, p.stock, p.image_url, c.name AS category
FROM products p
JOIN categories c ON c.category_id = p.category_id;

-- Q11 also use it: the Jewelry shelf of the website
SELECT * FROM v_product_catalog WHERE category = 'Jewelry';

-- Q12 Business question: what is the price ranking inside each category?
-- Type: WINDOW FUNCTION (RANK OVER PARTITION BY)
SELECT category, name, price,
       RANK() OVER (PARTITION BY category ORDER BY price DESC) AS price_rank
FROM v_product_catalog;

-- Q13 Business question: place an order without ever breaking the stock count?
-- Type: TRANSACTION (BEGIN...COMMIT)
BEGIN;
   INSERT INTO orders (customer_id) VALUES (3) RETURNING order_id;
   -- currval() = the order_id that was just generated in this session
   INSERT INTO order_items (order_id, product_id, quantity, unit_price)
   SELECT currval('orders_order_id_seq'), product_id, 1, price
   FROM products WHERE product_id = 4;
   UPDATE products SET stock = stock - 1 WHERE product_id = 4;
   UPDATE orders SET total = (SELECT SUM(quantity * unit_price) FROM order_items
                              WHERE order_id = currval('orders_order_id_seq'))
   WHERE order_id = currval('orders_order_id_seq');
COMMIT; -- or ROLLBACK; to cancel everything

-- Q13 check Business question: did the new order 4 store the discounted price?
-- Type: JOIN + scalar sub-query
SELECT o.order_id, o.customer_id, o.total, oi.product_id, oi.unit_price,
       (SELECT stock FROM products WHERE product_id = 4) AS stock_now
FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.order_id = 4;

-- Q14 Business question: which orders are already paid and how much came in?
-- Type: INNER JOIN (3 tables)
SELECT o.order_id, cu.full_name, o.status, p.method, p.amount, p.paid_at
FROM payments p
JOIN orders o ON o.order_id = p.order_id
JOIN customers cu ON cu.customer_id = o.customer_id
ORDER BY p.paid_at;

-- Q15 Business question: how many orders are in each status, and their average?
-- Type: GROUP BY (per status)
SELECT status,
       COUNT(*) AS orders,
       ROUND(AVG(total)) AS avg_total,
       MIN(created_at) AS first_order,
       MAX(created_at) AS last_order
FROM orders
GROUP BY status
ORDER BY orders DESC;

-- Q16 Business question: which products cost more than the shop average price?
-- Type: SUB-QUERY (scalar sub-select in WHERE)
SELECT name, price,
       (SELECT ROUND(AVG(price)) FROM products) AS shop_avg,
       price - (SELECT ROUND(AVG(price)) FROM products) AS above_avg
FROM products
WHERE price > (SELECT AVG(price) FROM products)
ORDER BY price DESC;

-- Q17 Business question: how does each customer's spending grow order by order?
-- Type: WINDOW FUNCTION (running SUM OVER PARTITION BY ... ORDER BY)
SELECT o.customer_id, cu.full_name, o.order_id, o.created_at, o.total,
       SUM(o.total) OVER (PARTITION BY o.customer_id ORDER BY o.created_at) AS running_total
FROM orders o
JOIN customers cu ON cu.customer_id = o.customer_id
ORDER BY o.customer_id, o.created_at;

-- Q18 Business question: which weekday brings the most revenue (staffing plan)?
-- Type: FREE - date_trunc + TO_CHAR + GROUP BY over the 500 000-row log
SELECT EXTRACT(ISODOW FROM sold_at)::int AS weekday_number,
       TO_CHAR(sold_at, 'Day') AS weekday,
       COUNT(*) AS sales,
       ROUND(SUM(amount)) AS revenue
FROM sales_log
GROUP BY 1, 2
ORDER BY revenue DESC;

-- Q19 Business question: which customers spend more than the average customer?
-- Type: FREE - CTE (WITH) + JOIN
WITH spend AS (
    SELECT customer_id, SUM(total) AS total_spent
    FROM orders
    WHERE status <> 'cancelled'
    GROUP BY customer_id
)
SELECT cu.full_name, cu.city, s.total_spent
FROM spend s
JOIN customers cu ON cu.customer_id = s.customer_id
WHERE s.total_spent > (SELECT AVG(total_spent) FROM spend)
ORDER BY s.total_spent DESC;

-- Q20 Business question: how many different customers tried each product line?
-- Type: FREE - GROUP BY + COUNT(DISTINCT) + CASE segment
SELECT c.name AS category,
       COUNT(DISTINCT oi.product_id) AS products_sold,
       COUNT(DISTINCT o.customer_id) AS unique_customers,
       SUM(oi.quantity) AS units,
       CASE WHEN SUM(oi.quantity) >= 3 THEN 'hit' ELSE 'normal' END AS demand
FROM order_items oi
JOIN products p ON p.product_id = oi.product_id
JOIN categories c ON c.category_id = p.category_id
JOIN orders o ON o.order_id = oi.order_id
GROUP BY c.name
ORDER BY units DESC;
