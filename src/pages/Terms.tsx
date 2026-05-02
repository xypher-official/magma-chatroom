import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Flame } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import LavaParticles from "@/components/LavaParticles";

const Terms = () => {
  const { t, lang } = useI18n();

  const body: Record<string, { intro: string; sections: { h: string; p: string }[] }> = {
    en: {
      intro: "Welcome to Magma Chat Room. By creating an account or using this service you agree to the terms below.",
      sections: [
        { h: "1. Eligibility", p: "You must be at least 13 years old. If you are under 16, you confirm a parent or guardian agrees to these terms on your behalf." },
        { h: "2. Account & Conduct", p: "You are responsible for your account credentials and for everything posted from it. No harassment, hate speech, illegal content, spam, impersonation, or sharing of private data of others." },
        { h: "3. AI Features", p: "Image generation and the admin assistant are powered by AI. Generated content may be inaccurate. Don't use AI to create harmful, deceptive, or illegal content." },
        { h: "4. Calls & Privacy", p: "Voice/video calls are peer-to-peer (WebRTC). We do not record calls. Profiles, messages and uploads are stored on our managed backend to deliver the service." },
        { h: "5. Moderation", p: "We may remove content, suspend or delete accounts that violate these terms or applicable law, with or without notice." },
        { h: "6. Liability", p: "Service is provided \"as is\" without warranty. To the maximum extent permitted, we are not liable for indirect, incidental or consequential damages." },
        { h: "7. Changes", p: "We may update these terms. Material changes will be announced inside the app." },
      ],
    },
    es: {
      intro: "Bienvenido a Magma Chat Room. Al crear una cuenta o usar este servicio aceptas los términos siguientes.",
      sections: [
        { h: "1. Elegibilidad", p: "Debes tener al menos 13 años. Si tienes menos de 16, confirmas que un padre/tutor acepta estos términos en tu nombre." },
        { h: "2. Cuenta y conducta", p: "Eres responsable de tus credenciales y de todo lo que se publique desde tu cuenta. No se permite acoso, discurso de odio, contenido ilegal, spam, suplantación o compartir datos privados de terceros." },
        { h: "3. Funciones IA", p: "La generación de imágenes y el asistente de admin usan IA. El contenido generado puede ser inexacto. No uses la IA para crear contenido dañino, engañoso o ilegal." },
        { h: "4. Llamadas y privacidad", p: "Las llamadas de voz/vídeo son P2P (WebRTC). No grabamos llamadas. Perfiles, mensajes y subidas se almacenan en nuestro backend gestionado para prestar el servicio." },
        { h: "5. Moderación", p: "Podemos eliminar contenido y suspender o borrar cuentas que infrinjan estos términos o la ley, con o sin aviso." },
        { h: "6. Responsabilidad", p: "El servicio se ofrece \"tal cual\" sin garantías. En la máxima medida permitida, no somos responsables de daños indirectos, incidentales o consecuentes." },
        { h: "7. Cambios", p: "Podemos actualizar estos términos. Los cambios importantes se anunciarán dentro de la app." },
      ],
    },
    de: {
      intro: "Willkommen bei Magma Chat Room. Mit der Registrierung oder Nutzung akzeptierst du die folgenden Bedingungen.",
      sections: [
        { h: "1. Voraussetzungen", p: "Du musst mindestens 13 Jahre alt sein. Unter 16 bestätigst du, dass ein Erziehungsberechtigter zustimmt." },
        { h: "2. Konto & Verhalten", p: "Du bist für dein Konto verantwortlich. Keine Belästigung, Hass, illegale Inhalte, Spam oder Identitätsmissbrauch." },
        { h: "3. KI-Funktionen", p: "Bildgenerierung und Admin-Assistent nutzen KI. Inhalte können fehlerhaft sein. Kein Missbrauch." },
        { h: "4. Anrufe & Datenschutz", p: "Sprach-/Videoanrufe sind P2P (WebRTC). Wir nehmen keine Anrufe auf." },
        { h: "5. Moderation", p: "Wir können Inhalte entfernen oder Konten sperren, die gegen diese Bedingungen verstoßen." },
        { h: "6. Haftung", p: "Service \"wie besehen\" ohne Garantie." },
        { h: "7. Änderungen", p: "Wesentliche Änderungen werden in der App angekündigt." },
      ],
    },
    it: {
      intro: "Benvenuto in Magma Chat Room. Creando un account accetti questi termini.",
      sections: [
        { h: "1. Requisiti", p: "Devi avere almeno 13 anni." },
        { h: "2. Account & Condotta", p: "Sei responsabile del tuo account. Vietati molestie, contenuti illegali, spam, impersonificazione." },
        { h: "3. IA", p: "Le funzioni IA possono essere imprecise. Non usarle per scopi dannosi." },
        { h: "4. Chiamate & Privacy", p: "Le chiamate sono P2P (WebRTC). Non registriamo." },
        { h: "5. Moderazione", p: "Possiamo rimuovere contenuti o sospendere account." },
        { h: "6. Responsabilità", p: "Servizio \"così com'è\"." },
        { h: "7. Modifiche", p: "Le modifiche saranno annunciate nell'app." },
      ],
    },
    fr: {
      intro: "Bienvenue sur Magma Chat Room. En créant un compte vous acceptez ces conditions.",
      sections: [
        { h: "1. Éligibilité", p: "Vous devez avoir au moins 13 ans." },
        { h: "2. Compte & Conduite", p: "Vous êtes responsable de votre compte. Pas de harcèlement, contenus illégaux, spam, usurpation." },
        { h: "3. IA", p: "Les fonctions IA peuvent être imprécises. N'en abusez pas." },
        { h: "4. Appels & Vie privée", p: "Les appels sont P2P (WebRTC). Nous n'enregistrons pas." },
        { h: "5. Modération", p: "Nous pouvons retirer du contenu ou suspendre des comptes." },
        { h: "6. Responsabilité", p: "Service \"tel quel\"." },
        { h: "7. Modifications", p: "Les changements seront annoncés dans l'app." },
      ],
    },
    pt: {
      intro: "Bem-vindo ao Magma Chat Room. Ao criar uma conta aceitas estes termos.",
      sections: [
        { h: "1. Elegibilidade", p: "Tens de ter pelo menos 13 anos." },
        { h: "2. Conta & Conduta", p: "És responsável pela tua conta. Sem assédio, conteúdo ilegal, spam ou personificação." },
        { h: "3. IA", p: "As funções IA podem ser imprecisas. Não as uses para fins prejudiciais." },
        { h: "4. Chamadas & Privacidade", p: "Chamadas P2P (WebRTC). Não gravamos." },
        { h: "5. Moderação", p: "Podemos remover conteúdo ou suspender contas." },
        { h: "6. Responsabilidade", p: "Serviço \"como está\"." },
        { h: "7. Alterações", p: "Mudanças importantes serão anunciadas." },
      ],
    },
  };
  const content = body[lang] ?? body.en;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <LavaParticles />
      <div className="relative z-10 max-w-3xl mx-auto px-5 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft size={16} /> {t("terms.back")}
        </Link>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-panel-strong rounded-3xl p-8 md:p-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl magma-gradient flex items-center justify-center magma-glow-sm">
              <Flame className="text-primary-foreground" size={22} />
            </div>
            <div>
              <h1 className="text-3xl font-bold magma-gradient-text">{t("terms.title")}</h1>
              <p className="text-xs text-muted-foreground mt-1">{t("terms.lastUpdated")}: 2026-05-01</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4 mb-6 leading-relaxed">{content.intro}</p>
          <div className="space-y-5">
            {content.sections.map((s) => (
              <section key={s.h}>
                <h2 className="font-semibold text-foreground mb-1">{s.h}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.p}</p>
              </section>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Terms;
