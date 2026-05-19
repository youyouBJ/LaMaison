import type { Database } from './database';

type WaitlistRow = Database['public']['Tables']['waitlist']['Row'];
type GuestRow    = Database['public']['Tables']['guests']['Row'];
type ShiftRow    = Database['public']['Tables']['shifts']['Row'];

export type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'left';
export type WaitlistServiceFilter = 'all' | 'lunch' | 'dinner';

// Entrée waitlist avec guest et shift joints (après migration 003).
export type WaitlistEntryWithGuest = WaitlistRow & {
  guests: GuestRow | null;
  shifts: ShiftRow | null;
};

export type CreateWaitlistInput = {
  date:       string;
  partySize:  number;
  shiftId?:   string;
  timeSlot?:  string;  // HH:MM
  guestId?:   string;
  guest?: {
    firstName?: string;
    lastName?:  string;
    phone?:     string;
    email?:     string;
    vip?:       boolean;
    notes?:     string;
  };
  isWalkIn: boolean;
  notes?:   string;
};

export type UpdateWaitlistStatusInput = {
  id:     string;
  status: WaitlistStatus;
};
