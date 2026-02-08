#!/bin/bash
# Generate self-signed SSL certificate for development

CERT_DIR="./ssl"
mkdir -p "$CERT_DIR"

echo "Generating self-signed SSL certificate for development..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/nginx-selfsigned.key" \
  -out "$CERT_DIR/nginx-selfsigned.crt" \
  -subj "/C=US/ST=State/L=City/O=SecondBrain/CN=localhost"

echo "✅ SSL certificate generated at $CERT_DIR"
echo "   - Certificate: nginx-selfsigned.crt"
echo "   - Key: nginx-selfsigned.key"
