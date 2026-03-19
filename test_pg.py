import psycopg2

try:
    conn = psycopg2.connect(
        dbname="vkr",
        user="postgres",
        password="postgres",
        host="127.0.0.1",
        port="5432",
    )
    print("OK")
    conn.close()
except Exception as e:
    print(type(e))
    print(e)