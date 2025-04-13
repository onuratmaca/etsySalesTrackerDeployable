import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { saveAs } from 'file-saver';

function App() {
  const [shops, setShops] = useState([]);
  const [sales, setSales] = useState([]);
  const [newShop, setNewShop] = useState('');

  const fetchData = async () => {
    const res = await axios.get('/api/shops');
    setShops(res.data.shops);
    setSales(res.data.sales);
  };

  const handleAddShop = async () => {
    if (!newShop) return;
    await axios.post('/api/add-shop', { name: newShop });
    setNewShop('');
    fetchData();
  };

  const handleScrape = async () => {
    await axios.get('/api/scrape-all');
    fetchData();
  };

  const handleExportCSV = () => {
    const rows = [['Shop Name', 'Timestamp', 'Total Sales']];
    sales.forEach(s => {
      const shopName = shops.find(shop => shop.id === s.shop_id)?.name || '';
      rows.push([shopName, s.timestamp, s.total_sales]);
    });
    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'sales_history.csv');
  };

  const getSalesStats = (shopId) => {
    const entries = sales.filter(s => s.shop_id === shopId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const today = entries[0]?.total_sales ?? 0;
    const yesterday = entries[1]?.total_sales ?? today;

    const sales7 = entries
      .slice(0, 7)
      .map((entry, i, arr) => i < arr.length - 1 ? entry.total_sales - arr[i + 1].total_sales : 0)
      .reduce((a, b) => a + b, 0);

    const sales30 = entries
      .slice(0, 30)
      .map((entry, i, arr) => i < arr.length - 1 ? entry.total_sales - arr[i + 1].total_sales : 0)
      .reduce((a, b) => a + b, 0);

    return {
      latest: today,
      diff: today - yesterday,
      last7: sales7,
      last30: sales30,
    };
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Etsy Competitor Sales Tracker</h1>

      <div className="mb-4 flex gap-2 flex-wrap">
        <input
          value={newShop}
          onChange={(e) => setNewShop(e.target.value)}
          placeholder="Enter Etsy shop name"
          className="border px-2 py-1 rounded w-full sm:w-auto"
        />
        <button onClick={handleAddShop} className="bg-blue-500 text-white px-4 py-1 rounded">Add</button>
        <button onClick={handleScrape} className="bg-green-600 text-white px-4 py-1 rounded">Scrape Now</button>
        <button onClick={handleExportCSV} className="bg-gray-600 text-white px-4 py-1 rounded">Export CSV</button>
      </div>

      <table className="w-full text-left border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Shop Name</th>
            <th className="p-2 border">Latest Sales</th>
            <th className="p-2 border">Today Δ</th>
            <th className="p-2 border">7-Day Sales</th>
            <th className="p-2 border">30-Day Sales</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((shop) => {
            const stats = getSalesStats(shop.id);
            return (
              <tr key={shop.id}>
                <td className="p-2 border">{shop.name}</td>
                <td className="p-2 border">{stats.latest}</td>
                <td className={\`p-2 border \${stats.diff > 0 ? 'text-green-600' : stats.diff < 0 ? 'text-red-600' : ''}\`}>{stats.diff}</td>
                <td className="p-2 border">{stats.last7}</td>
                <td className="p-2 border">{stats.last30}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;
