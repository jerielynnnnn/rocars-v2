// components/admin/StatCard.tsx
interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  isCurrency?: boolean;
}

export function StatCard({ title, value, change, isCurrency }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow">
      <p className="text-gray-500 text-sm">{title}</p>
      <p className="text-3xl font-bold mt-2">
        {isCurrency ? '₱' : ''}{value}
      </p>
      {change && (
        <p className="text-green-600 text-sm mt-2 font-medium">
          {change} from last month
        </p>
      )}
    </div>
  );
}