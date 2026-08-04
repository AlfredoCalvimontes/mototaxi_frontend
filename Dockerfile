# Build the SPA, then serve the static output. Two stages because node and its
# 400 MB of dev dependencies have no business running on the VM: the result is
# a directory of files, and the runtime only needs something to hand them over.
#
# The API is not reached from here. Caddy in the backend stack terminates TLS,
# routes /api/* to the api container and everything else to this one, so the
# browser sees a single origin — which is what keeps the httpOnly auth cookies
# first-party. See src/api/client.ts.

FROM node:22-alpine AS build

WORKDIR /app

# package*.json first: this layer only rebuilds when dependencies change, which
# is the difference between a 20 s deploy and a 3 min one on a burst vCPU.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_API_BASE_URL is baked in at build time — Vite inlines import.meta.env
# into the bundle, so this cannot be changed by an environment variable on the
# running container. The default is same-origin and should stay that way.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# `npm run build` runs `tsc --noEmit && vite build`: a type error fails the
# image instead of shipping a bundle nobody type-checked.
RUN npm run build


FROM caddy:2.8-alpine AS runtime

COPY --from=build /app/dist /srv

# Serves on plain HTTP inside the compose network only. TLS, HSTS and the
# security headers are the edge proxy's job; doing them twice means two places
# to fix when one is wrong.
COPY <<'CADDY' /etc/caddy/Caddyfile
{
	admin off
	auto_https off
}

:80 {
	root * /srv

	encode zstd gzip

	# Assets are handled before the SPA fallback, and deliberately without it.
	# A missing /assets/*.js must 404: falling back to index.html would answer
	# a script request with HTML, which the browser reports as a MIME type
	# error and not as the missing file it actually is.
	#
	# They are also immutable — Vite renames the file whenever the contents
	# change, so a year-long cache can never serve a stale one.
	@assets path /assets/*
	handle @assets {
		header Cache-Control "public, max-age=31536000, immutable"
		file_server
	}

	handle {
		# index.html is the one file that must not be cached — it points at
		# the current asset hashes, so a cached copy pins the browser to a
		# deploy that no longer exists.
		header Cache-Control "no-cache"

		# React Router owns the rest of the URL space. Any path that is not a
		# real file is a client route, so it gets index.html.
		try_files {path} /index.html
		file_server
	}
}
CADDY

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
