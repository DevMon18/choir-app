export interface WaiverContent {
  headerNote?: string;
  clause1Title?: string;
  clause1Text?: string;
  clause2Title?: string;
  clause2Text?: string;
  clause3Title?: string;
  clause3Text?: string;
  clause4Title?: string;
  clause4Text?: string;
  clause5Title?: string;
  clause5Text?: string;
  specialInstructions?: string;
  sourceDocumentId?: string;
}

export const DEFAULT_WAIVER_CONTENT: WaiverContent = {
  headerNote: '(I acknowledge that I have read the accompanying letter detailing the schedule, venue, and purpose of this choir activity.)',
  clause1Title: '1. Consent & Assumption of Risk',
  clause1Text: "I consent to my/my child's participation in this activity. I voluntarily assume all risks associated with the travel, rehearsals, performances, and team-building exercises described in the activity letter.",
  clause2Title: '2. Release of Liability',
  clause2Text: 'I hold harmless and release the Choir, its directors, and volunteers from any claims, liability, or damages related to personal injury or property loss during this event.',
  clause3Title: '3. Medical Authorization',
  clause3Text: 'I confirm the participant is fit to attend. In an emergency, I authorize the Choir Officers to secure medical treatment for the participant at my expense.',
  clause4Title: '4. Media & Audio Release',
  clause4Text: 'I grant permission for the Choir to record audio, video, and photographs of the participant during rehearsals and performances for use in the choir app, archives, and promotional materials without compensation.',
  clause5Title: '5. Code of Conduct',
  clause5Text: "Participants must uphold the choir's rules and values. Disruptive behavior may result in immediate dismissal, requiring the parent/guardian to arrange and pay for transportation home.",
  specialInstructions: '',
};
