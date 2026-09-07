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
  { id: "catalogo", name: "Catálogo Digital", price: 99.9 },
  { id: "chatbot", name: "Catálogo + Chatbot IA", price: 189.9, tag: "Popular" },
  { id: "ia", name: "IA para WhatsApp", price: 369.9 },
  { id: "automacao", name: "Automação Inteligente", price: 649.9, tag: "Empresarial" },
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="container max-w-3xl py-10">
        <Link to="/landing" className="text-sm font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 mb-6 transition-colors">
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
                    className={`h-10 w-10 rounded-full grid place-items-center border transition-all ${
                      done
                        ? "bg-primary border-primary text-white"
                        : active
                          ? "bg-gradient-to-br from-primary to-secondary border-primary text-white shadow-glow"
                          : "bg-slate-100 border-slate-300 text-slate-400"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-xs mt-2 font-medium ${active ? "text-slate-900 font-bold" : "text-slate-500"}`}>{s.t}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 ${i < step ? "bg-primary" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        <Card className="bg-white border-slate-200 p-6 sm:p-8 shadow-card rounded-3xl">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold text-slate-900">Cadastre sua empresa</h2>
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold text-xs uppercase tracking-wider">Nome da empresa</Label>
                <Input className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-primary" value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} placeholder="Pizzaria Bella" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold text-xs uppercase tracking-wider">E-mail</Label>
                  <Input type="email" className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-primary" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="voce@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold text-xs uppercase tracking-wider">WhatsApp</Label>
                  <Input className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-primary" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} placeholder="(11) 99999-9999" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold text-slate-900">Qual seu segmento?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SEGMENTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setData({ ...data, segment: s })}
                    className={`p-4 rounded-xl border text-sm font-medium transition ${
                      data.segment === s
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                        : "border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
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
              <h2 className="font-display text-2xl font-bold text-slate-900">Escolha seu plano</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setData({ ...data, plan: p.id })}
                    className={`relative p-5 rounded-2xl border text-left transition ${
                      data.plan === p.id
                        ? "border-2 border-primary bg-primary/5 text-slate-900 shadow-glow"
                        : "border-slate-200 bg-white text-slate-900 hover:border-primary/40"
                    }`}
                  >
                    {p.tag && (
                      <Badge className="absolute -top-2 right-3 bg-gradient-to-r from-primary to-secondary text-white text-[10px] font-bold">
                        {p.tag}
                      </Badge>
                    )}
                    <div className="font-bold text-base text-slate-900">{p.name}</div>
                    <div className="text-2xl font-display font-bold mt-1 text-slate-900">
                      R$ {p.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      <span className="text-xs text-slate-500 font-normal">/mês</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold text-slate-900">Pagamento</h2>
              <p className="text-sm text-slate-600">Plano selecionado: <span className="text-slate-900 font-bold">{PLANS.find(p => p.id === data.plan)?.name}</span></p>
              <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20 p-6 rounded-2xl">
                <div className="text-sm text-slate-600 font-medium">Total mensal</div>
                <div className="text-4xl font-display font-bold text-slate-900">
                  R$ {PLANS.find(p => p.id === data.plan)?.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Primeiros 7 dias grátis. Cancele quando quiser.
                </p>
              </Card>
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cartão de crédito</Label>
                <Input className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-primary" placeholder="0000 0000 0000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-primary" placeholder="MM/AA" />
                <Input className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-primary" placeholder="CVV" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-secondary grid place-items-center mx-auto shadow-glow mb-4">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Tudo pronto!</h2>
              <p className="text-slate-600 mt-2">Sua conta foi criada. Acesse seu painel para começar.</p>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
            <Button variant="outline" onClick={prev} disabled={step === 0} className="border-slate-300 text-slate-700 hover:bg-slate-100 font-medium">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} className="bg-gradient-to-r from-primary to-secondary text-white shadow-glow hover:opacity-90 font-bold">
                Continuar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={finish} className="bg-gradient-to-r from-primary to-secondary text-white shadow-glow hover:opacity-90 font-bold">
                Acessar painel <Rocket className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Cadastro;
