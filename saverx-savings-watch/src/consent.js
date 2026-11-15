// Canonical consent wording, versioned. The server stores THIS text (never client-supplied text),
// so a consent record always reflects what the visitor was actually shown.
//
// DRAFT: wording must be reviewed by counsel before launch (see docs/SAVINGS_WATCH_PLAN.md §6).
// Any wording change = new version key; never edit a published version in place.

export const CONSENT_VERSION = "v1-draft";

export const CONSENT_TEXTS = {
  "v1-draft": {
    transactional:
      "I agree to receive a text message from SaveRx.ai with a link to the savings information I requested. " +
      "Message and data rates may apply. Reply STOP to opt out or HELP for help. " +
      "Consent is not a condition of using SaveRx.ai.",
    watch:
      "Also text me occasional updates about new savings programs for this medication. " +
      "Message frequency varies. Reply STOP anytime to unsubscribe.",
  },
};
