import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Tag, Trash2, X } from 'lucide-react';
import { BusinessStatePanel } from './commerce-admin-primitives';
import { readApiItems } from './commerce-api-result';
import {
  createCommerceBrand,
  deleteCommerceBrand,
  listCommerceBrands,
  updateCommerceBrand,
} from './catalogService';

type BrandStatus = 'active' | 'inactive' | 'archived';

export type BrandRecord = {
  id: string;
  brandNo: string;
  name: string;
  description: string;
  status: BrandStatus;
  sortOrder: number;
  /** Optimistic-concurrency version; rides every guarded write as `If-Match`. */
  version: number;
  updatedAt?: string;
};

type BrandFormState = {
  id: string;
  brandNo: string;
  name: string;
  description: string;
  sortOrder: string;
  status: BrandStatus;
};

type BrandListState = {
  loading: boolean;
  error: string | null;
  records: BrandRecord[];
};

type BrandMessage = {
  tone: 'success' | 'error';
  text: string;
};

const EMPTY_FORM: BrandFormState = {
  id: '',
  brandNo: '',
  name: '',
  description: '',
  sortOrder: '0',
  status: 'active',
};

const INITIAL_STATE: BrandListState = {
  loading: true,
  error: null,
  records: [],
};

export function BrandManagementPage() {
  const [state, setState] = useState<BrandListState>(INITIAL_STATE);
  const [form, setForm] = useState<BrandFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<BrandMessage | null>(null);

  const editing = form.id !== '';

  useEffect(() => {
    void loadBrands();
  }, []);

  async function loadBrands() {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      setState({ loading: false, error: null, records: await readBrandRecords(await loadAllBrands()) });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error && error.message ? error.message : '品牌数据加载失败',
        records: [],
      });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setMessage({ tone: 'error', text: '品牌名称必填。' });
      return;
    }

    setSaving(true);
    setMessage(null);
    const mutablePayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      sortOrder: String(Number.parseInt(form.sortOrder, 10) || 0),
    };
    try {
      if (editing) {
        // Authority `UpdateBrandRequest` owns the lifecycle `status`; the write
        // carries the version the row was loaded with.
        await updateCommerceBrand(
          form.id,
          { ...mutablePayload, status: form.status },
          readBrandVersion(form.id),
        );
        setMessage({ tone: 'success', text: '品牌已更新。' });
      } else {
        const brandNo = form.brandNo.trim() || generateBrandNo(state.records);
        // Authority `CreateBrandRequest` closed body: brandNo/name required and
        // no `status` (create defaults to active).
        await createCommerceBrand({ brandNo, ...mutablePayload });
        setMessage({ tone: 'success', text: '品牌已创建。' });
      }
      setForm(EMPTY_FORM);
      await loadBrands();
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error && error.message ? error.message : '品牌保存失败',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(record: BrandRecord) {
    setMessage(null);
    try {
      await deleteCommerceBrand(record.id, record.version);
      setMessage({ tone: 'success', text: '品牌已归档。' });
      await loadBrands();
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error && error.message ? error.message : '品牌归档失败，可能仍被商品引用。',
      });
    }
  }

  /** The version the loaded list carried for this brand, for its `If-Match`. */
  function readBrandVersion(brandId: string): number {
    return state.records.find((record) => record.id === brandId)?.version ?? 0;
  }

  return (
    <section
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-50 px-5 pb-6 pt-4 text-slate-900 transition-colors duration-300 dark:bg-[#0a0a0a] dark:text-slate-100"
      data-admin-brand-management-page
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-[#171717]"
        data-admin-brand-scroll-shell
      >
        <BrandToolbar onCreate={() => void openCreateModal()} onRefresh={() => void loadBrands()} />

        {message ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
            }`}
            data-admin-brand-message
          >
            {message.text}
          </div>
        ) : null}

        {state.loading ? (
          <BusinessStatePanel description="品牌清单加载中。" kind="loading" title="加载中" />
        ) : state.error ? (
          <BusinessStatePanel
            description={state.error}
            kind="error"
            onRetry={() => void loadBrands()}
            title="品牌数据不可用"
          />
        ) : (
          <BrandTable
            onEdit={(record) => void openEditModal(record)}
            onArchive={(record) => void handleArchive(record)}
            records={state.records}
          />
        )}

        <BrandFormPanel
          form={form}
          editing={editing}
          saving={saving}
          onFormChange={setForm}
          onCancel={() => setForm(EMPTY_FORM)}
          onSubmit={(event) => void handleSubmit(event)}
        />
      </div>
    </section>
  );

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setMessage(null);
  }

  async function openEditModal(record: BrandRecord) {
    setForm({
      id: record.id,
      brandNo: record.brandNo,
      name: record.name,
      description: record.description,
      sortOrder: String(record.sortOrder),
      status: record.status,
    });
    setMessage(null);
  }
}

function BrandToolbar({
  onCreate,
  onRefresh,
}: {
  onCreate: () => void;
  onRefresh: () => void;
}) {
  return (
    <div
      className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]"
      data-admin-brand-toolbar
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Tag className="h-4 w-4" />
          品牌管理
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-lobster-300 hover:text-lobster-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-lobster-500/40"
            data-admin-brand-create-button
          >
            <Plus className="h-4 w-4" />
            新增品牌
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-lobster-300 hover:text-lobster-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-lobster-500/40"
            data-admin-brand-refresh
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>
      </div>
    </div>
  );
}

function BrandTable({
  onArchive,
  onEdit,
  records,
}: {
  onArchive: (record: BrandRecord) => void;
  onEdit: (record: BrandRecord) => void;
  records: BrandRecord[];
}) {
  if (records.length === 0) {
    return (
      <BusinessStatePanel
        description="尚未创建品牌；品牌是商品的品牌归属与筛选维度。"
        kind="empty"
        title="暂无品牌"
      />
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-white/10" data-admin-brand-table-viewport>
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#0f0f0f] dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">品牌编号</th>
            <th className="px-4 py-3">名称</th>
            <th className="px-4 py-3">状态</th>
            <th className="px-4 py-3">排序</th>
            <th className="px-4 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.id}
              className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.03]"
            >
              <td className="px-4 py-3 font-medium">{record.brandNo || record.id}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900 dark:text-white">{record.name}</div>
                {record.description ? (
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.description}</div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  {brandStatusLabel(record.status)}
                </span>
              </td>
              <td className="px-4 py-3">{record.sortOrder}</td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex gap-1">
                  <button
                    type="button"
                    aria-label={`编辑品牌 ${record.name}`}
                    onClick={() => onEdit(record)}
                    className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`归档品牌 ${record.name}`}
                    onClick={() => onArchive(record)}
                    className="rounded-md p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BrandFormPanel({
  editing,
  form,
  onCancel,
  onFormChange,
  onSubmit,
  saving,
}: {
  editing: boolean;
  form: BrandFormState;
  onCancel: () => void;
  onFormChange: (form: BrandFormState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  return (
    <form
      className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]"
      data-admin-brand-form
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {editing ? '编辑品牌' : '新增品牌'}
        </h3>
        {editing ? (
          <button
            type="button"
            aria-label="取消编辑"
            onClick={onCancel}
            className="rounded-md p-1 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        {!editing ? (
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            品牌编号（留空自动生成）
            <input
              value={form.brandNo}
              onChange={(event) => onFormChange({ ...form, brandNo: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-lobster-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              data-admin-brand-no-input
            />
          </label>
        ) : null}
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          品牌名称
          <input
            required
            value={form.name}
            onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-lobster-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            data-admin-brand-name-input
          />
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          描述
          <input
            value={form.description}
            onChange={(event) => onFormChange({ ...form, description: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-lobster-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            data-admin-brand-description-input
          />
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          排序
          <input
            inputMode="numeric"
            value={form.sortOrder}
            onChange={(event) => onFormChange({ ...form, sortOrder: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-lobster-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            data-admin-brand-sort-order-input
          />
        </label>
        {editing ? (
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            状态
            <select
              value={form.status}
              onChange={(event) => onFormChange({ ...form, status: event.target.value as BrandStatus })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-lobster-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              data-admin-brand-status-select
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-lobster-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-lobster-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-lobster-500 dark:hover:bg-lobster-400"
          data-admin-brand-submit-button
        >
          {saving ? '保存中' : editing ? '保存修改' : '创建品牌'}
        </button>
      </div>
    </form>
  );
}

export function readBrandRecords(result: unknown): BrandRecord[] {
  return readApiItems(result)
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        id: String(record.id ?? ''),
        brandNo: String(record.brandNo ?? record.brand_no ?? ''),
        name: String(record.name ?? ''),
        description: String(record.description ?? ''),
        status: readBrandStatus(record.status),
        sortOrder: typeof record.sortOrder === 'number' ? record.sortOrder : Number(record.sortOrder ?? 0) || 0,
        version: typeof record.version === 'number' ? record.version : Number(record.version ?? 0) || 0,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
      };
    })
    .filter((record) => record.id);
}

async function loadAllBrands(): Promise<unknown> {
  // One bounded page covers the dataset scale; a second page would only hide a
  // dataset defect behind pagination (`PAGINATION_SPEC.md` section 2).
  return listCommerceBrands({ page: '1', pageSize: '200' });
}

function readBrandStatus(value: unknown): BrandStatus {
  return value === 'inactive' || value === 'archived' ? value : 'active';
}

function brandStatusLabel(status: BrandStatus): string {
  switch (status) {
    case 'active':
      return '启用';
    case 'inactive':
      return '停用';
    case 'archived':
      return '已归档';
    default:
      return status;
  }
}

function generateBrandNo(records: BrandRecord[]): string {
  const existing = new Set(records.map((record) => record.brandNo));
  let index = records.length + 1;
  let candidate = `BRAND-${String(index).padStart(4, '0')}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `BRAND-${String(index).padStart(4, '0')}`;
  }
  return candidate;
}
