run toxiproxy-server
socat TCP-LISTEN:7000,reuseaddr,fork OPENSSL:rpc.ibp.network:443,verify=0
toxiproxy-cli create substrate-ws --listen 127.0.0.1:9999 --upstream 127.0.0.1:7000
toxiproxy-cli toggle substrate-ws # disconnect

Freeze downstream
toxiproxy-cli toxic add substrate-ws -t bandwidth -a rate=0 -d -n freeze

Freeze both
toxiproxy-cli toxic add substrate-ws -t bandwidth -a rate=0 -n freeze

Restore
toxiproxy-cli toxic remove substrate-ws -n freeze