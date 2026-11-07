"use strict";

const { createHash, randomBytes, randomUUID, timingSafeEqual } = require("node:crypto");
const { WebSocket, WebSocketServer } = require("ws");

const devicePattern = /^[a-zA-Z0-9_-]{1,64}$/;
const extensionOrigin = /^chrome-extension:\/\/[a-p]{32}$/;
const tokenPattern = /^[a-f0-9]{64}$/;
const resultPattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const pairLeaseMs = 10 * 60 * 1000;
const maxJobMs = 10 * 60 * 1000;

function hashSecret(value) {
  return createHash("sha256").update(value).digest();
}

function equalSecret(value, digest) {
  return typeof value === "string" && tokenPattern.test(value) && Buffer.isBuffer(digest)
    && timingSafeEqual(hashSecret(value), digest);
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

function receiveJson(req) {
  return new Promise((resolve, reject) => {
    let count = 0;
    const chunks = [];
    req.on("data", chunk => {
      count += chunk.length;
      if (count > 65536) {
        reject(Object.assign(new Error("Request exceeds 64 KiB"), { status: 413 }));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (count > 65536) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(Object.assign(new Error("Invalid JSON"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

/**
 * ToonFlow namespace. The existing encrypted MooZ /remote protocol is untouched.
 * The shared RELAY_ADMIN_KEY is supplied ONLY by the ToonFlow backend over HTTPS.
 * Chrome receives a one-time pairing code and a rotating resume secret, never the admin key.
 * Unlike MooZ /remote, this MVP relays media payloads in memory without E2E encryption.
 */
function createToonflowGateway({ authorizeAdmin }) {
  const clients = new WebSocketServer({ noServer: true, maxPayload: 12 * 1024 * 1024, perMessageDeflate: false });
  const devices = new Map();
  const pairings = new Map();
  const jobs = new Map();
  const active = new Map();
  let closing = false;

  function isOnline(deviceId) {
    return devices.get(deviceId)?.socket?.readyState === WebSocket.OPEN;
  }

  function fail(job, message) {
    if (!job || job.state === "done" || job.state === "error") return;
    job.state = "error";
    job.error = message;
    job.updatedAt = Date.now();
    if (active.get(job.deviceId) === job.id) active.delete(job.deviceId);
  }

  function pump(deviceId) {
    if (closing || active.has(deviceId) || !isOnline(deviceId)) return;
    const socket = devices.get(deviceId).socket;
    const job = [...jobs.values()].find(item => item.deviceId === deviceId && item.state === "queued");
    if (!job) return;
    job.state = "running";
    job.updatedAt = Date.now();
    active.set(deviceId, job.id);
    socket.send(JSON.stringify({
      type: "job", jobId: job.id, prompt: job.prompt, ratio: job.ratio, size: job.size, quality: job.quality,
    }), err => {
      if (err) {
        fail(job, "Could not deliver job to Chrome. Check Muse before retrying.");
        pump(deviceId);
      }
    });
  }

  async function processHttp(req, res) {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
    if (!authorizeAdmin(bearer)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }
    if (req.method === "GET" && pathname === "/toonflow/devices") {
      sendJson(res, 200, { devices: [...devices.keys()].map(deviceId => ({
        deviceId, connected: isOnline(deviceId), busy: active.has(deviceId),
      })) });
      return;
    }
    if (req.method === "POST" && pathname === "/toonflow/pairings") {
      const input = await receiveJson(req);
      if (!input || typeof input.deviceId !== "string" || !devicePattern.test(input.deviceId)) {
        sendJson(res, 400, { error: "Invalid deviceId" });
        return;
      }
      if (!pairings.has(input.deviceId) && pairings.size >= 24) {
        sendJson(res, 429, { error: "Too many pending pairing requests" });
        return;
      }
      const pairingCode = randomBytes(32).toString("hex");
      const expiresAt = Date.now() + pairLeaseMs;
      pairings.set(input.deviceId, { digest: hashSecret(pairingCode), expiresAt });
      sendJson(res, 201, { deviceId: input.deviceId, pairingCode, expiresAt });
      return;
    }
    if (req.method === "POST" && pathname === "/toonflow/jobs") {
      const input = await receiveJson(req);
      if (!input || typeof input.deviceId !== "string" || !devicePattern.test(input.deviceId)
        || typeof input.prompt !== "string" || !input.prompt.trim() || input.prompt.length > 10000) {
        sendJson(res, 400, { error: "Invalid deviceId or prompt" });
        return;
      }
      for (const key of ["ratio", "size", "quality"]) {
        if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length > 32)) {
          sendJson(res, 400, { error: "Invalid " + key });
          return;
        }
      }
      if (!isOnline(input.deviceId)) {
        sendJson(res, 409, { error: "Chrome device is not online" });
        return;
      }
      if ([...jobs.values()].filter(job => job.deviceId === input.deviceId && (job.state === "running" || job.state === "queued")).length >= 10) {
        sendJson(res, 429, { error: "Device job queue is full" });
        return;
      }
      const id = randomUUID();
      jobs.set(id, {
        id, deviceId: input.deviceId, prompt: input.prompt.trim(), ratio: input.ratio || "",
        size: input.size || "", quality: input.quality || "", state: "queued",
        createdAt: Date.now(), updatedAt: Date.now(),
      });
      pump(input.deviceId);
      sendJson(res, 202, { jobId: id });
      return;
    }
    if (req.method === "GET" && /^\/toonflow\/jobs\/[a-zA-Z0-9-]+$/.test(pathname)) {
      const id = pathname.slice("/toonflow/jobs/".length);
      const job = jobs.get(id);
      if (!job) {
        sendJson(res, 404, { error: "Job was not found or has expired" });
        return;
      }
      const response = { jobId: id, deviceId: job.deviceId, state: job.state, updatedAt: job.updatedAt };
      if (job.state === "done") response.result = job.result;
      if (job.state === "error") response.error = job.error;
      sendJson(res, 200, response);
      return;
    }
    sendJson(res, 404, { error: "Unknown ToonFlow endpoint" });
  }

  function handleHttp(req, res) {
    if (!new URL(req.url || "/", "http://localhost").pathname.startsWith("/toonflow/")) return false;
    void processHttp(req, res).catch(error => {
      if (!res.headersSent) sendJson(res, error.status || 400, { error: error.message || "Invalid request" });
      else res.destroy();
    });
    return true;
  }

  function handleUpgrade(req, socket, head) {
    if (closing || !extensionOrigin.test(req.headers.origin || "") || clients.clients.size >= 24) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      socket.destroy();
      return;
    }
    clients.handleUpgrade(req, socket, head, client => clients.emit("connection", client, req));
  }

  clients.on("connection", socket => {
    let deviceId = "";
    let authenticated = false;
    const timer = setTimeout(() => socket.close(1008, "Authentication timeout"), 8000);
    timer.unref?.();

    socket.on("message", data => {
      let message;
      try { message = JSON.parse(data.toString("utf8")); }
      catch { socket.close(1003, "Invalid JSON"); return; }
      if (!authenticated) {
        const id = message?.deviceId;
        if (message?.type !== "hello" || message.role !== "extension"
          || typeof id !== "string" || !devicePattern.test(id)) {
          socket.close(1008, "Invalid handshake"); return;
        }
        const pairing = pairings.get(id);
        const previous = devices.get(id);
        const validPairing = pairing && pairing.expiresAt > Date.now() && equalSecret(message.pairingCode, pairing.digest);
        const validResume = previous && equalSecret(message.resumeToken, previous.resumeDigest);
        if (!validPairing && !validResume) {
          socket.close(1008, "Pairing expired or revoked"); return;
        }
        if (!previous && devices.size >= 24) {
          socket.close(1013, "Device limit reached"); return;
        }
        if (validPairing) pairings.delete(id);
        if (previous?.socket?.readyState === WebSocket.OPEN && previous.socket !== socket) {
          previous.socket.close(1000, "New authorized device session");
        }
        deviceId = id;
        authenticated = true;
        clearTimeout(timer);
        const resumeToken = randomBytes(32).toString("hex");
        devices.set(id, { socket, resumeDigest: hashSecret(resumeToken) });
        socket.send(JSON.stringify({ type: "ready", deviceId, resumeToken }));
        pump(id);
        return;
      }
      if (message?.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
        return;
      }
      if (message?.type !== "result" || typeof message.jobId !== "string") return;
      const job = jobs.get(message.jobId);
      if (!job || job.deviceId !== deviceId || active.get(deviceId) !== job.id || job.state !== "running") return;
      if (typeof message.error === "string" && message.error) {
        fail(job, message.error.slice(0, 1000));
      } else {
        const result = message.result;
        const imageData = result?.imageData;
        const imageUrl = result?.imageUrl;
        const supportedData = typeof imageData === "string" && imageData.length <= 10 * 1024 * 1024 && resultPattern.test(imageData);
        const supportedUrl = typeof imageUrl === "string" && imageUrl.length <= 4096 && /^https:\/\//.test(imageUrl);
        if (!supportedData && !supportedUrl) fail(job, "Chrome returned no supported image");
        else {
          job.state = "done";
          job.result = supportedData ? { imageData } : { imageUrl };
          job.updatedAt = Date.now();
          active.delete(deviceId);
        }
      }
      pump(deviceId);
    });
    socket.on("close", () => {
      clearTimeout(timer);
      if (!deviceId) return;
      const entry = devices.get(deviceId);
      if (entry?.socket !== socket) return;
      entry.socket = null;
      for (const job of jobs.values()) {
        if (job.deviceId === deviceId && (job.state === "queued" || job.state === "running")) {
          fail(job, "Chrome disconnected. Check Muse before sending the prompt again.");
        }
      }
    });
    socket.on("error", () => {});
  });

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, record] of pairings) if (record.expiresAt <= now) pairings.delete(id);
    for (const [id, record] of jobs) {
      if ((record.state === "queued" || record.state === "running") && now - record.createdAt > maxJobMs) {
        fail(record, "Job timed out. Check Muse before trying again.");
        pump(record.deviceId);
      }
      if (now - record.createdAt > 30 * 60 * 1000) jobs.delete(id);
    }
  }, 15000);
  cleanup.unref?.();

  async function close() {
    closing = true;
    clearInterval(cleanup);
    for (const client of clients.clients) client.terminate();
    await new Promise(resolve => clients.close(resolve));
  }

  return { handleHttp, handleUpgrade, close };
}

module.exports = { createToonflowGateway };
