# EACC Telegram Bot Setup

This guide explains how to set up real-time Telegram notifications for EACC marketplace job events using Alchemy Webhooks and Cloudflare Workers with Wrangler CLI.

## Overview

The system monitors the EACC marketplace contract on Arbitrum One for `JobEvent` emissions and sends formatted notifications to a Telegram group when jobs are Created, Taken, Paid, Completed, etc.

**Architecture:** Alchemy Webhook → Cloudflare Worker → Telegram Bot → Your Group

## Prerequisites

- Node.js (v16 or later)
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

## Step 3: Set Up Local Development Environment

1. Clone the repository and navigate to the bot server directory:
```bash
cd /bot-server/
```

2. Install dependencies:
```bash
npm install
```

3. Install Wrangler CLI globally:
```bash
npm install -g wrangler
```

4. Login to Cloudflare:
```bash
wrangler login
```

## Step 4: Configure Environment

Your project structure should look like:
```
bot-server/
├── package.json
├── wrangler.toml
├── node_modules/
└── src/
    └── cloudflare-worker.js
```

### Set Environment Variables

Set your secrets using Wrangler (recommended for sensitive data):

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
# Enter your bot token when prompted

wrangler secret put TELEGRAM_CHAT_ID
# Enter your group chat ID when prompted
```

### Verify Configuration

Check your `wrangler.toml` file:
```toml
name = "eacc-telegram-bot"
main = "src/cloudflare-worker.js"
compatibility_date = "2024-08-15"

# Secrets are managed via: wrangler secret put TELEGRAM_BOT_TOKEN
# No sensitive data in this file
```

## Step 5: Deploy Cloudflare Worker

1. Deploy the worker:
```bash
wrangler deploy
```

2. After deployment, you'll see output like:
```
Uploaded eacc-telegram-bot (9.55 sec)
Deployed eacc-telegram-bot triggers (1.65 sec)
  https://eacc-telegram-bot.your-subdomain.workers.dev
Current Version ID: abc123...
```

3. Copy your worker URL for the next step.

### Verify Deployment

Check that your secrets are properly set:
```bash
wrangler secret list
```

You should see both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` listed.

## Step 6: Set Up Alchemy Webhook

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
- **Webhook URL:** Your Cloudflare Worker URL (from Step 5)
- **GraphQL Query:** The query above

Click **Test Webhook** to verify the connection, then **Create Webhook**.

## Step 7: Test the Setup

Create a test job on the EACC marketplace to trigger a `Created` event. You should receive a formatted message like:

```
🔔 Job Created
📋 Job ID: 123
🔗 View Transaction
📝 Test Job Title
💰 Reward: 100 USDC
📂 Category: Digital Text
🏷️ Tags: custom tag
⏳ Max Time: 1 day
👥 Multiple Applicants: No
📦 Delivery: ipfs
👤 Address: 0xd7d5...fc8d
⏰ Event Time: 8/15/2025, 6:38:12 PM UTC
📦 Block: 368769774
🕐 Processed: 8/15/2025, 6:38:13 PM UTC
```

## Monitored Events

The system tracks these job events:
- **Job Created** - New jobs posted to marketplace
- **Job Taken** - Worker accepts job
- **Job Paid** - Payment deposited by job creator
- **Job Updated** - Job details modified
- **Job Signed** - Contract terms agreed
- **Job Completed** - Work submitted by worker
- **Job Delivered** - Final delivery confirmed
- **Job Closed** - Job successfully finished
- **Job Reopened** - Job reopened for additional work
- **Job Rated** - Feedback submitted
- **Job Refunded** - Payment returned to creator
- **Job Disputed** - Dispute raised
- **Job Arbitrated** - Arbitrator decision made
- **Arbitration Refused** - Arbitrator declined case
- **Worker Whitelisted** - Worker added to allowed list
- **Worker Removed** - Worker removed from allowed list
- **Collateral Withdrawn** - Security deposit released

## Development Commands

### Deployment
```bash
# Deploy to production
wrangler deploy
```

## Message Features

### Rich Formatting
- **Bold titles** and job names
- **Clickable links** for transactions, tokens, and addresses
- **Category detection** for MECE tags (DA → Digital Audio, DT → Digital Text, etc.)
- **Natural time formatting** (86400 seconds → 1 day)
- **Proper token amounts** with correct decimals (USDC=6, WETH=18, etc.)

### Token Support
- Automatically resolves token symbols via RPC calls
- Supports common Arbitrum tokens (USDC, WETH, WBTC, etc.)
- Fallback to address display for unknown tokens
- Links to Arbiscan token pages

## Troubleshooting

### No Messages Received
1. Check Cloudflare Worker logs:
```bash
wrangler tail
```

2. Verify environment variables:
```bash
wrangler secret list
```

3. Test your bot token:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getMe"
```

4. Ensure your bot can send messages to the group

### Deployment Issues
```bash
# Check authentication
wrangler whoami

# Verify wrangler.toml configuration
wrangler status

# Re-deploy with verbose output
wrangler deploy --verbose
```

### Worker Errors
```bash
# View real-time logs
wrangler tail

# Check worker bindings
wrangler kv:namespace list
```

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

## File Structure

```
bot-server/
├── package.json              # Node.js dependencies
├── wrangler.toml             # Cloudflare Worker configuration
├── node_modules/             # Installed packages
└── src/
    └── cloudflare-worker.js  # Main bot logic with ethers.js integration
```

The worker automatically decodes Solidity event data, fetches token information, and formats rich Telegram messages with proper links and styling.