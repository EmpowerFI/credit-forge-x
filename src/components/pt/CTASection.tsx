import { useState } from "react";
import { ArrowRight, Mail, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_EMAIL } from "@/config/links";
import PlayStoreBadge from "@/components/PlayStoreBadge";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(100, "Máximo de 100 caracteres"),
  email: z.string().trim().email("E-mail inválido").max(255),
  message: z.string().trim().min(5, "Mensagem muito curta").max(2000, "Máximo de 2000 caracteres"),
});

const CTASection = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

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

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "contact-question-confirmation",
          recipientEmail: parsed.data.email,
          idempotencyKey: `contact-confirm-${id}`,
          templateData: { name: parsed.data.name },
        },
      });

      toast({ title: "Mensagem enviada!", description: "Respondemos em breve." });
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      console.error("Erro ao enviar mensagem", err);
      toast({
        title: "Não foi possível enviar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="contato" className="section-padding">
      <div className="container mx-auto space-y-12">
        <div className="mx-auto max-w-3xl space-y-6 rounded-2xl p-10 text-center glass glow-border shadow-glow md:p-16">
          <h2 className="section-title !text-2xl md:!text-3xl">
            Comece pelo <span className="text-gradient">seu negócio</span>.
          </h2>
          <p className="mx-auto max-w-xl leading-relaxed text-muted-foreground">
            Baixe o app, organize o dia a dia e comece a construir o histórico que hoje
            ninguém enxerga. É gratuito.
          </p>
          <div className="flex justify-center">
            <PlayStoreBadge eyebrow="Baixe agora no" justLaunched="Disponível no Brasil" />
          </div>
        </div>

        <div className="mx-auto max-w-3xl space-y-8">
          <div className="space-y-3 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-accent">Contato</p>
            <h3 className="section-title !text-2xl md:!text-3xl">
              Fale com a <span className="text-gradient">EmpowerFI</span>
            </h3>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Dúvidas sobre o app, imprensa, comunidades de empreendedorismo ou parcerias.
              Respondemos todas as mensagens.
            </p>
          </div>

          <form onSubmit={handleQuestion} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
              <Label htmlFor="contact-message">Mensagem</Label>
              <Textarea
                id="contact-message"
                required
                rows={5}
                maxLength={2000}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Como podemos ajudar?"
              />
            </div>
            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <Button
                type="submit"
                size="lg"
                disabled={sending}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {sending ? "Enviando..." : (<>Enviar mensagem <Send size={16} /></>)}
              </Button>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Contato%20EmpowerFI`}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail size={16} /> ou escreva para {CONTACT_EMAIL}
              </a>
            </div>
          </form>
        </div>

        {/* A tese para investidor vive em /investors, em inglês. Aqui fica só a
            porta de entrada, para não competir com a mensagem da página. */}
        <p className="text-center text-sm text-muted-foreground">
          Investidor ou parceiro institucional?{" "}
          <Link
            to="/investors"
            className="inline-flex items-center gap-1 font-medium text-accent transition-colors hover:text-foreground"
          >
            Veja a tese da EmpowerFI (em inglês) <ArrowRight size={14} />
          </Link>
        </p>
      </div>
    </section>
  );
};

export default CTASection;
