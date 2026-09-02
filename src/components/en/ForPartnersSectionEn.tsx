import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_EMAIL } from "@/config/links";
import SectionHeading from "@/components/SectionHeading";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100, "Max 100 characters"),
  email: z.string().trim().email("Invalid email").max(255),
  message: z.string().trim().min(5, "Message too short").max(2000, "Max 2000 characters"),
});

const audiences = [
  "Entrepreneurship communities",
  "NGOs",
  "Foundations",
  "Companies",
  "Financial institutions",
  "Impact organizations",
];

const ForPartnersSectionEn = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

      toast({ title: "Message sent!", description: "We'll reply shortly." });
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      console.error("Error sending partner enquiry", err);
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
    <section id="for-partners" className="section-padding">
      <div className="container mx-auto space-y-12">
        <SectionHeading
          eyebrow="For partners"
          title="Build impact"
          accent="with us."
          subtitle="We partner with organizations that already support entrepreneurs and want to connect education, productive capital and measurable economic outcomes."
        />

        <ul className="flex flex-wrap justify-center gap-3">
          {audiences.map((audience) => (
            <li
              key={audience}
              className="rounded-full px-5 py-2.5 font-heading text-sm font-semibold text-foreground glass glow-border"
            >
              {audience}
            </li>
          ))}
        </ul>

        <div className="mx-auto max-w-3xl space-y-8 rounded-2xl p-10 glass glow-border shadow-glow md:p-14">
          <div className="space-y-3 text-center">
            <h3 className="section-title !text-2xl md:!text-3xl">
              Partner with <span className="text-gradient">EmpowerFI</span>.
            </h3>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Tell us about your organization and what you want to build. We answer every
              message.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner-name">Name</Label>
                <Input
                  id="partner-name"
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-email">Email</Label>
                <Input
                  id="partner-email"
                  type="email"
                  required
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@organization.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner-message">Message</Label>
              <Textarea
                id="partner-message"
                required
                rows={5}
                maxLength={2000}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Tell us about your organization — the entrepreneurs you already support and what you'd like to build with us."
              />
            </div>
            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <Button
                type="submit"
                size="lg"
                disabled={sending}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {sending ? "Sending..." : (<>Partner with EmpowerFI <Send size={16} /></>)}
              </Button>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=EmpowerFI%20partnership`}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail size={16} /> or write to {CONTACT_EMAIL}
              </a>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ForPartnersSectionEn;
