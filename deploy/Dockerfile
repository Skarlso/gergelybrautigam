FROM golang:latest as builder
RUN apt-get update && apt install -y git make vim hugo
RUN mkdir -p /opt/website
RUN git clone https://github.com/Skarlso/gergelybrautigam /opt/website
WORKDIR /opt/website
RUN make

FROM ubuntu:18.04
RUN apt update && apt install -y nginx vim
RUN mkdir -p /var/www/html/gergelybrautigam
WORKDIR /var/www/html/gergelybrautigam
COPY --from=builder /opt/website/public .
COPY 01_gergelybrautigam /etc/nginx/sites-available/
COPY nginx.conf /etc/nginx/
RUN mkdir -p /etc/nginx/sites-enabled/
RUN rm -fr /etc/nginx/sites-enabled/default
EXPOSE 9090
RUN ln -s /etc/nginx/sites-available/01_gergelybrautigam /etc/nginx/sites-enabled/01_gergelybrautigam
CMD ["nginx", "-g", "daemon off;"]
