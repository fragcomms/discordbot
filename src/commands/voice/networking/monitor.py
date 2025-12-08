import sys
import pyshark
import json
import time

def start_monitoring(interface, local_port):
    bpf_filter = f'udp port {local_port}'
    
    print(json.dumps({ "status": "started", "port": local_port, "msg": "Pyshark monitor running (Time & Seq Tracking)..." }))
    sys.stdout.flush()

    capture = pyshark.LiveCapture(
        interface=interface, 
        bpf_filter=bpf_filter,
        decode_as={f'udp.port=={local_port}': 'rtp'} 
    )

    stats = {}

    try:
        for packet in capture.sniff_continuously():
            try:
                if not hasattr(packet, 'rtp'):
                    continue

                rtp = packet.rtp
                ssrc = getattr(rtp, 'ssrc', None)
                seq = int(getattr(rtp, 'seq', 0))
                
                # Get current time in milliseconds
                current_time_ms = time.time() * 1000 
                
                if not ssrc:
                    continue

                if ssrc not in stats:
                    stats[ssrc] = {
                        'highest_seq': seq, 
                        'last_arrival_time': current_time_ms,
                        'packets': 0
                    }
                
                user = stats[ssrc]
                
                # --- TIME GAP DETECTION (NEW) ---
                time_diff = current_time_ms - user['last_arrival_time']
                
                # If packet arrived more than 200ms after the previous one
                # (Standard RTP packets come every 20ms)
                if time_diff > 200:
                    print(json.dumps({
                        "type": "latency_spike", 
                        "ssrc": ssrc, 
                        "gap_ms": int(time_diff),
                        "seq_now": seq,
                        "seq_prev": user['highest_seq']
                    }))
                    sys.stdout.flush()

                user['last_arrival_time'] = current_time_ms
                user['packets'] += 1

                # --- SEQUENCE LOSS DETECTION ---
                if seq <= user['highest_seq']:
                     # Handle duplicates/reordering silently
                    pass
                else:
                    diff = (seq - user['highest_seq']) & 0xFFFF 
                    if diff > 1:
                        loss_event = diff - 1
                        if loss_event < 3000:
                            print(json.dumps({
                                "type": "loss", 
                                "ssrc": ssrc, 
                                "lost": loss_event,
                                "seq_now": seq,
                                "seq_prev": user['highest_seq']
                            }))
                            sys.stdout.flush()
                
                user['highest_seq'] = seq

            except Exception:
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