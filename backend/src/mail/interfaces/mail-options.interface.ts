export interface MailOptions {
  to: string;
  subject: string;
  /** HTML body. Omitted by messages that are sent as plain text only. */
  html?: string;
  /** Plain text alternative, sent alongside every HTML body. */
  text?: string;
}
