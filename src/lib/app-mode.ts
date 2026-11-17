// The Play Store app is a Trusted Web Activity: the same website, opened by the
// Android app in Chrome with no address bar. It shares cookies with the
// visitor's normal Chrome browser, so app mode is kept in sessionStorage
// (one tab only) and never in a cookie, or Chrome tabs would turn into the app.
//
// A launch is recognised by the start URL marker (?app=android) or by the
// android-app:// referrer Chrome gives pages opened from the app.

export const appModeKey = "wassa.app";
export const appModeValue = "android";
export const appStartPath = "/news";

const packagePattern = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

export function androidPackage(value = process.env.ANDROID_PACKAGE_NAME) {
  const name = value?.trim();
  return name && packagePattern.test(name) && name.length <= 150 ? name : null;
}

// Digital Asset Links: proves to Android that the app and this website have the
// same owner, so the app opens without a browser bar. Fingerprints are SHA-256
// signing-certificate digests (Play App Signing key, plus the upload key for
// locally signed test builds), comma or space separated.
export function assetLinks(
  packageValue = process.env.ANDROID_PACKAGE_NAME,
  fingerprintValue = process.env.ANDROID_CERT_FINGERPRINTS,
) {
  const packageName = androidPackage(packageValue);
  const fingerprints = (fingerprintValue ?? "")
    .split(/[\s,]+/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (
    !packageName ||
    !fingerprints.length ||
    !fingerprints.every((value) =>
      /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value),
    )
  )
    return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: [...new Set(fingerprints)],
      },
    },
  ];
}

// Runs in <body> before the header is painted. Marks <html data-app="android">
// so CSS swaps the website chrome for the app's tab bar without a flash, and
// sends the homepage to News as the app has no homepage.
export function appModeScript(packageName: string | null) {
  const referrer = packageName ? "android-app://" + packageName : null;
  return `(function(){try{var s=sessionStorage,k=${JSON.stringify(appModeKey)},v=${JSON.stringify(appModeValue)},r=${JSON.stringify(referrer)};if(/[?&]app=android(?:&|$)/.test(location.search)||(r&&(document.referrer===r||document.referrer.indexOf(r+"/")===0)))s.setItem(k,v);if(s.getItem(k)===v){document.documentElement.setAttribute("data-app",v);if(location.pathname==="/")location.replace(${JSON.stringify(appStartPath)})}}catch(e){}})();`;
}
