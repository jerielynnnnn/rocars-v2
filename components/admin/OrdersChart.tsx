// components/admin/OrdersChart.tsx
'use client';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const data = [
  { time: '12am', orders: 200 },
  { time: '8am', orders: 4500 },
  { time: '4pm', orders: 1200 },
  { time: '11pm', orders: 3200 },
];

export function OrdersChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <Tooltip />
          <Line 
            type="natural" 
            dataKey="orders" 
            stroke="#22d3ee" 
            strokeWidth={3.5} 
            dot={{ r: 5, fill: "#22d3ee", strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}