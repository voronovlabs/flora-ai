# Static frontend served by nginx.
# Note: the backend is reached via the upstream reverse proxy (Caddy in prod
# or the docker-compose service in dev). Frontend itself does not proxy.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY src /usr/share/nginx/html/src

EXPOSE 80
