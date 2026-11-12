# Pocket interview editor

Open `/hack/3/add`. Use the same password as `/compound/v2/stats` (`COMPOUND_V2_ADMIN_PASSWORD`, falling back to `COMPOUND_ADMIN_PASSWORD`). An existing stats login works here too. `BLOB_READ_WRITE_TOKEN` enables optional photos; text-only publishing works without it. No new dashboard setup is required.

Enter builder, robot/project, description and confirm the builder's permission. Handles, clip and photo are optional. Saving creates one interview and the next unused `x-gm-en-intN` registry row in a single Redis operation. Double submissions reuse the same request ID. Empty clips stay explicitly pending; social metrics require a real post URL. Add the post URL later in the video tracker, and the clip later here. Editing never resets metrics/votes. Delete removes the interview and its matching video row; aggregate vote counters are retained.

Published interviews update `/hack/3` and the stream-mode robots teaser on `/hack` within 30 seconds. Photo uploads are resized before transfer, decoded/re-encoded on the server and stripped of embedded metadata. Public photos use the existing Blob store. Records expire after 90 days; photo deletion is retried by the daily snapshot job and public reads. Never upload someone who has not agreed to publication.

Each interview keeps `/hack/3#int-N`. Share drafts use `/hack/3?interview=N#int-N`: URL fragments are not sent to servers, so the query selects the individual Open Graph title/card. Share buttons only open drafts; they do not post automatically. X uses the requested source/medium/interview slug, WhatsApp copies the builder's link, and LinkedIn uses the interview-specific preview.

`node tests/interview-quick-add.mjs` checks the shared login, validation, CSRF, concurrent numbering, retry safety, edits/deletion with preserved counts, photo encoding/cleanup, OG cards and the mobile/desktop flow against local Redis. Screenshots are in ignored `test-results/interviews/`.
