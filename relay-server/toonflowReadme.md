# ToonFlow gateway on the existing MooZ relay

The MooZ relay at `https://mooz-relay.onrender.com` serves two separate namespaces:

- `/remote`: existing encrypted MooZ host/Workflow Connect protocol, unchanged.
- `/toonflow`: an experimental Chrome Extension bridge for ToonFlow. It does NOT use the MooZ end-to-end encryption layer.

**No new environment variable is needed.** `RELAY_ADMIN_KEY` already stored in Render authenticates trusted **ToonFlow server-side** requests using `Authorization: Bearer ...`. Never put this key in Chrome or a public script.

## Pair Chrome

On a trusted computer where `RELAY_ADMIN_KEY` is locally available:

```sh
curl --fail-with-body -sS -X POST https://mooz-relay.onrender.com/toonflow/pairings \
  -H "Authorization: Bearer $RELAY_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"chrome-main"}'
```

Expected: `{"deviceId":"chrome-main","pairingCode":"<64 hex chars>","expiresAt":...}`.
The pairing code expires after 10 minutes and is consumed once.
Chrome Extension connects to `wss://mooz-relay.onrender.com/toonflow`, authenticates using the code, and receives a rotated resumeToken for reconnects; no admin key ever reaches Chrome.

## Server-side APIs

All HTTP endpoints below require `Authorization: Bearer $RELAY_ADMIN_KEY`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /toonflow/devices | List paired devices, online and busy status |
| POST | /toonflow/pairings | Create invitation (`deviceId`) |
| POST | /toonflow/jobs | Enqueue job (`deviceId`, `prompt`, optional `ratio`, `size`, `quality`) |
| GET | /toonflow/jobs/{jobId} | Poll state and eventual image result |

Status: `queued`, `running`, `done`, `error`. Job replies contain either `result.imageData` (data URI) or `result.imageUrl` (HTTPS). Unknown/disconnected jobs are never automatically replayed. Only one job runs per device at once; up to 10 active/queued jobs per device. Jobs and pairing are memory-only and disappear on service redeploy/restart. No permanent storage and no access to browser cookies.

### Deployment warning

Render's `app-mooz/render.yaml` disables auto deploy. After changing the relay source, manually deploy the latest `app-mooz/main` commit in **mooz-relay → Manual Deploy**. This will interrupt any active MooZ rooms or ToonFlow jobs. Choose a maintenance moment and reconnect existing Chrome/MooZ sessions. Do not modify `RELAY_ADMIN_KEY`.

### Security note

`/toonflow` is not an E2E-encrypted channel. The relay handles prompts and result images in memory, unlike `/remote` where payloads are opaque ciphertext. Use only with trusted accounts and avoid sensitive images/prompts until end-to-end encryption is implemented.

The gateway does not circumvent website authentication, CAPTCHA, quotas or access controls. It requires the authenticated user to install and authorize the dedicated ToonFlow Chrome Extension separately.
