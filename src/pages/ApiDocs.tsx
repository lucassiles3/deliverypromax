import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Key, Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const BASE = `https://${PROJECT_ID}.functions.supabase.co/api-rest`;

const Code = ({ children, lang = "bash" }: { children: string; lang?: string }) => {
  const copy = () => {
    navigator.clipboard.writeText(children);
    toast.success("Copiado");
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border-2 border-border bg-muted/40 p-4 text-xs leading-relaxed">
        <code className={`language-${lang}`}>{children}</code>
      </pre>
      <button onClick={copy}
        className="absolute right-2 top-2 rounded-lg border bg-background p-1.5 text-muted-foreground hover:text-foreground">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const Endpoint = ({
  method, path, title, children,
}: { method: "GET" | "POST" | "PUT" | "DELETE"; path: string; title: string; children: React.ReactNode }) => {
  const methodColors = {
    GET: "bg-blue-500/10 text-blue-600",
    POST: "bg-green-500/10 text-green-600",
    PUT: "bg-amber-500/10 text-amber-600",
    DELETE: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-soft">
      <div className="mb-2 flex items-center gap-3">
        <span className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold ${methodColors[method]}`}>{method}</span>
        <code className="text-sm font-bold">{path}</code>
      </div>
      <h3 className="font-display text-base font-bold">{title}</h3>
      <div className="mt-3 space-y-3 text-sm">{children}</div>
    </div>
  );
};

const ApiDocs = () => {
  useEffect(() => {
    document.title = "API · Documentação";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 pb-20">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
          </Button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="font-display text-lg font-bold">API REST · Documentação</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-6 space-y-6">
        <section className="rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Como funciona</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            A API REST permite integrar sua loja com sistemas externos (ERP, CRM, BI, automações).
            Toda requisição precisa do header de autenticação:
          </p>
          <Code>{`Authorization: Bearer ff_live_xxxxxxxxxxxxxxxx`}</Code>
          <p className="mt-3 text-xs text-muted-foreground">
            Gere chaves em <Link to="/admin" className="text-primary underline">Admin → Integrações → API</Link>.
            Cada chave dá acesso apenas aos dados da loja em que foi criada.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-bold">Base URL</h2>
          <Code>{BASE}</Code>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold">Endpoints</h2>

          <Endpoint method="GET" path="/produtos" title="Listar produtos da loja">
            <Code>{`curl -H "Authorization: Bearer ff_live_xxx" \\
  ${BASE}/produtos`}</Code>
            <p className="text-xs text-muted-foreground">Retorna todos os produtos com preço, estoque, categoria e imagem.</p>
          </Endpoint>

          <Endpoint method="PUT" path="/produtos/:id" title="Atualizar produto (preço/estoque/ativo)">
            <Code>{`curl -X PUT -H "Authorization: Bearer ff_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"price": 29.90, "stock": 50, "active": true}' \\
  ${BASE}/produtos/PRODUCT_ID`}</Code>
            <p className="text-xs text-muted-foreground">
              Campos aceitos: <code>price</code>, <code>old_price</code>, <code>stock</code>, <code>active</code>, <code>name</code>, <code>description</code>, <code>category</code>.
            </p>
          </Endpoint>

          <Endpoint method="GET" path="/categorias" title="Listar categorias">
            <Code>{`curl -H "Authorization: Bearer ff_live_xxx" ${BASE}/categorias`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/estoque" title="Snapshot de estoque (apenas itens com track_stock)">
            <Code>{`curl -H "Authorization: Bearer ff_live_xxx" ${BASE}/estoque`}</Code>
          </Endpoint>

          <Endpoint method="PUT" path="/estoque/:id" title="Ajustar estoque de um produto">
            <Code>{`curl -X PUT -H "Authorization: Bearer ff_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"stock": 30}' \\
  ${BASE}/estoque/PRODUCT_ID`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/pedidos" title="Listar pedidos">
            <Code>{`curl -H "Authorization: Bearer ff_live_xxx" \\
  "${BASE}/pedidos?status=preparing&limit=20"`}</Code>
            <p className="text-xs text-muted-foreground">
              Filtros: <code>status</code>, <code>from</code> (ISO date), <code>to</code> (ISO date), <code>limit</code> (max 200).
            </p>
          </Endpoint>

          <Endpoint method="PUT" path="/pedidos/:id/status" title="Mudar status de um pedido">
            <Code>{`curl -X PUT -H "Authorization: Bearer ff_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "preparing"}' \\
  ${BASE}/pedidos/ORDER_ID/status`}</Code>
            <p className="text-xs text-muted-foreground">
              Status válidos: <code>received</code>, <code>preparing</code>, <code>ready</code>, <code>out_for_delivery</code>, <code>delivered</code>, <code>cancelled</code>.
            </p>
          </Endpoint>

          <Endpoint method="GET" path="/dashboard" title="KPIs do dia (faturamento, pedidos, ticket médio)">
            <Code>{`curl -H "Authorization: Bearer ff_live_xxx" "${BASE}/dashboard?days=7"`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/relatorios/vendas" title="Relatório de vendas por período">
            <Code>{`curl -H "Authorization: Bearer ff_live_xxx" \\
  "${BASE}/relatorios/vendas?from=2025-01-01&to=2025-01-31"`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/clientes" title="Lista agregada de clientes">
            <Code>{`curl -H "Authorization: Bearer ff_live_xxx" ${BASE}/clientes`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/cupons" title="Criar um cupom de desconto">
            <Code>{`curl -X POST -H "Authorization: Bearer ff_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"code":"BLACK10","label":"Black Friday","type":"percent","value":10,"min_order":50}' \\
  ${BASE}/cupons`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/webhooks" title="Cadastrar webhook para receber eventos">
            <Code>{`curl -X POST -H "Authorization: Bearer ff_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://seu-erp.com/hook","events":["order.created","order.status_changed"]}' \\
  ${BASE}/webhooks`}</Code>
            <p className="text-xs text-muted-foreground">
              Eventos disponíveis: <code>order.created</code>, <code>order.status_changed</code>, <code>order.cancelled</code>.
            </p>
          </Endpoint>
        </section>

        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" /> Exemplo em JavaScript
          </h3>
          <Code lang="javascript">{`const res = await fetch("${BASE}/pedidos?status=preparing", {
  headers: { Authorization: "Bearer ff_live_xxx" }
});
const { data } = await res.json();
console.log(\`\${data.length} pedidos em preparo\`);`}</Code>
        </section>

        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h3 className="font-display text-base font-bold">Códigos HTTP</h3>
          <div className="mt-3 space-y-1 text-sm">
            <div><code className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-600">200</code> Sucesso</div>
            <div><code className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-600">201</code> Recurso criado</div>
            <div><code className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600">400</code> Dados inválidos</div>
            <div><code className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600">401</code> Chave ausente ou inválida</div>
            <div><code className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">404</code> Recurso não encontrado</div>
            <div><code className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">500</code> Erro do servidor</div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ApiDocs;
