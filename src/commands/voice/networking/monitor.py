import sys
import pyshark
import json

def start_monitoring(interface, local_port):
    # Filter for UDP traffic on the specific port used by the Discord voice connection
    # 'udp port X' captures both incoming (audio) and outgoing (voice) on that port
    bpf_filter = f'udp port {local_port}'
    
    print(f"{{ \"status\": \"started\", \"port\": {local_port}, \"msg\": \"Pyshark monitor running...\" }}")
    sys.stdout.flush()

    # LiveCapture sniffs the network interface
    # We use a display_filter to ensure we only get RTP packets to avoid crashing on random UDP noise
    capture = pyshark.LiveCapture(
        interface=interface, 
        bpf_filter=bpf_filter,
        display_filter='rtp' 
    )

    stats = {}

    try:
        for packet in capture.sniff_continuously():
            print(json.dumps({"type": "debug", "msg": "Packet received!"}))
            sys.stdout.flush()
            try:
                # Pyshark parses the RTP layer automatically
                rtp = packet.rtp
                ssrc = getattr(rtp, 'ssrc', None)
                seq = int(getattr(rtp, 'seq', 0))
                
                if not ssrc:
                    continue

                if ssrc not in stats:
                    stats[ssrc] = {'last_seq': seq, 'packets': 0, 'loss': 0}

                # Simple Loss Logic
                last_seq = stats[ssrc]['last_seq']
                diff = (seq - last_seq) & 0xFFFF # Handle 16-bit wrap-around
                
                if diff > 1:
                    loss_event = diff - 1
                    # Ignore huge jumps (often just stream starts/resets)
                    if loss_event < 50:
                        stats[ssrc]['loss'] += loss_event
                        # Send JSON log to TypeScript bot
                        print(json.dumps({
                            "type": "loss", 
                            "ssrc": ssrc, 
                            "lost": loss_event,
                            "seq": seq
                        }))
                        sys.stdout.flush()

                stats[ssrc]['last_seq'] = seq
                stats[ssrc]['packets'] += 1

                # Periodic heartbeat (every ~50 packets) to show it's alive
                if stats[ssrc]['packets'] % 50 == 0:
                    print(json.dumps({
                        "type": "stats",
                        "ssrc": ssrc,
                        "total": stats[ssrc]['packets'],
                        "total_loss": stats[ssrc]['loss']
                    }))
                    sys.stdout.flush()

            except Exception as e:
                # Silently ignore bad packets to keep stream alive
                pass

    except KeyboardInterrupt:
        sys.exit(0)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python monitor.py <local_port> [interface]")
        sys.exit(1)
    
    port = sys.argv[1]
    # Default to 'any' (Linux) or 'Ethernet' (Windows) if not specified
    iface = sys.argv[2] if len(sys.argv) > 2 else 'any' 
    
    start_monitoring(iface, port)