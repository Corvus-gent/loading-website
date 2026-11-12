# Bundled OG fonts

Noto fonts from the Google Fonts repository, SIL Open Font License 1.1 (adjacent LICENSE files). Sources:
- https://github.com/google/fonts/tree/main/ofl/notosans
- https://github.com/google/fonts/tree/main/ofl/notosansarabic
- https://github.com/google/fonts/tree/main/ofl/notosanssc

Variable sources instantiated at regular weight and converted to WOFF for the server renderer. Arabic additionally uses a static TTF with Sharp/Pango for correct joining and right-to-left shaping. The full Chinese character set is retained. No visitor text is sent to a remote font service.

The existing repo's `img/army/fonts/DejaVuSansMono.ttf` supplies the terminal-style numerals and labels.
