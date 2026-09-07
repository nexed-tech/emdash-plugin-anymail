// Kept in sync with package.json by the release process (npm version / CI).
// definePlugin() requires a semver string and there is no filesystem at runtime
// on Workers, so the version lives here as a plain constant.
export const VERSION = "0.1.0";
