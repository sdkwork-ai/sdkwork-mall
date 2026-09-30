#!/usr/bin/env bash
# module.sh — sdkwork-mall bin/ wiring (MODULE_BIN_SPEC.md §3).
# Scaffolded by sdkwork-specs/tools/scaffold-module-bin.mjs; replace the
# unwired hooks with the repository's canonical commands as they land.
# Every shared primitive comes from sdkwork-specs/bin/lib/sdkwork-common.sh.

SDKWORK_MODULE_ID="sdkwork-mall"
SDKWORK_IMAGE_NAME="sdkwork-mall-standalone"
SDKWORK_APP_TYPES="server,pc,h5"

# Operations wiring (OPERATIONS_SPEC.md): compose service carrying the health
# probe and its path; adjust to the module's compose file when it lands.
SDKWORK_PRIMARY_SERVICE="app"
SDKWORK_HEALTH_PATH="/healthz"
SDKWORK_CONFIG_ENV_SUBDIR="env"

# ----------------------------------------------------------------------------
# Container image (docker-image.sh build)
# ----------------------------------------------------------------------------
sdkwork_image_build() {
  local ref="$1" tag="$2"
  sdkwork_die "${SDKWORK_BIN_E_STATE}" \
    "sdkwork-mall is an assembly-only module: it ships no standalone server binary (no *-standalone-gateway crate), so a container image build is not applicable yet. If a standalone gateway lands, wire this hook per MODULE_BIN_SPEC.md §4.1"
}

# ----------------------------------------------------------------------------
# Application build (apps-build.sh)
# ----------------------------------------------------------------------------
sdkwork_mall_env_alias() {
  case "$1" in
    development) echo "dev" ;;
    production) echo "prod" ;;
    *) echo "$1" ;;
  esac
}

sdkwork_build_app() {
  local app_type="$1" environment="$2" profile="$3"
  local env_alias
  env_alias=$(sdkwork_mall_env_alias "${environment}")
  case "${app_type}" in
    server)
      sdkwork_local_run cargo build --release ;;
    pc)
      if [ "${profile}" = "cloud" ]; then
        sdkwork_local_run pnpm --dir apps/sdkwork-mall-pc run "build:${env_alias}:cloud"
      else
        sdkwork_local_run pnpm --dir apps/sdkwork-mall-pc run "build:${env_alias}"
      fi ;;
    h5)
      if [ "${profile}" = "cloud" ]; then
        sdkwork_local_run pnpm --dir apps/sdkwork-mall-h5 run "build:${env_alias}:cloud"
      else
        sdkwork_local_run pnpm --dir apps/sdkwork-mall-h5 run "build:${env_alias}"
      fi ;;
    *)
      sdkwork_die "${SDKWORK_BIN_E_ENV}" \
        "app type '${app_type}' has no wired build for sdkwork-mall; extend sdkwork_build_app with the repository's canonical runner (declared: ${SDKWORK_APP_TYPES})" ;;
  esac
}

# ----------------------------------------------------------------------------
# Application packaging (apps-package.sh)
# ----------------------------------------------------------------------------
sdkwork_package_app() {
  local app_type="$1" environment="$2" profile="$3" out="$4"
  local env_alias dist_dir artifact_name
  case "${app_type}" in
    pc|h5)
      env_alias=$(sdkwork_mall_env_alias "${environment}")
      dist_dir="apps/sdkwork-mall-${app_type}/dist/standalone/${env_alias}"
      if [ ! -d "${dist_dir}" ]; then
        dist_dir="apps/sdkwork-mall-${app_type}/dist/cloud/${env_alias}"
      fi
      if [ ! -d "${dist_dir}" ]; then
        sdkwork_die "${SDKWORK_BIN_E_STATE}" \
          "missing browser bundle for sdkwork-mall-${app_type} (${environment}/${profile}); run bin/apps-build.sh ${app_type} ${environment}:${profile} first"
      fi
      mkdir -p "${out:-target/bin-packages}"
      artifact_name="sdkwork-mall-${app_type}-${env_alias}-${profile}.tgz"
      sdkwork_tar_artifact "${dist_dir}" "${out:-target/bin-packages}/${artifact_name}" ;;
    *)
      sdkwork_die "${SDKWORK_BIN_E_STATE}" \
        "sdkwork-mall has no canonical packager for app type '${app_type}' yet; extend sdkwork_package_app (MODULE_BIN_SPEC.md §4.4)" ;;
  esac
}

# ----------------------------------------------------------------------------
# Native installer packaging (apps-pkg-installer.sh, MODULE_BIN_SPEC.md §4.9)
# ----------------------------------------------------------------------------
sdkwork_installer_app() {
  local app_type="$1" platform="$2" environment="$3" profile="$4" out="$5" arch="$6" format="$7"
  sdkwork_die "${SDKWORK_BIN_E_STATE}" \
    "sdkwork-mall has no native installer builder wired yet; implement sdkwork_installer_app against the repository's installer commands (MODULE_BIN_SPEC.md §4.9; platforms: windows|linux|macos|android|ios)"
}

# ----------------------------------------------------------------------------
# Application deployment (apps-deploy.sh)
# ----------------------------------------------------------------------------
sdkwork_deploy_app() {
  local app_type="$1" action="$2" environment="$3" profile="$4" host="$5"
  sdkwork_die "${SDKWORK_BIN_E_STATE}" \
    "sdkwork-mall has no application deployment channel wired yet; implement sdkwork_deploy_app (host-native install via bin/apps-package artifacts, MODULE_BIN_SPEC.md §4.5)"
}
