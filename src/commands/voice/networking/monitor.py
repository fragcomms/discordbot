import sys
import pyshark
import json

def start_monitoring(interface, local_port):
    bpf_filter = f'udp port {local_port}'
    
    print(json.dumps({ "status": "started", "port": local_port, "msg": "Pyshark monitor running..." }))
    sys.stdout.flush()

    # Force decode as RTP
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
                
                if not ssrc:
                    continue

                if ssrc not in stats:
                    # Initialize user stats
                    stats[ssrc] = {
                        'highest_seq': seq, 
                        'packets': 0, 
                        'loss_count': 0,
                        'window': set() # Store recently seen packets to handle out-of-order
                    }
                
                user = stats[ssrc]
                user['packets'] += 1

                # 1. Handle Duplicate / Old Packets
                if seq <= user['highest_seq']:
                    # If packet is very old (sequence wrapped or huge lag), ignore
                    # If it's just a bit old, it's an out-of-order packet we already counted as "lost"
                    # We could technically decrement loss count here, but for simple monitoring, we just ignore it.
                    continue

                # 2. Calculate Gap
                diff = (seq - user['highest_seq']) & 0xFFFF
                
                # 3. Detect Loss
                # If diff is 1, it's the perfect next packet.
                # If diff > 1, we missed (diff - 1) packets.
                if diff > 1:
                    gap = diff - 1
                    
                    # Logic: If gap is massive (> 1000), it's likely a stream reset/new talk burst, not loss.
                    # If gap is moderate (e.g. 50% loss on LTE), we count it.
                    if gap < 3000: 
                        user['loss_count'] += gap
                        print(json.dumps({
                            "type": "loss", 
                            "ssrc": ssrc, 
                            "lost": gap,
                            "seq_now": seq,
                            "seq_prev": user['highest_seq']
                        }))
                        sys.stdout.flush()
                
                user['highest_seq'] = seq

                # Periodic Stats (Every 50 packets received)
                if user['packets'] % 50 == 0:
                    print(json.dumps({
                        "type": "stats",
                        "ssrc": ssrc,
                        "total_received": user['packets'],
                        "total_loss": user['loss_count']
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