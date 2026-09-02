import { useState } from "react";
import { ArrowRight, Brain, Globe2, Mail, Send, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_EMAIL } from "@/config/links";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(100, "Máximo de 100 caracteres"),
  email: z.string().trim().email("E-mail inválido").max(255),
  message: z.string().trim().min(5, "Mensagem muito curta").max(2000, "Máximo de 2000 caracteres"),
});

const pillars = [
  {
    icon: Globe2,
    title: "Infraestrutura de crédito produtivo",
    desc: "Capital global chega ao pequeno negócio em moeda local. Stablecoins e a Solana são o trilho que torna viável um empréstimo de US$ 50 a US$ 200 atravessar fronteiras.",
  },
  {
    icon: Brain,
    title: "Inteligência de crédito alternativa",
    desc: "Sinais de atividade e gestão do negócio constroem uma visão de capacidade de pagamento para quem tem pouco histórico no sistema financeiro tradicional.",
  },
  {
    icon: Target,
    title: "Resultado econômico mensurável",
    desc: "Acompanhamos o que aconteceu depois do desembolso: negócios financiados, pagamento, evolução do faturamento, negócios ainda ativos.",
  },
];

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
    <section id="investidores" className="section-padding gradient-subtle">
      <div className="container mx-auto space-y-12">
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Investidores e parceiros
          </p>
          <h2 className="section-title">
            Infraestrutura que transforma liquidez global em{" "}
            <span className="text-gradient">capital produtivo</span>
          </h2>
          <p className="section-subtitle">
            A EmpowerFI conecta capital global a pequenos negócios sub-atendidos — começando
            por mulheres empreendedoras no Brasil.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl p-8 text-left glass glow-border">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
                <Icon className="text-primary-foreground" size={24} />
              </div>
              <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{title}</h3>
              <p className="leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          {/* The investor material and the waitlist are maintained in English,
              for the international audience they are written for. */}
          <Button
            asChild
            size="lg"
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link to="/investors">
              Página para investidores (em inglês) <ArrowRight size={18} />
            </Link>
          </Button>
          <p className="max-w-xl text-center text-xs text-muted-foreground">
            A lista de espera representa apenas interesse não vinculante. A EmpowerFI não
            está ofertando valores mobiliários ou produtos de investimento, nem captando
            recursos de investidores por este site.
          </p>
        </div>

        <div className="mx-auto max-w-3xl space-y-8 rounded-2xl p-10 glass glow-border shadow-glow md:p-16">
          <div className="space-y-4 text-center">
            <h3 className="section-title !text-2xl md:!text-3xl">
              Fale com a <span className="text-gradient">EmpowerFI</span>.
            </h3>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Imprensa, parcerias, comunidades de empreendedorismo ou dúvidas sobre o
              produto: escreva para a gente. Respondemos todas as mensagens.
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
                placeholder="Conte sobre seu interesse — parceria, comunidade de empreendedoras ou o produto."
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
      </div>
    </section>
  );
};

export default CTASection;
