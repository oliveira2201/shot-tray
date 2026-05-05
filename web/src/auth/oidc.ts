import { UserManager, WebStorageStateStore } from "oidc-client-ts";

const issuer = (import.meta.env.VITE_ZITADEL_ISSUER as string) || "https://id.vexvendas.com.br";
const clientId = import.meta.env.VITE_ZITADEL_CLIENT_ID as string | undefined;

if (!clientId) {
  // eslint-disable-next-line no-console
  console.warn("VITE_ZITADEL_CLIENT_ID não definido — auth não vai funcionar em build de produção");
}

export const userManager = new UserManager({
  authority: issuer,
  client_id: clientId || "",
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid profile email",
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  automaticSilentRenew: true,
});

export async function getAccessToken(): Promise<string | null> {
  const user = await userManager.getUser();
  if (!user || user.expired) return null;
  return user.access_token;
}

export async function logout() {
  await userManager.signoutRedirect();
}
