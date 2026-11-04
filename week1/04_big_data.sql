-- =============================================================
-- SavdoShop - Week 1, Step 1.11: 500 000 rows and the index test
-- Run each "Step" separately in pgAdmin (select it, press F5).
-- Write the two execution times of Step 2 and Step 3 in your report.
-- =============================================================

-- Step 0: create an empty table for the sales log
DROP TABLE IF EXISTS sales_log CASCADE;

CREATE TABLE sales_log (
    id         BIGSERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    city       VARCHAR(50) NOT NULL,
    amount     NUMERIC(12,2) NOT NULL,
    sold_at    TIMESTAMPTZ NOT NULL
);

-- Step 1: generate 500 000 random sales in one statement
INSERT INTO sales_log (product_id, city, amount, sold_at)
SELECT 1 + floor(random() * 12)::int,
       (ARRAY['Tashkent','Samarkand','Bukhara','Namangan','Andijan',
              'Fergana','Khiva','Nukus'])[1 + floor(random() * 8)::int],
       round((50000 + random() * 2000000)::numeric, -3),
       now() - random() * interval '365 days'
FROM generate_series(1, 500000);

ANALYZE sales_log;                        -- refresh planner statistics

SELECT COUNT(*) FROM sales_log;

-- Step 2: measure a query WITHOUT an index (look for "Seq Scan" + Execution Time)
EXPLAIN ANALYZE
SELECT COUNT(*), SUM(amount)
FROM sales_log
WHERE city = 'Khiva' AND sold_at > now() - interval '30 days';

-- Step 3: add a composite index and measure again (look for "Index" / "Bitmap")
CREATE INDEX idx_sales_city_date ON sales_log (city, sold_at);

EXPLAIN ANALYZE
SELECT COUNT(*), SUM(amount)
FROM sales_log
WHERE city = 'Khiva' AND sold_at > now() - interval '30 days';
-- Write both execution times in your report and explain the difference.

-- Step 4: monthly revenue trend (time-series analytics)
SELECT date_trunc('month', sold_at)::date AS month,
       COUNT(*)                           AS sales,
       ROUND(SUM(amount))                 AS revenue
FROM sales_log
GROUP BY 1
ORDER BY 1;

-- Step 5: materialized view = pre-computed summary for fast dashboards
DROP MATERIALIZED VIEW IF EXISTS mv_city_daily;
CREATE MATERIALIZED VIEW mv_city_daily AS
SELECT city, sold_at::date AS day, COUNT(*) AS sales, SUM(amount) AS revenue
FROM sales_log
GROUP BY city, sold_at::date;

SELECT * FROM mv_city_daily WHERE city = 'Tashkent' ORDER BY day DESC LIMIT 7;

REFRESH MATERIALIZED VIEW mv_city_daily; -- run again after new data arrives

-- Step 6: top 3 products in every city (window function over 500k rows)
SELECT * FROM (
      SELECT city, product_id, SUM(amount) AS revenue,
             ROW_NUMBER() OVER (PARTITION BY city ORDER BY SUM(amount) DESC) AS rn
      FROM sales_log
      GROUP BY city, product_id
) t
WHERE rn <= 3
ORDER BY city, rn;
