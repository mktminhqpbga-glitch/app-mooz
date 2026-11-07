"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { WebSocket } = require("ws");
const { createRelayServer } = require("../relay-server/server.cjs");

const adminKey = "test-" + "a".repeat(48);
const extensionOrigin = "chrome-extension://" + "a".repeat(32);

async function setup(t) {
  const relay = createRelayServer({ adminKey });
  const port = await relay.listen();
  const url = "http://127.0.0.1:" + port;
  t.after(() => relay.close());
  async function api(method, path, body, key = adminKey) {
    const response = await fetch(url + path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  async function connect(deviceId, credentials) {
    const socket = new WebSocket(url.replace("http:", "ws:") + "/toonflow", { origin: extensionOrigin });
    await once(socket, "open");
    const ready = once(socket, "message");
    socket.send(JSON.stringify({ type: "hello", role: "extension", deviceId, ...credentials }));
    return { socket, ready: JSON.parse((await ready)[0].toString()) };
  }
  return { relay, url, api, connect };
}

test("existing MooZ /remote host still authenticates and /health is intact", async t => {
  const f = await setup(t);
  const health = await (await fetch(f.url + "/health")).json();
  assert.equal(health.service, "mooz-outbound-relay");
  const socket = new WebSocket(f.url.replace("http:", "ws:") + "/remote");
  await once(socket, "open");
  const reply = once(socket, "message");
  socket.send(JSON.stringify({ type: "host", relayProtocol: 1, key: adminKey }));
  assert.equal(JSON.parse((await reply)[0].toString()).type, "host-ready");
  socket.close();
});

test("ToonFlow requires admin authentication for all HTTP API routes", async t => {
  const f = await setup(t);
  assert.equal((await f.api("GET", "/toonflow/devices", undefined, "bad-key")).status, 401);
  assert.equal((await f.api("POST", "/toonflow/jobs", { deviceId: "chrome-main", prompt: "test" }, "bad-key")).status, 401);
  assert.equal((await f.api("POST", "/toonflow/pairings", { deviceId: "a/b" })).status, 400);
  assert.equal((await f.api("POST", "/toonflow/jobs", { deviceId: "chrome-main", prompt: "test" })).status, 409);
});

test("one-time pairing, image job and rotating resume token work without giving the admin key to Chrome", async t => {
  const f = await setup(t);
  const pairing = await f.api("POST", "/toonflow/pairings", { deviceId: "chrome-main" });
  assert.equal(pairing.status, 201);
  assert.match(pairing.body.pairingCode, /^[a-f0-9]{64}$/);
  const client = await f.connect("chrome-main", { pairingCode: pairing.body.pairingCode });
  assert.equal(client.ready.type, "ready");
  assert.match(client.ready.resumeToken, /^[a-f0-9]{64}$/);
  const devices = await f.api("GET", "/toonflow/devices");
  assert.equal(devices.body.devices[0].connected, true);
  const nextJob = once(client.socket, "message");
  const task = await f.api("POST", "/toonflow/jobs", { deviceId: "chrome-main", prompt: "An orange bird" });
  assert.equal(task.status, 202);
  const jobMessage = JSON.parse((await nextJob)[0].toString());
  assert.equal(jobMessage.type, "job");
  assert.equal(jobMessage.prompt, "An orange bird");
  client.socket.send(JSON.stringify({ type: "result", jobId: jobMessage.jobId, result: { imageData: "data:image/png;base64,AA==" } }));
  // Processing the async message may lag the HTTP request by one event-loop turn.
  let state;
  for (let i = 0; i < 100; i++) {
    state = (await f.api("GET", "/toonflow/jobs/" + task.body.jobId)).body;
    if (state.state === "done") break;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(state.state, "done");
  assert.equal(state.result.imageData, "data:image/png;base64,AA==");
  assert.equal(JSON.stringify(devices.body).includes(adminKey), false);
  assert.equal(JSON.stringify(client.ready).includes(adminKey), false);

  const closed = once(client.socket, "close");
  client.socket.close();
  await closed;
  const resumed = await f.connect("chrome-main", { resumeToken: client.ready.resumeToken });
  assert.equal(resumed.ready.type, "ready");
  assert.notEqual(resumed.ready.resumeToken, client.ready.resumeToken);
  resumed.socket.close();
});

test("untrusted webpage origins cannot join ToonFlow socket", async t => {
  const f = await setup(t);
  await assert.rejects(new Promise((resolve, reject) => {
    const socket = new WebSocket(f.url.replace("http:", "ws:") + "/toonflow", { origin: "https://evil.invalid" });
    socket.once("open", resolve);
    socket.once("error", reject);
  }));
});


test("video jobs require a real video result, never an image thumbnail", async t => {
  const f = await setup(t);
  const pairing = await f.api("POST", "/toonflow/pairings", { deviceId: "chrome-video" });
  const client = await f.connect("chrome-video", { pairingCode: pairing.body.pairingCode });
  const next = once(client.socket, "message");
  const job = await f.api("POST", "/toonflow/jobs", {
    deviceId: "chrome-video", mediaType: "video", prompt: "A cinematic street scene", ratio: "9:16",
  });
  assert.equal(job.status, 202);
  const received = JSON.parse((await next)[0].toString());
  assert.equal(received.mediaType, "video");
  assert.equal(received.ratio, "9:16");
  client.socket.send(JSON.stringify({
    type: "result", jobId: received.jobId, result: { imageUrl: "https://example.com/thumbnail.png" },
  }));
  let status;
  for (let i = 0; i < 100; i++) {
    status = (await f.api("GET", "/toonflow/jobs/" + job.body.jobId)).body;
    if (status.state === "error") break;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(status.state, "error");
  assert.match(status.error, /video/);

  const next2 = once(client.socket, "message");
  const job2 = await f.api("POST", "/toonflow/jobs", { deviceId: "chrome-video", mediaType: "video", prompt: "Sunset city" });
  assert.equal(job2.status, 202);
  const received2 = JSON.parse((await next2)[0].toString());
  client.socket.send(JSON.stringify({
    type: "result", jobId: received2.jobId, result: { videoData: "data:video/mp4;base64,AA==" },
  }));
  for (let i = 0; i < 100; i++) {
    status = (await f.api("GET", "/toonflow/jobs/" + job2.body.jobId)).body;
    if (status.state === "done") break;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(status.state, "done");
  assert.equal(status.result.videoData, "data:video/mp4;base64,AA==");
  client.socket.close();
});

test("reject unsupported media type before scheduling a video job", async t => {
  const f = await setup(t);
  const invalid = await f.api("POST", "/toonflow/jobs", {
    deviceId: "chrome-main", mediaType: "audio", prompt: "Hello",
  });
  assert.equal(invalid.status, 400);
});
