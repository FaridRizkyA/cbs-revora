# Official Playwright image already ships Chromium and its system dependencies.
# Keep the tag in sync with the "playwright" version in package.json.
FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

COPY package*.json ./
# Browsers are preinstalled in the base image; skip the download.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# No package-lock.json is committed (it is gitignored), so npm ci cannot be used.
RUN npm install --omit=dev

COPY . .

# Running as root inside the container, so Chromium needs --no-sandbox.
ENV CHROMIUM_NO_SANDBOX=true
ENV NODE_ENV=production

CMD ["node", "index.js"]