import { useEffect, useState, useCallback } from 'react';
import { logsApi } from '../services/api';
import { OperationLog, PaginatedData } from '../types';
import dayjs from 'dayjs';

const actionLabels: Record<string, string> = {
  login: '登录',
  generate_code: '生成激活码',
  revoke_code: '作废激活码',
  delete_code: '删除激活码',
  export_codes: '导出激活码',
  regenerate_secret: '重新生成 Secret',
};

export default function Logs() {
  const [data, setData] = useState<PaginatedData<OperationLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 20,
    action: '',
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await logsApi.list(filters);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Load logs error:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const formatDetails = (details: string | null) => {
    if (!details) return '-';
    try {
      const parsed = JSON.parse(details);
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    } catch {
      return details;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">操作日志</h1>

      {/* 筛选条件 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4">
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">全部操作</option>
            <option value="login">登录</option>
            <option value="generate_code">生成激活码</option>
            <option value="revoke_code">作废激活码</option>
            <option value="delete_code">删除激活码</option>
            <option value="export_codes">导出激活码</option>
            <option value="regenerate_secret">重新生成 Secret</option>
          </select>
        </div>
      </div>

      {/* 日志表格 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作类型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作对象
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  详情
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP 地址
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : data?.list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                data?.list.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.target_type}
                      {log.target_id && ` (${log.target_id.slice(0, 8)}...)`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                      {formatDetails(log.details)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ip}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {data && data.pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              共 {data.pagination.total} 条，第 {data.pagination.page} / {data.pagination.totalPages} 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                disabled={filters.page <= 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                上一页
              </button>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={filters.page >= data.pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500">
        注：操作日志保留 3 个月，超期自动清理。
      </div>
    </div>
  );
}
