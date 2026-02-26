import sqlite3
conn = sqlite3.connect('app.db')
rows = conn.execute('SELECT id, device_id FROM notes').fetchall()
print(rows)
conn.close()
