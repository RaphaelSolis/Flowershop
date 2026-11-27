"use strict";

const { createHmac, pbkdf2, randomBytes, timingSafeEqual } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { promisify } = require("node:util");

const digestPassword = promisify(pbkdf2);
const username = "PetalFlower";
const loginPage = "/Log-Sign/LoginPage.html";
const cookieName = "__Secure-petal_admin";
const sessionSeconds = 8 * 60 * 60;

function adminConfig() {
  try {
    const config = JSON.parse(process.env.PETAL_ADMIN_CONFIG || "");
    return /^[0-9a-f]{32}$/.test(config.salt) &&
      /^[0-9a-f]{64}$/.test(config.digest) &&
      /^[0-9a-f]{64}$/.test(config.sessionKey) ? config : null;
  } catch {
    return null;
  }
}

function sign(value, key) {
  return createHmac("sha256", Buffer.from(key, "hex")).update(value).digest("hex");
}

function sessionCookie(token = "") {
  return cookieName + "=" + token + "; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=" +
    (token ? sessionSeconds : 0);
}

function hasSession(request, config) {
  const cookie = (request.headers.cookie || "").split(";").map(value => value.trim())
    .find(value => value.startsWith(cookieName + "="));
  const token = cookie?.slice(cookieName.length + 1) || "";
  if (!/^\d{10,11}\.[0-9a-f]{32}\.[0-9a-f]{64}$/.test(token)) return false;
  const [expires, nonce, signature] = token.split(".");
  return Number(expires) > Math.floor(Date.now() / 1000) &&
    timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(expires + "." + nonce, config.sessionKey), "hex"));
}

function readForm(request) {
  if (typeof request.body === "string" || Buffer.isBuffer(request.body))
    return Object.fromEntries(new URLSearchParams(request.body.toString()));
  return request.body || {};
}

module.exports = async function admin(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Security-Policy",
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src blob:; " +
    "font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  const action = request.query?.action;
  const config = adminConfig();
  const finish = status => response.status(status).end();
  if (action === "login" || action === "logout") {
    if (request.method !== "POST") return finish(405);
    if (!request.headers.host || request.headers.origin !== "https://" + request.headers.host) return finish(403);
    if (action === "logout") {
      response.setHeader("Set-Cookie", sessionCookie());
      response.setHeader("Location", loginPage);
      return finish(303);
    }
    if (!config) return finish(503);
    if (request.headers["content-type"]?.split(";")[0] !== "application/x-www-form-urlencoded")
      return finish(415);
    const { username: identifier, password } = readForm(request);
    if (identifier !== username || typeof password !== "string" || !password || password.length > 128)
      return finish(401);
    const digest = await digestPassword(password, Buffer.from(config.salt, "hex"), 600_000, 32, "sha256");
    if (!timingSafeEqual(digest, Buffer.from(config.digest, "hex"))) return finish(401);
    const value = Math.floor(Date.now() / 1000 + sessionSeconds) + "." + randomBytes(16).toString("hex");
    response.setHeader("Set-Cookie", sessionCookie(value + "." + sign(value, config.sessionKey)));
    return finish(204);
  }

  if (!["page", "session", "script"].includes(action)) return finish(404);
  if (!["GET", "HEAD"].includes(request.method)) return finish(405);
  if (!config || !hasSession(request, config)) {
    if (action !== "page") return finish(401);
    response.setHeader("Location", loginPage);
    return finish(303);
  }
  if (action === "session") return finish(204);

  response.setHeader("Content-Type", action === "script" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8");
  if (request.method === "HEAD") return finish(200);
  const content = action === "script" ? readFileSync(__dirname + "/../admin/dashboard.js") :
    readFileSync(__dirname + "/../admin/dashboard.html");
  return response.status(200).send(content);
};
