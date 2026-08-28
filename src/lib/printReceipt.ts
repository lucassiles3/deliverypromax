// Utilitário para impressão de cupons (térmico 80mm ou A4)
// Abre uma janela popup com o conteúdo formatado e dispara window.print()

export type PrintItem = {
  quantity: number;
  product_name: string;
  unit_price: number;
  notes?: string | null;
  customizations?: any;
};

export type PrintData = {
  storeName: string;
  storePhone?: string | null;
  storeAddress?: string | null;
  orderId: string;
  orderShortId: string;
  createdAt: string;
  customerName: string;
  customerPhone?: string | null;
  method: "delivery" | "pickup" | "logistics" | "pdv";
  paymentMethod: string;
  changeFor?: number | null;
  address?: any;
  notes?: string | null;
  items: PrintItem[];
  subtotal: number;
  deliveryFee?: number;
  discount?: number;
  total: number;
};

export type PrintFormat = "a4" | "thermal_80mm" | "thermal_58mm";

const formatBRL = (n: number) =>
  `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;

const escapeHtml = (s: string | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildItemsHtml = (items: PrintItem[]) =>
  items
    .map((it) => {
      const subtotal = it.quantity * Number(it.unit_price || 0);
      const customizations = Array.isArray(it.customizations)
        ? it.customizations
            .map((c: any) => `+ ${escapeHtml(c?.name ?? "")}`)
            .join("<br/>")
        : "";
      return `
        <div class="item">
          <div class="item-row">
            <span>${it.quantity}× ${escapeHtml(it.product_name)}</span>
            <span>${formatBRL(subtotal)}</span>
          </div>
          ${customizations ? `<div class="item-extras">${customizations}</div>` : ""}
          ${it.notes ? `<div class="item-extras">Obs: ${escapeHtml(it.notes)}</div>` : ""}
        </div>`;
    })
    .join("");

const buildAddress = (a: any) => {
  if (!a || typeof a !== "object") return "";
  const parts = [
    a.street && `${a.street}${a.number ? `, ${a.number}` : ""}`,
    a.complement,
    a.neighborhood,
    a.city,
  ].filter(Boolean);
  return parts.join(" — ");
};

const methodLabel = (m: string) =>
  m === "delivery"
    ? "🛵 Entrega"
    : m === "pickup"
      ? "🏪 Retirada"
      : m === "logistics"
        ? "📦 Retirada por app de logística"
        : "💵 Balcão (PDV)";

const paymentLabel = (m: string) =>
  ({
    pix: "PIX",
    cash: "Dinheiro",
    credit: "Cartão crédito",
    debit: "Cartão débito",
  } as Record<string, string>)[m] ?? m;

const buildHtml = (data: PrintData, format: PrintFormat) => {
  const isThermal58 = format === "thermal_58mm";
  const isThermal80 = format === "thermal_80mm";
  const isThermal = isThermal58 || isThermal80;

  const css = isThermal58
    ? `
      @page { size: 58mm auto; margin: 1mm; }
      body { font-family: 'Courier New', monospace; font-size: 10px; line-height: 1.25; width: 54mm; margin: 0; color: #000; }
      h1 { font-size: 12px; margin: 0 0 3px; text-align: center; }
      .center { text-align: center; }
      .divider { border-top: 1px dashed #000; margin: 4px 0; }
      .row { display: flex; justify-content: space-between; gap: 4px; }
      .item { margin-bottom: 3px; }
      .item-row { display: flex; justify-content: space-between; gap: 4px; }
      .item-extras { padding-left: 6px; font-size: 9px; color: #333; }
      .total { font-size: 12px; font-weight: bold; }
      .small { font-size: 9px; }
    `
    : isThermal80
    ? `
      @page { size: 80mm auto; margin: 2mm; }
      body { font-family: 'Courier New', monospace; font-size: 11px; width: 76mm; margin: 0; color: #000; }
      h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
      .center { text-align: center; }
      .divider { border-top: 1px dashed #000; margin: 6px 0; }
      .row { display: flex; justify-content: space-between; gap: 6px; }
      .item { margin-bottom: 4px; }
      .item-row { display: flex; justify-content: space-between; gap: 6px; }
      .item-extras { padding-left: 8px; font-size: 10px; color: #333; }
      .total { font-size: 14px; font-weight: bold; }
      .small { font-size: 10px; }
    `
    : `
      @page { size: A4; margin: 12mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111; max-width: 600px; margin: 0 auto; }
      h1 { font-size: 22px; margin: 0 0 6px; }
      .center { text-align: center; }
      .divider { border-top: 1px solid #ddd; margin: 12px 0; }
      .row { display: flex; justify-content: space-between; gap: 12px; }
      .item { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #eee; }
      .item-row { display: flex; justify-content: space-between; gap: 12px; font-weight: 600; }
      .item-extras { padding-left: 12px; font-size: 12px; color: #555; }
      .total { font-size: 18px; font-weight: bold; }
      .small { font-size: 11px; color: #555; }
    `;

  const addr = buildAddress(data.address);
  const dt = new Date(data.createdAt).toLocaleString("pt-BR");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Pedido #${data.orderShortId}</title>
<style>${css}</style>
</head>
<body>
  <h1>${escapeHtml(data.storeName)}</h1>
  <div class="center small">
    ${data.storePhone ? `Tel: ${escapeHtml(data.storePhone)}<br/>` : ""}
    ${data.storeAddress ? `${escapeHtml(data.storeAddress)}<br/>` : ""}
    ${dt}
  </div>
  <div class="divider"></div>

  <div><strong>Pedido:</strong> #${data.orderShortId}</div>
  <div><strong>Tipo:</strong> ${methodLabel(data.method)}</div>
  <div><strong>Cliente:</strong> ${escapeHtml(data.customerName)}</div>
  ${data.customerPhone ? `<div><strong>Tel:</strong> ${escapeHtml(data.customerPhone)}</div>` : ""}
  ${data.method === "delivery" && addr ? `<div><strong>Endereço:</strong> ${escapeHtml(addr)}</div>` : ""}

  <div class="divider"></div>
  ${buildItemsHtml(data.items)}

  <div class="divider"></div>
  <div class="row"><span>Subtotal</span><span>${formatBRL(data.subtotal)}</span></div>
  ${data.deliveryFee ? `<div class="row"><span>Entrega</span><span>${formatBRL(data.deliveryFee)}</span></div>` : ""}
  ${data.discount ? `<div class="row"><span>Desconto</span><span>- ${formatBRL(data.discount)}</span></div>` : ""}
  <div class="row total"><span>TOTAL</span><span>${formatBRL(data.total)}</span></div>

  <div class="divider"></div>
  <div><strong>Pagamento:</strong> ${paymentLabel(data.paymentMethod)}</div>
  ${data.changeFor ? `<div><strong>Troco para:</strong> ${formatBRL(data.changeFor)}</div>` : ""}
  ${data.notes ? `<div class="small" style="margin-top:6px"><strong>Observações:</strong> ${escapeHtml(data.notes)}</div>` : ""}

  <div class="divider"></div>
  <div class="center small">Obrigado pela preferência!</div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() { window.close(); }, 300);
      }, 100);
    };
  </script>
</body>
</html>`;
};

export const printReceipt = (data: PrintData, format: PrintFormat = "thermal_80mm") => {
  try {
    const html = buildHtml(data, format);
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) {
      console.warn("Popup bloqueado — não foi possível imprimir.");
      return false;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
  } catch (e) {
    console.error("printReceipt error", e);
    return false;
  }
};
