import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const CTASection = () => {
  const [email, setEmail] = useState("");

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({
      title: "Tudo certo!",
      description: "Vamos te avisar quando o produto estiver disponível.",
    });
    setEmail("");
  };

  return (
    <section className="section-padding">
      <div className="container mx-auto text-center">
        <div className="glass rounded-2xl p-10 md:p-16 glow-border shadow-glow max-w-3xl mx-auto space-y-6">
          <h2 className="section-title !text-3xl md:!text-4xl">
            Estamos construindo.{" "}
            <span className="text-gradient">Venha junto.</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Investidores, parceiros institucionais, programas de aceleração ou talentos — fale com a fundadora e descubra como se conectar com a EmpowerFI nesta fase.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Button asChild size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <a href="mailto:contato@empowerfi.com.br?subject=Conversa%20com%20a%20fundadora">
                Falar com a fundadora <ArrowRight size={18} />
              </a>
            </Button>
          </div>

          <div className="pt-6 border-t border-border space-y-3">
            <p className="text-sm text-muted-foreground">
              Sou empreendedora, quero acompanhar o lançamento
            </p>
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="outline" className="border-primary/40 text-foreground hover:bg-primary/10">
                Entrar na lista
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Vamos te avisar quando o produto estiver disponível. Estamos em fase de desenvolvimento.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
