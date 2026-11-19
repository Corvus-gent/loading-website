export type FeedbackQuestion = {
  id: string;
  section?: string;
  label: string;
  type: 'thumbs' | 'text';
  description?: string;
  placeholder?: string;
};
export type FeedbackForm = {
  slug: string;
  title: string;
  emailSubject: string;
  subtitle?: string;
  introHtml: string;
  minutes?: number;
  sections: { id: string; title: string }[];
  questions: FeedbackQuestion[];
};
