import { useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const INVESTOR_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "institutional", label: "Institutional" },
] as const;

// Indicative ticket in USD. Deliberately small at the low end — the pilot is
// about proving small-ticket productive credit works, not raising a fund.
const TICKET_RANGES = [
  { value: "50", label: "$50" },
  { value: "100", label: "$100" },
  { value: "200", label: "$200" },
  { value: "500_plus", label: "$500+" },
  { value: "other", label: "Other" },
] as const;

const MOTIVATIONS = [
  { value: "financial_return", label: "Financial return" },
  { value: "economic_impact", label: "Economic impact" },
  { value: "both", label: "Both" },
] as const;

const waitlistSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  country: z.string().trim().min(2, "Enter your country").max(80, "Max 80 characters"),
  investorType: z.enum(["individual", "institutional"]),
  ticketRange: z.enum(["50", "100", "200", "500_plus", "other"]),
  motivation: z.enum(["financial_return", "economic_impact", "both"]),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Please accept to continue" }),
  }),
});

const labelFor = (
  options: readonly { value: string; label: string }[],
  value: string,
) => options.find((o) => o.value === value)?.label ?? value;

const emptyForm = {
  email: "",
  country: "",
  investorType: "",
  ticketRange: "",
  motivation: "",
  consent: false,
};

const InvestorWaitlistForm = () => {
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [sending, setSending] = useState(false);
  const [joined, setJoined] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = waitlistSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Check the form",
        description: parsed.error.issues[0]?.message ?? "Some fields need attention",
        variant: "destructive",
      });
      return;
    }

    const { email, country, investorType, ticketRange, motivation } = parsed.data;

    setSending(true);
    try {
      const { error } = await supabase.from("investor_waitlist").insert({
        email,
        country,
        investor_type: investorType,
        ticket_range: ticketRange,
        motivation,
        consent: true,
        source: "investors-page",
      });

      // A repeat signup is not a failure — the person is already on the list.
      const alreadyOnList = error?.code === "23505";
      if (error && !alreadyOnList) throw error;

      if (!alreadyOnList) {
        // Notifications are best effort: the signup is already recorded, so an
        // email failure must not tell the person their submission was lost.
        const id = crypto.randomUUID();
        void supabase.functions
          .invoke("send-transactional-email", {
            body: {
              templateName: "investor-waitlist-for-founder",
              idempotencyKey: `investor-waitlist-${id}`,
              templateData: {
                email,
                country,
                investorType: labelFor(INVESTOR_TYPES, investorType),
                ticketRange: labelFor(TICKET_RANGES, ticketRange),
                motivation: labelFor(MOTIVATIONS, motivation),
              },
            },
          })
          .catch((err) => console.error("Waitlist founder notification failed", err));

        void supabase.functions
          .invoke("send-transactional-email", {
            body: {
              templateName: "investor-waitlist-confirmation",
              recipientEmail: email,
              idempotencyKey: `investor-waitlist-confirm-${id}`,
              templateData: {},
            },
          })
          .catch((err) => console.error("Waitlist confirmation failed", err));
      }

      setJoined(true);
      setForm(emptyForm);
    } catch (err) {
      console.error("Investor waitlist signup failed", err);
      toast({
        title: "Could not join the waitlist",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (joined) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 rounded-2xl p-10 text-center glass glow-border shadow-glow md:p-14">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full gradient-primary">
          <Check className="text-primary-foreground" size={26} strokeWidth={3} />
        </div>
        <h3 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          You're on the list.
        </h3>
        <p className="leading-relaxed text-muted-foreground">
          We'll keep you updated as we prepare the first EmpowerFI productive credit pilot.
        </p>
        <button
          type="button"
          onClick={() => setJoined(false)}
          className="text-sm font-medium text-accent transition-colors hover:text-foreground"
        >
          Add another entry
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-2xl space-y-7 rounded-2xl p-8 glass glow-border shadow-glow md:p-12"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="waitlist-email">Email</Label>
          <Input
            id="waitlist-email"
            type="email"
            required
            maxLength={255}
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@email.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="waitlist-country">Country</Label>
          <Input
            id="waitlist-country"
            required
            maxLength={80}
            autoComplete="country-name"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            placeholder="Where you're based"
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">Investor type</legend>
        <RadioGroup
          value={form.investorType}
          onValueChange={(v) => setForm({ ...form, investorType: v })}
          className="flex flex-wrap gap-x-6 gap-y-3"
        >
          {INVESTOR_TYPES.map(({ value, label }) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`type-${value}`} />
              <Label htmlFor={`type-${value}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="waitlist-ticket">Potential investment amount</Label>
          <Select
            value={form.ticketRange}
            onValueChange={(v) => setForm({ ...form, ticketRange: v })}
          >
            <SelectTrigger id="waitlist-ticket">
              <SelectValue placeholder="Select an amount" />
            </SelectTrigger>
            <SelectContent>
              {TICKET_RANGES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="waitlist-motivation">Primary motivation</Label>
          <Select
            value={form.motivation}
            onValueChange={(v) => setForm({ ...form, motivation: v })}
          >
            <SelectTrigger id="waitlist-motivation">
              <SelectValue placeholder="Select a motivation" />
            </SelectTrigger>
            <SelectContent>
              {MOTIVATIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="waitlist-consent"
          checked={form.consent}
          onCheckedChange={(checked) => setForm({ ...form, consent: checked === true })}
          className="mt-0.5"
        />
        <Label
          htmlFor="waitlist-consent"
          className="text-sm font-normal leading-relaxed text-muted-foreground"
        >
          I agree to be contacted by EmpowerFI about the productive credit pilot, and I
          understand this is an expression of non-binding interest.
        </Label>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={sending}
        className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {sending ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Joining...
          </>
        ) : (
          <>
            Join the Investor Waitlist <Send size={16} />
          </>
        )}
      </Button>
    </form>
  );
};

export default InvestorWaitlistForm;
