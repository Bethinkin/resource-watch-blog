// OAuth client configuration. Fill these in (or set the CP_* env vars) to
// enable the corresponding SSO providers. Manual sign-in works without any
// configuration.
//
// Google: Cloud Console -> APIs & Services -> Credentials -> OAuth client ID
//   type "Desktop app". No client secret needed (PKCE).
//
// Atlassian: developer.atlassian.com/console/myapps -> "OAuth 2.0 (3LO)".
//   Add callback URL "http://127.0.0.1/callback" (any port works; we register
//   the exact redirect at runtime). Needs both clientId and clientSecret.
//
// Apple: developer.apple.com -> Identifiers -> Services ID + Key. The
//   privateKeyPath must point to the .p8 file downloaded from Apple.

module.exports = {
  google: {
    clientId: process.env.CP_GOOGLE_CLIENT_ID || '',
    scope: 'openid email profile'
  },
  atlassian: {
    clientId: process.env.CP_ATLASSIAN_CLIENT_ID || '',
    clientSecret: process.env.CP_ATLASSIAN_CLIENT_SECRET || '',
    scope: 'read:jira-work read:jira-user read:me offline_access'
  },
  apple: {
    serviceId: process.env.CP_APPLE_SERVICE_ID || '',
    teamId: process.env.CP_APPLE_TEAM_ID || '',
    keyId: process.env.CP_APPLE_KEY_ID || '',
    privateKeyPath: process.env.CP_APPLE_PRIVATE_KEY || ''
  }
};
