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
All payments can be done through cash or cheques&cheques to be drawn in favor of Creative Computers. "A/C Payee Only"', '2026-06-30 00:35:02.316841');

-- Data for table rate_settings
INSERT INTO rate_settings (id, key, label, rate, rate_type, description, is_active, created_at, updated_at) VALUES (1, 'sscl_pct', 'SSCL', 0.025000, 'tax', 'Social Security Contribution Levy', true, '2026-06-29 23:37:41.550453', '2026-06-29 23:37:41.550453');
INSERT INTO rate_settings (id, key, label, rate, rate_type, description, is_active, created_at, updated_at) VALUES (2, 'vat_pct', 'VAT', 0.180000, 'tax', 'Value Added Tax', true, '2026-06-29 23:37:41.550453', '2026-06-29 23:37:41.550453');
INSERT INTO rate_settings (id, key, label, rate, rate_type, description, is_active, created_at, updated_at) VALUES (3, 'profit_margin', 'Profit Margin', 0.200000, 'margin', 'Default item markup', true, '2026-06-29 23:37:41.550453', '2026-06-30 00:37:53.126530');

-- Data for table reps
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (2, 'Asanka', 'CC-0001', NULL, 'CEO', true, '2026-06-25 07:37:29.676500');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (1, 'Joseph', 'CC-0002', NULL, 'General Manager', true, '2026-06-25 07:37:29.676500');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (5, 'Hasitha', 'CC-0003', NULL, 'Sales Representative', true, '2026-06-25 07:37:29.676500');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (3, 'Pramod', 'CC-0004', NULL, 'Sales Represantative', true, '2026-06-25 07:37:29.676500');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (4, 'Shen', 'CC-0005', NULL, 'Sales Represantative', true, '2026-06-25 07:37:29.676500');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (6, 'Rep One', 'CC-0006', '0710000001', 'Sales', true, '2026-06-29 21:08:58.599575');
INSERT INTO reps (id, name, code, phone, role, is_active, created_at) VALUES (7, 'Rep Two', 'CC-0007', '0710000002', 'Sales', true, '2026-06-29 21:08:58.604429');

-- Data for table routes
INSERT INTO routes (id, name, is_active, created_at) VALUES (1, 'Puttlam', true, '2026-06-25 07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (2, 'Dambulla', true, '2026-06-25 07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (3, 'Kandy', true, '2026-06-25 07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (4, 'Chilaw', true, '2026-06-25 07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (5, 'Kurunegala', true, '2026-06-25 07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (6, 'Mawathagama', true, '2026-06-25 07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (7, 'Giriulla', true, '2026-06-25 07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (8, 'Polpithigama', true, '2026-06-25 07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (9, 'Galgamuwa', true, '2026-06-25 07:37:29.676500');
INSERT INTO routes (id, name, is_active, created_at) VALUES (11, 'Walk-In Customer', true, '2026-06-29 21:55:39.140131');
INSERT INTO routes (id, name, is_active, created_at) VALUES (12, 'Jaffa', true, '2026-06-29 23:52:51.445432');
INSERT INTO routes (id, name, is_active, created_at) VALUES (10, 'Other', false, '2026-06-25 07:37:29.676500');

-- Data for table settings
INSERT INTO settings (id, sscl_pct, vat_pct, profit_margin, updated_at) VALUES (1, 0.025000, 0.180000, 0.200000, '2026-06-30 00:37:53.126530');

-- Data for table user_preferences
