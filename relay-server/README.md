# MooZ outbound relay

Private Node.js WebSocket relay for MooZ Agent 0.51.0 + Workflow Connect 1.3.0.
Run one instance. No database, file uploads or persistent room storage.

```sh
npm ci --omit=dev
```

Set `RELAY_ADMIN_KEY` to at least 32 random non-whitespace characters in your
hosting dashboard, then run `npm start`. The service listens on `PORT` (10000 by
default). Serve WSS/TLS at `/remote`; the public health check is `/health`.
Do not expose plaintext WS to the Internet. Render terminates TLS for its web
service. The root `render.yaml` supplies a Free blueprint and random master key.

Rooms expire after 24 hours; initial invites expire after 10 minutes. Guest
resume credentials rotate. Host disconnect/redeployment drops its rooms.
An authenticated room is not removed merely because its initial invite expired.
Room replies also include the remaining invitation lifetime (`leaseMs`), so
desktop clocks need not agree with the broker clock. Deploy this server revision
as well as MooZ Agent 0.66.0 / MooZ Connect 1.9.0 to enable both fixes. A Render
deployment clears rooms in memory and requires fresh pairing; the blueprint has
automatic deployment disabled.
Application payloads are end-to-end AES-GCM ciphertext; room membership is not
permission to send arbitrary AI/browser commands. The desktop still authenticates
the companion separately and enforces its own request policy.

See `docs/OUTBOUND-RELAY.md` in the parent repo for setup, limits and diagnostics.
GPL-2.0-or-later; see LICENSE. The `ws` dependency is distributed under its own
MIT license through npm.
