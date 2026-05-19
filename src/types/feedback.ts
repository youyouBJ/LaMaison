export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export interface FeedbackSurveyFormState {
  ratingOverall: FeedbackRating | null;
  ratingFood: FeedbackRating | null;
  ratingDrinks: FeedbackRating | null;
  ratingService: FeedbackRating | null;
  ratingAmbience: FeedbackRating | null;
  recommended: boolean | null;
  comment: string;
}

export interface FeedbackSurveySubmissionInput {
  token: string;
  ratingOverall: FeedbackRating;
  ratingFood: FeedbackRating | null;
  ratingDrinks: FeedbackRating | null;
  ratingService: FeedbackRating | null;
  ratingAmbience: FeedbackRating | null;
  recommended: boolean | null;
  comment: string | null;
}
