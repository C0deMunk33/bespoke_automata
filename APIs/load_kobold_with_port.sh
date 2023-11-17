#!/bin/bash

# Sudo warning
if [ "$EUID" -ne 0 ]; then
    echo "WARNING: This script requires sudo privileges."
    echo "Please run this script with sudo or as the root user."
    exit 1
fi

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 /path/to/second/script.sh PORT"
    exit 1
fi

SECOND_SCRIPT_PATH="$1"
PORT="$2"

# Ensure the provided port is a number
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
    echo "Error: The provided port is not a valid number."
    exit 1
fi

# Check if ufw is installed; if not, install it
if ! command -v ufw &> /dev/null; then
    apt-get update
    apt-get install -y ufw
fi

# Enable ufw if it's not already enabled
if ! ufw status | grep -q "Status: active"; then
    ufw enable
fi

# Ensure the provided script is executable
if [ ! -x "$SECOND_SCRIPT_PATH" ]; then
    chmod +x "$SECOND_SCRIPT_PATH"
fi

# Get the primary network interface
INTERFACE=$(ip route | grep default | awk '{print $5}')

# Obtain the IP address of the primary network interface
PRIVATE_IP=$(ip -o -f inet addr show $INTERFACE | awk '{print $4}' | cut -d/ -f1)

# Allow and forward traffic between 127.0.0.1:PORT and PRIVATE_IP:PORT
ufw allow proto tcp from 127.0.0.1 to $PRIVATE_IP port $PORT
iptables -t nat -A PREROUTING -p tcp --dport $PORT -j DNAT --to-destination $PRIVATE_IP:$PORT
iptables -t nat -A POSTROUTING -j MASQUERADE

# Enable job control
set -m

# Run the provided script in the background
"$SECOND_SCRIPT_PATH" &

# Wait for all background processes to complete
wait

# After all processes complete, remove forwarding and deny traffic on the port
ufw delete allow proto tcp from 127.0.0.1 to $PRIVATE_IP port $PORT
iptables -t nat -D PREROUTING -p tcp --dport $PORT -j DNAT --to-destination $PRIVATE_IP:$PORT
iptables -t nat -D POSTROUTING -j MASQUERADE





# sudo ./main_script.sh /path/to/your/second/script.sh 8080
