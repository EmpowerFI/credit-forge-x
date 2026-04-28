import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Status = "validating" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("validating");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const data = await res.json();
        if (data.valid === true) setStatus("ready");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        setStatus("invalid");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setStatus("submitting");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) setStatus("done");
      else if (data.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="glass rounded-2xl p-10 glow-border shadow-glow max-w-md w-full text-center space-y-5">
        <h1 className="text-2xl font-heading font-bold text-gradient">EmpowerFI</h1>

        {status === "validating" && (
          <p className="text-muted-foreground">Validando seu link...</p>
        )}

        {status === "ready" && (
          <>
            <h2 className="text-xl font-heading text-foreground">Cancelar inscrição</h2>
            <p className="text-muted-foreground">
              Confirme abaixo para parar de receber e-mails da EmpowerFI neste endereço.
            </p>
            <Button onClick={confirm} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Confirmar cancelamento
            </Button>
          </>
        )}

        {status === "submitting" && (
          <p className="text-muted-foreground">Processando...</p>
        )}

        {status === "done" && (
          <>
            <h2 className="text-xl font-heading text-foreground">Tudo certo</h2>
            <p className="text-muted-foreground">
              Você não receberá mais e-mails da EmpowerFI neste endereço.
            </p>
          </>
        )}

        {status === "already" && (
          <>
            <h2 className="text-xl font-heading text-foreground">Já cancelado</h2>
            <p className="text-muted-foreground">
              Esse endereço já está fora da nossa lista.
            </p>
          </>
        )}

        {status === "invalid" && (
          <>
            <h2 className="text-xl font-heading text-foreground">Link inválido</h2>
            <p className="text-muted-foreground">
              Este link de cancelamento expirou ou não é válido.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h2 className="text-xl font-heading text-foreground">Não foi possível processar</h2>
            <p className="text-muted-foreground">Tente novamente em alguns instantes.</p>
            <Button onClick={confirm} variant="outline" className="border-primary/40">
              Tentar novamente
            </Button>
          </>
        )}
      </div>
    </main>
  );
};

export default Unsubscribe;
