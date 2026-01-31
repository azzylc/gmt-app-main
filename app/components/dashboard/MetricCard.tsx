interface MetricCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: string;
  color: 'pink' | 'purple' | 'blue' | 'green';
  onClick?: () => void;
  progress?: { current: number; target: number };
}

const colorClasses = {
  pink: 'bg-pink-100 text-pink-600',
  purple: 'bg-purple-100 text-purple-600',
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
};

const textColorClasses = {
  pink: 'text-pink-600',
  purple: 'text-purple-600',
  blue: 'text-blue-600',
  green: 'text-green-600',
};

export default function MetricCard({ 
  title, 
  value, 
  subtitle = 'gelin', 
  icon, 
  color,
  onClick,
  progress 
}: MetricCardProps) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-gray-100 ${onClick ? 'cursor-pointer hover:shadow-md transition' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-xs">{title}</p>
          <p className={`text-xl md:text-2xl font-bold mt-1 ${textColorClasses[color]}`}>
            {value}
            {progress && (
              <span className="text-sm text-gray-400 font-normal">/{progress.target}</span>
            )}
          </p>
          <p className="text-gray-400 text-xs">{subtitle}</p>
        </div>
        <div className={`w-9 h-9 md:w-10 md:h-10 ${colorClasses[color]} rounded-xl flex items-center justify-center`}>
          <span className="text-lg md:text-xl">{icon}</span>
        </div>
      </div>
      {progress && progress.target > 0 && (
        <div className="mt-2">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full ${color === 'pink' ? 'bg-pink-500' : color === 'purple' ? 'bg-purple-500' : color === 'blue' ? 'bg-blue-500' : 'bg-green-500'} rounded-full transition-all`}
              style={{ width: `${Math.min((progress.current / progress.target) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}