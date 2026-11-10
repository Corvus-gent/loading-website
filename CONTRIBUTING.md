# Build with Corvus

Start with the README and ROUTES.md. Keep pages small, readable on a phone and
connected to a next step. Use the existing black/gold style and shared navigation.
Brand partner pages should respect the partner's own identity.

Work on a feature branch, preserve other builders' work, and open a pull request.
Do not push directly to main or merge without the owner's approval. Run the build
before pushing. For API changes, test malformed input, unauthorized access,
concurrent requests and dependency failure—not only the happy path.

Keep keys in environment variables. Never include private emails in public
responses, screenshots or fixtures. Use disposable local Redis namespaces and
mock paid services during tests. Do not change spending limits as a workaround.

Be honest about provenance and readiness: identify model-generated pages, preserve
receipts, distinguish fixtures from real outputs, and mark unfinished features.
Social posts are drafts for Gabe to publish himself.
