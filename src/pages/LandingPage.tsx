import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import siteContent from "../../content/site.json";
import { Brand } from "../components/Brand";
import { MomentsCarousel } from "../components/MomentsCarousel";
import { HowItWorksDemo } from "../components/HowItWorksDemo";
import { PrinterDemo } from "../components/PrinterDemo";
import { createLandingDemo, createMoments } from "./landing-demo";

export function LandingPage({ configured }: { configured: boolean; publicMode?: boolean }) {
  const [openFaq, setOpenFaq] = useState<number>(-1);
  const [pastHero, setPastHero] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const moments = useMemo(
    () => createMoments().filter(({ id }) => id === "run" || id === "cook" || id === "trail"),
    [],
  );
  const demo = useMemo(() => createLandingDemo(), []);
  const cta = configured ? "Open my printer" : "Try it in your browser";
  const ctaHref = "/app";

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const update = () => setPastHero(hero.getBoundingClientRect().bottom <= 0);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <main className="landing hero-experiment">
      <nav className={pastHero ? "landing-nav is-visible" : "landing-nav"} aria-label="Site" aria-hidden={!pastHero}>
        <div className="landing-nav-inner">
          <a className="landing-nav-title" href="/"><Brand compact /></a>
          <a className="button primary small" href={ctaHref} tabIndex={pastHero ? 0 : -1}>{cta}</a>
        </div>
      </nav>

      <section className="hero-experiment-stage" id="moments" ref={heroRef}>
        <a className="hero-wordmark" href="/" aria-hidden={pastHero}><Brand compact /></a>
        <MomentsCarousel moments={moments} variant="hero" />
        <div className="hero-experiment-copy">
          <h1>{siteContent.hero.heading}</h1>
          <p>{siteContent.hero.copy}</p>
          <div className="hero-actions">
            <a className="button primary hero-button" href={ctaHref}>{cta}<ArrowRight size={16} /></a>
          </div>
        </div>
      </section>

      <section className="landing-section" id="how">
        <h2 className="landing-heading">How it works</h2>
        <div className="landing-steps">
          {siteContent.steps.map((step, index) => (
            <article className="landing-step" key={step.title}>
              <HowItWorksDemo step={index} />
              <div className="landing-step-caption">
                <span className="landing-step-number">{index + 1}</span>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-agents">
        <div className="landing-agents-copy">
          <h2 className="landing-heading">Built for agents, too.</h2>
          <p>{siteContent.name} is a WebMCP app, so a compatible agent sees the same receipt you do. It can draft, edit, and preview — then ask before anything prints.</p>
        </div>
        <div className="landing-tools" aria-label="Agent tools">
          {siteContent.tools.map((tool) => (
            <div className="landing-tool" key={tool.name}>
              <code>{tool.name}</code>
              <span>{tool.copy}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-faq" id="faq">
        <h2 className="landing-heading">Questions</h2>
        <div className="landing-faq-list">
          {siteContent.faqs.map((faq, index) => (
            <div className={`landing-faq-item ${openFaq === index ? "open" : ""}`} key={faq.question}>
              <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}>
                <span className="landing-faq-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span>{faq.question}</span>
                <Plus size={16} aria-hidden="true" />
              </button>
              <div className="landing-faq-answer" role="region">
                <div><p>{faq.answer}</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <PrinterDemo slipSrc="/generated/landing-hero.svg" svgWidth={demo.hero.width} svgHeight={demo.hero.height} ctaHref={ctaHref} />
    </main>
  );
}
