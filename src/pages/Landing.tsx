import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles,
  Bot,
  MessageCircle,
  ShoppingBag,
  Users,
  BarChart3,
  Zap,
  CreditCard,
  Smartphone,
  Globe,
  Rocket,
  ShieldCheck,
  Clock,
  TrendingUp,
  Megaphone,
  Tag,
  HeartHandshake,
  Star,
  Check,
  X,
  ArrowRight,
  PlayCircle,
  LineChart,
  Cpu,
  Workflow,
  PackageSearch,
  MapPin,
  Repeat,
  Gift,
  Building2,
  Target,
} from "lucide-react";

// ---------- Animated counter ----------
const AnimatedNumber = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    const dur = 1600;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.floor(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span>
      {n.toLocaleString("pt-BR")}
      {suffix}
    </span>
  );
};

const Landing = () => {
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    document.title = "itChat Brasil — O Shopping Digital Inteligente da Sua Cidade";
    const meta = document.querySelector('meta[name="description"]') || (() => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
      return m;
    })();
    meta.setAttribute(
      "content",
      "Digitalize sua loja, automatize seu atendimento com IA e venda mais sem pagar taxas abusivas.",
    );
  }, []);

  const price = (m: number) => {
    const v = annual ? m * 10 : m; // 2 meses grátis no anual
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="min-h-screen bg-[hsl(20_14%_6%)] text-[hsl(30_20%_96%)] overflow-x-hidden">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[hsl(20_14%_6%/0.6)] border-b border-white/5">
        <div className="container flex items-center justify-between h-16">
          <Link to="/landing" className="flex items-center gap-2 font-display text-xl">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary grid place-items-center shadow-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            itChat<span className="text-primary">Brasil</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#solucao" className="hover:text-white transition">Solução</a>
            <a href="#beneficios" className="hover:text-white transition">Benefícios</a>
            <a href="#planos" className="hover:text-white transition">Planos</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" className="text-white hover:bg-white/10">Entrar</Button></Link>
            <Link to="/cadastro"><Button className="bg-gradient-to-r from-primary to-secondary text-white shadow-glow hover:opacity-90">Começar Agora</Button></Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Animated tech bg */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(242_85%_55%/0.35),transparent_50%),radial-gradient(circle_at_80%_30%,hsl(280_85%_55%/0.25),transparent_50%),radial-gradient(circle_at_50%_90%,hsl(180_85%_45%/0.2),transparent_50%)]" />
          <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/30 blur-[120px] animate-pulse" />
          <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-secondary/30 blur-[120px] animate-pulse" />
        </div>

        <div className="container py-20 md:py-32 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-slide-up">
            <Badge className="bg-white/10 border border-white/20 text-white mb-6 backdrop-blur">
              <Sparkles className="h-3 w-3 mr-1" /> Plataforma SaaS de IA + Comércio
            </Badge>
            <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
              O Shopping Digital{" "}
              <span className="bg-gradient-to-r from-primary via-[hsl(280_85%_75%)] to-secondary bg-clip-text text-transparent">
                Inteligente
              </span>{" "}
              da Sua Cidade
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/70 max-w-xl">
              Digitalize sua loja, automatize seu atendimento com IA e venda mais
              sem pagar taxas abusivas.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/cadastro">
                <Button size="lg" className="bg-gradient-to-r from-primary to-secondary text-white shadow-glow hover:opacity-90 h-14 px-8 text-base">
                  Começar Agora <ArrowRight className="ml-1" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 h-14 px-8 text-base">
                <PlayCircle className="mr-1" /> Ver Demonstração
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-5 gap-6">
              {[
                { label: "Lojas conectadas", value: 1200, suffix: "+" },
                { label: "Atendimentos IA", value: 480000, suffix: "+" },
                { label: "Pedidos processados", value: 95000, suffix: "+" },
                { label: "Economia em taxas", value: 38, suffix: "%" },
                { label: "Usuários ativos", value: 26000, suffix: "+" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="font-display text-2xl md:text-3xl font-bold text-white">
                    <AnimatedNumber value={s.value} suffix={s.suffix} />
                  </div>
                  <div className="text-xs text-white/50 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* MOCKUP */}
          <div className="relative animate-float-in">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary to-secondary blur-2xl opacity-30 rounded-3xl" />
            <Card className="relative bg-[hsl(20_14%_9%)]/90 border-white/10 p-5 rounded-2xl backdrop-blur-xl shadow-float">
              <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="ml-2 text-xs text-white/40">itchat.app/admin</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { i: BarChart3, l: "Faturamento", v: "R$ 84.2k" },
                  { i: ShoppingBag, l: "Pedidos hoje", v: "127" },
                  { i: Users, l: "Clientes", v: "3.1k" },
                ].map(({ i: I, l, v }) => (
                  <div key={l} className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <I className="h-4 w-4 text-primary" />
                    <div className="text-[10px] text-white/50 mt-2">{l}</div>
                    <div className="text-sm font-bold">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 p-4">
                <div className="flex items-center justify-between text-xs text-white/60 mb-3">
                  <span>Pedidos em tempo real</span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /> ao vivo
                  </span>
                </div>
                <div className="space-y-2">
                  {["Pizza Margherita • #4821", "Combo Família • #4822", "Açaí 500ml • #4823"].map((t, i) => (
                    <div key={t} className="flex items-center justify-between bg-black/30 rounded-lg p-2 text-xs">
                      <span>{t}</span>
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        {["Novo", "Preparando", "Saiu"][i]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <Bot className="h-4 w-4 text-[hsl(180_85%_60%)]" />
                  <div className="text-[10px] text-white/50 mt-2">Atendimento IA</div>
                  <div className="text-sm font-bold">98% automatizado</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <MessageCircle className="h-4 w-4 text-[hsl(140_70%_55%)]" />
                  <div className="text-[10px] text-white/50 mt-2">WhatsApp</div>
                  <div className="text-sm font-bold">847 conversas</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* PROBLEMAS */}
      <section className="container py-24">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge className="bg-red-500/10 text-red-300 border border-red-500/30 mb-4">O Problema</Badge>
          <h2 className="font-display text-3xl md:text-5xl font-bold">
            Os aplicativos tradicionais estão{" "}
            <span className="text-red-400">destruindo o lucro</span> do comércio local
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { i: CreditCard, t: "Taxas abusivas por pedido", d: "Até 30% do ticket pago em comissões." },
            { i: Globe, t: "Dependência de marketplaces", d: "Você não é dono do seu cliente." },
            { i: Clock, t: "Atendimento manual ineficiente", d: "Respostas lentas, vendas perdidas." },
            { i: Workflow, t: "Falta de automação", d: "Operação travada, equipe sobrecarregada." },
            { i: Users, t: "Perda de clientes", d: "Sem CRM, sem retenção, sem retorno." },
            { i: Smartphone, t: "Falta de presença digital", d: "Loja invisível no Google e redes." },
            { i: TrendingUp, t: "Dificuldade para crescer", d: "Sem dados, sem visão, sem escala." },
            { i: PackageSearch, t: "Operações desorganizadas", d: "Pedidos, estoque e equipe no caos." },
          ].map(({ i: I, t, d }) => (
            <Card key={t} className="group relative bg-white/[0.03] border-white/10 p-6 hover:bg-white/[0.06] transition-all hover:-translate-y-1">
              <div className="h-11 w-11 rounded-xl bg-red-500/15 border border-red-500/30 grid place-items-center mb-4 group-hover:scale-110 transition">
                <I className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="font-semibold mb-1">{t}</h3>
              <p className="text-sm text-white/60">{d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section id="solucao" className="container py-24">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge className="bg-primary/15 text-primary border border-primary/30 mb-4">A Solução</Badge>
          <h2 className="font-display text-3xl md:text-5xl font-bold">
            Uma plataforma completa para{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              digitalizar e automatizar
            </span>{" "}
            negócios
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { i: PackageSearch, t: "Catálogo digital inteligente" },
            { i: Building2, t: "Marketplace da cidade" },
            { i: BarChart3, t: "Painel administrativo" },
            { i: ShoppingBag, t: "Sistema de pedidos" },
            { i: Users, t: "CRM integrado" },
            { i: Bot, t: "IA para WhatsApp" },
            { i: MessageCircle, t: "Atendimento automatizado" },
            { i: Megaphone, t: "Automação de marketing" },
            { i: Tag, t: "Cupons automáticos" },
            { i: LineChart, t: "Relatórios inteligentes" },
            { i: HeartHandshake, t: "Gestão de clientes" },
            { i: MapPin, t: "Rastreamento em tempo real" },
            { i: CreditCard, t: "Integração de pagamentos" },
            { i: Workflow, t: "Fluxos automatizados" },
            { i: Repeat, t: "Recuperação de clientes" },
            { i: Star, t: "Pesquisa de satisfação" },
          ].map(({ i: I, t }) => (
            <div
              key={t}
              className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 hover:border-primary/50 transition overflow-hidden"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-primary/10 to-secondary/10" />
              <div className="relative">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 grid place-items-center mb-3 group-hover:shadow-glow transition">
                  <I className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">{t}</h3>
                <p className="text-xs text-white/50 mt-1">Tudo integrado, pronto para usar.</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="container py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Badge className="bg-white/10 text-white/80 border border-white/20 mb-4">Em 4 etapas</Badge>
          <h2 className="font-display text-3xl md:text-5xl font-bold">Como funciona</h2>
        </div>
        <div className="relative grid md:grid-cols-4 gap-6">
          <div className="hidden md:block absolute top-7 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          {[
            { i: Building2, t: "Cadastre sua empresa", d: "Crie sua conta em menos de 3 minutos." },
            { i: PackageSearch, t: "Configure seu catálogo", d: "Importe ou cadastre seus produtos." },
            { i: Bot, t: "Ative a IA no WhatsApp", d: "Treine sua IA e conecte seu número." },
            { i: Rocket, t: "Automatize e escale", d: "Venda 24/7 no piloto automático." },
          ].map(({ i: I, t, d }, idx) => (
            <div key={t} className="relative text-center">
              <div className="relative mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-primary to-secondary grid place-items-center shadow-glow z-10">
                <I className="h-6 w-6 text-white" />
                <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-accent text-accent-foreground text-xs font-bold grid place-items-center">
                  {idx + 1}
                </span>
              </div>
              <h3 className="font-semibold mt-4">{t}</h3>
              <p className="text-sm text-white/60 mt-1">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFICIOS + COMPARATIVO */}
      <section id="beneficios" className="container py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="font-display text-3xl md:text-5xl font-bold">
            Mais lucro. Mais automação.{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Mais controle.</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-16">
          {[
            { i: ShieldCheck, t: "Sem taxas abusivas" },
            { i: Clock, t: "Atendimento 24h" },
            { i: Cpu, t: "IA inteligente" },
            { i: TrendingUp, t: "Mais vendas" },
            { i: Workflow, t: "Operação automatizada" },
            { i: Rocket, t: "Crescimento escalável" },
            { i: HeartHandshake, t: "Fidelização" },
            { i: Target, t: "Gestão centralizada" },
            { i: Gift, t: "Economia operacional" },
            { i: Zap, t: "Mais produtividade" },
          ].map(({ i: I, t }) => (
            <Card key={t} className="bg-white/[0.03] border-white/10 p-5 text-center hover:border-primary/40 transition">
              <I className="h-6 w-6 text-primary mx-auto mb-2" />
              <div className="text-sm font-medium">{t}</div>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-red-500/5 border-red-500/20 p-8">
            <h3 className="font-display text-xl font-bold mb-5 text-red-300">Aplicativos Tradicionais</h3>
            {["Cobram comissão por venda", "Sem controle do cliente", "Atendimento limitado", "Dependência da plataforma"].map((x) => (
              <div key={x} className="flex items-start gap-3 py-2 text-white/70">
                <X className="h-5 w-5 text-red-400 shrink-0 mt-0.5" /> {x}
              </div>
            ))}
          </Card>
          <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30 p-8 shadow-glow">
            <h3 className="font-display text-xl font-bold mb-5 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              itChat Brasil
            </h3>
            {["Mensalidade fixa", "IA integrada", "Controle total", "Automações inteligentes", "Ecossistema digital completo"].map((x) => (
              <div key={x} className="flex items-start gap-3 py-2">
                <Check className="h-5 w-5 text-green-400 shrink-0 mt-0.5" /> {x}
              </div>
            ))}
          </Card>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="container py-24">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="font-display text-3xl md:text-5xl font-bold">
            Escolha o plano ideal para digitalizar seu negócio
          </h2>
          <p className="mt-4 text-white/60">
            Soluções inteligentes para transformar atendimento, vendas e operação.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-2.5">
            <span className={!annual ? "text-white" : "text-white/50"}>Mensal</span>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <span className={annual ? "text-white" : "text-white/50"}>
              Anual <Badge className="ml-1 bg-green-500/20 text-green-300 border-green-500/30">2 meses grátis</Badge>
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              name: "Catálogo Digital",
              price: 150,
              desc: "Ideal para começar sua presença digital.",
              cta: "Começar Agora",
              tag: null as string | null,
              features: [
                "Catálogo digital profissional",
                "Página personalizada",
                "Gestão de produtos",
                "Atualização de preços",
                "Compartilhamento via link",
                "Integração com WhatsApp",
                "Painel administrativo básico",
              ],
            },
            {
              name: "Catálogo + Chatbot IA",
              price: 250,
              desc: "Automatize seu atendimento e venda mais no WhatsApp.",
              cta: "Automatizar Meu Atendimento",
              tag: "Mais Popular",
              features: [
                "Tudo do plano anterior",
                "Chatbot inteligente",
                "Respostas automáticas",
                "Atendimento 24h",
                "Direcionamento inteligente",
                "Integração com catálogo",
                "Captação automática de clientes",
              ],
            },
            {
              name: "IA para WhatsApp",
              price: 399.9,
              desc: "Transforme seu WhatsApp em um vendedor inteligente.",
              cta: "Ativar IA no Meu Negócio",
              tag: null,
              features: [
                "Tudo dos planos anteriores",
                "IA treinável",
                "Atendimento humanizado",
                "Respostas contextuais",
                "Recomendações automáticas",
                "Recuperação de clientes",
                "Follow-up inteligente",
                "CRM integrado",
                "Análise de conversas",
                "Geração automática de leads",
              ],
            },
            {
              name: "Automação Inteligente",
              price: 699.9,
              desc: "Operação completa com IA e automações avançadas.",
              cta: "Escalar Meu Negócio",
              tag: "Plano Empresarial",
              features: [
                "Tudo dos planos anteriores",
                "Automação de marketing",
                "Disparo de campanhas",
                "Cupons automáticos",
                "Recuperação de clientes inativos",
                "Pesquisa de satisfação",
                "CRM avançado",
                "Fluxos inteligentes",
                "Integrações avançadas",
                "Relatórios inteligentes",
                "Automação operacional",
              ],
            },
          ].map((p, idx) => {
            const popular = p.tag === "Mais Popular";
            const enterprise = p.tag === "Plano Empresarial";
            return (
              <div
                key={p.name}
                className={`relative rounded-2xl border p-6 backdrop-blur-xl transition hover:-translate-y-1 ${
                  popular
                    ? "border-primary/60 bg-gradient-to-b from-primary/15 to-secondary/10 shadow-glow scale-[1.02]"
                    : enterprise
                      ? "border-accent/50 bg-gradient-to-b from-accent/10 to-white/[0.03]"
                      : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {p.tag && (
                  <Badge
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 ${
                      popular
                        ? "bg-gradient-to-r from-primary to-secondary text-white shadow-glow"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {p.tag}
                  </Badge>
                )}
                <h3 className="font-display text-lg font-bold uppercase tracking-wide">{p.name}</h3>
                <p className="text-sm text-white/60 mt-1 min-h-[40px]">{p.desc}</p>
                <div className="mt-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-display font-bold">R$ {price(p.price)}</span>
                    <span className="text-sm text-white/50">/{annual ? "ano" : "mês"}</span>
                  </div>
                  {annual && (
                    <div className="text-xs text-green-400 mt-1">Economize 2 meses</div>
                  )}
                </div>
                <Link to="/cadastro" className="block mt-5">
                  <Button
                    className={`w-full ${
                      popular || enterprise
                        ? "bg-gradient-to-r from-primary to-secondary text-white shadow-glow hover:opacity-90"
                        : "bg-white/10 text-white border border-white/20 hover:bg-white/15"
                    }`}
                  >
                    {p.cta}
                  </Button>
                </Link>
                <div className="h-px bg-white/10 my-5" />
                <ul className="space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-white/80">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* PROVA SOCIAL */}
      <section className="container py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Badge className="bg-white/10 text-white/80 border border-white/20 mb-4">Prova Social</Badge>
          <h2 className="font-display text-3xl md:text-5xl font-bold">Negócios que já decolaram</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {[
            { n: "Marina Souza", c: "Pizzaria Bella", t: "Triplicamos os pedidos no WhatsApp em 60 dias. A IA atende sozinha de madrugada.", r: 5 },
            { n: "Carlos Mendes", c: "Hortifruti Verde", t: "Cortei 100% das taxas dos apps. Agora controlo meus clientes e ganho mais.", r: 5 },
            { n: "Ana Lima", c: "Boutique Aurora", t: "O CRM e os disparos automáticos trouxeram clientes antigos de volta.", r: 5 },
          ].map((d) => (
            <Card key={d.n} className="bg-white/[0.03] border-white/10 p-6">
              <div className="flex gap-1 mb-3">
                {Array.from({ length: d.r }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
              <p className="text-white/80 italic">"{d.t}"</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary grid place-items-center font-bold">
                  {d.n[0]}
                </div>
                <div>
                  <div className="font-semibold text-sm">{d.n}</div>
                  <div className="text-xs text-white/50">{d.c}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="text-center text-sm text-white/40 mb-6">Segmentos atendidos</div>
        <div className="flex flex-wrap justify-center gap-3">
          {["Alimentação", "Moda", "Mercados", "Farmácias", "Serviços", "Beleza", "Pet Shop", "Hortifruti"].map((s) => (
            <Badge key={s} className="bg-white/5 border border-white/10 text-white/70 px-4 py-1.5">{s}</Badge>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container py-24 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-5xl font-bold">Perguntas frequentes</h2>
        </div>
        <Accordion type="single" collapsible className="space-y-3">
          {[
            ["Como funciona o itChat Brasil?", "É uma plataforma SaaS que une catálogo digital, marketplace local, automação e IA para WhatsApp em um só lugar."],
            ["Preciso pagar comissão por venda?", "Não. Você paga apenas a mensalidade do plano escolhido. 100% das vendas são suas."],
            ["A IA responde automaticamente?", "Sim. A IA atende, tira dúvidas, recomenda produtos e fecha vendas 24 horas por dia."],
            ["Posso cancelar quando quiser?", "Sim. Sem fidelidade, sem multa. Cancele com 1 clique no painel."],
            ["O sistema funciona no WhatsApp?", "Sim, com integração oficial e treinamento da IA com a base do seu negócio."],
            ["Posso integrar meu catálogo?", "Sim. Importe via planilha ou cadastre direto no painel — sincronizado com WhatsApp e marketplace."],
            ["Como funciona a automação?", "Fluxos prontos de marketing, recuperação de clientes, cupons e pesquisa de satisfação rodando no piloto automático."],
          ].map(([q, a]) => (
            <AccordionItem
              key={q}
              value={q}
              className="border border-white/10 rounded-xl bg-white/[0.03] px-5 data-[state=open]:border-primary/40"
            >
              <AccordionTrigger className="text-left hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="text-white/70">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA FINAL */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/30 via-secondary/20 to-[hsl(280_85%_55%/0.3)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.08] bg-[linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="container text-center max-w-3xl">
          <h2 className="font-display text-4xl md:text-6xl font-bold leading-tight">
            Pronto para transformar sua operação?
          </h2>
          <p className="mt-6 text-lg md:text-xl text-white/80">
            Digitalize, automatize e escale seu negócio com o itChat Brasil.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/cadastro">
              <Button size="lg" className="bg-white text-[hsl(20_14%_6%)] hover:bg-white/90 h-14 px-8 text-base font-semibold">
                Começar Agora <ArrowRight className="ml-1" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/15 h-14 px-8 text-base">
              Falar com Especialista
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            © {new Date().getFullYear()} itChat Brasil. Todos os direitos reservados.
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white">Termos</a>
            <a href="#" className="hover:text-white">Privacidade</a>
            <a href="#" className="hover:text-white">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
