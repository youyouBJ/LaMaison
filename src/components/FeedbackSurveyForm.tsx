import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { FeedbackRating, FeedbackSurveyFormState } from '../types/feedback';
import { colors, typography, spacing, radius } from '../theme';

interface Props {
  token: string;
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'already_submitted' | 'token_not_found' | 'token_expired' | 'error';

// submit_feedback_survey not yet in generated types — typed explicitly
type RpcResult = { id: string } | { error: 'token_not_found' | 'token_expired' | 'already_submitted' };

const EMPTY_FORM: FeedbackSurveyFormState = {
  ratingOverall:  null,
  ratingFood:     null,
  ratingDrinks:   null,
  ratingService:  null,
  ratingAmbience: null,
  recommended:    null,
  comment:        '',
};

const STAR = '★';
const STAR_EMPTY = '☆';

function StarRating({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: FeedbackRating | null;
  onChange: (v: FeedbackRating) => void;
  required?: boolean;
}): React.JSX.Element {
  return (
    <View style={starStyles.row}>
      <Text style={starStyles.label}>
        {label}
        {required ? <Text style={starStyles.required}> *</Text> : null}
      </Text>
      <View style={starStyles.stars}>
        {([1, 2, 3, 4, 5] as FeedbackRating[]).map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={[starStyles.star, value !== null && n <= value && starStyles.starFilled]}>
              {value !== null && n <= value ? STAR : STAR_EMPTY}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  required: {
    color: colors.cta,
  },
  stars: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  star: {
    fontSize: 28,
    color: colors.borderLight,
  },
  starFilled: {
    color: colors.gold,
  },
});

export default function FeedbackSurveyForm({ token }: Props): React.JSX.Element {
  const [form, setForm]         = useState<FeedbackSurveyFormState>(EMPTY_FORM);
  const [status, setStatus]     = useState<SubmitStatus>('idle');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const setRating = useCallback(
    (field: keyof Pick<FeedbackSurveyFormState, 'ratingOverall' | 'ratingFood' | 'ratingDrinks' | 'ratingService' | 'ratingAmbience'>) =>
      (v: FeedbackRating) => setForm((prev) => ({ ...prev, [field]: v })),
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (form.ratingOverall === null) {
      setFieldError('Veuillez noter votre expérience globale.');
      return;
    }
    setFieldError(null);
    setStatus('submitting');

    // submit_feedback_survey not yet in generated types; typed via unknown intermediate
    // (cast will become unnecessary after migration + type regeneration)
    type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{
      data: RpcResult | null;
      error: { message: string } | null;
    }>;
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

    const result = rawData;

    if (!result) {
      setStatus('error');
    } else if ('error' in result && result.error === 'already_submitted') {
      setStatus('already_submitted');
    } else if ('error' in result && result.error === 'token_not_found') {
      setStatus('token_not_found');
    } else if ('error' in result && result.error === 'token_expired') {
      setStatus('token_expired');
    } else if ('id' in result && result.id) {
      setStatus('success');
    } else {
      setStatus('error');
    }
  }, [form, token]);

  if (status === 'success') {
    return (
      <View style={styles.centeredCard}>
        <Text style={styles.successTitle}>Merci pour votre retour</Text>
        <Text style={styles.successBody}>
          Votre avis a bien été enregistré. Il nous aide à améliorer l'expérience La Maison.
        </Text>
      </View>
    );
  }

  if (status === 'already_submitted') {
    return (
      <View style={styles.centeredCard}>
        <Text style={styles.infoTitle}>Enquête déjà remplie</Text>
        <Text style={styles.infoBody}>Cette enquête a déjà été remplie. Merci de votre participation.</Text>
      </View>
    );
  }

  if (status === 'token_not_found' || status === 'token_expired') {
    return (
      <View style={styles.centeredCard}>
        <Text style={styles.errorTitle}>Lien invalide</Text>
        <Text style={styles.errorBody}>
          {status === 'token_expired'
            ? 'Ce lien d\'enquête a expiré.'
            : 'Ce lien d\'enquête est introuvable ou incorrect.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Merci pour votre visite</Text>
        <Text style={styles.subtitle}>
          Votre retour nous aide à améliorer l'expérience La Maison.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Votre expérience</Text>

        <StarRating
          label="Expérience globale"
          value={form.ratingOverall}
          onChange={setRating('ratingOverall')}
          required
        />
        <StarRating
          label="Cuisine"
          value={form.ratingFood}
          onChange={setRating('ratingFood')}
        />
        <StarRating
          label="Boissons"
          value={form.ratingDrinks}
          onChange={setRating('ratingDrinks')}
        />
        <StarRating
          label="Service"
          value={form.ratingService}
          onChange={setRating('ratingService')}
        />
        <StarRating
          label="Ambiance"
          value={form.ratingAmbience}
          onChange={setRating('ratingAmbience')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Recommandation</Text>
        <Text style={styles.questionText}>Recommanderiez-vous La Maison ?</Text>
        <View style={styles.recommendRow}>
          <TouchableOpacity
            style={[styles.recommendBtn, form.recommended === true && styles.recommendBtnActive]}
            onPress={() => setForm((prev) => ({ ...prev, recommended: true }))}
            activeOpacity={0.8}
          >
            <Text style={[styles.recommendBtnText, form.recommended === true && styles.recommendBtnTextActive]}>
              Oui
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.recommendBtn, form.recommended === false && styles.recommendBtnDanger]}
            onPress={() => setForm((prev) => ({ ...prev, recommended: false }))}
            activeOpacity={0.8}
          >
            <Text style={[styles.recommendBtnText, form.recommended === false && styles.recommendBtnTextDanger]}>
              Non
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Commentaire libre</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Partagez votre expérience…"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          value={form.comment}
          onChangeText={(text) => setForm((prev) => ({ ...prev, comment: text }))}
          textAlignVertical="top"
        />
      </View>

      {fieldError ? (
        <View style={styles.fieldError}>
          <Text style={styles.fieldErrorText}>{fieldError}</Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.fieldError}>
          <Text style={styles.fieldErrorText}>
            Une erreur est survenue. Veuillez réessayer.
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.submitBtn, status === 'submitting' && styles.submitBtnDisabled]}
        onPress={() => { void handleSubmit(); }}
        disabled={status === 'submitting'}
        activeOpacity={0.85}
      >
        {status === 'submitting' ? (
          <ActivityIndicator color={colors.textOnDark} size="small" />
        ) : (
          <Text style={styles.submitBtnText}>Envoyer mon avis</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },

  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  title: {
    fontFamily: typography.display.fontFamily,
    fontSize: typography.display.fontSize,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  questionText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  recommendRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  recommendBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  recommendBtnActive: {
    backgroundColor: colors.statusFreeLight,
    borderColor: colors.statusFree,
  },
  recommendBtnDanger: {
    backgroundColor: colors.ctaLight,
    borderColor: colors.cta,
  },
  recommendBtnText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  recommendBtnTextActive: {
    color: colors.statusFree,
  },
  recommendBtnTextDanger: {
    color: colors.cta,
  },

  textInput: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 100,
    backgroundColor: colors.background,
  },

  fieldError: {
    backgroundColor: colors.ctaLight,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cta,
  },
  fieldErrorText: {
    ...typography.small,
    color: colors.cta,
    fontFamily: typography.bodyMedium.fontFamily,
  },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    ...typography.bodyMedium,
    color: colors.textOnDark,
    fontSize: 16,
  },

  // États terminaux
  centeredCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  successTitle: {
    fontFamily: typography.h1.fontFamily,
    fontSize: typography.h1.fontSize,
    color: colors.statusFree,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  successBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoTitle: {
    fontFamily: typography.h1.fontFamily,
    fontSize: typography.h1.fontSize,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  infoBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorTitle: {
    fontFamily: typography.h1.fontFamily,
    fontSize: typography.h1.fontSize,
    color: colors.cta,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  errorBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
