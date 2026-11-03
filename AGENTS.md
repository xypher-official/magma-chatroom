# Project rules
- Authentication presentation changes must preserve the existing account credential format and submission flow; visual updates must not change how existing users sign in.
- Auth-specific interface copy lives in a typed language dictionary alongside the existing translation system so all supported languages have labels.
- Both chat assistants use the shared public MiniCPM Gradio queue adapter through authenticated edge functions; keep API keys out of this flow and preserve explicit third-party privacy consent.
- Public-Space admin actions are proposals only: validate them against the declared tool schema, authorize the admin server-side, and redact tool results before external inference.
- Assistant intensive-use consumption belongs in the authenticated inference function, not the browser, so direct requests cannot bypass the existing pause.
