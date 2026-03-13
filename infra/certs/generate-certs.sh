#!/usr/bin/env bash
#
# Generate self-signed CA + per-service TLS certificates for ai_cortex services.
# Output: CA cert/key + service cert/key pairs in the same directory as this script.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CA_DAYS=3650       # 10 years
CERT_DAYS=365      # 1 year
SERVICES=("leemadb" "orchestrator" "embedding-proxy")

echo "=== Generating self-signed CA (ECDSA P-256, ${CA_DAYS}d validity) ==="

openssl ecparam -genkey -name prime256v1 -noout -out ca.key 2>/dev/null
openssl req -new -x509 -key ca.key -out ca.crt -days "$CA_DAYS" \
    -subj "/CN=ai-cortex-ca/O=LeemaDB/OU=Internal" \
    -sha256

echo "  CA certificate: $SCRIPT_DIR/ca.crt"
echo "  CA private key:  $SCRIPT_DIR/ca.key"

for SERVICE in "${SERVICES[@]}"; do
    echo ""
    echo "=== Generating certificate for: ${SERVICE} (${CERT_DAYS}d validity) ==="

    # Generate service private key (ECDSA P-256)
    openssl ecparam -genkey -name prime256v1 -noout -out "${SERVICE}.key" 2>/dev/null

    # Create CSR
    openssl req -new -key "${SERVICE}.key" -out "${SERVICE}.csr" \
        -subj "/CN=${SERVICE}/O=LeemaDB/OU=${SERVICE}" \
        -sha256

    # Create SAN extension config
    cat > "${SERVICE}.ext" <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth,clientAuth
subjectAltName=@alt_names

[alt_names]
DNS.1 = ${SERVICE}
DNS.2 = localhost
DNS.3 = ${SERVICE}.sanbao_default
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

    # Sign with CA
    openssl x509 -req -in "${SERVICE}.csr" -CA ca.crt -CAkey ca.key \
        -CAcreateserial -out "${SERVICE}.crt" -days "$CERT_DAYS" \
        -extfile "${SERVICE}.ext" -sha256 2>/dev/null

    # Clean up intermediate files
    rm -f "${SERVICE}.csr" "${SERVICE}.ext"

    echo "  Certificate: $SCRIPT_DIR/${SERVICE}.crt"
    echo "  Private key: $SCRIPT_DIR/${SERVICE}.key"
done

# Clean up CA serial file
rm -f ca.srl

echo ""
echo "=== Done. All certificates generated in: $SCRIPT_DIR ==="
echo ""
echo "Verify a certificate:"
echo "  openssl x509 -in leemadb.crt -text -noout"
echo ""
echo "Verify chain:"
echo "  openssl verify -CAfile ca.crt leemadb.crt"
