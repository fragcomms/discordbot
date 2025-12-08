import sys
import pyshark
import json

def start_monitoring(interface, local_port):
    # Filter for UDP traffic on the specific port
    bpf_filter = f'udp port {local_port}'
    
    print(f"{{ \"status\": \"started\", \"port\": {local_port}, \"msg\": \"Pyshark monitor running...\" }}")
    sys.stdout.flush()

    # 1. REMOVED display_filter='rtp' (It was filtering out unrecognized packets)
    # 2. ADDED decode_as (Forces TShark to interpret this port's UDP as RTP)
    capture = pyshark.LiveCapture(
        interface=interface, 
        bpf_filter=bpf_filter,
        decode_as={f'udp.port=={local_port}': 'rtp'} 
    )

    stats = {}

    try:
        for packet in capture.sniff_continuously():
            # Debug print to confirm raw packets are hitting the script
            # print(json.dumps({"type": "debug", "msg": f"Packet received! Layers: {packet.layers}"}))
            # sys.stdout.flush()

            try:
                # If decode_as works, 'packet.rtp' will now exist
                if not hasattr(packet, 'rtp'):
                    continue

                rtp = packet.rtp
                ssrc = getattr(rtp, 'ssrc', None)
                seq_raw = getattr(rtp, 'seq', 0)
                
                # Convert to int (TShark sometimes returns strings)
                seq = int(seq_raw)
                
                if not ssrc:
                    continue

                if ssrc not in stats:
                    stats[ssrc] = {'last_seq': seq, 'packets': 0, 'loss': 0}

                # Simple Loss Logic
                last_seq = stats[ssrc]['last_seq']
                diff = (seq - last_seq) & 0xFFFF 
                
                if diff > 1:
                    loss_event = diff - 1
                    if loss_event < 50:
                        stats[ssrc]['loss'] += loss_event
                        print(json.dumps({
                            "type": "loss", 
                            "ssrc": ssrc, 
                            "lost": loss_event,
                            "seq": seq
                        }))
                        sys.stdout.flush()

                stats[ssrc]['last_seq'] = seq
                stats[ssrc]['packets'] += 1

                if stats[ssrc]['packets'] % 50 == 0:
                    print(json.dumps({
                        "type": "stats",
                        "ssrc": ssrc,
                        "total": stats[ssrc]['packets'],
                        "total_loss": stats[ssrc]['loss']
                    }))
                    sys.stdout.flush()

            except Exception as e:
                # Only print actual errors, ignore expected parsing issues
                # print(f"Error processing packet: {e}")
                pass

    except KeyboardInterrupt:
        sys.exit(0)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python monitor.py <local_port> [interface]")
        sys.exit(1)
    
    port = sys.argv[1]
    iface = sys.argv[2] if len(sys.argv) > 2 else 'any' 
    
    start_monitoring(iface, port)