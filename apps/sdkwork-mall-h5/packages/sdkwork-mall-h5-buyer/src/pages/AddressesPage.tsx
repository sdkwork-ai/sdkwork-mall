import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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
import { SdkworkMallH5ErrorState } from "@sdkwork/mall-h5-commons/error-state";

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
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<MallH5Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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
          setLoadError(cause instanceof Error ? cause.message : t("addresses.loadFailed"));
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
  }, [reload, t]);

  const retryLoad = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    reload()
      .catch((cause: unknown) => {
        setLoadError(cause instanceof Error ? cause.message : t("addresses.loadFailed"));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [reload, t]);

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
      setMessage(t("addresses.errors.required"));
      return;
    }
    if (!form.region.province || !form.region.city) {
      setMessage(t("addresses.errors.region"));
      return;
    }
    if (!form.addressDetail.trim()) {
      setMessage(t("addresses.errors.detail"));
      return;
    }
    const phone = form.receiverPhone.trim();
    if (!/^1[3-9]\d{9}$/u.test(phone)) {
      setMessage(t("addresses.errors.phone"));
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
      setMessage(cause instanceof Error ? cause.message : t("addresses.errors.save"));
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
      setMessage(cause instanceof Error ? cause.message : t("addresses.errors.setDefault"));
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
      setMessage(cause instanceof Error ? cause.message : t("addresses.errors.delete"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">{t("addresses.loading")}</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">{t("addresses.title")}</h1>

      {loadError ? <SdkworkMallH5ErrorState message={loadError} onRetry={retryLoad} /> : null}

      {message ? <div className="sdk-h5-notice sdk-h5-notice-danger" role="alert">{message}</div> : null}

      {addresses.length === 0 ? (
        <div className="sdk-h5-empty">{t("addresses.empty")}</div>
      ) : (
        addresses.map((address) => (
          <div className="sdk-h5-section" key={address.id}>
            <div className="sdk-h5-address-line">
              <strong>
                {address.receiverName} {address.receiverPhone}
                {address.isDefault ? (
                  <em className="sdk-h5-address-default">{t("addresses.default")}</em>
                ) : null}
              </strong>
              <div className="sdk-h5-muted">{address.addressLine}</div>
            </div>
            <div className="sdk-h5-action-row">
              {!address.isDefault ? (
                <button className="sdk-h5-button sdk-h5-button-secondary" disabled={busy} onClick={() => void handleSetDefault(address)} type="button">
                  {t("addresses.actions.setDefault")}
                </button>
              ) : null}
              <button className="sdk-h5-button sdk-h5-button-ghost" disabled={busy} onClick={() => openEdit(address)} type="button">
                {t("addresses.actions.edit")}
              </button>
              <button className="sdk-h5-button sdk-h5-button-ghost" disabled={busy} onClick={() => void handleDelete(address)} type="button">
                {t("addresses.actions.delete")}
              </button>
            </div>
          </div>
        ))
      )}

      {editing.open ? (
        <div className="sdk-h5-section">
          <h2>{editing.address ? t("addresses.form.editTitle") : t("addresses.form.createTitle")}</h2>
          <label className="sdk-h5-field">
            {t("addresses.form.receiver")}
            <input
              onChange={(event) => setForm((current) => ({ ...current, receiverName: event.target.value }))}
              value={form.receiverName}
            />
          </label>
          <label className="sdk-h5-field">
            {t("addresses.form.phone")}
            <input
              inputMode="tel"
              maxLength={11}
              onChange={(event) => setForm((current) => ({ ...current, receiverPhone: event.target.value }))}
              placeholder={t("addresses.form.phonePlaceholder")}
              value={form.receiverPhone}
            />
          </label>
          <SdkworkMallH5SelectCell
            label={t("addresses.form.province")}
            onChange={(province) => {
              setForm((current) => ({ ...current, region: { city: "", province } }));
            }}
            options={MALL_H5_REGIONS.map((region) => ({ label: region.name, value: region.name }))}
            placeholder={t("addresses.form.provincePlaceholder")}
            value={form.region.province}
          />
          <SdkworkMallH5SelectCell
            label={t("addresses.form.city")}
            onChange={(city) => {
              setForm((current) => ({ ...current, region: { ...current.region, city } }));
            }}
            options={cityOptions.map((city) => ({ label: city, value: city }))}
            placeholder={
              cityOptions.length === 0
                ? t("addresses.form.provinceFirst")
                : t("addresses.form.cityPlaceholder")
            }
            value={form.region.city}
          />
          <label className="sdk-h5-field">
            {t("addresses.form.detail")}
            <input
              onChange={(event) => setForm((current) => ({ ...current, addressDetail: event.target.value }))}
              placeholder={t("addresses.form.detailPlaceholder")}
              value={form.addressDetail}
            />
          </label>
          <div className="sdk-h5-action-row">
            <button className="sdk-h5-button sdk-h5-button-primary" disabled={busy} onClick={() => void handleSave()} type="button">
              {t("addresses.form.save")}
            </button>
            <button className="sdk-h5-button sdk-h5-button-ghost" disabled={busy} onClick={() => setEditing({ open: false })} type="button">
              {t("addresses.form.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button className="sdk-h5-button sdk-h5-button-primary sdk-h5-button-block" onClick={openCreate} type="button">
          {t("addresses.add")}
        </button>
      )}
    </div>
  );
}
