// components/admin/TopNav.tsx
'use client';

import { usePathname } from 'next/navigation';
import { Download, Calendar, Filter } from 'lucide-react';
import { useState } from 'react';

interface ExportFilters {
  dataType: 'sales' | 'orders' | 'products' | 'customers';
  startDate: string;
  endDate: string;
  format: 'csv' | 'excel' | 'json';
}

export function TopNav() {
  const pathname = usePathname();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ExportFilters>({
    dataType: 'sales',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    format: 'csv'
  });
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Get page title from pathname
  const getPageTitle = () => {
    const path = pathname.split('/').pop();
    switch(path) {
      case 'dashboard': return 'Dashboard';
      case 'users': return 'Users Management';
      case 'products': return 'Products Management';
      case 'orders': return 'Orders Management';
      case 'payments': return 'Payments Management';
      case 'reviews': return 'Reviews Management';
      case 'categories': return 'Categories Management';
      case 'shipping': return 'Shipping Management';
      case 'settings': return 'Settings';
      default: return 'Admin Panel';
    }
  };

  // Check if current page is dashboard
  const isDashboard = pathname === '/admin/dashboard';

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        type: filters.dataType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        format: filters.format
      });

      const response = await fetch(`/api/admin/export?${params.toString()}`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filters.dataType}_${filters.startDate}_to_${filters.endDate}.${filters.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setIsExportOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDateFilter = () => {
    // This will trigger a refresh of the dashboard data
    const event = new CustomEvent('dashboardDateFilter', { 
      detail: { startDate: dateRange.start, endDate: dateRange.end }
    });
    window.dispatchEvent(event);
    setIsFilterOpen(false);
  };

  if (!isDashboard) {
    // Simple TopNav for non-dashboard pages
    return (
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-800">{getPageTitle()}</h1>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            ROCARS Admin
          </span>
        </div>
      </header>
    );
  }

  // Dashboard TopNav with Export and Filter functionality
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
        <span className="hidden md:inline-flex text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
          Live Data
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Date Filter Button */}
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
          >
            <Calendar className="h-4 w-4" />
            <span>Filter Date</span>
          </button>

          {isFilterOpen && (
            <>
              <div 
                className="fixed inset-0 z-40 bg-black/50"
                onClick={() => setIsFilterOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Filter Dashboard Data</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDateFilter}
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Export Button */}
        <div className="relative">
          <button
            onClick={() => setIsExportOpen(!isExportOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>Export Data</span>
          </button>

          {isExportOpen && (
            <>
              <div 
                className="fixed inset-0 z-40 bg-black/50"
                onClick={() => setIsExportOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Export Dashboard Data</h3>
                  <button
                    onClick={() => setIsExportOpen(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data Type</label>
                    <select
                      value={filters.dataType}
                      onChange={(e) => setFilters({ ...filters, dataType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="sales">Sales Data</option>
                      <option value="orders">Orders Data</option>
                      <option value="products">Products Data</option>
                      <option value="customers">Customers Data</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End Date</label>
                      <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['csv', 'excel', 'json'].map((format) => (
                        <button
                          key={format}
                          onClick={() => setFilters({ ...filters, format: format as any })}
                          className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                            filters.format === format
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          {format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                  <button
                    onClick={() => setIsExportOpen(false)}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {isExporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span>Export Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}