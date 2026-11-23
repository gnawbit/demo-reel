import { commandError } from "./report.mjs";

// Keep URLs (which may contain credentials or tokens) out of error reports.
export async function navigate(page, url, { allowAuthErrors = false } = {}) {
  let response;
  try {
    response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  } catch (error) {
    throw commandError("PAGE_UNREACHABLE", error.name === "TimeoutError"
      ? "The target page did not finish loading in time."
      : "Could not open the target page.", {
      hint: "Check the target URL, start the app if it is local, and verify browser network/proxy access before retrying. doctor checks dependencies, not page access.",
    });
  }
  const status = response?.status();
  // A login page may return 401/403 before the user signs in manually.
  if (status >= 400 && !(allowAuthErrors && (status === 401 || status === 403))) {
    throw commandError("PAGE_HTTP_ERROR", `The target page returned HTTP ${status}.`, {
      status,
      hint: status === 401 || status === 403
        ? "Check page permissions and login state. Use interactive --login if needed, then pass --storage-state; do not bypass access controls."
        : "Check the target URL and app/server response. Retry after the page is available.",
    });
  }
  return response;
}
