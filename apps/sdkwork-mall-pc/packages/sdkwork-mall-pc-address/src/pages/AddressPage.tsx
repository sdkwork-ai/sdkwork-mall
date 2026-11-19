import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, LoadingBlock, StatusNotice } from "@sdkwork/ui-pc-react";
import {
  createSdkworkAddressService,
  type SdkworkAddressInput,
  type SdkworkAddressRecord,
} from "../address-service";

type AddressTag = NonNullable<SdkworkAddressRecord["tag"]>;

interface AddressFormState {
  city: string;
  detail: string;
  district: string;
  name: string;
  phone: string;
  province: string;
  tag: AddressTag;
}

interface AddressFormErrors {
  detail?: string;
  name?: string;
  phone?: string;
  province?: string;
}

const TAG_LABELS: Record<AddressTag, string> = {
  company: "公司",
  home: "家",
  other: "其他",
  school: "学校",
};

const TAG_TONES: Record<AddressTag, string> = {
  company: "bg-[var(--sdk-color-brand-primary)]/10 text-[var(--sdk-color-brand-primary)] border-[var(--sdk-color-brand-primary)]/30",
  home: "bg-[var(--sdk-color-state-success)]/10 text-[var(--sdk-color-state-success)] border-[var(--sdk-color-state-success)]/30",
  other: "bg-[var(--sdk-color-surface-subtle)] text-[var(--sdk-color-text-secondary)] border-[var(--sdk-color-border-default)]",
  school: "bg-[var(--sdk-color-state-warning)]/10 text-[var(--sdk-color-state-warning)] border-[var(--sdk-color-state-warning)]/30",
};

const emptyForm = (): AddressFormState => ({
  name: "",
  phone: "",
  province: "",
  city: "",
  district: "",
  detail: "",
  tag: "home",
});

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

function validatePhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone.trim());
}

function validateForm(form: AddressFormState): AddressFormErrors {
  const errors: AddressFormErrors = {};
  if (!form.name.trim()) {
    errors.name = "请填写收件人姓名";
  } else if (form.name.trim().length > 20) {
    errors.name = "收件人姓名不能超过 20 个字符";
  }

  if (!form.phone.trim()) {
    errors.phone = "请填写手机号";
  } else if (!validatePhone(form.phone)) {
    errors.phone = "请输入正确的 11 位手机号";
  }

  if (!form.province.trim()) {
    errors.province = "请选择省份";
  }

  if (!form.detail.trim()) {
    errors.detail = "请填写详细地址";
  } else if (form.detail.trim().length < 5) {
    errors.detail = "详细地址至少需要 5 个字符";
  }

  return errors;
}

function toAddressInput(form: AddressFormState): SdkworkAddressInput {
  return {
    contactName: form.name.trim(),
    phone: form.phone.trim(),
    province: form.province.trim() || undefined,
    city: form.city.trim() || undefined,
    district: form.district.trim() || undefined,
    detail: form.detail.trim(),
    tag: form.tag,
  };
}

export function SdkworkMallAddressPage() {
  const addressService = useMemo(() => createSdkworkAddressService(), []);
  const [addresses, setAddresses] = useState<SdkworkAddressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressFormState>(emptyForm);
  const [errors, setErrors] = useState<AddressFormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  async function refresh() {
    setLoading(true);
    setAddresses(await addressService.listAddresses());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, [addressService]);

  const fullAddress = [form.province, form.city, form.district, form.detail].filter(Boolean).join(" ");

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm());
    setErrors({});
    setTouched({});
    setShowForm(true);
    setMessage(null);
  }

  function openEditForm(address: SdkworkAddressRecord) {
    setEditingId(address.id);
    setForm({
      name: address.name,
      phone: address.phone ?? "",
      province: address.province ?? "",
      city: address.city ?? "",
      district: address.district ?? "",
      detail: address.detail ?? "",
      tag: address.tag ?? "home",
    });
    setErrors({});
    setTouched({});
    setShowForm(true);
    setMessage(null);
  }

  function updateField<K extends keyof AddressFormState>(field: K, value: AddressFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => {
      const nextForm = { ...form, [field]: value };
      const nextErrors = validateForm(nextForm);
      const fieldError = field in nextErrors
        ? nextErrors[field as keyof AddressFormErrors]
        : undefined;
      return {
        ...current,
        [field]: fieldError,
      };
    });
  }

  async function handleSave() {
    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    setTouched({
      detail: true,
      name: true,
      phone: true,
      province: true,
    });
    if (Object.keys(validationErrors).length > 0) {
      setMessage("请修正表单中的错误后再保存");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const body = toAddressInput(form);
      if (editingId) {
        await addressService.updateAddress(editingId, body);
      } else {
        await addressService.createAddress(body);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
      setErrors({});
      setTouched({});
      await refresh();
      setMessage(editingId ? "地址已更新" : "地址已添加");
    } catch {
      setMessage("保存失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(addressId: string) {
    // Deleting a saved address is destructive; confirm before the write.
    if (typeof window !== "undefined" && !window.confirm("确定删除该地址吗？")) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await addressService.deleteAddress(addressId);
      if (editingId === addressId) {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm());
        setErrors({});
        setTouched({});
      }
      await refresh();
      setMessage("地址已删除");
    } catch {
      setMessage("删除失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  async function handleSetDefault(addressId: string) {
    setBusy(true);
    setMessage(null);
    try {
      await addressService.setDefaultAddress(addressId);
      await refresh();
    } catch {
      setMessage("设置默认地址失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <LoadingBlock label="加载地址..." />;
  }

  return (
    <div className="sdkwork-mall-pc-address-page space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">收货地址</h1>
          <p className="mt-1 text-sm text-[var(--sdk-color-text-muted)]">
            管理常用收货地址，结算时可快速选择
          </p>
        </div>
        <Button onClick={openCreateForm} type="button">新增地址</Button>
      </header>

      {message ? <StatusNotice tone="default">{message}</StatusNotice> : null}

      {showForm ? (
        <section className="sdkwork-mall-pc-form-grid rounded-2xl border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-6">
          <h2 className="text-lg font-semibold">{editingId ? "编辑地址" : "新增地址"}</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">
                收件人 <span className="text-[var(--sdk-color-state-danger)]">*</span>
              </span>
              <input
                className={`mt-1 w-full rounded-lg border bg-[var(--sdk-color-surface-panel)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sdk-color-border-focus)] ${
                  touched.name && errors.name
                    ? "border-[var(--sdk-color-state-danger)]"
                    : "border-[var(--sdk-color-border-default)]"
                }`}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="请输入收件人姓名"
                value={form.name}
              />
              {touched.name && errors.name ? (
                <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">{errors.name}</span>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-medium">
                手机号 <span className="text-[var(--sdk-color-state-danger)]">*</span>
              </span>
              <input
                className={`mt-1 w-full rounded-lg border bg-[var(--sdk-color-surface-panel)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sdk-color-border-focus)] ${
                  touched.phone && errors.phone
                    ? "border-[var(--sdk-color-state-danger)]"
                    : "border-[var(--sdk-color-border-default)]"
                }`}
                maxLength={11}
                onChange={(event) => {
                  const value = event.target.value.replace(/\D/g, "").slice(0, 11);
                  updateField("phone", value);
                }}
                placeholder="请输入 11 位手机号"
                value={form.phone}
              />
              {touched.phone && errors.phone ? (
                <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">{errors.phone}</span>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-medium">
                省份 <span className="text-[var(--sdk-color-state-danger)]">*</span>
              </span>
              <input
                className={`mt-1 w-full rounded-lg border bg-[var(--sdk-color-surface-panel)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sdk-color-border-focus)] ${
                  touched.province && errors.province
                    ? "border-[var(--sdk-color-state-danger)]"
                    : "border-[var(--sdk-color-border-default)]"
                }`}
                onChange={(event) => updateField("province", event.target.value)}
                placeholder="如：广东省"
                value={form.province}
              />
              {touched.province && errors.province ? (
                <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">{errors.province}</span>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-medium">城市</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sdk-color-border-focus)]"
                onChange={(event) => updateField("city", event.target.value)}
                placeholder="如：深圳市"
                value={form.city}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">区/县</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sdk-color-border-focus)]"
                onChange={(event) => updateField("district", event.target.value)}
                placeholder="如：南山区"
                value={form.district}
              />
            </label>

            <fieldset className="block">
              <span className="text-sm font-medium">地址标签</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(TAG_LABELS) as AddressTag[]).map((tag) => (
                  <button
                    className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                      form.tag === tag
                        ? "border-[var(--sdk-color-brand-primary)] bg-[var(--sdk-color-brand-primary)] text-[var(--sdk-color-text-inverse)]"
                        : "border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] text-[var(--sdk-color-text-secondary)] hover:border-[var(--sdk-color-brand-primary)]"
                    }`}
                    key={tag}
                    onClick={() => updateField("tag", tag)}
                    type="button"
                  >
                    {TAG_LABELS[tag]}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <label className="block">
            <span className="text-sm font-medium">
              详细地址 <span className="text-[var(--sdk-color-state-danger)]">*</span>
            </span>
            <textarea
              className={`mt-1 w-full rounded-lg border bg-[var(--sdk-color-surface-panel)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sdk-color-border-focus)] ${
                touched.detail && errors.detail
                  ? "border-[var(--sdk-color-state-danger)]"
                  : "border-[var(--sdk-color-border-default)]"
              }`}
              onChange={(event) => updateField("detail", event.target.value)}
              placeholder="请输入街道、门牌号等详细地址"
              rows={3}
              value={form.detail}
            />
            {touched.detail && errors.detail ? (
              <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">{errors.detail}</span>
            ) : null}
          </label>

          {fullAddress ? (
            <div className="rounded-lg border border-[var(--sdk-color-border-subtle)] bg-[var(--sdk-color-surface-subtle)] px-4 py-3 text-sm">
              <span className="text-[var(--sdk-color-text-muted)]">地址预览：</span>
              <span className="ml-1 text-[var(--sdk-color-text-primary)]">{fullAddress}</span>
            </div>
          ) : null}

          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => void handleSave()} type="button">保存</Button>
            <Button
              disabled={busy}
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(emptyForm());
                setErrors({});
                setTouched({});
              }}
              type="button"
              variant="ghost"
            >
              取消
            </Button>
          </div>
        </section>
      ) : null}

      {addresses.length === 0 && !showForm ? (
        <EmptyState description="添加常用收货地址以便快速结算" title="暂无地址" />
      ) : (
        <ul className="sdkwork-mall-pc-address-list grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li
              className="rounded-2xl border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-5"
              key={address.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-base font-semibold">{address.name}</strong>
                    {address.phone ? (
                      <span className="text-sm text-[var(--sdk-color-text-secondary)]">{address.phone}</span>
                    ) : null}
                    {address.tag ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${TAG_TONES[address.tag]}`}
                      >
                        {TAG_LABELS[address.tag]}
                      </span>
                    ) : null}
                    {address.isDefault ? (
                      <span className="rounded-full border border-[var(--sdk-color-brand-primary)]/30 bg-[var(--sdk-color-brand-primary)]/10 px-2 py-0.5 text-[0.65rem] font-medium text-[var(--sdk-color-brand-primary)]">
                        默认
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-[var(--sdk-color-text-secondary)]">
                    {[address.province, address.city, address.district, address.detail]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--sdk-color-border-subtle)] pt-3">
                {!address.isDefault ? (
                  <Button
                    disabled={busy}
                    onClick={() => void handleSetDefault(address.id)}
                    type="button"
                    variant="ghost"
                  >
                    设为默认
                  </Button>
                ) : null}
                <Button
                  disabled={busy}
                  onClick={() => openEditForm(address)}
                  type="button"
                  variant="outline"
                >
                  编辑
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void handleDelete(address.id)}
                  type="button"
                  variant="ghost"
                >
                  删除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
