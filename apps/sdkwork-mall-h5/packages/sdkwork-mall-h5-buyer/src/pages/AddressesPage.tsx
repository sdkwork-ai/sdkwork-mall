import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createMallH5Address,
  deleteMallH5Address,
  listMallH5Addresses,
  setDefaultMallH5Address,
  updateMallH5Address,
  type MallH5Address,
} from "../addresses-service";
import { SdkworkMallH5SelectCell } from "../components/ActionSheet";
import {
  formatMallH5RegionPrefix,
  MALL_H5_REGIONS,
  parseMallH5RegionSelection,
  type MallH5RegionSelection,
} from "../regions";

interface EditingState {
  address?: MallH5Address;
  open: boolean;
}

interface AddressFormState {
  addressDetail: string;
  receiverName: string;
  receiverPhone: string;
  region: MallH5RegionSelection;
}

const EMPTY_REGION: MallH5RegionSelection = { province: "", city: "" };

function regionLabel(selection: MallH5RegionSelection): string {
  if (!selection.province) {
    return "请选择省 / 市";
  }
  return selection.city ? `${selection.province} ${selection.city}` : selection.province;
}

function detectRegion(addressLine: string): MallH5RegionSelection {
  return parseMallH5RegionSelection(addressLine) ?? EMPTY_REGION;
}

function stripRegionPrefix(addressLine: string): string {
  const selection = parseMallH5RegionSelection(addressLine);
  if (!selection) {
    return addressLine;
  }
  return addressLine.slice(formatMallH5RegionPrefix(selection).length).trim();
}

export function SdkworkMallH5AddressesPage() {
  const [addresses, setAddresses] = useState<MallH5Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState>({ open: false });
  const [form, setForm] = useState<AddressFormState>({
    addressDetail: "",
    receiverName: "",
    receiverPhone: "",
    region: EMPTY_REGION,
  });

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

  const cityOptions = useMemo(() => {
    const region = MALL_H5_REGIONS.find((entry) => entry.name === form.region.province);
    return region?.cities ?? [];
  }, [form.region.province]);

  function openCreate() {
    setForm({ addressDetail: "", receiverName: "", receiverPhone: "", region: EMPTY_REGION });
    setEditing({ open: true });
  }

  function openEdit(address: MallH5Address) {
    setForm({
      addressDetail: stripRegionPrefix(address.addressLine),
      receiverName: address.receiverName,
      receiverPhone: address.receiverPhone,
      region: detectRegion(address.addressLine),
    });
    setEditing({ address, open: true });
  }

  async function handleSave() {
    if (!form.receiverName.trim() || !form.receiverPhone.trim()) {
      setMessage("请填写收货人与联系电话");
      return;
    }
    if (!form.region.province || !form.region.city) {
      setMessage("请选择所在省 / 市");
      return;
    }
    if (!form.addressDetail.trim()) {
      setMessage("请填写区县、街道等详细地址");
      return;
    }
    const phone = form.receiverPhone.trim();
    if (!/^1[3-9]\d{9}$/u.test(phone)) {
      setMessage("请填写 11 位大陆手机号");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const input = {
        addressLine: `${formatMallH5RegionPrefix(form.region)} ${form.addressDetail.trim()}`,
        receiverName: form.receiverName.trim(),
        receiverPhone: phone,
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
              maxLength={11}
              onChange={(event) => setForm((current) => ({ ...current, receiverPhone: event.target.value }))}
              placeholder="11 位手机号"
              value={form.receiverPhone}
            />
          </label>
          <SdkworkMallH5SelectCell
            label="所在省"
            onChange={(province) => {
              setForm((current) => ({ ...current, region: { city: "", province } }));
            }}
            options={MALL_H5_REGIONS.map((region) => ({ label: region.name, value: region.name }))}
            placeholder="请选择省份"
            value={form.region.province}
          />
          <SdkworkMallH5SelectCell
            label="所在市"
            onChange={(city) => {
              setForm((current) => ({ ...current, region: { ...current.region, city } }));
            }}
            options={cityOptions.map((city) => ({ label: city, value: city }))}
            placeholder={cityOptions.length === 0 ? "请先选择省份" : "请选择城市"}
            value={form.region.city}
          />
          <label className="sdk-h5-field">
            详细地址（区县 / 街道 / 门牌）
            <input
              onChange={(event) => setForm((current) => ({ ...current, addressDetail: event.target.value }))}
              placeholder="例如：西湖区文一路 96 号"
              value={form.addressDetail}
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
