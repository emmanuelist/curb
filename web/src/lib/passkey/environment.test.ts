import { describe, expect, it } from "vitest";
import { detectPasskeyEnvironment } from "@/lib/passkey/environment";

const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1";
const IOS_WEBVIEW =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

describe("detectPasskeyEnvironment", () => {
  it("lets real browsers through", () => {
    expect(detectPasskeyEnvironment(SAFARI_IOS, true)).toEqual({ kind: "ok" });
    expect(detectPasskeyEnvironment(CHROME_IOS, true)).toEqual({ kind: "ok" });
    expect(detectPasskeyEnvironment(DESKTOP_CHROME, true)).toEqual({ kind: "ok" });
  });

  it("catches in-app browsers before a passkey ceremony can fail", () => {
    expect(detectPasskeyEnvironment(`${SAFARI_IOS} Telegram-iOS`, true)).toEqual({ kind: "in-app", app: "Telegram" });
    expect(detectPasskeyEnvironment(`${IOS_WEBVIEW} Twitter for iPhone`, true)).toEqual({ kind: "in-app", app: "X" });
    expect(detectPasskeyEnvironment(IOS_WEBVIEW, true)).toEqual({ kind: "in-app", app: "this app" });
    expect(detectPasskeyEnvironment(ANDROID_WEBVIEW, true)).toEqual({ kind: "in-app", app: "this app" });
  });

  it("reports browsers without WebAuthn", () => {
    expect(detectPasskeyEnvironment(DESKTOP_CHROME, false)).toEqual({ kind: "unsupported" });
  });
});
