import os
import sys
import json
import asyncio
import paramiko
from scp import SCPClient
import psycopg
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

class SCPManager:
    def __init__(self):
        self.host = os.getenv("SCP_HOST")
        print(self.host)
        self.port = int(os.getenv("SCP_PORT", 22))
        print(self.port)
        self.user = os.getenv("SCP_USER")
        print(self.user)
        self.password = os.getenv("SCP_PASS")
        print(self.password)

    def transfer_audio(self, local_path, remote_dir, remote_filename):
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(self.host, port=self.port, username=self.user, password=self.password)

            # Recursive mkdir via SSH command (paramiko doesn't do recursive mkdir natively easily)
            stdin, stdout, stderr = ssh.exec_command(f"mkdir -p {remote_dir}")
            stdout.channel.recv_exit_status() # Wait for command to finish

            print(f"Uploading {local_path} to {remote_dir}/{remote_filename}...")
            
            with SCPClient(ssh.get_transport()) as scp:
                scp.put(local_path, remote_path=f"{remote_dir}/{remote_filename}")
            
            print("Upload successful")
            ssh.close()
            return True
        except Exception as e:
            print(f"Transfer failed: {e}", file=sys.stderr)
            return False

class PGManager:
    def __init__(self):
        self.conn = None

    def connect(self):
        self.conn = psycopg.connect(
            user=os.getenv("PG_USER"),
            password=os.getenv("PG_PASS"),
            host=os.getenv("PG_HOST"),
            dbname=os.getenv("PG_DB")
        )
        print("Connected to DB")

    def disconnect(self):
        if self.conn:
            self.conn.close()
            print("Disconnected from DB")

    def insert_audio_record(self, file_ext, remote_path, timestamp_ms):
        try:
            cur = self.conn.cursor()
            query = """
                INSERT INTO public.audios (file_ext, path, sampling_rate, creation_time) 
                VALUES (%s, %s, %s, %s) 
                RETURNING audio_id;
            """
            # Convert timestamp ms to datetime
            dt = datetime.fromtimestamp(timestamp_ms / 1000.0)
            
            cur.execute(query, (file_ext, remote_path, 20000, dt))
            new_id = cur.fetchone()[0]
            self.conn.commit()
            cur.close()
            print(f"Inserted Audio Record. ID: {new_id}")
            return new_id
        except Exception as e:
            print(f"Failed to insert audio record: {e}", file=sys.stderr)
            self.conn.rollback()
            return None

    def ensure_user_exists(self, discord_id, username, timestamp_ms):
        try:
            cur = self.conn.cursor()
            query = """
                INSERT INTO public.users (discord_id, created_at, discord_display_name) 
                VALUES (%s, %s, %s) 
                ON CONFLICT (discord_id) DO NOTHING;
            """
            dt = datetime.fromtimestamp(timestamp_ms / 1000.0)
            cur.execute(query, (discord_id, dt, username))
            self.conn.commit()
            cur.close()
        except Exception as e:
            print(f"Failed to ensure user {username} exists: {e}", file=sys.stderr)
            self.conn.rollback()

    def grant_user_access(self, discord_id, audio_id):
        try:
            cur = self.conn.cursor()
            query = """
                INSERT INTO public.media_access (discord_id, audio_id) 
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING;
            """
            cur.execute(query, (discord_id, audio_id))
            self.conn.commit()
            cur.close()
        except Exception as e:
            print(f"Failed to grant access for user {discord_id}: {e}", file=sys.stderr)
            self.conn.rollback()

class RecordingSessionManager:
    def __init__(self):
        self.db = PGManager()
        self.scp = SCPManager()

    def end_session(self, local_wav_path, remote_dir, remote_filename, guild_data_json):
        data = json.loads(guild_data_json)
        timestamp = int(data['timestamp'])
        remote_full_path = f"{remote_dir}/{remote_filename}"

        # 1. Upload
        success = self.scp.transfer_audio(local_wav_path, remote_dir, remote_filename)

        if success:
            # 2. Database
            try:
                self.db.connect()
                audio_id = self.db.insert_audio_record('mka', remote_full_path, timestamp)
                
                if audio_id:
                    for user in data['users']:
                        self.db.ensure_user_exists(user['id'], user['username'], timestamp)
                        self.db.grant_user_access(user['id'], audio_id)
            finally:
                self.db.disconnect()
        else:
            print("Skipping DB operations due to upload failure.")

if __name__ == "__main__":
    # Command Line Arguments: [script, local_path, remote_dir, remote_fname, json_data]
    if len(sys.argv) < 5:
        print("Invalid arguments")
        sys.exit(1)

    manager = RecordingSessionManager()
    manager.end_session(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])