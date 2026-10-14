import type { Lang } from "./translations";

const en = {
  welcome: "Welcome back", join: "Create your account", loginHint: "Sign in to Magma Chat Room.", registerHint: "Choose your username and password.",
  passwordTips: "Password recommendations", clear: "Clear username", optional: "Recommendations, not requirements",
  show: "Show password", hide: "Hide password", generate: "Generate password", generated: "Password generated", caps: "Caps Lock is on",
  strength: "Password strength", weak: "Weak", fair: "Fair", strong: "Strong", excellent: "Excellent",
  minimum: "At least 6 characters", mixed: "Uppercase and lowercase", number: "Number or symbol", match: "Passwords match",
  signingIn: "Signing in…", creating: "Creating account…", language: "Language", terms: "Terms & conditions", signIn: "Sign in", signUp: "Create account",
};
type AuthCopy = typeof en;

export const AUTH_COPY: Record<Lang, AuthCopy> = {
  en,
  es: {
    passwordTips: "Recomendaciones de contraseña", clear: "Borrar usuario", optional: "Recomendaciones, no requisitos",
    welcome: "Bienvenido de nuevo", join: "Crea tu cuenta", loginHint: "Accede a Magma Chat Room.", registerHint: "Elige tu usuario y contraseña.",
    show: "Mostrar contraseña", hide: "Ocultar contraseña", generate: "Generar contraseña", generated: "Contraseña generada", caps: "Bloq Mayús está activado",
    strength: "Seguridad de la contraseña", weak: "Débil", fair: "Aceptable", strong: "Fuerte", excellent: "Excelente",
    minimum: "Al menos 6 caracteres", mixed: "Mayúsculas y minúsculas", number: "Número o símbolo", match: "Las contraseñas coinciden",
    signingIn: "Iniciando sesión…", creating: "Creando cuenta…", language: "Idioma", terms: "Términos y condiciones", signIn: "Iniciar sesión", signUp: "Crear cuenta",
  },
  de: {
    passwordTips: "Passwortempfehlungen", clear: "Benutzername löschen", optional: "Empfehlungen, keine Anforderungen",
    welcome: "Willkommen zurück", join: "Konto erstellen", loginHint: "Bei Magma Chat Room anmelden.", registerHint: "Benutzername und Passwort wählen.",
    show: "Passwort anzeigen", hide: "Passwort verbergen", generate: "Passwort generieren", generated: "Passwort generiert", caps: "Feststelltaste ist aktiv",
    strength: "Passwortstärke", weak: "Schwach", fair: "Mittel", strong: "Stark", excellent: "Sehr stark",
    minimum: "Mindestens 6 Zeichen", mixed: "Groß- und Kleinbuchstaben", number: "Zahl oder Sonderzeichen", match: "Passwörter stimmen überein",
    signingIn: "Anmeldung…", creating: "Konto wird erstellt…", language: "Sprache", terms: "Nutzungsbedingungen", signIn: "Anmelden", signUp: "Konto erstellen",
  },
  fr: {
    passwordTips: "Conseils pour le mot de passe", clear: "Effacer l’identifiant", optional: "Conseils, pas des exigences",
    welcome: "Bon retour", join: "Créez votre compte", loginHint: "Connectez-vous à Magma Chat Room.", registerHint: "Choisissez votre identifiant et mot de passe.",
    show: "Afficher le mot de passe", hide: "Masquer le mot de passe", generate: "Générer un mot de passe", generated: "Mot de passe généré", caps: "Verr. Maj est activé",
    strength: "Force du mot de passe", weak: "Faible", fair: "Moyen", strong: "Fort", excellent: "Excellent",
    minimum: "Au moins 6 caractères", mixed: "Majuscules et minuscules", number: "Chiffre ou symbole", match: "Les mots de passe correspondent",
    signingIn: "Connexion…", creating: "Création du compte…", language: "Langue", terms: "Conditions générales", signIn: "Se connecter", signUp: "Créer un compte",
  },
  it: {
    passwordTips: "Consigli per la password", clear: "Cancella nome utente", optional: "Consigli, non requisiti",
    welcome: "Bentornato", join: "Crea il tuo account", loginHint: "Accedi a Magma Chat Room.", registerHint: "Scegli nome utente e password.",
    show: "Mostra password", hide: "Nascondi password", generate: "Genera password", generated: "Password generata", caps: "Blocco maiuscole attivo",
    strength: "Sicurezza della password", weak: "Debole", fair: "Discreta", strong: "Forte", excellent: "Eccellente",
    minimum: "Almeno 6 caratteri", mixed: "Maiuscole e minuscole", number: "Numero o simbolo", match: "Le password coincidono",
    signingIn: "Accesso…", creating: "Creazione account…", language: "Lingua", terms: "Termini e condizioni", signIn: "Accedi", signUp: "Crea account",
  },
  pt: {
    passwordTips: "Recomendações de senha", clear: "Limpar usuário", optional: "Recomendações, não requisitos",
    welcome: "Bem-vindo de volta", join: "Crie sua conta", loginHint: "Entre no Magma Chat Room.", registerHint: "Escolha seu usuário e senha.",
    show: "Mostrar senha", hide: "Ocultar senha", generate: "Gerar senha", generated: "Senha gerada", caps: "Caps Lock está ativado",
    strength: "Força da senha", weak: "Fraca", fair: "Razoável", strong: "Forte", excellent: "Excelente",
    minimum: "Pelo menos 6 caracteres", mixed: "Maiúsculas e minúsculas", number: "Número ou símbolo", match: "As senhas coincidem",
    signingIn: "Entrando…", creating: "Criando conta…", language: "Idioma", terms: "Termos e condições", signIn: "Entrar", signUp: "Criar conta",
  },
};