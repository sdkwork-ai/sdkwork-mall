import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { SdkworkIamH5I18nProvider } from "@sdkwork/iam-h5-commons";
import {
  IAM_H5_USER_CENTER_I18N_CATALOG,
  SdkworkIamH5UserCenterProfileScreen,
  createSdkworkIamH5UserCenterController,
} from "@sdkwork/iam-h5-user-center";

import { getSdkworkMallH5UserCenterService } from "../user-center-runtime";

/**
 * Buyer profile surface.
 *
 * Owned by the IAM H5 user-center brick (profile view/edit over the IAM
 * self-service ports); the mall root injects its IAM service and the brick
 * renders its own screen frame, so the shell yields chrome for this route.
 */
export function SdkworkMallH5ProfilePage() {
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
      <SdkworkIamH5UserCenterProfileScreen
        controller={controller}
        onBack={() => navigate(-1)}
        onOpenPassword={() => navigate("/buyer/password")}
      />
    </SdkworkIamH5I18nProvider>
  );
}
