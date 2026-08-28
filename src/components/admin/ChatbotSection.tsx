import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Copy, Loader2, QrCode, Webhook, Phone, CheckCircle2, AlertCircle, Lock, Sparkles, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "react-router-dom";

const PLANS_WITH_CHATBOT = ["chatbot", "ia", "automacao"];

export const ChatbotSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();

  // Plano da loja
  const { data: sub, isLoading: loadingSub } = useQuery({
    queryKey: ["store-sub", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_subscriptions")
        .select("status, plan_id, subscription_plans(slug, name)")
        .eq("store_id", storeId)
        .maybeSingle();
      return data as any;
    },
  });

  // Config da loja (campos chatbot)
  const { data: store } = useQuery({
    queryKey: ["store-chatbot", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("chatbot_phone, chatbot_n8n_webhook_url, chatbot_qr_code, chatbot_status, chatbot_connected_at, chatbot_qr_updated_at")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>({});
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (store) setForm(store);
  }, [store]);

  // Realtime: atualiza QR quando n8n posta
  useEffect(() => {
    const ch = supabase
      .channel(`chatbot-${storeId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stores", filter: `id=eq.${storeId}` },
        () => qc.invalidateQueries({ queryKey: ["store-chatbot", storeId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [storeId, qc]);

  const planSlug = sub?.subscription_plans?.slug as string | undefined;
  const hasChatbot = planSlug ? PLANS_WITH_CHATBOT.includes(planSlug) : false;

  const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-qr-receive`;

  const save = async () => {
    const { error } = await supabase
      .from("stores")
      .update({
        chatbot_phone: form.chatbot_phone || null,
        chatbot_n8n_webhook_url: form.chatbot_n8n_webhook_url || null,
      })
      .eq("id", storeId);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["store-chatbot", storeId] });
  };

  const requestQr = async () => {
    if (!form.chatbot_n8n_webhook_url) return toast.error("Configure a URL do webhook n8n primeiro");
    if (!form.chatbot_phone) return toast.error("Informe o número do WhatsApp");
    setActivating(true);
    try {
      // Marca como pendente imediatamente
      await supabase.from("stores").update({ chatbot_status: "pending_qr", chatbot_qr_code: null }).eq("id", storeId);

      // Dispara o n8n
      const res = await fetch(form.chatbot_n8n_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_session",
          store_id: storeId,
          phone: form.chatbot_phone,
          callback_url: callbackUrl,
        }),
      });
      if (!res.ok) throw new Error(`n8n respondeu ${res.status}`);
      toast.success("Solicitação enviada ao n8n. Aguarde o QR Code…");
    } catch (e: any) {
      toast.error(e.message || "Falha ao chamar n8n");
    } finally {
      setActivating(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Desconectar o chatbot do WhatsApp?")) return;
    await supabase.from("stores").update({ chatbot_status: "disconnected", chatbot_qr_code: null }).eq("id", storeId);
    if (form.chatbot_n8n_webhook_url) {
      fetch(form.chatbot_n8n_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", store_id: storeId }),
      }).catch(() => {});
    }
    toast.success("Chatbot desconectado");
    qc.invalidateQueries({ queryKey: ["store-chatbot", storeId] });
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  if (loadingSub) {
    return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  }

  // Plano não permite chatbot
  if (!hasChatbot) {
    return (
      <Card className="p-8 text-center border-2 border-dashed">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-2">Chatbot WhatsApp indisponível no seu plano</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Para liberar o chatbot com IA no WhatsApp, faça upgrade para o plano <strong>Catálogo + Chatbot IA</strong>,
          <strong> IA para WhatsApp</strong> ou <strong>Automação Inteligente</strong>.
        </p>
        <Button asChild className="gradient-primary">
          <Link to="/cadastro">
            <Sparkles className="mr-2 h-4 w-4" /> Ver planos
          </Link>
        </Button>
      </Card>
    );
  }

  const status = form.chatbot_status || "disconnected";
  const statusInfo =
    status === "connected"
      ? { label: "Conectado", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: CheckCircle2 }
      : status === "pending_qr"
        ? { label: "Aguardando leitura do QR", color: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: QrCode }
        : { label: "Desconectado", color: "bg-muted text-muted-foreground", icon: AlertCircle };

  return (
    <div className="space-y-5">
      {/* Header status */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Chatbot WhatsApp com IA</h3>
              <p className="text-xs text-muted-foreground">
                Plano: <strong>{sub?.subscription_plans?.name}</strong>
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`${statusInfo.color} font-bold gap-1.5`}>
            <statusInfo.icon className="h-3.5 w-3.5" />
            {statusInfo.label}
          </Badge>
        </div>
      </Card>

      {/* Configuração */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Configuração da integração n8n</h3>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Phone className="h-4 w-4" /> Número do WhatsApp do chatbot
          </Label>
          <Input
            placeholder="+55 11 99999-9999"
            value={form.chatbot_phone ?? ""}
            onChange={(e) => setForm({ ...form, chatbot_phone: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Número onde o bot será ativado. Inclua DDI + DDD.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" /> URL do webhook n8n (do seu workflow)
          </Label>
          <Input
            placeholder="https://seu-n8n.com/webhook/whatsapp-chatbot"
            value={form.chatbot_n8n_webhook_url ?? ""}
            onChange={(e) => setForm({ ...form, chatbot_n8n_webhook_url: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Crie um workflow n8n com nó <strong>Webhook</strong> e cole a URL aqui.
          </p>
        </div>

        <Button onClick={save} className="gradient-primary">
          Salvar configurações
        </Button>
      </Card>

      {/* Callback URL para colar no n8n */}
      <Card className="p-5 space-y-3 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <h3 className="font-bold">URL de callback (cole no seu n8n)</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          No seu workflow n8n, depois de gerar o QR code, faça um <strong>HTTP Request POST</strong> para esta URL enviando:
          <br />
          <code className="text-[10px] block mt-1 bg-background/50 p-2 rounded">
            {`{ "store_id": "${storeId}", "qr_code": "<base64 ou string>", "status": "pending_qr" }`}
          </code>
          E quando conectar: <code>{`{ "store_id": "${storeId}", "status": "connected" }`}</code>
        </p>
        <div className="flex gap-2">
          <Input readOnly value={callbackUrl} className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={() => copy(callbackUrl, "URL de callback")}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Input readOnly value={storeId} className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={() => copy(storeId, "store_id")}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* QR Code / Ações */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Ativação do chatbot</h3>
        </div>

        {status === "connected" ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-3" />
            <p className="font-bold text-emerald-600">Chatbot conectado e operando</p>
            <p className="text-xs text-muted-foreground mt-1">
              Conectado em {form.chatbot_connected_at ? new Date(form.chatbot_connected_at).toLocaleString("pt-BR") : "—"}
            </p>
            <Button variant="outline" onClick={disconnect} className="mt-4">
              Desconectar
            </Button>
          </div>
        ) : form.chatbot_qr_code ? (
          <div className="text-center py-4">
            <p className="text-sm font-bold mb-3">📱 Escaneie com o WhatsApp do número {form.chatbot_phone}</p>
            <div className="inline-block p-4 bg-white rounded-2xl border-2 border-primary/30">
              {form.chatbot_qr_code.startsWith("data:image") ? (
                <img src={form.chatbot_qr_code} alt="QR" className="h-64 w-64" />
              ) : (
                <QRCodeSVG value={form.chatbot_qr_code} size={256} />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Atualizado {form.chatbot_qr_updated_at ? new Date(form.chatbot_qr_updated_at).toLocaleTimeString("pt-BR") : ""}
            </p>
            <Button variant="outline" onClick={requestQr} className="mt-4" disabled={activating}>
              {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 mr-1" />}
              Gerar novo QR
            </Button>
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed rounded-xl">
            <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Clique para iniciar a sessão. O QR code aparecerá aqui automaticamente.
            </p>
            <Button onClick={requestQr} disabled={activating} className="gradient-primary">
              {activating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
              Ativar chatbot
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
