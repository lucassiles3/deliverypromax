import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, ArrowLeft, Building2, Tag, CreditCard, Sparkles, Rocket } from "lucide-react";
import { toast } from "sonner";

const SEGMENTS = [
  "Alimentação", "Moda", "Mercado", "Farmácia",
  "Beleza", "Pet Shop", "Serviços", "Hortifruti",
];

const PLANS = [
  { id: "catalogo", name: "Catálogo Digital", price: 150 },
  { id: "chatbot", name: "Catálogo + Chatbot IA", price: 250, tag: "Popular" },
  { id: "ia", name: "IA para WhatsApp", price: 399.9 },
  { id: "automacao", name: "Automação Inteligente", price: 699.9, tag: "Empresarial" },
];

const STEPS = [
  { k: "empresa", t: "Empresa", i: Building2 },
  { k: "segmento", t: "Segmento", i: Tag },
  { k: "plano", t: "Plano", i: Sparkles },
  { k: "pagamento", t: "Pagamento", i: CreditCard },
  { k: "acesso", t: "Acesso", i: Rocket },
];

const Cadastro = () => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    company: "", email: "", phone: "",
    segment: "", plan: "chatbot",
  });
  const navigate = useNavigate();

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const finish = () => {
    toast.success("Cadastro concluído! Redirecionando para o painel…");
    setTimeout(() => navigate("/auth"), 1200);
  };

  return (
    <div className="min-h-screen bg-[hsl(20_14%_6%)] text-[hsl(30_20%_96%)]">
      <div className="container max-w-3xl py-10">
        <Link to="/landing" className="text-sm text-white/60 hover:text-white inline-flex items-center gap-1 mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar à página inicial
        </Link>

        {/* Steps */}
        <div className="flex items-center justify-between mb-10">
          {STEPS.map((s, i) => {
            const active = i === step;
            const done = i < step;
            const Icon = s.i;
            return (
              <div key={s.k} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`h-10 w-10 rounded-full grid place-items-center border transition ${
                      done
                        ? "bg-primary border-primary text-white"
                        : active
                          ? "bg-gradient-to-br from-primary to-secondary border-primary text-white shadow-glow"
                          : "bg-white/5 border-white/10 text-white/40"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-xs mt-2 ${active ? "text-white" : "text-white/50"}`}>{s.t}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 ${i < step ? "bg-primary" : "bg-white/10"}`} />
                )}
              </div>
            );
          })}
        </div>

        <Card className="bg-white/[0.03] border-white/10 p-8">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold">Cadastre sua empresa</h2>
              <div className="space-y-2">
                <Label>Nome da empresa</Label>
                <Input className="bg-white/5 border-white/10" value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} placeholder="Pizzaria Bella" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" className="bg-white/5 border-white/10" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="voce@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input className="bg-white/5 border-white/10" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} placeholder="(11) 99999-9999" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold">Qual seu segmento?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SEGMENTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setData({ ...data, segment: s })}
                    className={`p-4 rounded-xl border text-sm transition ${
                      data.segment === s
                        ? "border-primary bg-primary/15 text-white shadow-glow"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/30"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold">Escolha seu plano</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setData({ ...data, plan: p.id })}
                    className={`relative p-5 rounded-xl border text-left transition ${
                      data.plan === p.id
                        ? "border-primary bg-gradient-to-br from-primary/15 to-secondary/10 shadow-glow"
                        : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    {p.tag && (
                      <Badge className="absolute -top-2 right-3 bg-gradient-to-r from-primary to-secondary text-white text-[10px]">
                        {p.tag}
                      </Badge>
                    )}
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-2xl font-display font-bold mt-1">
                      R$ {p.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      <span className="text-xs text-white/50 font-normal">/mês</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold">Pagamento</h2>
              <p className="text-sm text-white/60">Plano selecionado: <span className="text-white font-semibold">{PLANS.find(p => p.id === data.plan)?.name}</span></p>
              <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30 p-6">
                <div className="text-sm text-white/70">Total mensal</div>
                <div className="text-4xl font-display font-bold">
                  R$ {PLANS.find(p => p.id === data.plan)?.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-white/60 mt-3">
                  Primeiros 7 dias grátis. Cancele quando quiser.
                </p>
              </Card>
              <div className="space-y-2">
                <Label>Cartão de crédito</Label>
                <Input className="bg-white/5 border-white/10" placeholder="0000 0000 0000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input className="bg-white/5 border-white/10" placeholder="MM/AA" />
                <Input className="bg-white/5 border-white/10" placeholder="CVV" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-secondary grid place-items-center mx-auto shadow-glow mb-4">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h2 className="font-display text-2xl font-bold">Tudo pronto!</h2>
              <p className="text-white/70 mt-2">Sua conta foi criada. Acesse seu painel para começar.</p>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
            <Button variant="ghost" onClick={prev} disabled={step === 0} className="text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} className="bg-gradient-to-r from-primary to-secondary text-white shadow-glow hover:opacity-90">
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={finish} className="bg-gradient-to-r from-primary to-secondary text-white shadow-glow hover:opacity-90">
                Acessar painel <Rocket className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Cadastro;
