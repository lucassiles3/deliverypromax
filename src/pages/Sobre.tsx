import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Sparkles, Bot, ShoppingBag, BarChart3, Rocket, ShieldCheck, MessageCircle } from "lucide-react";

const PLANS = [
  {
    id: "catalogo",
    name: "Catálogo Digital",
    price: 99.9,
    desc: "Tenha sua loja online com cardápio digital, pedidos e pagamentos.",
    features: ["Catálogo ilimitado", "Pedidos via WhatsApp", "Pagamento Pix e cartão", "Painel completo"],
  },
  {
    id: "chatbot",
    name: "Catálogo + Chatbot IA",
    price: 189.9,
    tag: "Mais popular",
    desc: "Atendimento automatizado 24/7 com IA conectada ao seu catálogo.",
    features: ["Tudo do Catálogo", "Chatbot com IA", "Respostas automáticas", "Recuperação de carrinho"],
  },
  {
    id: "ia",
    name: "IA para WhatsApp",
    price: 369.9,
    desc: "IA avançada que vende, agenda e atende clientes no WhatsApp.",
    features: ["Atendimento humano + IA", "Agendamentos", "Funil de vendas", "Integrações"],
  },
  {
    id: "automacao",
    name: "Automação Inteligente",
    price: 649.9,
    tag: "Empresarial",
    desc: "Solução completa para empresas que querem escalar com automação.",
    features: ["Tudo dos outros planos", "Automações personalizadas", "API e webhooks", "Suporte prioritário"],
  },
];

const FEATURES = [
  { icon: ShoppingBag, title: "Loja completa", desc: "Catálogo, pedidos, pagamentos e entregas em um só lugar." },
  { icon: Bot, title: "IA integrada", desc: "Chatbot inteligente que atende e vende pelo WhatsApp." },
  { icon: BarChart3, title: "Painel poderoso", desc: "Relatórios, financeiro, estoque e gestão em tempo real." },
  { icon: MessageCircle, title: "Marketing automático", desc: "Recuperação de carrinho, campanhas e fidelização." },
  { icon: ShieldCheck, title: "Seguro e confiável", desc: "Infraestrutura robusta com proteção de dados (LGPD)." },
  { icon: Rocket, title: "Pronto em minutos", desc: "Crie sua loja e comece a vender no mesmo dia." },
];

const Sobre = () => {
  useEffect(() => {
    document.title = "Sobre — itChat Brasil";
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(20_14%_6%)] text-[hsl(30_20%_96%)]">
      <div className="container max-w-6xl py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <Badge className="bg-gradient-to-r from-primary to-secondary text-white mb-4">
            <Sparkles className="h-3 w-3 mr-1" /> O shopping digital da sua cidade
          </Badge>
          <h1 className="font-display text-4xl sm:text-6xl font-bold leading-tight">
            Tudo que sua loja precisa <br />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              para vender mais
            </span>
          </h1>
          <p className="text-white/70 mt-6 max-w-2xl mx-auto text-lg">
            O itChat Brasil é a plataforma que conecta estabelecimentos locais aos clientes da sua região,
            com catálogo digital, chatbot com IA, pedidos pelo WhatsApp e gestão completa do seu negócio.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <Link to="/cadastro">
              <Button size="lg" className="bg-gradient-to-r from-primary to-secondary text-white shadow-glow hover:opacity-90">
                Criar minha loja grátis por 7 dias <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/">
              <Button size="lg" variant="ghost" className="text-white hover:bg-white/10">
                Ver lojas próximas
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <section className="mb-20">
          <h2 className="font-display text-3xl font-bold text-center mb-10">Por que o itChat Brasil?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="bg-white/[0.03] border-white/10 p-6">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-secondary grid place-items-center mb-3 shadow-glow">
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="text-white/60 text-sm mt-1">{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Plans */}
        <section className="mb-16" id="planos">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-bold">Planos e preços</h2>
            <p className="text-white/70 mt-2">Escolha o plano ideal. Comece com 7 dias grátis, sem cartão.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((p) => (
              <Card
                key={p.id}
                className={`relative p-6 bg-white/[0.03] border-white/10 flex flex-col ${
                  p.tag === "Mais popular" ? "border-primary/50 shadow-glow" : ""
                }`}
              >
                {p.tag && (
                  <Badge className="absolute -top-2 right-4 bg-gradient-to-r from-primary to-secondary text-white text-[10px]">
                    {p.tag}
                  </Badge>
                )}
                <div className="font-semibold">{p.name}</div>
                <div className="text-3xl font-display font-bold mt-2">
                  R$ {p.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  <span className="text-xs text-white/50 font-normal">/mês</span>
                </div>
                <p className="text-sm text-white/60 mt-2">{p.desc}</p>
                <ul className="space-y-2 mt-4 mb-6 text-sm flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> <span className="text-white/80">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/cadastro" className="mt-auto">
                  <Button className="w-full bg-gradient-to-r from-primary to-secondary text-white shadow-glow hover:opacity-90">
                    Criar loja — 7 dias grátis
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <Card className="bg-gradient-to-br from-primary/15 to-secondary/10 border-primary/30 p-10 text-center">
          <h2 className="font-display text-3xl font-bold">Pronto para começar?</h2>
          <p className="text-white/70 mt-2">Crie sua loja agora mesmo e ganhe 7 dias grátis para testar tudo.</p>
          <Link to="/cadastro" className="inline-block mt-6">
            <Button size="lg" className="bg-gradient-to-r from-primary to-secondary text-white shadow-glow hover:opacity-90">
              Quero meus 7 dias grátis <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </Card>

        {/* Footer links */}
        <div className="flex justify-center gap-6 mt-12 text-sm text-white/50">
          <Link to="/termos" className="hover:text-white">Termos de Uso</Link>
          <Link to="/privacidade" className="hover:text-white">Política de Privacidade</Link>
          <Link to="/" className="hover:text-white">Início</Link>
        </div>
      </div>
    </div>
  );
};

export default Sobre;
