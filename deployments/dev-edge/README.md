# Mall dev preview (local development edge)

Development-only preview of the Adaptive Web PC/H5 bundles:

- URL: `http://mall-dev.birdcoder.com/`
- Desktop browser → PC bundle (`apps/sdkwork-mall-pc/dist/cloud/dev`)
- Mobile browser → H5 bundle (`apps/sdkwork-mall-h5/dist/cloud/dev`)
- API: the cloud bundle resolves `api-dev.birdcoder.com` from the page host
  (`ENVIRONMENT_SPEC.md` §5.1.0.1 host-aware cloud API edge), backed by the
  `development` gateway (`api-dev.*`).

## Build

```bash
pnpm run build:pc:dev:cloud
pnpm run build:h5:dev:cloud
```

## Host edge

`sdkwork-mall` is classified as a client-only module (no owned public
ingress), so this preview runs on the dev host's local-edge nginx, not the
public `sdkwork-webserver` edge. The files in this directory are the
deployed copies:

| File | Role |
| --- | --- |
| `sdkwork-mall-dev.conf` | UA map + `:80`/`:443` server blocks for `mall-dev.birdcoder.com` |
| `sdkwork-mall-dev-static.conf` | PC/H5 static roots, SPA fallback, cache policy |
| `san.ext` | local dev certificate SAN entries (includes `mall-dev.birdcoder.com`) |

Allocation on the dev host (`sdkwork@api-dev.birdcoder.com`):

```text
/home/sdkwork/mall-edge/pc   <- apps/sdkwork-mall-pc/dist/cloud/dev
/home/sdkwork/mall-edge/h5   <- apps/sdkwork-mall-h5/dist/cloud/dev
/home/sdkwork/local-edge/conf/snippets/{sdkwork-mall-dev,sdkwork-mall-dev-static}.conf
```

The edge container mounts the bundles read-only at `/srv/mall`; see
`/home/sdkwork/local-edge/README.md` on the host for the full run command.

## Client hosts entry

```text
192.168.31.49 mall-dev.birdcoder.com
```

`api-dev.birdcoder.com` already points at the same host.
