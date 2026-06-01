// components/admin/RevenueChart.tsx
'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { month: 'Jan', revenue: 8500 },
  { month: 'Feb', revenue: 12000 },
  { month: 'Mar', revenue: 45000 },
  { month: 'Apr', revenue: 58000 },
  { month: 'May', revenue: 12000 },
  { month: 'Jun', revenue: 28000 },
  { month: 'Jul', revenue: 65000 },
  { month: 'Aug', revenue: 95000 },
];

export function RevenueChart() {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Area 
            type="natural" 
            dataKey="revenue" 
            stroke="#6366f1" 
            fill="#6366f1" 
            fillOpacity={0.6} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}