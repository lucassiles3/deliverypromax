import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Termos = () => {
  useEffect(() => {
    document.title = "Termos de Uso — itChat Brasil";
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(20_14%_6%)] text-[hsl(30_20%_96%)]">
      <div className="container max-w-3xl py-12">
        <Link to="/sobre" className="text-sm text-white/60 hover:text-white inline-flex items-center gap-1 mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <h1 className="font-display text-4xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-white/60 mb-10">Última atualização: 14 de junho de 2026</p>

        <article className="prose prose-invert max-w-none space-y-6 text-white/80 leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-bold text-white">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar a plataforma itChat Brasil ("Plataforma"), você concorda integralmente com estes Termos de Uso.
              Caso não concorde com qualquer disposição, não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">2. Sobre a Plataforma</h2>
            <p>
              O itChat Brasil é uma plataforma digital que conecta consumidores a estabelecimentos comerciais locais, oferecendo
              catálogo digital, sistema de pedidos, atendimento via chatbot com inteligência artificial, gestão de loja e meios de pagamento.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">3. Cadastro</h2>
            <p>
              Para utilizar determinadas funcionalidades, o usuário deve criar uma conta fornecendo informações verídicas e atualizadas.
              É responsabilidade do usuário manter a confidencialidade de suas credenciais de acesso.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">4. Período de Teste Gratuito</h2>
            <p>
              Novos estabelecimentos têm direito a 7 (sete) dias gratuitos para experimentar a plataforma, sem necessidade de
              cartão de crédito. Após esse período, a assinatura será cobrada conforme o plano contratado, podendo ser cancelada a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">5. Planos e Pagamento</h2>
            <p>
              Os planos oferecidos pelo itChat Brasil possuem cobrança mensal recorrente, conforme valores apresentados na página
              de planos. O não pagamento poderá resultar na suspensão temporária ou definitiva do acesso à plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">6. Responsabilidades do Usuário</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Utilizar a plataforma de acordo com a legislação vigente.</li>
              <li>Não publicar conteúdo ilegal, ofensivo, falso ou que viole direitos de terceiros.</li>
              <li>Respeitar os direitos de propriedade intelectual do itChat Brasil e demais usuários.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">7. Responsabilidades dos Estabelecimentos</h2>
            <p>
              Os estabelecimentos parceiros são integralmente responsáveis pelos produtos e serviços ofertados, qualidade,
              entrega, atendimento ao consumidor e cumprimento das obrigações fiscais.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">8. Limitação de Responsabilidade</h2>
            <p>
              O itChat Brasil atua como intermediador tecnológico e não se responsabiliza por relações comerciais entre clientes
              e estabelecimentos, indisponibilidades momentâneas decorrentes de força maior, ou por uso indevido por terceiros.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">9. Cancelamento</h2>
            <p>
              O usuário poderá cancelar sua assinatura a qualquer momento pelo painel administrativo. O cancelamento será efetivado
              ao fim do ciclo de cobrança vigente.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">10. Alterações</h2>
            <p>
              Estes Termos podem ser atualizados periodicamente. Recomendamos consulta regular. O uso continuado da plataforma
              após alterações configura aceitação das novas disposições.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">11. Foro</h2>
            <p>
              Fica eleito o foro da comarca da sede do itChat Brasil para dirimir quaisquer questões oriundas destes Termos,
              com renúncia a qualquer outro, por mais privilegiado que seja.
            </p>
          </section>
        </article>

        <div className="mt-12 text-center">
          <Link to="/cadastro">
            <Button size="lg" className="bg-gradient-to-r from-primary to-secondary text-white shadow-glow hover:opacity-90">
              Criar minha loja — 7 dias grátis <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Termos;
