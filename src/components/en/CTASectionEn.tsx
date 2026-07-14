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
  name: z.string().trim().min(1, "Enter your name").max(100, "Max 100 characters"),
  email: z.string().trim().email("Invalid email").max(255),
  message: z.string().trim().min(5, "Message too short").max(2000, "Max 2000 characters"),
});

const pillars = [
  {
    icon: Landmark,
    title: "Returns protected by Treasury collateral",
    desc: "The yield comes from the credit originated. The principal is protected by two layers: collateral in Brazilian Treasury bonds, and a first-loss layer that EmpowerFI absorbs before any investor capital is touched.",
  },
  {
    icon: ShieldCheck,
    title: "Verifiable on-chain impact",
    desc: "Every allocation and outcome recorded on-chain — continuous, auditable proof of impact, not an annual report.",
  },
  {
    icon: Globe2,
    title: "Global infrastructure, phased rollout",
    desc: "Built as global financial infrastructure on blockchain, launching in phases starting with Brazil.",
  },
];

const CTASectionEn = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Check the fields",
        description: parsed.error.issues[0]?.message ?? "Invalid data",
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
        title: "Message sent!",
        description: "We'll reply shortly.",
      });
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      console.error("Error sending question", err);
      toast({
        title: "Could not send",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="investors" className="section-padding gradient-subtle">
      <div className="container mx-auto space-y-12">
        <div className="text-center space-y-4">
          <p className="text-sm font-medium text-accent uppercase tracking-widest">For investors</p>
          <h2 className="section-title">
            A Web3 impact fund with{" "}
            <span className="text-gradient">stable returns and auditable impact</span>
          </h2>
          <p className="section-subtitle">
            Returns protected by two layers on one side; verifiable on-chain impact on the other.
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
              Request the <span className="text-gradient">deck</span>.
            </h3>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Investors and strategic partners: send a message to receive the full materials.
            </p>
          </div>

          <form onSubmit={handleQuestion} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-name-en">Name</Label>
                <Input
                  id="contact-name-en"
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email-en">Email</Label>
                <Input
                  id="contact-email-en"
                  type="email"
                  required
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@email.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message-en">Message</Label>
              <Textarea
                id="contact-message-en"
                required
                rows={5}
                maxLength={2000}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Tell us about your interest — investment, strategic partnership or impact capital."
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={sending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {sending ? "Sending..." : (<>Request the deck <Send size={16} /></>)}
              </Button>
              <a
                href={`mailto:${INVESTOR_EMAIL}?subject=EmpowerFI%20interest`}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail size={16} /> or write to {INVESTOR_EMAIL}
              </a>
            </div>
          </form>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground text-center">
            <Lock size={12} /> Detailed projections and financial terms are shared under NDA.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASectionEn;
