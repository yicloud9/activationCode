import { useEffect, useState } from 'react';
import { statsApi } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface StatusStats {
  pending: number;
  activated: number;
  expired: number;
  revoked: number;
  total: number;
}

interface AppStats {
  app_name: string;
  total: number;
  activated: number;
  pending: number;
  expired: number;
  revoked: number;
}

interface TimeStats {
  period: string;
  generated: number;
  activated: number;
}

export default function Dashboard() {
  const [statusStats, setStatusStats] = useState<StatusStats | null>(null);
  const [appStats, setAppStats] = useState<AppStats[]>([]);
  const [timeStats, setTimeStats] = useState<TimeStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [statusRes, appRes, timeRes] = await Promise.all([
        statsApi.byStatus(),
        statsApi.byApp(),
        statsApi.byTime('day', 30),
      ]);

      if (statusRes.data.success) {
        setStatusStats(statusRes.data.data);
      }
      if (appRes.data.success) {
        setAppStats(appRes.data.data);
      }
      if (timeRes.data.success) {
        setTimeStats(timeRes.data.data);
      }
    } catch (error) {
      console.error('Load stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">仪表盘</h1>

      {/* 状态统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">总数</div>
          <div className="text-3xl font-bold text-gray-800 mt-2">
            {statusStats?.total || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">待激活</div>
          <div className="text-3xl font-bold text-yellow-500 mt-2">
            {statusStats?.pending || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">已激活</div>
          <div className="text-3xl font-bold text-green-500 mt-2">
            {statusStats?.activated || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">已过期</div>
          <div className="text-3xl font-bold text-gray-400 mt-2">
            {statusStats?.expired || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">已作废</div>
          <div className="text-3xl font-bold text-red-500 mt-2">
            {statusStats?.revoked || 0}
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 趋势图 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">最近 30 天趋势</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="generated" stroke="#3B82F6" name="生成" />
                <Line type="monotone" dataKey="activated" stroke="#10B981" name="激活" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* APP 统计 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">按 APP 统计</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={appStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="app_name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="total" fill="#3B82F6" name="总数" />
                <Bar dataKey="activated" fill="#10B981" name="已激活" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* APP 详情表格 */}
      {appStats.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">APP 详情</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    APP 名称
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    总数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    待激活
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    已激活
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    已过期
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    已作废
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {appStats.map((app) => (
                  <tr key={app.app_name}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {app.app_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {app.total}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-500">
                      {app.pending}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-500">
                      {app.activated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {app.expired}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">
                      {app.revoked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
