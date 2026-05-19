import React, { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedbackRating = 1 | 2 | 3 | 4 | 5;

type SubmitStatus =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'already_submitted'
  | 'token_not_found'
  | 'token_expired'
  | 'error';

type RpcResult =
  | { id: string }
  | { error: 'token_not_found' | 'token_expired' | 'already_submitted' };

type RpcFn = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: RpcResult | null; error: { message: string } | null }>;

interface FormState {
  ratingOverall: FeedbackRating | null;
  ratingFood: FeedbackRating | null;
  ratingDrinks: FeedbackRating | null;
  ratingService: FeedbackRating | null;
  ratingAmbience: FeedbackRating | null;
  recommended: boolean | null;
  comment: string;
}

const INITIAL_FORM: FormState = {
  ratingOverall: null,
  ratingFood: null,
  ratingDrinks: null,
  ratingService: null,
  ratingAmbience: null,
  recommended: null,
  comment: '',
};

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  background:    '#F5F0E8',
  surface:       '#FFFFFF',
  primary:       '#2C1810',
  secondary:     '#5C3317',
  cta:           '#8B1A1A',
  ctaLight:      '#F9ECEC',
  gold:          '#B8973A',
  goldLight:     '#F7F0DC',
  border:        '#E8DDD0',
  borderLight:   '#F0EAE0',
  textPrimary:   '#2C1810',
  textSecondary: '#5C3317',
  textMuted:     '#C4A882',
  textOnDark:    '#F5F0E8',
  statusFree:    '#2D6A4F',
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageWrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: C.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '48px',
        paddingBottom: '64px',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
    >
      {children}
    </div>
  );
}

function BrandHeader(): React.JSX.Element {
  return (
    <div
      style={{
        textAlign: 'center',
        marginBottom: '32px',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '2px',
          backgroundColor: C.gold,
          margin: '0 auto 16px',
        }}
      />
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '5px',
          color: C.gold,
          textTransform: 'uppercase',
        }}
      >
        La Maison
      </span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '500px',
        backgroundColor: C.surface,
        borderRadius: '16px',
        padding: '36px 28px 40px',
        boxShadow: '0 4px 32px rgba(44, 24, 16, 0.07)',
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: string }): React.JSX.Element {
  return (
    <p
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '2px',
        color: C.gold,
        textTransform: 'uppercase',
        margin: '0 0 16px',
      }}
    >
      {children}
    </p>
  );
}

function Divider(): React.JSX.Element {
  return (
    <div
      style={{
        height: '1px',
        backgroundColor: C.borderLight,
        margin: '24px 0',
      }}
    />
  );
}

function RatingRow({
  label,
  value,
  onChange,
  required,
  noBorder,
}: {
  label: string;
  value: FeedbackRating | null;
  onChange: (v: FeedbackRating) => void;
  required?: boolean;
  noBorder?: boolean;
}): React.JSX.Element {
  return (
    <div
      style={{
        paddingTop: '14px',
        paddingBottom: '14px',
        borderBottom: noBorder ? 'none' : `1px solid ${C.borderLight}`,
      }}
    >
      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '14px',
          fontWeight: 500,
          color: C.textPrimary,
          margin: '0 0 12px',
        }}
      >
        {label}
        {required === true && (
          <span style={{ color: C.cta, marginLeft: '3px' }}>*</span>
        )}
      </p>
      <div style={{ display: 'flex', gap: '6px' }}>
        {([1, 2, 3, 4, 5] as FeedbackRating[]).map((n) => (
          <button
            key={n}
            type="button"
            className={`rating-btn${value === n ? ' rating-selected' : ''}`}
            onClick={() => onChange(n)}
            aria-label={`Note ${n} sur 5`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function TerminalCard({
  title,
  body,
  titleColor,
}: {
  title: string;
  body: string;
  titleColor?: string;
}): React.JSX.Element {
  return (
    <PageWrapper>
      <BrandHeader />
      <Card>
        <div style={{ textAlign: 'center', paddingTop: '8px', paddingBottom: '8px' }}>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '22px',
              fontWeight: 700,
              color: titleColor ?? C.textPrimary,
              margin: '0 0 16px',
              lineHeight: 1.3,
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '15px',
              color: C.textSecondary,
              margin: 0,
              lineHeight: 1.7,
            }}
          >
            {body}
          </p>
        </div>
      </Card>
    </PageWrapper>
  );
}

function Footer(): React.JSX.Element {
  return (
    <p
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: '12px',
        color: C.textMuted,
        textAlign: 'center',
        marginTop: '32px',
        marginBottom: 0,
        lineHeight: 1.5,
      }}
    >
      La Maison — Vos avis restent confidentiels.
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FeedbackPage(): React.JSX.Element {
  const { token } = useParams<{ token: string }>();
  const [form, setForm]           = useState<FormState>(INITIAL_FORM);
  const [status, setStatus]       = useState<SubmitStatus>('idle');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const setRating = useCallback(
    (
      field: keyof Pick<
        FormState,
        'ratingOverall' | 'ratingFood' | 'ratingDrinks' | 'ratingService' | 'ratingAmbience'
      >,
    ) =>
      (v: FeedbackRating) =>
        setForm((prev) => ({ ...prev, [field]: v })),
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!token) {
      setStatus('token_not_found');
      return;
    }
    if (form.ratingOverall === null) {
      setFieldError('Veuillez noter votre expérience globale.');
      return;
    }
    setFieldError(null);
    setStatus('submitting');

    const rpc = supabase.rpc as unknown as RpcFn;
    const { data: rawData, error } = await rpc('submit_feedback_survey', {
      p_token:           token,
      p_rating_overall:  form.ratingOverall,
      p_rating_food:     form.ratingFood,
      p_rating_drinks:   form.ratingDrinks,
      p_rating_service:  form.ratingService,
      p_rating_ambience: form.ratingAmbience,
      p_recommended:     form.recommended,
      p_comment:         form.comment.trim() || null,
    });

    if (error) {
      setStatus('error');
      return;
    }

    if (!rawData) {
      setStatus('error');
    } else if ('error' in rawData && rawData.error === 'already_submitted') {
      setStatus('already_submitted');
    } else if ('error' in rawData && rawData.error === 'token_not_found') {
      setStatus('token_not_found');
    } else if ('error' in rawData && rawData.error === 'token_expired') {
      setStatus('token_expired');
    } else if ('id' in rawData && rawData.id) {
      setStatus('success');
    } else {
      setStatus('error');
    }
  }, [form, token]);

  // ── Terminal states ──────────────────────────────────────────────────────────

  if (!token) {
    return (
      <TerminalCard
        title="Lien invalide"
        body="Ce lien d'enquête est invalide ou incomplet."
        titleColor={C.cta}
      />
    );
  }

  if (status === 'success') {
    return (
      <TerminalCard
        title="Merci pour votre retour"
        body="Votre avis a bien été enregistré. Il nous aide à améliorer l'expérience La Maison."
        titleColor={C.statusFree}
      />
    );
  }

  if (status === 'already_submitted') {
    return (
      <TerminalCard
        title="Enquête déjà remplie"
        body="Cette enquête a déjà été remplie. Merci de votre participation."
      />
    );
  }

  if (status === 'token_not_found' || status === 'token_expired') {
    return (
      <TerminalCard
        title="Lien invalide"
        body={
          status === 'token_expired'
            ? "Ce lien d'enquête a expiré."
            : "Ce lien d'enquête est introuvable ou incorrect."
        }
        titleColor={C.cta}
      />
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <PageWrapper>
      <BrandHeader />
      <Card>

        {/* En-tête */}
        <div style={{ marginBottom: '28px' }}>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '26px',
              fontWeight: 700,
              color: C.textPrimary,
              margin: '0 0 10px',
              lineHeight: 1.25,
            }}
          >
            Merci pour votre visite
          </h1>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '14px',
              color: C.textSecondary,
              margin: 0,
              lineHeight: 1.65,
            }}
          >
            Votre retour nous aide à améliorer l'expérience La Maison.
          </p>
        </div>

        <Divider />

        {/* Notes */}
        <SectionLabel>Votre expérience</SectionLabel>
        <RatingRow
          label="Expérience globale"
          value={form.ratingOverall}
          onChange={setRating('ratingOverall')}
          required
        />
        <RatingRow
          label="Cuisine"
          value={form.ratingFood}
          onChange={setRating('ratingFood')}
        />
        <RatingRow
          label="Boissons"
          value={form.ratingDrinks}
          onChange={setRating('ratingDrinks')}
        />
        <RatingRow
          label="Service"
          value={form.ratingService}
          onChange={setRating('ratingService')}
        />
        <RatingRow
          label="Ambiance"
          value={form.ratingAmbience}
          onChange={setRating('ratingAmbience')}
          noBorder
        />

        <Divider />

        {/* Recommandation */}
        <SectionLabel>Recommandation</SectionLabel>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '14px',
            fontWeight: 500,
            color: C.textPrimary,
            margin: '0 0 14px',
          }}
        >
          Recommanderiez-vous La Maison ?
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className={`recommend-btn${form.recommended === true ? ' recommend-yes' : ''}`}
            onClick={() => setForm((prev) => ({ ...prev, recommended: true }))}
          >
            Oui
          </button>
          <button
            type="button"
            className={`recommend-btn${form.recommended === false ? ' recommend-no' : ''}`}
            onClick={() => setForm((prev) => ({ ...prev, recommended: false }))}
          >
            Non
          </button>
        </div>

        <Divider />

        {/* Commentaire */}
        <SectionLabel>Commentaire libre</SectionLabel>
        <textarea
          className="feedback-comment"
          placeholder="Partagez votre expérience…"
          value={form.comment}
          onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
        />

        {/* Erreur champ */}
        {fieldError !== null && (
          <div
            style={{
              backgroundColor: C.ctaLight,
              border: `1px solid ${C.cta}`,
              borderRadius: '6px',
              padding: '12px 14px',
              marginTop: '16px',
            }}
          >
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '13px',
                fontWeight: 500,
                color: C.cta,
                margin: 0,
              }}
            >
              {fieldError}
            </p>
          </div>
        )}

        {/* Erreur API */}
        {status === 'error' && (
          <div
            style={{
              backgroundColor: C.ctaLight,
              border: `1px solid ${C.cta}`,
              borderRadius: '6px',
              padding: '12px 14px',
              marginTop: '16px',
            }}
          >
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '13px',
                fontWeight: 500,
                color: C.cta,
                margin: 0,
              }}
            >
              Une erreur est survenue. Veuillez réessayer.
            </p>
          </div>
        )}

        {/* Bouton soumettre */}
        <button
          type="button"
          className="submit-btn"
          style={{ marginTop: '24px' }}
          onClick={() => { void handleSubmit(); }}
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? 'Envoi en cours…' : 'Envoyer mon avis'}
        </button>

      </Card>
      <Footer />
    </PageWrapper>
  );
}
