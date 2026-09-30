import { useCallback, useEffect, useState } from "react";

import {
  createMallH5Address,
  deleteMallH5Address,
  listMallH5Addresses,
  setDefaultMallH5Address,
  updateMallH5Address,
  type MallH5Address,
} from "../addresses-service";

interface EditingState {
  address?: MallH5Address;
  open: boolean;
}

export function SdkworkMallH5AddressesPage() {
  const [addresses, setAddresses] = useState<MallH5Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState>({ open: false });
  const [form, setForm] = useState({ addressLine: "", receiverName: "", receiverPhone: "" });

  const reload = useCallback(async () => {
    setAddresses(await listMallH5Addresses());
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setMessage(cause instanceof Error ? cause.message : "地址加载失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);

  function openCreate() {
    setForm({ addressLine: "", receiverName: "", receiverPhone: "" });
    setEditing({ open: true });
  }

  function openEdit(address: MallH5Address) {
    setForm({
      addressLine: address.addressLine,
      receiverName: address.receiverName,
      receiverPhone: address.receiverPhone,
    });
    setEditing({ address, open: true });
  }

  async function handleSave() {
    if (!form.receiverName.trim() || !form.receiverPhone.trim() || !form.addressLine.trim()) {
      setMessage("请完整填写收货人、电话与地址");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const input = {
        addressLine: form.addressLine.trim(),
        receiverName: form.receiverName.trim(),
        receiverPhone: form.receiverPhone.trim(),
      };
      if (editing.address) {
        await updateMallH5Address(editing.address.id, input);
      } else {
        await createMallH5Address(input);
      }
      setEditing({ open: false });
      await reload();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleSetDefault(address: MallH5Address) {
    setBusy(true);
    try {
      await setDefaultMallH5Address(address.id);
      await reload();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "设置默认地址失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(address: MallH5Address) {
    setBusy(true);
    try {
      await deleteMallH5Address(address.id);
      await reload();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载地址...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-page-title">地址管理</h1>

      {message ? <div className="sdk-h5-error" role="alert">{message}</div> : null}

      {addresses.length === 0 ? (
        <div className="sdk-h5-empty">还没有收货地址</div>
      ) : (
        addresses.map((address) => (
          <div className="sdk-h5-section" key={address.id}>
            <div className="sdk-h5-address-line">
              <strong>
                {address.receiverName} {address.receiverPhone}
                {address.isDefault ? <em className="sdk-h5-address-default">默认</em> : null}
              </strong>
              <div className="sdk-h5-muted">{address.addressLine}</div>
            </div>
            <div className="sdk-h5-action-row">
              {!address.isDefault ? (
                <button className="sdk-h5-button sdk-h5-button-secondary" disabled={busy} onClick={() => void handleSetDefault(address)} type="button">
                  设为默认
                </button>
              ) : null}
              <button className="sdk-h5-button sdk-h5-button-ghost" disabled={busy} onClick={() => openEdit(address)} type="button">
                编辑
              </button>
              <button className="sdk-h5-button sdk-h5-button-ghost" disabled={busy} onClick={() => void handleDelete(address)} type="button">
                删除
              </button>
            </div>
          </div>
        ))
      )}

      {editing.open ? (
        <div className="sdk-h5-section">
          <h2>{editing.address ? "编辑地址" : "新增地址"}</h2>
          <label className="sdk-h5-field">
            收货人
            <input
              onChange={(event) => setForm((current) => ({ ...current, receiverName: event.target.value }))}
              value={form.receiverName}
            />
          </label>
          <label className="sdk-h5-field">
            联系电话
            <input
              inputMode="tel"
              onChange={(event) => setForm((current) => ({ ...current, receiverPhone: event.target.value }))}
              value={form.receiverPhone}
            />
          </label>
          <label className="sdk-h5-field">
            收货地址
            <input
              onChange={(event) => setForm((current) => ({ ...current, addressLine: event.target.value }))}
              value={form.addressLine}
            />
          </label>
          <div className="sdk-h5-action-row">
            <button className="sdk-h5-button sdk-h5-button-primary" disabled={busy} onClick={() => void handleSave()} type="button">
              保存
            </button>
            <button className="sdk-h5-button sdk-h5-button-ghost" disabled={busy} onClick={() => setEditing({ open: false })} type="button">
              取消
            </button>
          </div>
        </div>
      ) : (
        <button className="sdk-h5-button sdk-h5-button-primary sdk-h5-button-block" onClick={openCreate} type="button">
          新增收货地址
        </button>
      )}
    </div>
  );
}
