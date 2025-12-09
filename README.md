# Discord Bot + UDP Packet Monitor
**Project by: Sean Lai and Aaron Ba (CPE 400 Fall 2025 UNR)**

## Project Description
This project consists of a Discord bot that recieves UDP packets meant for recording voice data meant for FragComms. These packets are not only processed but also monitored for debugging purposes, specifically for monitoring packet loss and latency. The bot can be interacted with through Discord commands to start and stop monitoring, as well as to retrieve statistics about the received packets.

## Setup Instructions
1. Download the zip file and extract it
    1. Once downloaded, `cd discordbot`.
    2. Install the node dependencies by doing `npm install`.
    3. If you do not have python, install that before continuing.
2. Install the python dependencies by doing `python3 -m venv ./src/commands/voice/networking/.venv`
    1. Then after that, do `./src/commands/voice/networking/.venv/bin/pip3 install -r ./src/commands/voice/networking/requirements.txt`
3. Replace the .env variables `GUILD_ID` and `CHANNEL_ID` with your respective IDs. This is optional.
4. Invite the Discord bot to a test server using this link: [Discord Bot Invite](https://discord.com/oauth2/authorize?client_id=1447798146603290736)
5. Start up the discord bot by running: `npm run dev`
6. Join a voice channel on the Discord server that you invited the bot to.
7. Run `/join` in a text channel that the bot has access to.
8. Run `/record` in a text channel that the bot has access to.
9. Now, talk for about ~5 seconds. You will now see a lot of debug messages on the terminal! Congrats, everything is set up!

## Bot Command List
`/join` - Bot joins the voice channel you are currently in.

`/leave` - Bot leaves the voice channel it is currently in.
`/record` - Initates the record request now start selecting adding the user that will be recorded.

`/stop-recording` - Stops the current recording session.

`/ping` - Replies with pong!

`/user` - Provides information about the user.

## Throttle Guide
This section provides instructions on how to use the `throttle` package to simulate network conditions such as packet loss and latency for testing purposes.
### Dependecies:
To simulate network conditions such as packet loss and latency, you will need to install the package `npm install @sitespeed.io/throttle -g`. Make sure you have `ip` and `tc` installed on your system as well for Linux. Refer to the setup instructions found at the [throttle documentation](https://github.com/sitespeedio/throttle) for an extensive setup guide.

### Usage:
To simulate packet loss and latency, you can use the following command in your terminal to simulate 20% packet loss with a profile of 3fast:
```bash
throttle --profile 3fast --packetLoss 20
```
This will affect all UDP packets on your system. You can adjust the `--packetLoss` value to simulate different levels of packet loss as needed for testing. Otherwise other network profiles can be found in the [throttle documentation](https://github.com/sitespeedio/throttle) for speeds such as lte, 3g, 4g, etc.

## Technical Report
### Functionality of the Protocol
The protocol utilized in this project is RTP (Real-time Transport Protocol) for real-time voice recording in Discord. For the the FragComms bot, we are not only recording the voice data but also monitoring the RTP-over-UDP packets on a designated port. With each packet received, we extract relevant information such as sequence numbers and timestamps to calculate jitter and latency. The bot uses this information to provide real-time statistics on the quality of voice communication, allowing for proactive monitoring and debugging of potential issues if implemented in a larger system.

### Possible Scenarios Handled
1. **Different Network Qualities**: Tested with different network qualities and the jitter is consistently monitored and recorded with high accuracy. With the accuracy of the jitter calculation being affected when packet loss is simulated through the throttle package.
2. **Discord Packet Fillers**: Discord servers send us packets that are always in sequence meaning packet loss can't be identified through sequence numbers. Which is why if the Discord servers were to fail then our packet loss would be able to detect it then.
3. **Multiple Users**: Can handle recording requests for multiple users in a voice channel, so the audio will come back with multiple channels depending on the number of users. For every packet being printed to console, different users can be identified by the different SSRC number.
4. **Silence Gaps:** The code checks for gaps in where there is silence in the voice data and handles them appropriately. This is done by calculating the audio time gap being greater than 80ms and then reseting the jitter base baseline if it is so.
5. **Non-RTP Packets:** Any packets that aren't RDP will be ignored, allowing for no interference from other packets being sent across the same socket when monitoring RTP packets.
6. **Threshold-Based Alerts:** The bot is set to trigger alerts if jitter or latency exceeds predefined thresholds, allowing for proactive monitoring of voice quality.
7. **Real-Time Statistics:** The bot provides real-time statistics on jitter and latency, allowing users to monitor the quality of voice communication as it happens.

### Results and Analysis
When we started this project, our original goal was to detect packet loss by looking at gaps in RTP sequence numbers. Our first few versions were written in TypeScript, and we spent a lot of time trying different ways to simulate bad network conditions using the throttle package. No matter how much throttling we added, our code always showed 0% packet loss. At first, we assumed the packet capture was wrong or that our calculations were off, so we rewrote parts of the code several times and tried different test setups.

Eventually, after a lot of debugging, we realized the real issue wasn’t our code at all—it was how Discord handles voice traffic. Discord always sends packets with perfectly increasing sequence numbers, even when the real network drops some of them. In other words, Discord “fills in the gaps” so clients never see missing packets. This completely broke our original packet loss detection method, because the thing we were looking for (sequence-number gaps) simply never appeared. We also then attempted to do timing-based packet loss detection, but even with tinkering of calcualtions it was still too inaccurate to be named successful.

After understanding this behavior, we shifted our focus to jitter and latency instead. These metrics do change based on real network conditions, and they turned out to be far more meaningful for monitoring overall voice quality. We ended up switching to Python and using PyShark to make packet parsing easier and more reliable. With that setup, we were finally able to get accurate real-time measurements of jitter and latency, and those values changed the way we expected when network quality was altered.

Packet loss is still mentioned in the project, but only in a very limited way. Since Discord keeps sequence numbers perfectly in order, the only time we’d ever see “real” packet loss is if Discord’s own infrastructure were failing—which isn’t something we can realistically test. At best, we can sometimes infer possible loss when jitter calculations become unstable.

Overall, the final version of the bot performs reliably and gives us a clear picture of network jitter and latency for voice communication in FragComms. Even though the early approach turned out to be impossible because of Discord’s internals, that discovery shaped the direction of the project and made the end result stronger.
