import { Linking } from 'react-native';
import { LA_MAISON_SURVEY_URL } from './whatsapp';

export interface ReservationEmailParams {
  date: string;
  time: string;
  partySize: number;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function buildMailtoUrl(
  to: string | null | undefined,
  subject: string,
  body: string,
): string | null {
  if (!to || !isValidEmail(to)) return null;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function openEmailMessage(
  to: string | null | undefined,
  subject: string,
  body: string,
): Promise<boolean> {
  const url = buildMailtoUrl(to, subject, body);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export function buildReservationConfirmationEmail(
  params: ReservationEmailParams,
): { subject: string; body: string } {
  const { date, time, partySize } = params;
  const persons = `${partySize} personne${partySize > 1 ? 's' : ''}`;
  return {
    subject: 'Confirmation de votre réservation - La Maison',
    body: [
      'Bonjour,',
      '',
      `Nous vous contactons de La Maison pour confirmer votre réservation du ${date} à ${time} pour ${persons}.`,
      '',
      'Merci de nous confirmer votre présence.',
      '',
      'À très bientôt,',
      'La Maison',
    ].join('\n'),
  };
}

export function buildGuestConfirmationEmail(): { subject: string; body: string } {
  return {
    subject: 'Confirmation de votre réservation - La Maison',
    body: [
      'Bonjour,',
      '',
      'Nous vous contactons de La Maison pour confirmer votre réservation.',
      '',
      'Merci de nous confirmer votre présence.',
      '',
      'À très bientôt,',
      'La Maison',
    ].join('\n'),
  };
}

export function buildSatisfactionEmail(): { subject: string; body: string } {
  const lines = [
    'Bonjour,',
    '',
    "Merci d'avoir choisi La Maison. Nous espérons que vous avez passé un excellent moment.",
    '',
    'Votre avis nous aiderait beaucoup.',
  ];
  if (LA_MAISON_SURVEY_URL) {
    lines.push('', `Vous pouvez répondre ici : ${LA_MAISON_SURVEY_URL}`);
  }
  lines.push('', 'À très bientôt,', 'La Maison');
  return {
    subject: 'Votre avis nous intéresse - La Maison',
    body: lines.join('\n'),
  };
}
