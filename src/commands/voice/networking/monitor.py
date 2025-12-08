import sys
import pyshark
import json

def start_monitoring(interface, local_port):
    bpf_filter = f'udp port {local_port}'
    
    # Send initial status
    print(json.dumps({ "status": "started", "port": local_port, "msg": "Pyshark monitor running..." }))
    sys.stdout.flush()

    # Capture with RTP decoding forced
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
                seq_raw = getattr(rtp, 'seq', 0)
                
                if not ssrc:
                    continue
                
                # Convert seq to int
                seq = int(seq_raw)

                if ssrc not in stats:
                    # Initialize with the first sequence number we see
                    stats[ssrc] = {
                        'highest_seq': seq, 
                        'packets': 0, 
                        'loss_cumulative': 0
                    }
                
                user = stats[ssrc]
                user['packets'] += 1

                # --- IMPROVED LOGIC START ---

                # 1. Handle Reordering (The "3gfast" Fix)
                # If the packet we just got is OLDER than the highest one we've seen,
                # it's just out-of-order. Ignore it (don't count as loss).
                if seq <= user['highest_seq']:
                    # Handle sequence number wrapping (65535 -> 0)
                    # If highest is 65000 and we see 10, that's NEW, not old.
                    wrap_diff = (user['highest_seq'] - seq)
                    if wrap_diff < 30000:
                        # It really is an old packet (e.g. we have 100, we got 99)
                        continue

                # 2. Calculate the gap to the highest seen
                # (seq - highest) should be 1. If it's more, we skipped packets.
                diff = (seq - user['highest_seq']) & 0xFFFF 
                
                if diff > 1:
                    loss_event = diff - 1
                    
                    # 3. Handle Large Loss (The "LTE" Fix)
                    # We increased the threshold from 50 to 3000. 
                    # This allows detecting massive drops (common in 50% loss scenarios)
                    # while still ignoring huge jumps caused by stream resets.
                    if loss_event < 3000:
                        user['loss_cumulative'] += loss_event
                        
                        print(json.dumps({
                            "type": "loss", 
                            "ssrc": ssrc, 
                            "lost": loss_event,
                            "seq_now": seq,
                            "seq_prev": user['highest_seq']
                        }))
                        sys.stdout.flush()
                
                # Update highest sequence seen
                user['highest_seq'] = seq

                # --- IMPROVED LOGIC END ---

                # Periodic Heartbeat
                if user['packets'] % 100 == 0:
                    print(json.dumps({
                        "type": "stats",
                        "ssrc": ssrc,
                        "total_received": user['packets'],
                        "total_loss": user['loss_cumulative']
                    }))
                    sys.stdout.flush()

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