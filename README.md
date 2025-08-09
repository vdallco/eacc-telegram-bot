# EACC Telegram Bot Setup

This guide explains how to set up real-time Telegram notifications for EACC marketplace job events using Alchemy Webhooks and Cloudflare Workers.

## Overview

The system monitors the EACC marketplace contract on Arbitrum One for `JobEvent` emissions and sends formatted notifications to a Telegram group when jobs are Created, Taken, Paid, Completed, etc.

**Architecture:** Alchemy Webhook → Cloudflare Worker → Telegram Bot → Your Group

## Prerequisites

- Alchemy account (free tier works)
- Cloudflare account (free tier works)
- Telegram Bot Token from @BotFather
- Telegram Group Chat ID
- Add Telegram Bot to Group as admin

## Step 1: Create Telegram Bot

1. Message @BotFather on Telegram
2. Send `/newbot` and follow prompts to create your bot
3. Save the **Bot Token** (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
4. Add your bot to your Telegram group
5. Make the bot an admin OR disable privacy mode:
   - Go to @BotFather → `/mybots` → Select your bot → Bot Settings → Group Privacy → Turn Off

## Step 2: Get Group Chat ID

1. Add your bot to the group and make it an admin
2. Send several test messages in the group
3. Wait a few minutes for the messages to be processed
4. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
5. Look for `"chat":{"id":-1001234567890}` - that negative number is your chat ID

**Note:** Group chat IDs are always negative numbers. If you see a positive number, that's a private chat ID.

## Step 3: Deploy Cloudflare Worker

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **Create Application** → **Start with Hello World!**
3. Name your worker (e.g., `eacc-monitor`)
4. Click **Deploy**
5. Click **Edit Code** and replace the default code with the worker code from `cloudflare-worker.js`
6. Click **Save and Deploy**

### Environment Variables

1. Go to your worker's **Settings** → **Variables**
2. Add these environment variables:
   - `TELEGRAM_BOT_TOKEN`: (as Secret) Your bot token from Step 1
   - `TELEGRAM_CHAT_ID`: (as Text) Your group chat ID from Step 2

Your worker URL will be: `https://eacc-monitor.your-subdomain.workers.dev`

## Step 4: Set Up Alchemy Webhook

1. Create a free account at [alchemy.com](https://alchemy.com)
2. Go to **Dashboard** → **Data** → **Webhooks**
3. Click **+ Create Webhook**
4. Template -> Specific Events for a Contract

### GraphQL Query

In the GraphQL playground, paste this query:

```graphql
{
  block {
    number
    timestamp
    logs(filter: {
      addresses: ["0x0191ae69d05F11C7978cCCa2DE15653BaB509d9a"]
      topics: [["0x2c03c6df0d03954344db45c40d4facdfa60aaf0e03186fc750db6b83c6bbd1bb"]]
    }) {
      account {
        address
      }
      topics
      data
      transaction {
        hash
      }
      index
    }
  }
}
```

### Webhook Configuration

- **Network:** Arbitrum One
- **Webhook URL:** Your Cloudflare Worker URL (from Step 3)
- **GraphQL Query:** The query above

Click **Test Webhook** to verify the connection, then **Create Webhook**.

## Step 5: Test the Setup

Create a test job on the EACC marketplace to trigger a `Created` event. You should receive a message like:

```
🔔 EACC Job Event: Created
📋 Job ID: 123
🔗 TX: https://arbiscan.io/tx/0x...
📦 Block: 276543210
⏰ 8/9/2025, 3:30:45 PM
```

## Monitored Events

The system tracks these job events:
- Created
- Taken
- Paid
- Updated
- Signed
- Completed
- Delivered
- Closed
- Reopened
- Rated
- Refunded
- Disputed
- Arbitrated
- ArbitrationRefused
- WhitelistedWorkerAdded
- WhitelistedWorkerRemoved
- CollateralWithdrawn
- WorkerMessage
- OwnerMessage

## Troubleshooting

### No Messages Received
1. Check Cloudflare Worker logs: Worker Dashboard → **Logs** tab
2. Verify environment variables are set correctly
3. Test your bot token: Send a message to `https://api.telegram.org/bot<TOKEN>/getMe`
4. Ensure your bot can send messages to the group

### Wrong Contract Address
Make sure the contract address in the GraphQL query matches your deployed EACC Marketplace Data contract:
- Current mainnet Data contract: `0x0191ae69d05F11C7978cCCa2DE15653BaB509d9a`

### Event Topic Hash
The topic hash `0x2c03c6df0d03954344db45c40d4facdfa60aaf0e03186fc750db6b83c6bbd1bb` is for:
```solidity
event JobEvent(uint256 indexed jobId, JobEventData eventData);
```

## Cost

- **Alchemy:** Free tier (100k compute units/month)
- **Cloudflare Workers:** Free tier (100k requests/day)
- **Telegram:** Free

This setup can handle thousands of job events per month at no cost.
