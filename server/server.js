
import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

let db;

async function initDB() {
  db = await open({
    filename: './etsy_sales.db',
    driver: sqlite3.Database,
  });

  await db.exec(\`
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      total_sales INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops(id)
    );
  \`);
}

async function getSalesCount(shopName) {
  try {
    const url = \`https://www.etsy.com/shop/\${shopName}\`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const salesText = $('span[data-buy-box-region="sales"]').first().text();
    const match = salesText.match(/(\d+[\d,]*)/);
    return match ? parseInt(match[1].replace(/,/g, '')) : null;
  } catch (err) {
    console.error(\`Error fetching for \${shopName}:\`, err.message);
    return null;
  }
}

app.post('/api/add-shop', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing shop name' });
  try {
    await db.run('INSERT OR IGNORE INTO shops (name) VALUES (?)', name);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/shops', async (req, res) => {
  const shops = await db.all('SELECT * FROM shops');
  const sales = await db.all('SELECT * FROM sales');
  res.json({ shops, sales });
});

app.get('/api/scrape-all', async (req, res) => {
  const shops = await db.all('SELECT * FROM shops');
  const result = [];
  for (const shop of shops) {
    const sales = await getSalesCount(shop.name);
    if (sales !== null) {
      await db.run('INSERT INTO sales (shop_id, total_sales) VALUES (?, ?)', [shop.id, sales]);
      result.push({ shop: shop.name, sales });
    }
  }
  res.json({ updated: result });
});

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
  });
});
