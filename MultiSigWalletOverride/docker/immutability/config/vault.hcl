default_lease_ttl = "168h"
disable_mlock = "true"
max_lease_ttl = "720h"

backend "file" {
    path = "/home/root/vault/config/data"
}

ui = "false"

api_addr = "https://localhost:8200"
plugin_directory = "/home/root/vault/plugins"
listener "tcp" {
    address = "0.0.0.0:8200"
    tls_cert_file = "/home/root/vault/config/my-service.crt"
    tls_client_ca_file = "/home/root/vault/config/ca.crt"
    tls_key_file = "/home/root/vault/config/my-service.key"
    tls_require_and_verify_client_cert = "false"
}
