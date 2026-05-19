import { Linking } from 'react-native';

export const LA_MAISON_REVIEW_URL = '';

export function normalizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;

  let cleaned = phone.replace(/[\s\-()]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  if (cleaned.startsWith('216')) {
    return cleaned.length === 11 ? cleaned : null;
  }

  if (cleaned.length === 8 && /^[2579]/.test(cleaned)) {
    return `216${cleaned}`;
  }

  return null;
}

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export async function openWhatsAppMessage(
  phone: string | null | undefined,
  message: string,
): Promise<boolean> {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export interface ReservationMessageParams {
  date: string;
  time: string;
  partySize: number;
}

export function buildReservationConfirmationMessage(
  params: ReservationMessageParams,
): string {
  const { date, time, partySize } = params;
  const persons = `${partySize} personne${partySize > 1 ? 's' : ''}`;
  return `Bonjour, nous vous contactons de La Maison pour confirmer votre réservation du ${date} à ${time} pour ${persons}. Merci de nous confirmer votre présence.`;
}

export function buildReservationReminderMessage(
  params: Pick<ReservationMessageParams, 'time' | 'partySize'>,
): string {
  const { time, partySize } = params;
  const persons = `${partySize} personne${partySize > 1 ? 's' : ''}`;
  return `Bonjour, La Maison vous rappelle votre réservation aujourd'hui à ${time} pour ${persons}. À très bientôt.`;
}

export function buildWaitlistReadyMessage(): string {
  return "Bonjour, votre table à La Maison sera bientôt prête. Vous pouvez vous présenter à l'accueil.";
}

export function buildSatisfactionMessage(): string {
  if (LA_MAISON_REVIEW_URL) {
    return `Bonjour, merci d'avoir choisi La Maison. Nous espérons que vous avez passé un excellent moment. Votre avis nous aiderait beaucoup : ${LA_MAISON_REVIEW_URL}`;
  }
  return "Bonjour, merci d'avoir choisi La Maison. Nous espérons que vous avez passé un excellent moment. Votre avis nous aiderait beaucoup.";
}
