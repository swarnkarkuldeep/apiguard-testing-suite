-- Seed data for the STAGING environment (different products/counts than local).
INSERT INTO users (name, email, password_hash, role) VALUES
 ('Staging Admin', 'admin@iguard.staging', '$2a$10$0o4bLvVJ9OVR3WZXxWR/duRe2xak36RpT4ZXOCFLAUfoNuLFCHEuS', 'admin'),
 ('Staging User',  'user@iguard.staging',  '$2a$10$VXpXHj3S.KLNhBPj0nIjiuhTlgzn7Iw/P6wW94tzXwO/B9IbAe9cS', 'user');

INSERT INTO products (name, sku, price, stock) VALUES
 ('Noise-Cancelling Headphones', 'STG-HEAD-001', 129.00, 30),
 ('Portable SSD 1TB',            'STG-SSD-001',   89.90, 60),
 ('Monitor 27in',                'STG-MON-001',  219.00, 15),
 ('Desk Lamp',                   'STG-LAMP-001',  24.99, 80),
 ('Bluetooth Speaker',           'STG-SPK-001',   39.00, 45),
 ('Phone Charger 30W',           'STG-CHG-001',   15.50, 120),
 ('Ergonomic Chair',             'STG-CHAIR-001',199.00, 10);
