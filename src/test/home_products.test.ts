import { describe, it, expect } from "vitest";
import { normalizeHomeProductRow, getColumnValue } from "@/hooks/useHomeProducts";

describe("HomeProducts Data Normalization & Segment Matching", () => {
  it("maps exact Portuguese column names with spaces and accents from 'Produtos Home'", () => {
    const rawRow = {
      "Nome do Produto": "1 Pizza 25cm + 1 Pizza doce 25cm - Combo",
      "Estabelecimento": "Co.Pizza",
      "Segmento": "Pizzaria",
      "Promoção": "37.70",
      "Preço Antigo": "47.88",
      "Dia da semana": "Sexta",
      "Dia e hora": "25-11 17",
      "Descrição": "Equilíbrio perfeito: uma salgada, uma doce! 1 pizza 25cm + 1 pizza doce 25cm",
      "Link do Produto": "https://menu.brendi.com.br/copizza/produto/1-pizza-25cm-1-pizza-doce-25cm-combo",
      "Link da Imagem": "https://firebasestorage.googleapis.com/v0/b/brendi-app.appspot.com/o/test.webp",
      "Bairro": "Centro",
      "Nota": "4.7",
    };

    const normalized = normalizeHomeProductRow(rawRow, 0);

    expect(normalized.product_name).toBe("1 Pizza 25cm + 1 Pizza doce 25cm - Combo");
    expect(normalized.store_name).toBe("Co.Pizza");
    expect(normalized.segment).toBe("Pizzaria");
    expect(normalized.promo_price).toBeCloseTo(37.7, 2);
    expect(normalized.old_price).toBeCloseTo(47.88, 2);
    expect(normalized.description).toContain("Equilíbrio perfeito");
    expect(normalized.product_link).toBe(
      "https://menu.brendi.com.br/copizza/produto/1-pizza-25cm-1-pizza-doce-25cm-combo"
    );
    expect(normalized.image_url).toBe(
      "https://firebasestorage.googleapis.com/v0/b/brendi-app.appspot.com/o/test.webp"
    );
    expect(normalized.neighborhood).toBe("Centro");
    expect(normalized.rating).toBeCloseTo(4.7, 1);
  });

  it("handles currency formatted strings with comma decimals (e.g. 'R$ 28,50')", () => {
    const rawRow = {
      nome_do_produto: "Bife a Parmegiana",
      estabelecimento: "Itafood House",
      segmento: "Restaurante",
      promocao: "R$ 28,00",
      preco_antigo: "R$ 35,56",
      link_do_produto: "https://example.com/item",
    };

    const normalized = normalizeHomeProductRow(rawRow, 1);
    expect(normalized.promo_price).toBeCloseTo(28.0, 2);
    expect(normalized.old_price).toBeCloseTo(35.56, 2);
  });

  it("extracts values case-insensitively and accent-insensitively via getColumnValue", () => {
    const row = { "PRECO ANTIGO": "50.00", "promoçao": "39.90" };
    expect(getColumnValue(row, "Preço Antigo")).toBe("50.00");
    expect(getColumnValue(row, "Promoção")).toBe("39.90");
  });
});
