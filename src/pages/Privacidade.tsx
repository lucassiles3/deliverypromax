import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Privacidade = () => {
  useEffect(() => {
    document.title = "Política de Privacidade — itChat Brasil";
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(20_14%_6%)] text-[hsl(30_20%_96%)]">
      <div className="container max-w-3xl py-12">
        <Link to="/sobre" className="text-sm text-white/60 hover:text-white inline-flex items-center gap-1 mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <h1 className="font-display text-4xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-white/60 mb-10">Última atualização: 14 de junho de 2026</p>

        <article className="prose prose-invert max-w-none space-y-6 text-white/80 leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-bold text-white">1. Introdução</h2>
            <p>
              O itChat Brasil respeita a privacidade de seus usuários e está comprometido com a proteção de dados pessoais,
              em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">2. Dados que coletamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Dados cadastrais:</strong> nome, e-mail, telefone, CPF/CNPJ, endereço.</li>
              <li><strong>Dados de uso:</strong> pedidos realizados, preferências, histórico de navegação.</li>
              <li><strong>Dados de localização:</strong> utilizados para mostrar estabelecimentos próximos.</li>
              <li><strong>Dados de pagamento:</strong> processados por gateways parceiros (não armazenamos dados completos de cartão).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">3. Como utilizamos seus dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Prestação dos serviços contratados.</li>
              <li>Personalização da experiência do usuário.</li>
              <li>Comunicação sobre pedidos, atualizações e novidades.</li>
              <li>Prevenção de fraudes e segurança da plataforma.</li>
              <li>Cumprimento de obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">4. Compartilhamento de dados</h2>
            <p>
              Compartilhamos dados apenas com: (i) estabelecimentos parceiros, para viabilizar pedidos; (ii) processadores de
              pagamento; (iii) entregadores, quando aplicável; (iv) autoridades públicas, mediante obrigação legal.
              Não vendemos seus dados pessoais.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">5. Cookies</h2>
            <p>
              Utilizamos cookies para melhorar a navegação, lembrar preferências e analisar o uso da plataforma. Você pode
              gerenciar cookies pelas configurações do seu navegador.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">6. Seus direitos (LGPD)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Confirmar a existência de tratamento de dados.</li>
              <li>Acessar, corrigir ou atualizar seus dados.</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação.</li>
              <li>Revogar o consentimento a qualquer momento.</li>
              <li>Solicitar portabilidade dos dados.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">7. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus dados contra acessos não autorizados, perda,
              destruição ou alteração, incluindo criptografia, controle de acesso e monitoramento contínuo.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">8. Retenção</h2>
            <p>
              Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta Política e obrigações legais,
              sendo posteriormente excluídos ou anonimizados.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">9. Contato do Encarregado (DPO)</h2>
            <p>
              Para exercer seus direitos ou esclarecer dúvidas, entre em contato pelo e-mail: <strong>privacidade@itchatbrasil.com</strong>
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white">10. Alterações</h2>
            <p>
              Esta Política pode ser atualizada periodicamente. Recomendamos a consulta regular. Alterações relevantes serão
              comunicadas pelos canais oficiais.
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

export default Privacidade;
