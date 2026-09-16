import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PlayStoreBadge from "@/components/PlayStoreBadge";
import entrepreneursPhoto from "@/assets/entrepreneurs.webp";

const ForEntrepreneursSectionEn = () => (
  <section id="for-entrepreneurs" className="section-padding gradient-subtle">
    <div className="container mx-auto">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 space-y-6 lg:order-1">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            For entrepreneurs
          </p>
          <h2 className="section-title !text-3xl md:!text-4xl">
            The businesses this{" "}
            <span className="text-gradient">infrastructure is built for.</span>
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground">
            EmpowerFI helps women entrepreneurs organize their businesses, build stronger
            financial histories and prepare for better access to productive capital.
          </p>
          <p className="leading-relaxed text-muted-foreground">
            When a business is ready and she chooses to ask, she receives and repays in reais,
            by Pix. Being ready and not asking is a complete outcome too.
          </p>

          <div className="space-y-5 pt-2">
            <Button
              asChild
              size="lg"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {/* The entrepreneur-facing product is communicated in Portuguese. */}
              <Link to="/pt">
                Discover EmpowerFI <ArrowRight size={18} />
              </Link>
            </Button>

            <PlayStoreBadge eyebrow="Live on" justLaunched="Available in Brazil" />
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <img
            src={entrepreneursPhoto}
            alt="Two women entrepreneurs reviewing their business together"
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

export default ForEntrepreneursSectionEn;
