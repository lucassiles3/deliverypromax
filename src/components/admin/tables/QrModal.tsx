import { QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import type { RestaurantTable } from "@/hooks/useTables";

export const QrModal = ({ table, onClose }: { table: RestaurantTable; onClose: () => void }) => {
  const url = `${window.location.origin}/mesa/${table.qr_token}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const print = () => {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    const canvas = document.querySelector("#qr-print canvas") as HTMLCanvasElement | null;
    const dataUrl = canvas?.toDataURL("image/png") ?? "";
    w.document.write(`
      <html><head><title>Mesa ${table.number}</title></head>
      <body style="font-family:system-ui;text-align:center;padding:40px">
        <h1 style="margin:0 0 8px">Mesa ${table.number}</h1>
        ${table.name ? `<p style="margin:0 0 16px;color:#666">${table.name}</p>` : ""}
        <img src="${dataUrl}" style="width:280px;height:280px" />
        <p style="margin-top:16px;font-size:12px;color:#666">${url}</p>
        <p style="margin-top:24px;font-size:14px">📱 Escaneie para chamar o garçom</p>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR Code · Mesa {table.number}</DialogTitle>
        </DialogHeader>
        <div id="qr-print" className="flex flex-col items-center gap-3 p-4">
          <QRCodeCanvas value={url} size={240} includeMargin />
          <code className="break-all text-xs text-muted-foreground">{url}</code>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy}><Copy className="mr-1 h-4 w-4" />Copiar link</Button>
            <Button onClick={print}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
