FROM golang:latest as builder
RUN apt-get update && apt install -y git make vim hugo
RUN mkdir -p /opt/website
RUN git clone https://github.com/Skarlso/gergelybrautigam /opt/website
WORKDIR /opt/website
RUN make

FROM nginx:latest
RUN mkdir -p /var/www/html/gergelybrautigam
WORKDIR /var/www/html/gergelybrautigam
COPY --from=builder /opt/website/public .
COPY 01_gergelybrautigam /etc/nginx/sites-available/
RUN mkdir -p /etc/nginx/sites-enabled/
RUN ln -s /etc/nginx/sites-available/01_gergelybrautigam /etc/nginx/sites-enabled/01_gergelybrautigam

