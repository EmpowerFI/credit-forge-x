import { useState } from "react";
import { Send, Mail, Landmark, ShieldCheck, Globe2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { INVESTOR_EMAIL } from "@/config/links";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(100, "Máximo de 100 caracteres"),
  email: z.string().trim().email("E-mail inválido").max(255),
  message: z.string().trim().min(5, "Mensagem muito curta").max(2000, "Máximo de 2000 caracteres"),
});

const pillars = [
  {
    icon: Landmark,
    title: "Retorno protegido por colateral em Tesouro",
    desc: "O rendimento vem do crédito originado. O principal é protegido em duas camadas: colateral em títulos do Tesouro brasileiro e uma camada de primeira perda que a EmpowerFI assume antes de tocar o capital do investidor.",
  },
  {
    icon: ShieldCheck,
    title: "Impacto verificável on-chain",
    desc: "Cada alocação e cada resultado registrados na blockchain — prova de impacto contínua e auditável, não relatório anual.",
  },
  {
    icon: Globe2,
    title: "Infraestrutura global, rollout em fases",
    desc: "Construída como infraestrutura financeira global em blockchain, com lançamento em fases começando pelo Brasil.",
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
    <section id="investidores" className="section-padding gradient-subtle">
      <div className="container mx-auto space-y-12">
        <div className="text-center space-y-4">
          <p className="text-sm font-medium text-accent uppercase tracking-widest">Para investidores</p>
          <h2 className="section-title">
            Um fundo de impacto Web3 com{" "}
            <span className="text-gradient">retorno estável e impacto auditável</span>
          </h2>
          <p className="section-subtitle">
            Retorno protegido em duas camadas de um lado; prova de impacto verificável on-chain do outro.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {pillars.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-8 glow-border text-left">
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                <Icon className="text-primary-foreground" size={24} />
              </div>
              <h3 className="text-lg font-heading font-bold text-foreground mb-2">{title}</h3>
              <p className="text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-10 md:p-16 glow-border shadow-glow max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h3 className="section-title !text-2xl md:!text-3xl">
              Solicite o <span className="text-gradient">deck</span>.
            </h3>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Investidores e parceiros estratégicos: envie uma mensagem para receber o material completo.
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
              <Label htmlFor="contact-message">Mensagem</Label>
              <Textarea
                id="contact-message"
                required
                rows={5}
                maxLength={2000}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Conte sobre seu interesse — investimento, parceria estratégica ou capital de impacto."
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={sending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {sending ? "Enviando..." : (<>Solicitar o deck <Send size={16} /></>)}
              </Button>
              <a
                href={`mailto:${INVESTOR_EMAIL}?subject=Interesse%20EmpowerFI`}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail size={16} /> ou escreva para {INVESTOR_EMAIL}
              </a>
            </div>
          </form>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground text-center">
            <Lock size={12} /> Projeções e termos financeiros detalhados são compartilhados sob NDA.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
