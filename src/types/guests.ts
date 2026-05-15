export type GuestSortOption =
  | 'last_visit_desc'
  | 'created_at_desc'
  | 'visit_count_desc'
  | 'avg_rating_desc'
  | 'name_asc';

export type GuestFilterState = {
  vipOnly: boolean;
  withPhoneOnly: boolean;
  withEmailOnly: boolean;
  withRatingOnly: boolean;
  reengagementOnly: boolean;
  positiveFeedbackOnly: boolean;
  negativeFeedbackOnly: boolean;
  upcomingReservationOnly: boolean;
};

export const DEFAULT_SORT: GuestSortOption = 'last_visit_desc';

export const DEFAULT_FILTERS: GuestFilterState = {
  vipOnly: false,
  withPhoneOnly: false,
  withEmailOnly: false,
  withRatingOnly: false,
  reengagementOnly: false,
  positiveFeedbackOnly: false,
  negativeFeedbackOnly: false,
  upcomingReservationOnly: false,
};
