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
  name: z.string().trim().min(1, "Enter your name").max(100, "Max 100 characters"),
  email: z.string().trim().email("Invalid email").max(255),
  message: z.string().trim().min(5, "Message too short").max(2000, "Max 2000 characters"),
});

const CTASectionEn = () => {
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) return;
    toast({
      title: "All set!",
      description: "We'll notify you when the product is available.",
    });
    setWaitlistEmail("");
  };

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
    <section className="section-padding">
      <div className="container mx-auto">
        <div className="glass rounded-2xl p-10 md:p-16 glow-border shadow-glow max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="section-title !text-3xl md:!text-4xl">
              We're building it.{" "}
              <span className="text-gradient">Come along.</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Investors, institutional partners, acceleration programs or talent — send a message and the founder replies personally.
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
              <Label htmlFor="contact-message-en">Your question</Label>
              <Textarea
                id="contact-message-en"
                required
                rows={5}
                maxLength={2000}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="How can we help? Tell us about your interest — investment, partnership, acceleration or other."
              />
            </div>
            <div className="flex justify-center pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={sending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {sending ? "Sending..." : (<>Send question <Send size={16} /></>)}
              </Button>
            </div>
          </form>

          <div className="pt-6 border-t border-border space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              I'm an entrepreneur — I want to follow the launch
            </p>
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  type="email"
                  required
                  placeholder="you@email.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="outline" className="border-primary/40 text-foreground hover:bg-primary/10 gap-2">
                Join the list <ArrowRight size={16} />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground text-center">
              We'll notify you when the product is available. We are in development.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASectionEn;
