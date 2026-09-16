import { Check } from "lucide-react";
import PlayStoreBadge from "@/components/PlayStoreBadge";
import entrepreneursPhoto from "@/assets/entrepreneurs.webp";

const features = [
  "Divulgar o que você vende e ser encontrada por novos clientes",
  "Acompanhar vendas e recebimentos no mesmo lugar",
  "Começar a construir seu histórico no dia a dia do negócio",
  "Fazer parte de uma rede de empreendedoras",
];

const AppSection = () => (
  <section id="app" className="section-padding">
    <div className="container mx-auto">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 space-y-6 lg:order-1">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">O app</p>
          <h2 className="section-title !text-3xl md:!text-4xl">
            Já está no ar, e é <span className="text-gradient">de graça.</span>
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground">
            O app da EmpowerFI está publicado na Google Play. Baixar e se cadastrar é
            gratuito, e não cobramos comissão sobre o que você vende.
          </p>

          <ul className="space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full gradient-primary">
                  <Check className="text-primary-foreground" size={12} strokeWidth={3} />
                </span>
                <span className="leading-relaxed text-foreground">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="pt-2">
            <PlayStoreBadge eyebrow="Baixe agora no" justLaunched="Disponível no Brasil" />
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <img
            src={entrepreneursPhoto}
            alt="Duas empreendedoras olhando juntas os números do negócio"
            width={1400}
            height={933}
            loading="lazy"
            decoding="async"
            className="w-full rounded-2xl object-cover shadow-card glow-border"
          />
        </div>
      </div>
    </div>
  </section>
);

export default AppSection;
