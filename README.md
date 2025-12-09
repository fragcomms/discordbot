# Discord Bot + UDP Packet Monitor
**Project by: Sean Lai and Aaron Ba (CPE 400 Fall 2025 UNR)**

## Project Description
This project consists of a Discord bot that recieves UDP packets meant for recording voice data meant for FragComms. These packets are not only processed but also monitored for debugging purposes, specifically for monitoring packet loss and latency. The bot can be interacted with through Discord commands to start and stop monitoring, as well as to retrieve statistics about the received packets.

## Setup Instructions
1. Add the Discord Bot to a server you manage through this invite link: 
2. Install the dependencies by running the following commands in your terminal:
`npm install` and `pip install requirements.txt`
3. Start up the discord bot by running:
`npm run dev`
4. Utilize the bot through Discord commands to start and stop monitoring, as well as to retrieve statistics about the received packets. Refer to the bot command list below for more details.
5. Now watch the command line to see the UDP packets being monitored in real-time!
6. You can create a mock packet loss through the throttle which can be found in the throttle guide below.

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
To simulate network conditions such as packet loss and latency, you will need to install the package `npm install @sitespeed.io/throttle -g`. Make sure you have `ip` and `tc` installed on your system as well for Linux. Any additional setup instructions can be found in the [throttle documentation](https://github.com/sitespeedio/throttle).

### Usage:
To simulate packet loss and latency, you can use the following command in your terminal to simulate 20% packet loss with a profile of 3fast:
```bash
throttle --profile 3fast --packetLoss 20
```
This will affect all UDP packets on your system. You can adjust the `--packetLoss` value to simulate different levels of packet loss as needed for testing. Otherwise other network profiles can be found in the [throttle documentation](https://github.com/sitespeedio/throttle) for speeds such as lte, 3g, 4g, etc.

## Technical Report
### Functionality of the Protocol
The protocol implemented in this project is designed to handle UDP packets that contain voice data for FragComms. The bot listens for incoming UDP packets on a specified port and processes them to extract relevant information such as sequence numbers and timestamps. This information is then used to mainly monitor jitter and latency, with packet loss added but is not testable as the Discord infrastructure would have to be failing, providing valuable insights into the quality of the voice communication.

### Possible Scenarios Handled
1. **Different Network Qualities**: Tested with different network qualities and the jitter is consistently monitored and recorded with high accuracy.
2. **Discord Packet Fillers**: Discord servers send us packets that are always in sequence meaning packet loss can't be identified through sequence numbers. Which is why if the Discord servers were to fail then our packet loss would be able to detect it then.
3. **Multiple Users**: Can handle recording requests for multiple users in a voice channel, so the audio will come back with multiple channels depending on the number of users. For every packet being printed to console, different users can be identified by the different SSRC number.
4. **Silence Gaps:** The code checks for gaps in where there is silence in the voice data and handles them appropriately. This is done by calculating the audio time gap being greater than 80ms and then reseting the jitter base baseline if it is so.
5. **Non-RTP Packets:** Any packets that aren't RDP will be ignored, allowing for no interference from other packets being sent across the same socket when monitoring RTP packets.
6. **Threshold-Based Alerts:**  

### Resuslts and Analysis
The bot successfully monitors UDP packets and provides real-time statistics on jittering and latency. 
