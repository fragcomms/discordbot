import sys
import pyshark
import json
import time

def start_monitoring(interface, local_port):
    bpf_filter = f'udp port {local_port}'
    
    print(json.dumps({ "status": "started", "port": local_port, "msg": "Pyshark monitor running (VERBOSE MODE)..." }))
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
                rtp_time = int(getattr(rtp, 'timestamp', 0)) 
                
                # Use Kernel Timestamp
                arrival_time_ms = float(packet.sniff_timestamp) * 1000 
                
                if not ssrc:
                    continue

                if ssrc not in stats:
                    stats[ssrc] = {
                        'highest_seq': seq, 
                        'last_arrival_time': arrival_time_ms,
                        'last_rtp_time': rtp_time,
                    }
                
                user = stats[ssrc]
                
                # --- CALCULATIONS ---
                wall_diff = arrival_time_ms - user['last_arrival_time']
                
                rtp_diff = (rtp_time - user['last_rtp_time'])
                if rtp_diff < -2147483648: rtp_diff += 4294967296 
                
                audio_diff_ms = (rtp_diff / 48000) * 1000

                # --- SILENCE DETECTION ---
                if audio_diff_ms > 80:
                    print(json.dumps({
                        "type": "debug", 
                        "ssrc": ssrc,   # 👈 ADDED SSRC HERE
                        "msg": "Silence gap detected (Resetting Jitter)",
                        "gap_ms": int(audio_diff_ms)
                    }))
                    sys.stdout.flush()
                    user['last_arrival_time'] = arrival_time_ms
                    user['last_rtp_time'] = rtp_time
                    user['highest_seq'] = seq
                    continue

                # --- JITTER CALCULATION ---
                jitter = wall_diff - audio_diff_ms

                # 👇 VERBOSE LOGGING: Print EVERY packet's stats
                print(json.dumps({
                    "type": "jitter_debug", 
                    "ssrc": ssrc,       # 👈 ADDED SSRC HERE
                    "seq": seq,
                    "wall_diff": round(wall_diff, 2),
                    "audio_diff": round(audio_diff_ms, 2),
                    "jitter": round(jitter, 2)
                }))
                sys.stdout.flush()

                # Update trackers
                user['last_arrival_time'] = arrival_time_ms
                user['last_rtp_time'] = rtp_time

                # --- PACKET LOSS ---
                if seq > user['highest_seq']:
                    diff = (seq - user['highest_seq']) & 0xFFFF 
                    if diff > 1:
                        loss_event = diff - 1
                        if loss_event < 3000:
                            print(json.dumps({
                                "type": "loss", 
                                "ssrc": ssrc, 
                                "lost": loss_event
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