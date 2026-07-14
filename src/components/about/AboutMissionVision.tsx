import { Compass, Target } from "lucide-react";
import type { AboutContent } from "@/content/about";

const AboutMissionVision = ({ missionVision }: { missionVision: AboutContent["missionVision"] }) => {
  const blocks = [
    { icon: Target, ...missionVision.mission },
    { icon: Compass, ...missionVision.vision },
  ];

  return (
    <section id="missao" className="section-padding gradient-subtle">
      <div className="container mx-auto grid md:grid-cols-2 gap-6 max-w-5xl">
        {blocks.map(({ icon: Icon, eyebrow, text }) => (
          <div key={eyebrow} className="glass rounded-2xl p-10 glow-border flex flex-col gap-5">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <p className="text-sm font-medium text-accent uppercase tracking-widest">{eyebrow}</p>
            <p className="font-heading text-xl md:text-2xl font-bold text-foreground leading-snug">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default AboutMissionVision;
