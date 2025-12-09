import sys
import pyshark
import json
import time
from collections import deque

# Jitter thresholds
JITTER_WARNING_THRESHOLD = 30.0  # ms
JITTER_CRITICAL_THRESHOLD = 50.0  # ms
JITTER_WINDOW_SIZE = 20  # Number of packets to track for moving average

def start_monitoring(interface, local_port):
    bpf_filter = f'udp port {local_port}'
    
    print(json.dumps({ "status": "started", "port": local_port, "msg": "Pyshark monitor running with jitter tracking..." }))
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
                
                arrival_time_ms = float(packet.sniff_timestamp) * 1000 
                
                if not ssrc:
                    continue

                if ssrc not in stats:
                    stats[ssrc] = {
                        'highest_seq': seq, 
                        'last_arrival_time': arrival_time_ms,
                        'last_rtp_time': rtp_time,
                        'jitter_history': deque(maxlen=JITTER_WINDOW_SIZE),
                        'high_jitter_count': 0,
                        'critical_jitter_count': 0,
                        'last_warning_time': 0,
                        'packet_count': 0
                    }
                
                user = stats[ssrc]
                user['packet_count'] += 1
                
                # --- CALCULATIONS ---
                wall_diff = arrival_time_ms - user['last_arrival_time']
                
                rtp_diff = (rtp_time - user['last_rtp_time'])
                if rtp_diff < -2147483648:
                    rtp_diff += 4294967296 
                
                audio_diff_ms = (rtp_diff / 48000) * 1000

                # --- SILENCE DETECTION ---
                if audio_diff_ms > 80:
                    print(json.dumps({
                        "type": "debug", 
                        "ssrc": ssrc,
                        "msg": "Silence gap detected (resetting jitter)",
                        "gap_ms": int(audio_diff_ms)
                    }))
                    sys.stdout.flush()
                    user['last_arrival_time'] = arrival_time_ms
                    user['last_rtp_time'] = rtp_time
                    user['highest_seq'] = seq
                    # Clear jitter history on silence gaps
                    user['jitter_history'].clear()
                    continue

                # --- JITTER CALCULATION ---
                jitter = abs(wall_diff - audio_diff_ms)
                user['jitter_history'].append(jitter)

                # Calculate moving average jitter
                if len(user['jitter_history']) >= 5:
                    avg_jitter = sum(user['jitter_history']) / len(user['jitter_history'])
                    max_jitter = max(user['jitter_history'])
                    
                    current_time = time.time()
                    
                    # Check for consistently high jitter
                    if avg_jitter > JITTER_CRITICAL_THRESHOLD:
                        user['critical_jitter_count'] += 1
                        
                        # Alert every 10 seconds to avoid spam
                        if current_time - user['last_warning_time'] > 10:
                            print(json.dumps({
                                "type": "alert",
                                "severity": "CRITICAL",
                                "ssrc": ssrc,
                                "avg_jitter_ms": round(avg_jitter, 2),
                                "max_jitter_ms": round(max_jitter, 2),
                                "msg": "CRITICAL: Severe network instability detected",
                                "suggestion": "Voice quality severely degraded. Check network connection."
                            }))
                            sys.stdout.flush()
                            user['last_warning_time'] = current_time
                    
                    elif avg_jitter > JITTER_WARNING_THRESHOLD:
                        user['high_jitter_count'] += 1
                        
                        # Alert every 10 seconds to avoid spam
                        if current_time - user['last_warning_time'] > 10:
                            print(json.dumps({
                                "type": "alert",
                                "severity": "WARNING",
                                "ssrc": ssrc,
                                "avg_jitter_ms": round(avg_jitter, 2),
                                "max_jitter_ms": round(max_jitter, 2),
                                "msg": "WARNING: High jitter detected",
                                "suggestion": "Voice quality may be affected. Monitor network conditions."
                            }))
                            sys.stdout.flush()
                            user['last_warning_time'] = current_time
                    else:
                        # Reset counters if jitter returns to normal
                        if user['high_jitter_count'] > 0 or user['critical_jitter_count'] > 0:
                            user['high_jitter_count'] = 0
                            user['critical_jitter_count'] = 0
                            print(json.dumps({
                                "type": "info",
                                "ssrc": ssrc,
                                "avg_jitter_ms": round(avg_jitter, 2),
                                "msg": "Network conditions normalized"
                            }))
                            sys.stdout.flush()

                # Print periodic stats every 100 packets
                if user['packet_count'] % 100 == 0 and len(user['jitter_history']) > 0:
                    avg_jitter = sum(user['jitter_history']) / len(user['jitter_history'])
                    print(json.dumps({
                        "type": "stats",
                        "ssrc": ssrc,
                        "seq": seq,
                        "packets": user['packet_count'],
                        "avg_jitter_ms": round(avg_jitter, 2),
                        "current_jitter_ms": round(jitter, 2)
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
                                "lost": loss_event,
                                "msg": "packet loss",
                                "severity": "HIGH" if loss_event > 5 else "MEDIUM"
                            }))
                            sys.stdout.flush()
                    
                    user['highest_seq'] = seq

            except Exception as e:
                print(json.dumps({
                    "type": "error",
                    "msg": f"Packet processing error: {str(e)}"
                }))
                sys.stdout.flush()

    except KeyboardInterrupt:
        # Print final summary
        print(json.dumps({"type": "shutdown", "msg": "Monitor stopped"}))
        for ssrc, data in stats.items():
            if len(data['jitter_history']) > 0:
                avg_jitter = sum(data['jitter_history']) / len(data['jitter_history'])
                print(json.dumps({
                    "type": "final_stats",
                    "ssrc": ssrc,
                    "total_packets": data['packet_count'],
                    "avg_jitter_ms": round(avg_jitter, 2),
                    "high_jitter_events": data['high_jitter_count'],
                    "critical_jitter_events": data['critical_jitter_count']
                }))
        sys.stdout.flush()
        sys.exit(0)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python monitor.py <local_port> [interface]")
        sys.exit(1)
    
    port = sys.argv[1]
    iface = sys.argv[2] if len(sys.argv) > 2 else 'any' 
    
    start_monitoring(iface, port)