# Build context is the REPO ROOT (Railway Root Directory left empty, Dockerfile Path = backend/Dockerfile).
# The backend reads files outside backend/ (email templates and logos), so the container mirrors the repo layout.
# Official Playwright image already ships Chromium and its system dependencies.
# Keep the tag in sync with the "playwright" version in backend/package.json.
FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app/backend

COPY backend/package*.json ./
# Browsers are preinstalled in the base image; skip the download.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# No package-lock.json is committed (it is gitignored), so npm ci cannot be used.
RUN npm install --omit=dev

COPY backend/ ./

# Files the backend loads from outside backend/ (see authController, emailQueue, templateRenderer).
COPY assets/images/ui/logo_horizontal.png assets/images/ui/logo_koperasi_cbs.png /app/assets/images/ui/
COPY components/emails /app/components/emails

# Running as root inside the container, so Chromium needs --no-sandbox.
ENV CHROMIUM_NO_SANDBOX=true
ENV NODE_ENV=production

CMD ["node", "index.js"]