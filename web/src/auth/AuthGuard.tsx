import { useEffect, useState } from "react";
import { userManager } from "./oidc";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Callback?
        if (window.location.pathname === "/auth/callback") {
          await userManager.signinRedirectCallback();
          window.history.replaceState({}, "", "/");
          setReady(true);
          return;
        }

        const user = await userManager.getUser();
        if (!user || user.expired) {
          await userManager.signinRedirect();
          return;
        }
        setReady(true);
      } catch (err: any) {
        setError(err.message || "Erro de autenticação");
      }
    })();
  }, []);

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#b00" }}>
        <h2>Erro de autenticação</h2>
        <p>{error}</p>
        <button onClick={() => userManager.signinRedirect()}>Tentar de novo</button>
      </div>
    );
  }

  if (!ready) return <div style={{ padding: 32, textAlign: "center" }}>Carregando…</div>;
  return <>{children}</>;
}
