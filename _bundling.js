/**
 * There are two versions of the Bundling widget: The "legacy" version that
 * lives outside Recharge's CDN and the new version in Recharge's CDN.
 *
 * The objective of this file is to ease the migration of the users who
 * currently have the widget installed using the "legacy" version.
 *
 * Once the migration finishes for all users to use Recharge's Bundles, we
 * would have only to import the new widget and remove all this code.
 */

(function () {
    function buildCdnUrl(filename) {
        return `{{ bundling_cdn_url }}${filename}`;
    }

    function isLegacyResource(src) {
        return src && src.indexOf("{{ bundling_legacy_cdn_url }}") !== -1;
    }

    function isNewResource(src) {
        return src && src.indexOf("{{ bundling_cdn_url }}") !== -1;
    }

    function isBundlesWidgetInstalled() {
        const scripts = Array.from(document.getElementsByTagName("script"));
        return scripts.find(function (script) {
            return isLegacyResource(script.src) || isNewResource(script.src);
        });
    }

    function isBundlesStylesheetInstalled() {
        const stylesheets = Array.from(document.getElementsByTagName("link"));
        return stylesheets.find(function (stylesheet) {
            return (
                isLegacyResource(stylesheet.href) ||
                isNewResource(stylesheet.href)
            );
        });
    }

    function appendBundlesWidgetScript() {
        if (isBundlesWidgetInstalled()) return;
        const bundleScript = document.createElement("script");
        bundleScript.src = buildCdnUrl("src.js");
        bundleScript.referrerPolicy = "origin";
        document.body.appendChild(bundleScript);
    }

    function appendBundlesWidgetStylesheet() {
        if (isBundlesStylesheetInstalled()) return;
        const bundleStylesheet = document.createElement("link");
        bundleStylesheet.href = buildCdnUrl("src.css");
        bundleStylesheet.rel = "stylesheet";
        bundleStylesheet.referrerPolicy = "origin";
        document.head.appendChild(bundleStylesheet);
    }

    document.addEventListener("DOMContentLoaded", () => {
        appendBundlesWidgetStylesheet();
        appendBundlesWidgetScript();
    });
})();
