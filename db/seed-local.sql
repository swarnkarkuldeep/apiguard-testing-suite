-- Seed data for the LOCAL environment.
INSERT INTO users (name, email, password_hash, role) VALUES
 ('Local Admin', 'admin@iguard.local', '$2a$10$guZVeljeDiYSnrJCDueMtObjAr3TvpwXRKfjVHrA0BfQmtNZnbB4y', 'admin'),
 ('Local User',  'user@iguard.local',  '$2a$10$IMoXamkY5mCegLTS2.zOxOl0NXIDBC66TuDjZBV5fBVre5y56AZ0C', 'user');

INSERT INTO products (name, sku, price, stock) VALUES
 ('Wireless Mouse',      'LOC-MOUSE-001', 19.99, 100),
 ('Mechanical Keyboard', 'LOC-KEYB-001',  59.50,  50),
 ('USB-C Cable 1m',      'LOC-CABLE-001',  7.25, 200),
 ('Laptop Stand',        'LOC-STAND-001', 34.00,  25),
 ('Webcam 1080p',        'LOC-CAM-001',   45.00,  40);
