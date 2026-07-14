import { useState } from "react";
import { Instagram, Linkedin, Mail, Send } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_EMAIL, INSTAGRAM_URL, LINKEDIN_URL } from "@/config/links";
import type { AboutContent } from "@/content/about";

// Posts through the same send-transactional-email function and templates the
// investor CTA on the home page uses, so every inbound message lands in the
// founder's inbox the same way and the sender still gets a confirmation.
const AboutContact = ({ contact }: { contact: AboutContent["contact"] }) => {
  const t = contact.form;
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const schema = z.object({
    name: z.string().trim().min(1, t.validation.name).max(100, t.validation.nameMax),
    email: z.string().trim().email(t.validation.email).max(255),
    message: z.string().trim().min(5, t.validation.messageMin).max(2000, t.validation.messageMax),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: t.invalidTitle,
        description: parsed.error.issues[0]?.message,
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
          idempotencyKey: `about-contact-${id}`,
          templateData: parsed.data,
        },
      });
      if (error) throw error;

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "contact-question-confirmation",
          recipientEmail: parsed.data.email,
          idempotencyKey: `about-contact-confirm-${id}`,
          templateData: { name: parsed.data.name },
        },
      });

      toast({ title: t.successTitle, description: t.successDesc });
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      console.error("Erro ao enviar mensagem de contato", err);
      toast({ title: t.errorTitle, description: t.errorDesc, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const channels = [
    { icon: Mail, label: contact.emailLabel, value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
    { icon: Instagram, label: "Instagram", value: "@empowerfi_community", href: INSTAGRAM_URL },
    { icon: Linkedin, label: "LinkedIn", value: "EmpowerFI", href: LINKEDIN_URL },
  ];

  return (
    <section id="contato" className="section-padding">
      <div className="container mx-auto max-w-5xl space-y-12">
        <div className="text-center space-y-4">
          <p className="text-sm font-medium text-accent uppercase tracking-widest">{contact.eyebrow}</p>
          <h2 className="section-title">
            {contact.titleLead}
            <span className="text-gradient">{contact.titleAccent}</span>
          </h2>
          <p className="section-subtitle">{contact.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {channels.map(({ icon: Icon, label, value, href }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith("mailto:") ? undefined : "_blank"}
              rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
              className="glass rounded-xl p-6 glow-border flex items-center gap-4 hover:shadow-glow transition-shadow duration-300"
            >
              <div className="w-11 h-11 shrink-0 rounded-lg gradient-primary flex items-center justify-center">
                <Icon className="text-primary-foreground" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
                <p className="font-heading font-semibold text-foreground truncate">{value}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="glass rounded-2xl p-8 md:p-12 glow-border shadow-glow max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="about-name">{t.name}</Label>
                <Input
                  id="about-name"
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t.namePlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="about-email">{t.email}</Label>
                <Input
                  id="about-email"
                  type="email"
                  required
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={t.emailPlaceholder}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="about-message">{t.message}</Label>
              <Textarea
                id="about-message"
                required
                rows={5}
                maxLength={2000}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder={t.messagePlaceholder}
              />
            </div>
            <div className="pt-2 flex justify-center">
              <Button
                type="submit"
                size="lg"
                disabled={sending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {sending ? t.sending : (<>{t.submit} <Send size={16} /></>)}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default AboutContact;
