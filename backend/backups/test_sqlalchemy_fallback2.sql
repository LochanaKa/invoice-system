-- SQLALCHEMY_BACKUP: true
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

DROP TABLE IF EXISTS company_settings CASCADE;
CREATE TABLE company_settings (
	id INTEGER NOT NULL, 
	company_name VARCHAR(200) NOT NULL, 
	address TEXT, 
	tin VARCHAR(50), 
	phone_numbers TEXT, 
	default_warranty_text TEXT, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

DROP TABLE IF EXISTS rate_settings CASCADE;
CREATE TABLE rate_settings (
	id SERIAL NOT NULL, 
	key VARCHAR(80) NOT NULL, 
	label VARCHAR(120) NOT NULL, 
	rate NUMERIC(8, 6) NOT NULL, 
	rate_type VARCHAR(30) NOT NULL, 
	description TEXT, 
	is_active BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (key)
);

DROP TABLE IF EXISTS reps CASCADE;
CREATE TABLE reps (
	id SERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	code VARCHAR(20) NOT NULL, 
	phone VARCHAR(30), 
	role VARCHAR(100), 
	is_active BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (code)
);

DROP TABLE IF EXISTS routes CASCADE;
CREATE TABLE routes (
	id SERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	is_active BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

DROP TABLE IF EXISTS settings CASCADE;
CREATE TABLE settings (
	id INTEGER NOT NULL, 
	sscl_pct NUMERIC(8, 6) NOT NULL, 
	vat_pct NUMERIC(8, 6) NOT NULL, 
	profit_margin NUMERIC(8, 6) NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

DROP TABLE IF EXISTS user_preferences CASCADE;
CREATE TABLE user_preferences (
	id SERIAL NOT NULL, 
	system_id VARCHAR(80) NOT NULL, 
	dashboard_layout JSONB NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (system_id)
);

DROP TABLE IF EXISTS appointments CASCADE;
CREATE TABLE appointments (
	id SERIAL NOT NULL, 
	apo_number VARCHAR(50) NOT NULL, 
	rep_id INTEGER NOT NULL, 
	appointment_date DATE NOT NULL, 
	delivery_method VARCHAR(30), 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (apo_number), 
	FOREIGN KEY(rep_id) REFERENCES reps (id)
);

DROP TABLE IF EXISTS customers CASCADE;
CREATE TABLE customers (
	id SERIAL NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	tin VARCHAR(20), 
	is_vat_registered BOOLEAN, 
	is_active BOOLEAN, 
	route_id INTEGER, 
	phone VARCHAR(30), 
	address TEXT, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(route_id) REFERENCES routes (id)
);

DROP TABLE IF EXISTS invoices CASCADE;
CREATE TABLE invoices (
	id BIGSERIAL NOT NULL, 
	invoice_number VARCHAR(50) NOT NULL, 
	invoice_category VARCHAR(10) NOT NULL, 
	service_type VARCHAR(20) NOT NULL, 
	invoice_date DATE NOT NULL, 
	customer_id INTEGER NOT NULL, 
	rep_id INTEGER, 
	appointment_id INTEGER, 
	route_id INTEGER, 
	amount NUMERIC(12, 2) NOT NULL, 
	base_subtotal NUMERIC(12, 2) NOT NULL, 
	profit_margin_pct NUMERIC(8, 6) NOT NULL, 
	profit_margin_amount NUMERIC(12, 2) NOT NULL, 
	sscl_pct NUMERIC(8, 6) NOT NULL, 
	sscl_amount NUMERIC(12, 2) NOT NULL, 
	vat_pct NUMERIC(8, 6) NOT NULL, 
	vat_amount NUMERIC(12, 2) NOT NULL, 
	grand_total NUMERIC(12, 2) NOT NULL, 
	credit_balance NUMERIC(12, 2) NOT NULL, 
	remarks TEXT, 
	is_vat_posted BOOLEAN, 
	contact_name VARCHAR(100), 
	due_date DATE, 
	po_number VARCHAR(50), 
	warranty VARCHAR(100), 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (invoice_number), 
	FOREIGN KEY(customer_id) REFERENCES customers (id), 
	FOREIGN KEY(rep_id) REFERENCES reps (id), 
	FOREIGN KEY(appointment_id) REFERENCES appointments (id), 
	FOREIGN KEY(route_id) REFERENCES routes (id)
);

DROP TABLE IF EXISTS invoice_items CASCADE;
CREATE TABLE invoice_items (
	id BIGSERIAL NOT NULL, 
	invoice_id BIGINT NOT NULL, 
	line_number INTEGER NOT NULL, 
	description VARCHAR(300) NOT NULL, 
	serial_no VARCHAR(200), 
	qty INTEGER NOT NULL, 
	raw_rate NUMERIC(12, 2) NOT NULL, 
	rate NUMERIC(12, 2) NOT NULL, 
	amount NUMERIC(12, 2) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(invoice_id) REFERENCES invoices (id)
);

DROP TABLE IF EXISTS payments CASCADE;
CREATE TABLE payments (
	id BIGSERIAL NOT NULL, 
	invoice_id BIGINT NOT NULL, 
	payment_method VARCHAR(30) NOT NULL, 
	amount NUMERIC(12, 2) NOT NULL, 
	cheque_number VARCHAR(50), 
	bank VARCHAR(100), 
	date_of_payment DATE, 
	recorded_by_rep_id INTEGER, 
	reference_notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(invoice_id) REFERENCES invoices (id), 
	FOREIGN KEY(recorded_by_rep_id) REFERENCES reps (id)
);

-- Data for table company_settings
INSERT INTO company_settings (id, company_name, address, tin, phone_numbers, default_warranty_text, updated_at) VALUES (1, 'Creative Computers', 'No. 95, Colombo Road, Kurunegala', '783634953-7000', '+94 37 22 29 181
+94 77 57 67 070', 'Please submit the Original Invoice for warranty claims.
Warranty period is one year less than 14 working days
Good once sold are not refundable
No warranty Keyboard, Mouse, Speakers, Cartridges, Toners, Ribbons, Printer Heads and all consumable items.
Warranty covers only Manufacture Defects: Software & Virus issues, Damages or defects or due to other causes such as negligence misuse improper
operations, power fluctuation, lightening or other natural disaster. Sabotage or accidents etc are NOT included under this warranty.
The customer bound to protect all the serial & warranty stickers for any warranty claims. If not, no warranty claims will be issued for such items, even if the
original invoice were produced.
Repair or replacements necessitated by such causes not covered by the warranty are subject to changes for labour, time & material. Warranty replacement
would be provided with available technology, if identical replacement is not available.
Creative Computers is not liable or bonds to provide any On Site Services unless specified by a Quotation / Maintenance Agreement or on the Original
Invoice. The customer bound to carry in any items at his / hers own expenses for such warranty claims / repairs or services.
The customer bound with creative to pay above balance within one week.
All payments can be done through cash or cheques&cheques to be drawn in favor of Creative Computers. "A/C Payee Only"', '2026-06-30T00:35:02.316841');

-- Data for table rate_settings
INSERT INTO rate_settings (id, key, label, rate, rate_type, description, is_active, created_at, updated_at) VALUES (1, 'sscl_pct', 'SSCL', 0.025000, 'tax', 'Social Security Contribution Levy', TRUE, '2026-06-29T23:37:41.550453', '2026-06-29T23:37:41.550453');
INSERT INTO rate_settings (id, key, label, rate, rate_type, description, is_active, created_at, updated_at) VALUES (2, 'vat_pct', 'VAT', 0.180000, 'tax', 'Value Added Tax', TRUE, '2026-06-29T23:37:41.550453', '2026-06-29T23:37:41.550453');
INSERT INTO rate_settings (id, key, label, rate, rate_type, description, is_active, created_at, updated_at) VALUES (3, 'profit_margin', 'Profit Margin', 0.200000, 'margin', 'Default item markup', TRUE, '2026-06-29T23:37:41.550453', '2026-06-30T00:37:53.126530');

-- Data for table reps
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (2, 'Asanka', 'CC-0001', NULL, 'CEO', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (1, 'Joseph', 'CC-0002', NULL, 'General Manager', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (5, 'Hasitha', 'CC-0003', NULL, 'Sales Representative', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (3, 'Pramod', 'CC-0004', NULL, 'Sales Represantative', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (4, 'Shen', 'CC-0005', NULL, 'Sales Represantative', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (6, 'Rep One', 'CC-0006', '0710000001', 'Sales', TRUE, '2026-06-29T21:08:58.599575');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (7, 'Rep Two', 'CC-0007', '0710000002', 'Sales', TRUE, '2026-06-29T21:08:58.604429');

-- Data for table routes
INSERT INTO routes (id, name, is_active, created_at) VALUES (1, 'Puttlam', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (2, 'Dambulla', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (3, 'Kandy', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (4, 'Chilaw', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (5, 'Kurunegala', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (6, 'Mawathagama', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (7, 'Giriulla', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (8, 'Polpithigama', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (9, 'Galgamuwa', TRUE, '2026-06-25T07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (11, 'Walk-In Customer', TRUE, '2026-06-29T21:55:39.140131');
INSERT INTO routes (id, name, is_active, created_at) VALUES (12, 'Jaffa', TRUE, '2026-06-29T23:52:51.445432');
INSERT INTO routes (id, name, is_active, created_at) VALUES (10, 'Other', FALSE, '2026-06-25T07:37:29.676500');

-- Data for table settings
INSERT INTO settings (id, sscl_pct, vat_pct, profit_margin, updated_at) VALUES (1, 0.025000, 0.180000, 0.200000, '2026-06-30T00:37:53.126530');

-- Data for table user_preferences
INSERT INTO user_preferences (id, system_id, dashboard_layout, created_at, updated_at) VALUES (1, 'default', '[{"h": 2, "i": "kpis", "w": 12, "x": 0, "y": 0, "minH": 2, "minW": 6}, {"h": 6, "i": "revenue-trend", "w": 8, "x": 0, "y": 2, "minH": 4, "minW": 5}, {"h": 3, "i": "yoy", "w": 4, "x": 8, "y": 2, "minH": 3, "minW": 3}, {"h": 5, "i": "top-customers", "w": 4, "x": 4, "y": 13, "minH": 3, "minW": 3}, {"h": 5, "i": "top-outstanding", "w": 4, "x": 0, "y": 13, "minH": 3, "minW": 3}, {"h": 5, "i": "route-performance", "w": 4, "x": 8, "y": 5, "minH": 4, "minW": 3}, {"h": 3, "i": "aging", "w": 4, "x": 8, "y": 10, "minH": 3, "minW": 3}, {"h": 5, "i": "leaderboard", "w": 8, "x": 0, "y": 8, "minH": 3, "minW": 5}, {"h": 5, "i": "recent-invoices", "w": 4, "x": 8, "y": 13, "minH": 3, "minW": 4}]'::jsonb, '2026-06-30T01:30:25.965648', '2026-06-30T02:32:36.368578');

-- Data for table appointments
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (1, '2026-01-R001', 2, '2026-01-06', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (2, '2026-01-R002', 1, '2026-01-07', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (3, '2026-01-R005', 1, '2026-01-09', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (4, '2026-01-R006', 3, '2026-01-10', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (5, '2026-01-R007', 2, '2026-01-13', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (6, '2026-01-R009', 3, '2026-01-14', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (7, '2026-01-R011', 2, '2026-01-16', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (8, '2026-01-R014', 4, '2026-01-17', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (9, '2026-01-R016', 2, '2026-01-19', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (10, '2026-01-R018', 3, '2026-01-21', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (11, '2026-01-R020', 1, '2026-01-22', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (12, '2026-01-R021', 2, '2026-01-23', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (13, '2026-01-S006', 1, '2026-01-01', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (14, '2026-01-S007', 1, '2026-01-02', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (15, '2026-01-S013', 2, '2026-01-05', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (16, '2026-01-S019', 1, '2026-01-06', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (17, '2026-01-S020', 1, '2026-01-08', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (18, '2026-01-S022', 1, '2026-01-09', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (19, '2026-01-S026', 2, '2026-01-10', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (20, '2026-01-S033', 2, '2026-01-12', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (21, '2026-01-S035', 2, '2026-01-13', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (22, '2026-01-S038', 3, '2026-01-14', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (23, '2026-01-S044', 2, '2026-01-16', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (24, '2026-01-S049', 1, '2026-01-17', 'BY_COURIER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (25, '2026-01-S050', 2, '2026-01-19', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (26, '2026-01-S051', 2, '2026-01-20', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (27, '2026-01-S054', 2, '2026-01-21', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (28, '2026-01-S056', 2, '2026-01-22', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (29, '2026-01-S059', 4, '2026-01-23', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (30, '2026-02-R002', 3, '2026-02-06', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (31, '2026-02-R003', 2, '2026-02-09', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (32, '2026-02-R005', 4, '2026-02-18', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (33, '2026-02-R006', 2, '2026-02-20', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (34, '2026-02-R007', 2, '2026-02-21', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (35, '2026-02-R009', 3, '2026-02-23', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (36, '2026-02-R011', 3, '2026-02-24', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (37, '2026-02-R013', 3, '2026-02-26', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (38, '2026-02-R014', 4, '2026-02-27', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (39, '2026-02-S016', 1, '2026-02-02', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (40, '2026-02-S019', 3, '2026-02-05', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (41, '2026-02-S028', 2, '2026-02-06', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (42, '2026-02-S029', 2, '2026-02-07', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (43, '2026-02-S032', 2, '2026-02-09', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (44, '2026-02-S033', 2, '2026-02-10', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (45, '2026-02-S038', 2, '2026-02-11', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (46, '2026-02-S040', 3, '2026-02-12', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (47, '2026-02-S041', 1, '2026-02-13', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (48, '2026-02-S042', 1, '2026-02-14', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (49, '2026-02-S046', 1, '2026-02-16', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (50, '2026-02-S049', 4, '2026-02-18', 'BY_COURIER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (51, '2026-02-S052', 1, '2026-02-19', 'BY_COURIER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (52, '2026-02-S058', 2, '2026-02-20', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (53, '2026-02-S059', 2, '2026-02-21', 'BY_COURIER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (54, '2026-02-S062', 3, '2026-02-23', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (55, '2026-02-S063', 2, '2026-02-24', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (56, '2026-02-S066', 2, '2026-02-25', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (57, '2026-02-S069', 2, '2026-02-26', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (58, '2026-02-S073', 4, '2026-02-27', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (59, '2026-03-R002', 3, '2026-03-03', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (60, '2026-03-R006', 3, '2026-03-04', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (61, '2026-03-R007', 2, '2026-03-06', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (62, '2026-03-R009', 2, '2026-03-07', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (63, '2026-03-R010', 2, '2026-03-09', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (64, '2026-03-R015', 2, '2026-03-11', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (65, '2026-03-R016', 1, '2026-03-13', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (66, '2026-03-R018', 1, '2026-03-16', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (67, '2026-03-R019', 3, '2026-03-25', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (68, '2026-03-R020', 2, '2026-03-31', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (69, '2026-03-S004', 3, '2026-03-03', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (70, '2026-03-S008', 3, '2026-03-04', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (71, '2026-03-S011', 2, '2026-03-06', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (72, '2026-03-S018', 3, '2026-03-07', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (73, '2026-03-S021', 2, '2026-03-09', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (74, '2026-03-S023', 2, '2026-03-10', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (75, '2026-03-S028', 2, '2026-03-11', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (76, '2026-03-S033', 3, '2026-03-12', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (77, '2026-03-S034', 1, '2026-03-13', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (78, '2026-03-S036', 1, '2026-03-14', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (79, '2026-03-S040', 1, '2026-03-16', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (80, '2026-03-S041', 1, '2026-03-17', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (81, '2026-03-S042', 1, '2026-03-18', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (82, '2026-03-S045', 3, '2026-03-19', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (83, '2026-03-S048', 3, '2026-03-23', 'BY_COURIER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (84, '2026-03-S049', 2, '2026-03-24', 'BY_COURIER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (85, '2026-03-S050', 1, '2026-03-25', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (86, '2026-03-S056', 2, '2026-03-30', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (87, '2026-03-S058', 2, '2026-03-31', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (88, '2026-04-R004', 4, '2026-04-02', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (89, '2026-04-R007', 3, '2026-04-03', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (90, '2026-04-R009', 2, '2026-04-06', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (91, '2026-04-R010', 2, '2026-04-07', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (92, '2026-04-R011', 2, '2026-04-10', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (93, '2026-04-R013', 1, '2026-04-18', 'BY_COURIER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (94, '2026-04-R014', 1, '2026-04-22', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (95, '2026-04-R017', 3, '2026-04-25', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (96, '2026-04-R020', 1, '2026-04-29', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (97, '2026-04-R021', 2, '2026-04-30', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (98, '2026-04-S001', 1, '2026-04-02', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (99, '2026-04-S004', 2, '2026-04-04', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (100, '2026-04-S006', 2, '2026-04-06', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (101, '2026-04-S007', 2, '2026-04-07', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (102, '2026-04-S011', 2, '2026-04-08', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (103, '2026-04-S018', 2, '2026-04-09', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (104, '2026-04-S025', 2, '2026-04-10', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (105, '2026-04-S028', 2, '2026-04-17', 'BY_COURIER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (106, '2026-04-S030', 1, '2026-04-20', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (107, '2026-04-S035', 1, '2026-04-21', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (108, '2026-04-S036', 1, '2026-04-22', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (109, '2026-04-S048', 1, '2026-04-27', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (110, '2026-04-S051', 1, '2026-04-28', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (111, '2026-04-S061', 1, '2026-04-29', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (112, '2026-04-S064', 3, '2026-04-30', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (113, '2026-05-R001', 3, '2026-05-01', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (114, '2026-05-R004', 4, '2026-05-03', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (115, '2026-05-R008', 2, '2026-05-05', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (116, '2026-05-R009', 1, '2026-05-06', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (117, '2026-05-R010', 4, '2026-05-07', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (118, '2026-05-R012', 1, '2026-05-08', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (119, '2026-05-R014', 1, '2026-05-11', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (120, '2026-05-R016', 3, '2026-05-12', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (121, '2026-05-R017', 4, '2026-05-13', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (122, '2026-05-R018', 4, '2026-05-14', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (123, '2026-05-R020', 2, '2026-05-16', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (124, '2026-05-R021', 4, '2026-05-19', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (125, '2026-05-R024', 3, '2026-05-20', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (126, '2026-05-R028', 4, '2026-05-22', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (127, '2026-05-R029', 3, '2026-05-23', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (128, '2026-05-R030', 3, '2026-05-25', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (129, '2026-05-R032', 4, '2026-05-27', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (130, '2026-05-R034', 4, '2026-05-28', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (131, '2026-05-R037', 4, '2026-05-29', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (132, '2026-05-S002', 3, '2026-05-01', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (133, '2026-05-S003', 2, '2026-05-02', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (134, '2026-05-S010', 2, '2026-05-05', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (135, '2026-05-S015', 4, '2026-05-06', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (136, '2026-05-S017', 4, '2026-05-07', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (137, '2026-05-S022', 1, '2026-05-08', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (138, '2026-05-S026', 4, '2026-05-11', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (139, '2026-05-S031', 5, '2026-05-12', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (140, '2026-05-S035', 3, '2026-05-13', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (141, '2026-05-S041', 2, '2026-05-15', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (142, '2026-05-S043', 2, '2026-05-16', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (143, '2026-05-S044', 2, '2026-05-18', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (144, '2026-05-S049', 3, '2026-05-19', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (145, '2026-05-S051', 3, '2026-05-20', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (146, '2026-05-S055', 3, '2026-05-21', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (147, '2026-05-S058', 3, '2026-05-25', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (148, '2026-05-S059', 4, '2026-05-26', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (149, '2026-05-S060', 2, '2026-05-29', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (150, '2026-06-R001', 3, '2026-06-02', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (151, '2026-06-R002', 3, '2026-06-03', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (152, '2026-06-R006', 4, '2026-06-04', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (153, '2026-06-R007', 4, '2026-06-07', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (154, '2026-06-R008', 1, '2026-06-09', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (155, '2026-06-R010', 1, '2026-06-11', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (156, '2026-06-R013', 4, '2026-06-12', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (157, '2026-06-R014', 3, '2026-06-15', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (158, '2026-06-R015', 2, '2026-06-17', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (159, '2026-06-R016', 1, '2026-06-23', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (160, '2026-06-R018', 2, '2026-06-24', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (161, '2026-06-S003', 1, '2026-06-01', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (162, '2026-06-S005', 3, '2026-06-02', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (163, '2026-06-S006', 3, '2026-06-03', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (164, '2026-06-S007', 4, '2026-06-04', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (165, '2026-06-S012', 1, '2026-06-06', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (166, '2026-06-S013', 1, '2026-06-08', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (167, '2026-06-S015', 1, '2026-06-09', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (168, '2026-06-S017', 1, '2026-06-10', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (169, '2026-06-S018', 1, '2026-06-11', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (170, '2026-06-S019', 1, '2026-06-12', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (171, '2026-06-S020', 3, '2026-06-15', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (172, '2026-06-S029', 3, '2026-06-16', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (173, '2026-06-S034', 2, '2026-06-17', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (174, '2026-06-S037', 3, '2026-06-18', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (175, '2026-06-S039', 3, '2026-06-19', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (176, '2026-06-S040', 3, '2026-06-20', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (177, '2026-06-S044', 1, '2026-06-22', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (178, '2026-06-S053', 2, '2026-06-23', 'OTHER', NULL, '2026-06-25T07:39:04.299251');
INSERT INTO appointments (id, apo_number, rep_id, appointment_date, delivery_method, notes, created_at) VALUES (179, '2026-06-S061', 2, '2026-06-24', 'OTHER', NULL, '2026-06-25T07:39:04.299251');

-- Data for table customers
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (2, 'Agrarian Service - Paduwasnuwara', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (3, 'Agrarian Service - Palugaswewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (4, 'Animal Production & health - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (5, 'Animal Production & health NWP - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (6, 'Animal Prodution & Health Department - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (7, 'Athhuwana Senanayaka Primary School - Chilaw', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (8, 'C.S.I.A.P OFFICE - Kurunegla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (9, 'Council Office NWP - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (10, 'D .A . N Karawgoda - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (15, 'Dedunu Bakers - Waduragala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (16, 'Department Of Animal Production and Health ( NWP ) - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (17, 'Distric Samurdi Office - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (18, 'Divisional Education Office - Arachchikattuwa', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (19, 'Divisional Forest Office - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (20, 'Divisional Secretariat - Bamunakotuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (21, 'Divisional Secretariat - Bingiriya', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (22, 'Divisional Secretariat - Galgamuwa', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (23, 'Divisional Secretariat - Ganewatta', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (24, 'Divisional Secretariat - Giribawa', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (25, 'Divisional Secretariat - Hingurakgoda', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (26, 'Divisional Secretariat - Ibbagamuwa', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (27, 'Divisional Secretariat - Kotawehera', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (28, 'Divisional Secretariat - Kuliyapitiya East', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (29, 'Divisional Secretariat - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (30, 'Divisional Secretariat - Madampe', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (31, 'Divisional Secretariat - Mallawapitiya', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (32, 'Divisional Secretariat - Mawathagama', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (33, 'Divisional Secretariat - Naththandiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (34, 'Divisional Secretariat - Polgahawela', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (35, 'Divisional Secretariat - Polpithigama', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (36, 'Divisional Secretariat - Rideegama', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (37, 'Divisional Secretariat - Wariyapola', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (38, 'Dodangaslanda - Mr Dipani', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (39, 'End Customer - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (40, 'Engineering Department - NWP', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (41, 'Forest Office - Maho', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (42, 'Gaya Invesment - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (43, 'Gaya Investment - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (44, 'Hameesha Agency - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (45, 'High Cort - Puttalam', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (46, 'Hitmallage Sudarma She Kumara Nayaka - Ambanpola', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (47, 'Janana Book Shop - Gonagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (48, 'Janana Mobile - Gonagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (49, 'KU / Kosgolla K.V - Kosgolla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (50, 'Ku / Wellawa Centarl College - Wellawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (51, 'M. B.M.U.N. Balasuriya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (52, 'MARS NETWORKS (PVT) LTD, NO. 164, THIMBIRIGASYAYA ROAD, COLOMBO 05', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (53, 'MR B.SILVA', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (54, 'Mahathorawa Pagnakirthi Himi - Henamulla Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (55, 'Ministry Of Co - Operative Development NWP - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (56, 'Mr Amila - Hewapola', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (57, 'Mr Anura Yapa - Maeliya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (58, 'Mr Anuruddh - Maduragala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (59, 'Mr Anuruddh - Waduragala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (60, 'Mr Ashoka - Malkaduwawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (61, 'Mr Athula - Bamunugedara', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (62, 'Mr Chaminda - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (63, 'Mr Chandima - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (64, 'Mr Dasanayaka - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (65, 'Mr Dinesh - Mawathagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (66, 'Mr Ekanayaka - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (67, 'Mr Granwil - Malkaduwawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (68, 'Mr Ilham - Ibbagamuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (69, 'Mr Imalka - Uhumiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (70, 'Mr KARAWGODA - Waduragala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (71, 'Mr Kanchana - Ambakote', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (72, 'Mr Kirialla - Polgahawela', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (73, 'Mr Kulawansa - Polpithigama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (74, 'Mr Lahiru - Polpithigama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (75, 'Mr Lakshan - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (76, 'Mr Lochana - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (77, 'Mr Madawa - Mawathagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (78, 'Mr Madawala - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (79, 'Mr Nissanka - Pannipitiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (80, 'Mr Pasindu - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (81, 'Mr Pradip - Ibbagamuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (82, 'Mr Ranaweera - Kandulawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (83, 'Mr Ranjith - Dodangaslanda', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (84, 'Mr Ranura - Uyandana', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (85, 'Mr Rathnayaka - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (86, 'Mr Rusuri - Uyandana', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (87, 'Mr Sajith - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (88, 'Mr Shiwantha - Yanthampalawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (89, 'Mr Thilakarathna - Thiththawella', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (90, 'Mr Vijemuni - Kohilagedara', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (91, 'Mr Vinod Deshan - Dunakadeniya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (92, 'Mr Wanninayaka - Ehetuwewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (93, 'Mr Wicramasinha - Mallawapitiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (94, 'Mr Wijemuni - Kohilagedara', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (95, 'Mrs U.D.N Rathnayaka - Mawathagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (96, 'Ms Anusha - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (97, 'Ms Gayani - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (98, 'Ms Heshani - Anamaduwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (12, 'DIVISIONAL SECRETARIAT - POLGAHAWELA', NULL, TRUE, FALSE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (14, 'DIVISIONAL SECRETRIAT - POLGAHAWELA', NULL, TRUE, FALSE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (13, 'DIVISIONAL SECRETARIAT - RIDEEGAMA', NULL, TRUE, FALSE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (99, 'Ms Janaka - Mawathagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (100, 'Ms Kumari - Kuruwikulama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (101, 'Ms Piyumi - Popithigama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (102, 'Ms Prasanthi - Moder Waththa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (103, 'Ms Tharushi - Galgamuwa', NULL, FALSE, TRUE, 1, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (104, 'Ms Wasanthi - Wilgoda', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (105, 'N.W.P Engineering Department - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (106, 'Nalinda motors - Kandulawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (107, 'Nika / Hal /Thennakongama Mv ,Awlegama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (108, 'Officenexus - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (109, 'Patrick Pereira - Moder St,Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (110, 'Plastica International ( pvt ) ltd - Pothuwatuna', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (111, 'Provincial Council - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (112, 'ROMESH MADUSHANKA - WARIYAPOLA', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (113, 'Regional directorate of Health Services - Kurunegala', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (114, 'Regional directorate of Health Services - Madampe', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (115, 'Rice Research and Development Institute - Batalagoda', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (116, 'Royal Printers - Polpithigama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (117, 'SAMURDHI BANK - HETTIGEDARA', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (118, 'SAMURDHI BANK - KATUNERIYA', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (119, 'SAMURDHI BANK - MADDEGAMA', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (120, 'SAMURDHI BANK - NARAWILA', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (121, 'SAMURDHI BANK - NATHTHANDIYA', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (122, 'SAMURDHI BANK - WATAREKA', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (123, 'Samasi Manpower Service - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (124, 'Samurdh Bank - Thissawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (125, 'Samurdh Bank - Wakkunuwala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (126, 'Samurdhi Bank - Anamaduwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (127, 'Samurdhi Bank - Arachchikattuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (128, 'Samurdhi Bank - Awulegama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (129, 'Samurdhi Bank - Boralessa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (130, 'Samurdhi Bank - Boraluwewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (131, 'Samurdhi Bank - Boyagane', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (132, 'Samurdhi Bank - Boyagne', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (133, 'Samurdhi Bank - Boyawalana', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (134, 'Samurdhi Bank - Bulnewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (135, 'Samurdhi Bank - Chilaw', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (136, 'Samurdhi Bank - Dambagirigama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (137, 'Samurdhi Bank - Dampitiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (138, 'Samurdhi Bank - Dankotuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (139, 'Samurdhi Bank - Dehikumbura', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (140, 'Samurdhi Bank - Delvita', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (141, 'Samurdhi Bank - Delwita', NULL, FALSE, TRUE, 3, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (142, 'Samurdhi Bank - Denagmuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (143, 'Samurdhi Bank - Diwullapitiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (144, 'Samurdhi Bank - Diyathure', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (145, 'Samurdhi Bank - Dodangaslanda', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (146, 'Samurdhi Bank - Ehetuwewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (147, 'Samurdhi Bank - Galmuruwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (148, 'Samurdhi Bank - Gattuwana', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (149, 'Samurdhi Bank - Gettuwana', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (150, 'Samurdhi Bank - Girathalana 1', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (151, 'Samurdhi Bank - Girathalana I', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (152, 'Samurdhi Bank - Giriulla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (153, 'Samurdhi Bank - Gokarella', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (154, 'Samurdhi Bank - Gonadeniya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (155, 'Samurdhi Bank - Hammaliya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (156, 'Samurdhi Bank - Hettigedara', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (157, 'Samurdhi Bank - Hewanpelessa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (158, 'Samurdhi Bank - Hindagolla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (159, 'Samurdhi Bank - Hondella', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (160, 'Samurdhi Bank - Horombawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (161, 'Samurdhi Bank - Ibbagamuwa', NULL, FALSE, TRUE, 2, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (162, 'Samurdhi Bank - Ihakolagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (163, 'Samurdhi Bank - Ihalagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (164, 'Samurdhi Bank - Inigodawela', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (165, 'Samurdhi Bank - Kalugall', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (166, 'Samurdhi Bank - Kalugalla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (167, 'Samurdhi Bank - Kanadeniyawala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (168, 'Samurdhi Bank - Kandulawa', NULL, FALSE, TRUE, 2, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (169, 'Samurdhi Bank - Karadagolla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (170, 'Samurdhi Bank - Karandagolla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (171, 'Samurdhi Bank - Karandapaththuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (172, 'Samurdhi Bank - Karuwalagaswewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (173, 'Samurdhi Bank - Katuneriya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (174, 'Samurdhi Bank - Katupitiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (175, 'Samurdhi Bank - Kelemulla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (176, 'Samurdhi Bank - Kobeigane', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (177, 'Samurdhi Bank - Kokkavila', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (178, 'Samurdhi Bank - Kotawehera', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (179, 'Samurdhi Bank - Kottukachchiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (180, 'Samurdhi Bank - Kudagalgamuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (181, 'Samurdhi Bank - Kuruwikulama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (182, 'Samurdhi Bank - Madagalla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (183, 'Samurdhi Bank - Madagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (184, 'Samurdhi Bank - Madahapola', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (185, 'Samurdhi Bank - Madddegama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (187, 'Samurdhi Bank - Mahakeliya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (188, 'Samurdhi Bank - Makandura', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (189, 'Samurdhi Bank - Malkaduwawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (190, 'Samurdhi Bank - Mallawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (191, 'Samurdhi Bank - Mallawapitiya', NULL, FALSE, TRUE, 3, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (192, 'Samurdhi Bank - Mavila', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (193, 'Samurdhi Bank - Mawathagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (194, 'Samurdhi Bank - Mawila', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (195, 'Samurdhi Bank - Melsiripura', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (196, 'Samurdhi Bank - Minuwangate', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (197, 'Samurdhi Bank - Munamaldeniya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (198, 'Samurdhi Bank - Mundalama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (199, 'Samurdhi Bank - Muneshwaram', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (200, 'Samurdhi Bank - Nakalagmuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (201, 'Samurdhi Bank - Narakkalliya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (202, 'Samurdhi Bank - Narawila', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (203, 'Samurdhi Bank - Naththandiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (204, 'Samurdhi Bank - Nawagaththegama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (205, 'Samurdhi Bank - Nikawaratiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (206, 'Samurdhi Bank - Norochcholai', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (207, 'Samurdhi Bank - Ogodapola', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (208, 'Samurdhi Bank - Palukandewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (209, 'Samurdhi Bank - Piduruwella', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (210, 'Samurdhi Bank - Pilessa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (211, 'Samurdhi Bank - Polpithigama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (212, 'Samurdhi Bank - Polpitiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (213, 'Samurdhi Bank - Puttalam', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (214, 'Samurdhi Bank - Rambadagalla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (215, 'Samurdhi Bank - Rambe', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (216, 'Samurdhi Bank - Rathmalgoda', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (217, 'Samurdhi Bank - Saliyaewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (218, 'Samurdhi Bank - Saliyawewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (219, 'Samurdhi Bank - Sangarajapura', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (220, 'Samurdhi Bank - Siyabalangamuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (221, 'Samurdhi Bank - Smailpuram', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (222, 'Samurdhi Bank - Smilepuram', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (223, 'Samurdhi Bank - Socity - Mundalama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (224, 'Samurdhi Bank - Thalagalla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (225, 'Samurdhi Bank - Udappuwa', NULL, FALSE, TRUE, 1, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (226, 'Samurdhi Bank - Uthuruyatikaha', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (227, 'Samurdhi Bank - Waduwawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (228, 'Samurdhi Bank - Wakkunuwala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (229, 'Samurdhi Bank - Walaswewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (230, 'Samurdhi Bank - Walikare', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (231, 'Samurdhi Bank - Weerambugedara', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (232, 'Samurdhi Bank - Weerapokuna', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (233, 'Samurdhi Bank - Wellawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (234, 'Samurdhi Bank - Wennappuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (235, 'Samurdhi Bank - Weralabada', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (236, 'Samurdhi Bank - Weuda', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (237, 'Samurdhi Bank - Wewagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (238, 'Samurdhi Bank - Wewagedara', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (239, 'Samurdhi Bank - Yakwila', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (240, 'Samurdhi Bank - Yanthampalawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (241, 'Samurdhi Bank - polpitiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (242, 'Samurdhi Bank - weerambugedara', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (243, 'Samurdhi Bank Head Quarters - Kuliyapitiya East', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (244, 'Samurdhi Bank Scociety - Mallawapitiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (245, 'Samurdhi Bank Society - Bamunaukotuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (246, 'Samurdhi Bank Society - Chilaw', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (247, 'Samurdhi Bank Society - Ibbagamuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (248, 'Samurdhi Bank Society - Kobeigane', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (249, 'Samurdhi Bank Society - Mahawewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (250, 'Samurdhi Bank Society - Mundel', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (251, 'Samurdhi Bank Society - Nikawaratiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (252, 'Samurdhi Bank Society - Paduwasnuwara West', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (253, 'Samurdhi Bank Society - Polpithigama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (254, 'Samurdhi Bank Society - Thambaglla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (255, 'Samurdhi Bank Society - Wanathawilluwa', NULL, FALSE, TRUE, 1, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (256, 'Samurdhi Bank Society - Wariyapola', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (257, 'Samurdhi Bank Socity - Arachchikattuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (258, 'Samurdhi Bank Socity - Mawathagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (259, 'Samurdhi Bank Socity - Mawiela', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (260, 'Samurdhi Bank Socity - Polpithigama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (261, 'Samurdhi Bank society - Horombawa', NULL, FALSE, TRUE, 4, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (262, 'Samurdhi Community Based Bank - Ehetuwewa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (263, 'Samurdhi Community Based Bank - GALKULIYA', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (264, 'Samurdhi Community Based Bank - Galkuliya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (265, 'Samurdhi Community Based Bank - Mattakotu', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (266, 'Samurdhi Community Based Bank - Mohoththawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (267, 'Samurdhi Community Based Bank - Puttalam', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (268, 'Samurdhi Community Based Bank - Wanathawilluwa', NULL, FALSE, TRUE, 1, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (269, 'Samurdhi Community Based Bank Society - Mawathagama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (270, 'Samurdhi Coomunity Based Bank - Madurankuliya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (271, 'Samurdhi Coomunity Based Bank - Mangalaeliya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (272, 'Samurdhi Coomunity Based Bank - Mundalama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (273, 'Samurdhi Coomunity Based Bank - Udappuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (274, 'Samurdhi Headquarters - Kobeigane', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (275, 'Samurdhi Headquarters - Nawagaththegama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (276, 'Samurdi Bank - Hammaliya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (277, 'Samurdi Bank - Nakalagamuwa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (278, 'Sanmurdhi Bank - Gokarella', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (279, 'Sanurdhi Bank - Hindagolla', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (280, 'Smurdhi Bank - Girathalana 1', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (281, 'Smurdhi Bank - Wariyapola', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (282, 'Suhada Computer Center - Gampaha', '806214027-7000', TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (283, 'T K Rathnayaka - Maraluwawa', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (284, 'WELLAWA CENTRAL COLLEGE', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (285, 'WELLAWA CENTRAL COLLEGEV - WELLAWA', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (286, 'Wayamba Technology - Kurunegala', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (287, 'Zonal Education - Giriulla', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (288, 'Zonal Education Office - Maho', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (289, 'Zonal Education Office - Puttalam', NULL, TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (291, 'k.a nimal wijesiri', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (292, 'samurdhi bank - boyagane', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (293, 'samurdhi bank - weerambugedara', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (1, 'Test', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (290, 'amurdhi Bank - Maddegama', NULL, FALSE, FALSE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (186, 'Samurdhi Bank - Maddegama', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (294, 'Mr. Sujith Asanka - Nailiya', NULL, FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-27T02:12:35.023000');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (295, 'Sample Customer A', 'TIN-A', TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.577275');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (296, 'Sample Customer B', 'TIN-B', FALSE, TRUE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.595194');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (297, 'Sample Customer C', 'TIN-C', TRUE, TRUE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.597302');
INSERT INTO customers (id, name, tin, is_vat_registered, is_active, route_id, phone, address, notes, created_at) VALUES (11, 'DIVISIONAL SECRETARAIT - GANEWATTA', NULL, TRUE, FALSE, NULL, NULL, NULL, NULL, '2026-06-25T07:39:03.942010');

-- Data for table invoices
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (654, '2026-01-S12495', 'VAT', 'SALE', '2026-01-14', 23, 2, NULL, NULL, 4750.00, 4750.00, 0.000000, 0.00, 0.000000, 0.00, 0.180000, 855.00, 5605.00, 5605.00, 'Fetched From Previous System', FALSE, 'The Accountant', '2026-01-21', NULL, NULL, '2026-06-29T20:50:10.132156', '2026-06-29T20:50:10.132156');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (653, '2026-01-S12494', 'VAT', 'SALE', '2026-01-13', 4, 2, NULL, NULL, 8500.00, 8500.00, 0.000000, 0.00, 0.000000, 0.00, 0.180000, 1530.00, 10030.00, 0.00, 'Fetched From Previous System', FALSE, 'The Accountant', NULL, NULL, NULL, '2026-06-29T20:41:21.875980', '2026-06-29T20:41:21.875980');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (656, 'CCFR-R00001', 'ALL_INC', 'REPAIR', '2026-01-05', 295, 6, NULL, NULL, 2100.00, 2100.00, 0.200000, 420.00, 0.025000, 63.00, 0.180000, 464.94, 3047.94, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.625138', '2026-06-29T21:08:58.625138');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (657, '2026-06-S12496', 'VAT', 'SALE', '2026-01-05', 295, 6, NULL, NULL, 2100.00, 2100.00, 0.200000, 420.00, 0.025000, 63.00, 0.180000, 464.94, 3047.94, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.648432', '2026-06-29T21:08:58.648432');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (659, 'CCFR-S00002', 'ALL_INC', 'SALE', '2026-02-05', 296, 7, NULL, NULL, 2200.00, 2200.00, 0.200000, 440.00, 0.025000, 66.00, 0.180000, 487.08, 3193.08, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.660048', '2026-06-29T21:08:58.660048');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (660, 'CCFR-R00002', 'ALL_INC', 'REPAIR', '2026-02-05', 296, 7, NULL, NULL, 2200.00, 2200.00, 0.200000, 440.00, 0.025000, 66.00, 0.180000, 487.08, 3193.08, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.666489', '2026-06-29T21:08:58.666489');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (662, '2026-06-R00002', 'VAT', 'REPAIR', '2026-02-05', 296, 7, NULL, NULL, 2200.00, 2200.00, 0.200000, 440.00, 0.025000, 66.00, 0.180000, 487.08, 3193.08, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.677078', '2026-06-29T21:08:58.677078');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (663, 'CCFR-S00003', 'ALL_INC', 'SALE', '2026-03-05', 297, 6, NULL, NULL, 2300.00, 2300.00, 0.200000, 460.00, 0.025000, 69.00, 0.180000, 509.22, 3338.22, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.682532', '2026-06-29T21:08:58.682532');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (665, '2026-06-S12498', 'VAT', 'SALE', '2026-03-05', 297, 6, NULL, NULL, 2300.00, 2300.00, 0.200000, 460.00, 0.025000, 69.00, 0.180000, 509.22, 3338.22, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.694198', '2026-06-29T21:08:58.694198');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (666, '2026-06-R00003', 'VAT', 'REPAIR', '2026-03-05', 297, 6, NULL, NULL, 2300.00, 2300.00, 0.200000, 460.00, 0.025000, 69.00, 0.180000, 509.22, 3338.22, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.699824', '2026-06-29T21:08:58.699824');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (668, 'CCFR-R00004', 'ALL_INC', 'REPAIR', '2026-04-05', 295, 7, NULL, NULL, 2400.00, 2400.00, 0.200000, 480.00, 0.025000, 72.00, 0.180000, 531.36, 3483.36, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.710994', '2026-06-29T21:08:58.710994');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (669, '2026-06-S12499', 'VAT', 'SALE', '2026-04-05', 295, 7, NULL, NULL, 2400.00, 2400.00, 0.200000, 480.00, 0.025000, 72.00, 0.180000, 531.36, 3483.36, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.716441', '2026-06-29T21:08:58.716441');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (671, 'CCFR-S00005', 'ALL_INC', 'SALE', '2026-05-05', 296, 6, NULL, NULL, 2500.00, 2500.00, 0.200000, 500.00, 0.025000, 75.00, 0.180000, 553.50, 3628.50, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.726730', '2026-06-29T21:08:58.726730');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (672, 'CCFR-R00005', 'ALL_INC', 'REPAIR', '2026-05-05', 296, 6, NULL, NULL, 2500.00, 2500.00, 0.200000, 500.00, 0.025000, 75.00, 0.180000, 553.50, 3628.50, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.733097', '2026-06-29T21:08:58.733097');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (674, '2026-06-R00005', 'VAT', 'REPAIR', '2026-05-05', 296, 6, NULL, NULL, 2500.00, 2500.00, 0.200000, 500.00, 0.025000, 75.00, 0.180000, 553.50, 3628.50, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.743485', '2026-06-29T21:08:58.743485');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (675, 'CCFR-S00006', 'ALL_INC', 'SALE', '2026-06-05', 297, 7, NULL, NULL, 2600.00, 2600.00, 0.200000, 520.00, 0.025000, 78.00, 0.180000, 575.64, 3773.64, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.748798', '2026-06-29T21:08:58.748798');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (677, '2026-06-S12501', 'VAT', 'SALE', '2026-06-05', 297, 7, NULL, NULL, 2600.00, 2600.00, 0.200000, 520.00, 0.025000, 78.00, 0.180000, 575.64, 3773.64, 0.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.759957', '2026-06-29T21:08:58.759957');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (655, 'CCFR-S00001', 'ALL_INC', 'SALE', '2026-01-05', 295, 6, NULL, NULL, 2100.00, 2100.00, 0.200000, 420.00, 0.025000, 63.00, 0.180000, 464.94, 3047.94, 3047.94, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.605945', '2026-06-29T21:08:58.605945');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (658, '2026-06-R00001', 'VAT', 'REPAIR', '2026-01-05', 295, 6, NULL, NULL, 2100.00, 2100.00, 0.200000, 420.00, 0.025000, 63.00, 0.180000, 464.94, 3047.94, 3047.94, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.654860', '2026-06-29T21:08:58.654860');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (661, '2026-06-S12497', 'VAT', 'SALE', '2026-02-05', 296, 7, NULL, NULL, 2200.00, 2200.00, 0.200000, 440.00, 0.025000, 66.00, 0.180000, 487.08, 3193.08, 3193.08, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.671946', '2026-06-29T21:08:58.671946');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (664, 'CCFR-R00003', 'ALL_INC', 'REPAIR', '2026-03-05', 297, 6, NULL, NULL, 2300.00, 2300.00, 0.200000, 460.00, 0.025000, 69.00, 0.180000, 509.22, 3338.22, 3338.22, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.689165', '2026-06-29T21:08:58.689165');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (667, 'CCFR-S00004', 'ALL_INC', 'SALE', '2026-04-05', 295, 7, NULL, NULL, 2400.00, 2400.00, 0.200000, 480.00, 0.025000, 72.00, 0.180000, 531.36, 3483.36, 3483.36, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.705173', '2026-06-29T21:08:58.705173');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (670, '2026-06-R00004', 'VAT', 'REPAIR', '2026-04-05', 295, 7, NULL, NULL, 2400.00, 2400.00, 0.200000, 480.00, 0.025000, 72.00, 0.180000, 531.36, 3483.36, 3483.36, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.721656', '2026-06-29T21:08:58.721656');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (673, '2026-06-S12500', 'VAT', 'SALE', '2026-05-05', 296, 6, NULL, NULL, 2500.00, 2500.00, 0.200000, 500.00, 0.025000, 75.00, 0.180000, 553.50, 3628.50, 3628.50, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.738384', '2026-06-29T21:08:58.738384');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (676, 'CCFR-R00006', 'ALL_INC', 'REPAIR', '2026-06-05', 297, 7, NULL, NULL, 2600.00, 2600.00, 0.200000, 520.00, 0.025000, 78.00, 0.180000, 575.64, 3773.64, 3773.64, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-29T21:08:58.754846', '2026-06-29T21:08:58.754846');
INSERT INTO invoices (id, invoice_number, invoice_category, service_type, invoice_date, customer_id, rep_id, appointment_id, route_id, amount, base_subtotal, profit_margin_pct, profit_margin_amount, sscl_pct, sscl_amount, vat_pct, vat_amount, grand_total, credit_balance, remarks, is_vat_posted, contact_name, due_date, po_number, warranty, created_at, updated_at) VALUES (681, 'CCFR-S00007', 'ALL_INC', 'SALE', '2026-06-29', 3, 3, NULL, 2, 10000.00, 10000.00, 0.200000, 2000.00, 0.025000, 300.00, 0.180000, 2214.00, 14514.00, 10000.00, NULL, FALSE, NULL, NULL, NULL, NULL, '2026-06-30T03:42:38.197301', '2026-06-30T03:42:38.197301');

-- Data for table invoice_items
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (81, 653, 1, 'SAMSUNG 10435 TONER', NULL, 1, 8500.00, 8500.00, 8500.00, '2026-06-29T20:41:21.875980');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (82, 654, 1, 'EPSON LQ 2090 RIBBON ', NULL, 1, 4750.00, 4750.00, 4750.00, '2026-06-29T20:50:10.132156');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (83, 655, 1, 'Item A (month 1)', NULL, 1, 1050.00, 1523.97, 1523.97, '2026-06-29T21:08:58.605945');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (84, 655, 2, 'Item B (month 1)', NULL, 2, 525.00, 761.99, 1523.97, '2026-06-29T21:08:58.605945');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (85, 656, 1, 'Item A (month 1)', NULL, 1, 1050.00, 1523.97, 1523.97, '2026-06-29T21:08:58.625138');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (86, 656, 2, 'Item B (month 1)', NULL, 2, 525.00, 761.99, 1523.97, '2026-06-29T21:08:58.625138');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (87, 657, 1, 'Item A (month 1)', NULL, 1, 1050.00, 1260.00, 1260.00, '2026-06-29T21:08:58.648432');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (88, 657, 2, 'Item B (month 1)', NULL, 2, 525.00, 630.00, 1260.00, '2026-06-29T21:08:58.648432');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (89, 658, 1, 'Item A (month 1)', NULL, 1, 1050.00, 1260.00, 1260.00, '2026-06-29T21:08:58.654860');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (90, 658, 2, 'Item B (month 1)', NULL, 2, 525.00, 630.00, 1260.00, '2026-06-29T21:08:58.654860');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (91, 659, 1, 'Item A (month 2)', NULL, 1, 1100.00, 1596.54, 1596.54, '2026-06-29T21:08:58.660048');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (92, 659, 2, 'Item B (month 2)', NULL, 2, 550.00, 798.27, 1596.54, '2026-06-29T21:08:58.660048');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (93, 660, 1, 'Item A (month 2)', NULL, 1, 1100.00, 1596.54, 1596.54, '2026-06-29T21:08:58.666489');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (94, 660, 2, 'Item B (month 2)', NULL, 2, 550.00, 798.27, 1596.54, '2026-06-29T21:08:58.666489');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (95, 661, 1, 'Item A (month 2)', NULL, 1, 1100.00, 1320.00, 1320.00, '2026-06-29T21:08:58.671946');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (96, 661, 2, 'Item B (month 2)', NULL, 2, 550.00, 660.00, 1320.00, '2026-06-29T21:08:58.671946');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (97, 662, 1, 'Item A (month 2)', NULL, 1, 1100.00, 1320.00, 1320.00, '2026-06-29T21:08:58.677078');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (98, 662, 2, 'Item B (month 2)', NULL, 2, 550.00, 660.00, 1320.00, '2026-06-29T21:08:58.677078');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (99, 663, 1, 'Item A (month 3)', NULL, 1, 1150.00, 1669.11, 1669.11, '2026-06-29T21:08:58.682532');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (100, 663, 2, 'Item B (month 3)', NULL, 2, 575.00, 834.56, 1669.11, '2026-06-29T21:08:58.682532');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (101, 664, 1, 'Item A (month 3)', NULL, 1, 1150.00, 1669.11, 1669.11, '2026-06-29T21:08:58.689165');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (102, 664, 2, 'Item B (month 3)', NULL, 2, 575.00, 834.56, 1669.11, '2026-06-29T21:08:58.689165');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (103, 665, 1, 'Item A (month 3)', NULL, 1, 1150.00, 1380.00, 1380.00, '2026-06-29T21:08:58.694198');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (104, 665, 2, 'Item B (month 3)', NULL, 2, 575.00, 690.00, 1380.00, '2026-06-29T21:08:58.694198');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (105, 666, 1, 'Item A (month 3)', NULL, 1, 1150.00, 1380.00, 1380.00, '2026-06-29T21:08:58.699824');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (106, 666, 2, 'Item B (month 3)', NULL, 2, 575.00, 690.00, 1380.00, '2026-06-29T21:08:58.699824');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (107, 667, 1, 'Item A (month 4)', NULL, 1, 1200.00, 1741.68, 1741.68, '2026-06-29T21:08:58.705173');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (108, 667, 2, 'Item B (month 4)', NULL, 2, 600.00, 870.84, 1741.68, '2026-06-29T21:08:58.705173');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (109, 668, 1, 'Item A (month 4)', NULL, 1, 1200.00, 1741.68, 1741.68, '2026-06-29T21:08:58.710994');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (110, 668, 2, 'Item B (month 4)', NULL, 2, 600.00, 870.84, 1741.68, '2026-06-29T21:08:58.710994');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (111, 669, 1, 'Item A (month 4)', NULL, 1, 1200.00, 1440.00, 1440.00, '2026-06-29T21:08:58.716441');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (112, 669, 2, 'Item B (month 4)', NULL, 2, 600.00, 720.00, 1440.00, '2026-06-29T21:08:58.716441');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (113, 670, 1, 'Item A (month 4)', NULL, 1, 1200.00, 1440.00, 1440.00, '2026-06-29T21:08:58.721656');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (114, 670, 2, 'Item B (month 4)', NULL, 2, 600.00, 720.00, 1440.00, '2026-06-29T21:08:58.721656');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (115, 671, 1, 'Item A (month 5)', NULL, 1, 1250.00, 1814.25, 1814.25, '2026-06-29T21:08:58.726730');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (116, 671, 2, 'Item B (month 5)', NULL, 2, 625.00, 907.13, 1814.25, '2026-06-29T21:08:58.726730');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (117, 672, 1, 'Item A (month 5)', NULL, 1, 1250.00, 1814.25, 1814.25, '2026-06-29T21:08:58.733097');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (118, 672, 2, 'Item B (month 5)', NULL, 2, 625.00, 907.13, 1814.25, '2026-06-29T21:08:58.733097');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (119, 673, 1, 'Item A (month 5)', NULL, 1, 1250.00, 1500.00, 1500.00, '2026-06-29T21:08:58.738384');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (120, 673, 2, 'Item B (month 5)', NULL, 2, 625.00, 750.00, 1500.00, '2026-06-29T21:08:58.738384');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (121, 674, 1, 'Item A (month 5)', NULL, 1, 1250.00, 1500.00, 1500.00, '2026-06-29T21:08:58.743485');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (122, 674, 2, 'Item B (month 5)', NULL, 2, 625.00, 750.00, 1500.00, '2026-06-29T21:08:58.743485');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (123, 675, 1, 'Item A (month 6)', NULL, 1, 1300.00, 1886.82, 1886.82, '2026-06-29T21:08:58.748798');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (124, 675, 2, 'Item B (month 6)', NULL, 2, 650.00, 943.41, 1886.82, '2026-06-29T21:08:58.748798');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (125, 676, 1, 'Item A (month 6)', NULL, 1, 1300.00, 1886.82, 1886.82, '2026-06-29T21:08:58.754846');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (126, 676, 2, 'Item B (month 6)', NULL, 2, 650.00, 943.41, 1886.82, '2026-06-29T21:08:58.754846');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (127, 677, 1, 'Item A (month 6)', NULL, 1, 1300.00, 1560.00, 1560.00, '2026-06-29T21:08:58.759957');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (128, 677, 2, 'Item B (month 6)', NULL, 2, 650.00, 780.00, 1560.00, '2026-06-29T21:08:58.759957');
INSERT INTO invoice_items (id, invoice_id, line_number, description, serial_no, qty, raw_rate, rate, amount, created_at) VALUES (133, 681, 1, 'python restore.py', 'python restore.py', 1, 10000.00, 14514.00, 14514.00, '2026-06-30T03:42:38.197301');

-- Data for table payments
INSERT INTO payments (id, invoice_id, payment_method, amount, cheque_number, bank, date_of_payment, recorded_by_rep_id, reference_notes, created_at) VALUES (480, 653, 'CHEQUE', 10030.00, NULL, NULL, '2026-03-04', NULL, NULL, '2026-06-29T20:51:56.048449');

