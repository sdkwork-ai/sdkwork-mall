import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { SdkworkIamH5I18nProvider } from "@sdkwork/iam-h5-commons";
import {
  IAM_H5_USER_CENTER_I18N_CATALOG,
  SdkworkIamH5UserCenterPasswordScreen,
  createSdkworkIamH5UserCenterController,
} from "@sdkwork/iam-h5-user-center";

import { getSdkworkMallH5UserCenterService } from "../user-center-runtime";

/**
 * Password-change surface.
 *
 * The IAM H5 user-center password brick owns the form and the
 * `iam.users.current.password` command; the account/security page links here
 * instead of sending the buyer back to the login screen.
 */
export function SdkworkMallH5PasswordPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const controller = useMemo(
    () => createSdkworkIamH5UserCenterController({ service: getSdkworkMallH5UserCenterService() }),
    [],
  );

  return (
    <SdkworkIamH5I18nProvider
      catalogs={[IAM_H5_USER_CENTER_I18N_CATALOG]}
      locale={i18n.language}
    >
      <SdkworkIamH5UserCenterPasswordScreen
        controller={controller}
        onBack={() => navigate(-1)}
        onChanged={() => navigate("/buyer/security", { replace: true })}
      />
    </SdkworkIamH5I18nProvider>
  );
}

