import psycopg2

def main():
    conn = psycopg2.connect(
        host="localhost",
        port="5432",
        database="creative_computers",
        user="postgres",
        password="ccadmin@lk"
    )
    cur = conn.cursor()
    
    cur.execute("SELECT id, serial_number, status, stock_item_id, sold_invoice_item_id FROM stock_units WHERE serial_number ILIKE '%789456%' OR serial_number ILIKE '%123456%'")
    units = cur.fetchall()
    print("STOCK UNITS FOUND:")
    for u in units:
        print(u)
        
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
