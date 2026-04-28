import { useState } from "react";
import { ArrowRight, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(100, "Máximo de 100 caracteres"),
  email: z.string().trim().email("E-mail inválido").max(255),
  message: z.string().trim().min(5, "Mensagem muito curta").max(2000, "Máximo de 2000 caracteres"),
});

const CTASection = () => {
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) return;
    toast({
      title: "Tudo certo!",
      description: "Vamos te avisar quando o produto estiver disponível.",
    });
    setWaitlistEmail("");
  };

  const handleQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Verifique os campos",
        description: parsed.error.issues[0]?.message ?? "Dados inválidos",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "contact-question-for-founder",
          idempotencyKey: `contact-question-${id}`,
          templateData: parsed.data,
        },
      });
      if (error) throw error;

      // Confirmação para quem enviou (best-effort)
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "contact-question-confirmation",
          recipientEmail: parsed.data.email,
          idempotencyKey: `contact-confirm-${id}`,
          templateData: { name: parsed.data.name },
        },
      });

      toast({
        title: "Mensagem enviada!",
        description: "Vamos te responder em breve.",
      });
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      console.error("Erro ao enviar pergunta", err);
      toast({
        title: "Não foi possível enviar",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="section-padding">
      <div className="container mx-auto">
        <div className="glass rounded-2xl p-10 md:p-16 glow-border shadow-glow max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="section-title !text-3xl md:!text-4xl">
              Estamos construindo.{" "}
              <span className="text-gradient">Venha junto.</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Investidores, parceiros institucionais, programas de aceleração ou talentos — envie sua mensagem e a fundadora responde pessoalmente.
            </p>
          </div>

          <form onSubmit={handleQuestion} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Nome</Label>
                <Input
                  id="contact-name"
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">E-mail</Label>
                <Input
                  id="contact-email"
                  type="email"
                  required
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="seu@email.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">Sua pergunta</Label>
              <Textarea
                id="contact-message"
                required
                rows={5}
                maxLength={2000}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Como podemos te ajudar? Conte sobre seu interesse — investimento, parceria, aceleração ou outro."
              />
            </div>
            <div className="flex justify-center pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={sending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {sending ? "Enviando..." : (<>Enviar pergunta <Send size={16} /></>)}
              </Button>
            </div>
          </form>

          <div className="pt-6 border-t border-border space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Sou empreendedora, quero acompanhar o lançamento
            </p>
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="outline" className="border-primary/40 text-foreground hover:bg-primary/10 gap-2">
                Entrar na lista <ArrowRight size={16} />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground text-center">
              Vamos te avisar quando o produto estiver disponível. Estamos em fase de desenvolvimento.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
