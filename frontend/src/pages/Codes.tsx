import { useEffect, useState, useCallback } from 'react';
import { codesApi } from '../services/api';
import { ActivationCode, PaginatedData } from '../types';
import dayjs from 'dayjs';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  activated: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-800',
  revoked: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  pending: '待激活',
  activated: '已激活',
  expired: '已过期',
  revoked: '已作废',
};

export default function Codes() {
  const [data, setData] = useState<PaginatedData<ActivationCode> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 10,
    code: '',
    app_name: '',
    user_name: '',
    status: '',
  });

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await codesApi.list(filters);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Load codes error:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  const handleRevoke = async (id: string) => {
    if (!confirm('确定要作废此激活码吗？')) return;
    try {
      const response = await codesApi.revoke(id);
      if (response.data.success) {
        loadCodes();
      }
    } catch (error) {
      console.error('Revoke error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此激活码吗？')) return;
    try {
      const response = await codesApi.delete(id);
      if (response.data.success) {
        loadCodes();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleExport = async () => {
    try {
      const response = await codesApi.export({
        status: filters.status || undefined,
        app_name: filters.app_name || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `activation_codes_${dayjs().format('YYYY-MM-DD')}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">激活码管理</h1>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            导出 CSV
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            生成激活码
          </button>
        </div>
      </div>

      {/* 筛选条件 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="激活码"
            value={filters.code}
            onChange={(e) => setFilters({ ...filters, code: e.target.value, page: 1 })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="text"
            placeholder="APP 名称"
            value={filters.app_name}
            onChange={(e) => setFilters({ ...filters, app_name: e.target.value, page: 1 })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="text"
            placeholder="用户名称"
            value={filters.user_name}
            onChange={(e) => setFilters({ ...filters, user_name: e.target.value, page: 1 })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">全部状态</option>
            <option value="pending">待激活</option>
            <option value="activated">已激活</option>
            <option value="expired">已过期</option>
            <option value="revoked">已作废</option>
          </select>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  激活码
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  APP 名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  有效时长
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  过期时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  请求次数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  创建时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : data?.list.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                data?.list.map((code) => (
                  <tr key={code.id}>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-medium text-gray-900">
                      {code.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.app_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.user_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${statusColors[code.status]}`}>
                        {statusLabels[code.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.duration_hours} 小时
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.expired_at ? dayjs(code.expired_at).format('YYYY-MM-DD HH:mm') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.request_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dayjs(code.created_at).format('YYYY-MM-DD HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {code.status !== 'revoked' && code.status !== 'expired' && (
                        <button
                          onClick={() => handleRevoke(code.id)}
                          className="text-orange-600 hover:text-orange-800"
                        >
                          作废
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(code.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        删除
                      </button>
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

      {/* 生成激活码弹窗 */}
      {showCreate && (
        <CreateCodeModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            loadCodes();
          }}
        />
      )}
    </div>
  );
}

function CreateCodeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    app_name: '',
    user_name: '',
    duration_hours: 24,
    remark: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.app_name || !form.user_name) {
      setError('APP 名称和用户名称不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await codesApi.create(form);
      if (response.data.success) {
        setResult(response.data.data);
      } else {
        setError(response.data.error || '生成失败');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">生成激活码</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {result ? (
          <div className="p-6 text-center">
            <div className="text-green-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600 mb-2">激活码生成成功</p>
            <p className="text-3xl font-mono font-bold text-gray-800 mb-6">{result.code}</p>
            <button
              onClick={onSuccess}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              确定
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                APP 名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.app_name}
                onChange={(e) => setForm({ ...form, app_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入 APP 名称"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                用户名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.user_name}
                onChange={(e) => setForm({ ...form, user_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入用户名称"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                有效时长（小时） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={form.duration_hours}
                onChange={(e) => setForm({ ...form, duration_hours: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                备注
              </label>
              <textarea
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="可选"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '生成中...' : '生成激活码'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
