import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";
import superagent from "superagent";

import { buildSearchOptions } from "./kayak-api.js";

const DEFAULT_OPTIONS = buildSearchOptions({
  origin: "TYO",
  destination: "TPE",
  departureDate: "2026-06-18"
});
const DEFAULT_POLL_URL = "https://www.kayak.co.jp/i/api/search/dynamic/flights/poll";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveCacheFile(cacheFile) {
  return path.resolve(process.cwd(), cacheFile ?? ".cache/kayak-session.json");
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function isCookieExpired(cookie) {
  if (!cookie.expires || cookie.expires <= 0) {
    return false;
  }
  return cookie.expires * 1000 <= Date.now();
}

function buildCookieHeader(cookies) {
  return cookies
    .filter((cookie) => cookie.name && cookie.value && !isCookieExpired(cookie))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

function pickHeader(headers, name) {
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  return undefined;
}

function buildPollRequest(session, body) {
  const cookieHeader = buildCookieHeader(session.cookies ?? []);
  if (!cookieHeader) {
    throw new Error("Cached session does not contain any valid cookies.");
  }

  const requestBody = body ?? session.pollRequest?.body ?? DEFAULT_OPTIONS.requestBody;
  const headers = {
    accept: "*/*",
    "accept-language": session.acceptLanguage ?? "ja,zh-CN;q=0.9,zh;q=0.8,en;q=0.7",
    "content-type": "application/json",
    cookie: cookieHeader,
    origin: session.origin ?? DEFAULT_OPTIONS.origin,
    referer: session.referer ?? DEFAULT_OPTIONS.referer,
    "user-agent":
      session.userAgent ??
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "x-requested-with": "XMLHttpRequest"
  };

  if (session.csrfToken) {
    headers["x-csrf"] = session.csrfToken;
  }

  const optionalHeaders = [
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform",
    "sec-fetch-dest",
    "sec-fetch-mode",
    "sec-fetch-site",
    "priority"
  ];

  for (const headerName of optionalHeaders) {
    const headerValue = pickHeader(session.pollRequest?.headers, headerName);
    if (headerValue) {
      headers[headerName] = headerValue;
    }
  }

  return { headers, requestBody };
}

function cloneBody(body) {
  return JSON.parse(JSON.stringify(body));
}

function withSearchId(body, searchId) {
  const nextBody = cloneBody(body);
  nextBody.userSearchParams = nextBody.userSearchParams ?? {};
  nextBody.userSearchParams.searchId = searchId;
  return nextBody;
}

async function sendPollRequest(session, body) {
  const { headers, requestBody } = buildPollRequest(session, body);
  const pollUrl = session.pollUrl ?? session.pollRequest?.url ?? DEFAULT_POLL_URL;
  const response = await superagent
    .post(pollUrl)
    .set(headers)
    .send(requestBody)
    .ok((res) => res.status >= 200 && res.status < 500);

  if (response.status >= 400) {
    const error = new Error(`Kayak poll request failed with status ${response.status}.`);
    error.status = response.status;
    error.responseText = response.text;
    throw error;
  }

  return response.body;
}

async function pollUntilComplete(session, body, options = {}) {
  const intervalMs = options.pollIntervalMs ?? 3000;
  const maxAttempts = options.maxPollAttempts ?? 40;

  let attempt = 0;
  let requestBody = cloneBody(body ?? session.pollRequest?.body ?? DEFAULT_OPTIONS.requestBody);
  let responseBody = await sendPollRequest(session, requestBody);

  while (responseBody?.status !== "complete") {
    attempt += 1;

    if (attempt >= maxAttempts) {
      const error = new Error(
        `Kayak poll did not complete after ${maxAttempts} attempts. Last status: ${responseBody?.status ?? "unknown"}.`
      );
      error.lastResponse = responseBody;
      throw error;
    }

    const searchId = responseBody?.searchId ?? requestBody?.userSearchParams?.searchId;
    if (!searchId) {
      const error = new Error("Kayak poll response did not contain a searchId for the next phase.");
      error.lastResponse = responseBody;
      throw error;
    }

    await sleep(intervalMs);
    requestBody = withSearchId(requestBody, searchId);
    responseBody = await sendPollRequest(session, requestBody);
  }

  return responseBody;
}

async function captureSessionWithBrowser(options = {}) {
  const browser = await chromium.launch({
    headless: options.headless ?? true,
    channel: options.channel ?? "chromium",
    args: ["--disable-blink-features=AutomationControlled"]
  });

  const context = await browser.newContext({
    locale: options.locale ?? "ja-JP",
    timezoneId: options.timezoneId ?? "Asia/Tokyo",
    userAgent:
      options.userAgent ??
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    viewport: options.viewport ?? { width: 1440, height: 900 },
    screen: options.screen ?? { width: 1440, height: 900 }
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["ja-JP", "ja", "en-US", "en"]
    });
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5]
    });

    if (!window.chrome) {
      Object.defineProperty(window, "chrome", {
        value: { runtime: {} },
        configurable: true
      });
    }

    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
      window.navigator.permissions.query = (parameters) => {
        if (parameters?.name === "notifications") {
          return Promise.resolve({ state: Notification.permission });
        }
        return originalQuery.call(window.navigator.permissions, parameters);
      };
    }
  });

  const page = await context.newPage();
  let capturedRequest;

  page.on("request", async (request) => {
    if (request.method() !== "POST" || !request.url().includes("/i/api/search/dynamic/flights/poll")) {
      return;
    }

    let parsedBody;
    const rawPostData = request.postData();
    if (rawPostData) {
      try {
        parsedBody = JSON.parse(rawPostData);
      } catch {
        parsedBody = rawPostData;
      }
    }

    capturedRequest = {
      url: request.url(),
      headers: request.headers(),
      body: parsedBody
    };
  });

  try {
    await page.goto(options.searchUrl ?? DEFAULT_OPTIONS.searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: options.navigationTimeoutMs ?? 120000
    });

    await page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/i/api/search/dynamic/flights/poll"),
      {
        timeout: options.pollTimeoutMs ?? 120000
      }
    );

    const cookies = await context.cookies();
    const session = {
      capturedAt: new Date().toISOString(),
      searchUrl: page.url(),
      origin: options.origin ?? new URL(page.url()).origin,
      referer: options.referer ?? page.url(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      acceptLanguage: await page.evaluate(() => navigator.language),
      csrfToken: pickHeader(capturedRequest?.headers, "x-csrf"),
      cookies,
      pollUrl: capturedRequest?.url ?? DEFAULT_POLL_URL,
      pollRequest: capturedRequest
    };

    if (!session.csrfToken) {
      throw new Error("Browser request was captured, but x-csrf header was missing.");
    }

    return session;
  } finally {
    await browser.close();
  }
}

export async function loadCachedSession(cacheFile) {
  const cachePath = resolveCacheFile(cacheFile);
  return readJson(cachePath);
}

export async function saveSession(session, cacheFile) {
  const cachePath = resolveCacheFile(cacheFile);
  await writeJson(cachePath, session);
}

export async function getValidSession(options = {}) {
  const cacheFile = options.cacheFile;
  const cachedSession = await loadCachedSession(cacheFile);

  if (cachedSession) {
    try {
      await sendPollRequest(cachedSession, options.requestBody);
      return {
        session: cachedSession,
        source: "cache"
      };
    } catch (error) {
      if (![401, 403].includes(error.status)) {
        throw error;
      }
    }
  }

  const freshSession = await captureSessionWithBrowser(options);
  await saveSession(freshSession, cacheFile);
  return {
    session: freshSession,
    source: "browser"
  };
}

export async function fetchKayakPoll(options = {}) {
  const { session, source } = await getValidSession(options);
  const data = await pollUntilComplete(session, options.requestBody, options);
  return {
    source,
    sessionCapturedAt: session.capturedAt,
    data
  };
}

export const kayakDefaults = {
  searchUrl: DEFAULT_OPTIONS.searchUrl,
  pollUrl: DEFAULT_POLL_URL,
  requestBody: DEFAULT_OPTIONS.requestBody
};
