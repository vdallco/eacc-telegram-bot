import { ethers } from 'ethers';

const JOB_EVENT_TYPES = {
  0: "Created", 1: "Taken", 2: "Paid", 3: "Updated", 4: "Signed",
  5: "Completed", 6: "Delivered", 7: "Closed", 8: "Reopened", 9: "Rated",
  10: "Refunded", 11: "Disputed", 12: "Arbitrated", 13: "ArbitrationRefused",
  14: "WhitelistedWorkerAdded", 15: "WhitelistedWorkerRemoved", 16: "CollateralWithdrawn"
};

const JOB_EVENT_TOPIC = "0x2c03c6df0d03954344db45c40d4facdfa60aaf0e03186fc750db6b83c6bbd1bb";

const JOB_EVENT_ABI = [{
  "anonymous": false,
  "inputs": [
    {"indexed": true, "name": "jobId", "type": "uint256"},
    {"indexed": false, "name": "eventData", "type": "tuple", "components": [
      {"name": "type_", "type": "uint8"},
      {"name": "address_", "type": "bytes"},
      {"name": "data_", "type": "bytes"},
      {"name": "timestamp_", "type": "uint32"}
    ]}
  ],
  "name": "JobEvent",
  "type": "event"
}];

const ERC20_SYMBOL_ABI = [{
  "constant": true,
  "inputs": [],
  "name": "symbol",
  "outputs": [{"name": "", "type": "string"}],
  "type": "function"
}];

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();
      console.log('Received webhook:', JSON.stringify(body, null, 2));
      
      const logs = body.event?.data?.block?.logs;
      if (!logs || logs.length === 0) {
        console.log('No logs found in webhook');
        return new Response('No logs found', { status: 200 });
      }

      console.log(`Processing ${logs.length} logs`);

      const iface = new ethers.Interface(JOB_EVENT_ABI);

      for (const log of logs) {
        if (log.topics[0] !== JOB_EVENT_TOPIC) {
          console.log('Skipping non-JobEvent log');
          continue;
        }

        try {
          const decodedLog = iface.parseLog({
            topics: log.topics,
            data: log.data
          });

          const jobId = decodedLog.args.jobId.toString();
          const eventData = decodedLog.args.eventData;
          
          console.log('Raw decoded event data:', {
            jobId: jobId,
            type: eventData.type_.toString(),
            address: eventData.address_,
            dataLength: eventData.data_.length,
            dataHex: eventData.data_,
            timestamp: eventData.timestamp_.toString()
          });
          
          const eventType = parseInt(eventData.type_.toString());
          
          if (!JOB_EVENT_TYPES.hasOwnProperty(eventType)) {
            console.log(`Skipping unknown event type: ${eventType}`);
            continue;
          }
          
          const eventTypeName = JOB_EVENT_TYPES[eventType];
          const txHash = log.transaction?.hash || 'unknown';
          const blockNumber = body.event.data.block.number;
          
          console.log(`Processing ${eventTypeName} event for job ${jobId}`);
          
          let message = await formatEventMessage(
            eventTypeName, 
            jobId, 
            eventType,
            eventData, 
            txHash, 
            blockNumber, 
            env
          );
          
          console.log('Final message:', message);
          const success = await sendTelegramMessage(message, env);
          console.log('Telegram send result:', success);
          
        } catch (parseError) {
          console.error('Error parsing event data:', parseError);
          
          const jobId = parseInt(log.topics[1], 16);
          const eventTypeName = "Parse Error";
          const txHash = log.transaction?.hash || 'unknown';
          const blockNumber = body.event.data.block.number;
          
          const fallbackMessage = `🔔 EACC Job Event: ${eventTypeName}
📋 Job ID: ${jobId}
🔗 TX: https://arbiscan.io/tx/${txHash}
📦 Block: ${blockNumber}
⏰ ${new Date().toLocaleString()}
⚠️ Error: ${parseError.message}`;
          
          await sendTelegramMessage(fallbackMessage, env);
        }
      }
      
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
};

function parseCreatedEventData(eventDataHex) {
  try {
    console.log('Parsing Created event data:', eventDataHex);
    
    if (!eventDataHex || eventDataHex === '0x' || eventDataHex.length < 10) {
      console.log('Invalid or empty event data');
      return null;
    }

    const hex = eventDataHex.slice(2);
    let offset = 0;
    
    const titleLength = parseInt(hex.slice(offset, offset + 2), 16);
    offset += 2;
    
    const titleHex = hex.slice(offset, offset + (titleLength * 2));
    const title = titleHex.match(/.{2}/g)?.map(h => String.fromCharCode(parseInt(h, 16))).join('') || '';
    console.log('Parsed title:', title);
    offset += titleLength * 2;
    
    const contentHash = "0x" + hex.slice(offset, offset + 64);
    console.log('Content hash:', contentHash);
    offset += 64;
    
    const multipleApplicants = parseInt(hex.slice(offset, offset + 2), 16) !== 0;
    console.log('Multiple applicants:', multipleApplicants);
    offset += 2;
    
    const tagsLength = parseInt(hex.slice(offset, offset + 2), 16);
    offset += 2;
    
    const tags = [];
    for (let i = 0; i < tagsLength; i++) {
      const tagLength = parseInt(hex.slice(offset, offset + 2), 16);
      offset += 2;
      
      const tagHex = hex.slice(offset, offset + (tagLength * 2));
      const tag = tagHex.match(/.{2}/g)?.map(h => String.fromCharCode(parseInt(h, 16))).join('') || '';
      tags.push(tag);
      console.log('Parsed tag:', tag);
      offset += tagLength * 2;
    }
    
    const tokenAddress = "0x" + hex.slice(offset, offset + 40);
    console.log('Token address:', tokenAddress);
    offset += 40;
    
    const amountHex = hex.slice(offset, offset + 64);
    const amount = BigInt("0x" + amountHex);
    console.log('Amount:', amount.toString());
    offset += 64;
    
    const maxTimeHex = hex.slice(offset, offset + 8);
    const maxTime = parseInt(maxTimeHex, 16);
    console.log('Max time:', maxTime);
    offset += 8;
    
    const deliveryLength = parseInt(hex.slice(offset, offset + 2), 16);
    offset += 2;
    
    const deliveryHex = hex.slice(offset, offset + (deliveryLength * 2));
    const deliveryMethod = deliveryHex.match(/.{2}/g)?.map(h => String.fromCharCode(parseInt(h, 16))).join('') || '';
    console.log('Delivery method:', deliveryMethod);
    offset += deliveryLength * 2;
    
    const arbitrator = "0x" + hex.slice(offset, offset + 40);
    offset += 40;
    
    const whitelistWorkers = parseInt(hex.slice(offset, offset + 2), 16) !== 0;
    
    const result = {
      title,
      contentHash,
      multipleApplicants,
      tags,
      tokenAddress,
      amount: amount.toString(),
      maxTime,
      deliveryMethod,
      arbitrator,
      whitelistWorkers
    };
    
    console.log('Final parsed result:', result);
    return result;
    
  } catch (error) {
    console.error('Error parsing Created event data:', error);
    return null;
  }
}

async function getTokenSymbol(tokenAddress, env) {
  try {
    if (!tokenAddress || tokenAddress === '0x' || tokenAddress.length !== 42) {
      return { symbol: 'UNKNOWN', decimals: 18 };
    }
    
    const knownTokens = {
      '0x0000000000000000000000000000000000000000': { symbol: 'ETH', decimals: 18 },
      '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { symbol: 'WETH', decimals: 18 },
      '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC', decimals: 6 },
      '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': { symbol: 'USDT', decimals: 6 },
      '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': { symbol: 'USDC.e', decimals: 6 },
      '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': { symbol: 'WBTC', decimals: 8 }
    };
    
    const lowerAddress = tokenAddress.toLowerCase();
    if (knownTokens[lowerAddress]) {
      return knownTokens[lowerAddress];
    }
    
    const symbol = await fetchTokenSymbol(tokenAddress);
    if (symbol) {
      const decimals = await fetchTokenDecimals(tokenAddress);
      return { symbol, decimals: decimals || 18 };
    }
    
    return { 
      symbol: `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`, 
      decimals: 18 
    };
    
  } catch (error) {
    console.error('Error getting token symbol:', error);
    return { 
      symbol: `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`, 
      decimals: 18 
    };
  }
}

async function fetchTokenSymbol(tokenAddress) {
  try {
    const rpcUrls = [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum-one.publicnode.com',
      'https://endpoints.omniatech.io/v1/arbitrum/one/public'
    ];
    
    const iface = new ethers.Interface(ERC20_SYMBOL_ABI);
    const data = iface.encodeFunctionData('symbol', []);
    
    const payload = {
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [
        {
          to: tokenAddress,
          data: data
        },
        'latest'
      ],
      id: 1
    };
    
    for (const rpcUrl of rpcUrls) {
      try {
        console.log(`Trying RPC call to ${rpcUrl} for token ${tokenAddress}`);
        
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
          console.log(`RPC ${rpcUrl} returned ${response.status}`);
          continue;
        }
        
        const result = await response.json();
        
        if (result.error) {
          console.log(`RPC error from ${rpcUrl}:`, result.error);
          continue;
        }
        
        if (!result.result || result.result === '0x') {
          console.log(`No result from ${rpcUrl}`);
          continue;
        }
        
        const symbol = iface.decodeFunctionResult('symbol', result.result)[0];
        if (symbol && symbol.length > 0) {
          console.log(`Successfully got symbol "${symbol}" for ${tokenAddress}`);
          return symbol;
        }
        
      } catch (rpcError) {
        console.log(`RPC call failed for ${rpcUrl}:`, rpcError.message);
        continue;
      }
    }
    
    console.log(`All RPC calls failed for token ${tokenAddress}`);
    return null;
    
  } catch (error) {
    console.error('Error in fetchTokenSymbol:', error);
    return null;
  }
}

async function fetchTokenDecimals(tokenAddress) {
  try {
    const rpcUrls = [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum-one.publicnode.com',
      'https://endpoints.omniatech.io/v1/arbitrum/one/public'
    ];
    
    const decimalsAbi = [{
      "constant": true,
      "inputs": [],
      "name": "decimals",
      "outputs": [{"name": "", "type": "uint8"}],
      "type": "function"
    }];
    
    const iface = new ethers.Interface(decimalsAbi);
    const data = iface.encodeFunctionData('decimals', []);
    
    const payload = {
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: tokenAddress, data: data }, 'latest'],
      id: 1
    };
    
    for (const rpcUrl of rpcUrls) {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) continue;
        
        const result = await response.json();
        if (result.error || !result.result || result.result === '0x') continue;
        
        const decimals = iface.decodeFunctionResult('decimals', result.result)[0];
        return Number(decimals);
        
      } catch (rpcError) {
        continue;
      }
    }
    
    return 18;
    
  } catch (error) {
    return 18;
  }
}

function formatAmount(amount, decimals = 18) {
  try {
    if (!amount || amount === '0') return '0';
    const formatted = ethers.formatUnits(amount.toString(), decimals);
    const num = parseFloat(formatted);
    return num.toLocaleString('en-US', { 
      maximumFractionDigits: decimals <= 8 ? decimals : 8,
      useGrouping: true 
    });
  } catch (error) {
    return amount ? amount.toString() : '0';
  }
}

function formatTimeFromSeconds(seconds) {
  if (!seconds || seconds === 0) return 'Unknown';
  
  const units = [
    { name: 'year', value: 31536000 },
    { name: 'month', value: 2592000 },
    { name: 'week', value: 604800 },
    { name: 'day', value: 86400 },
    { name: 'hour', value: 3600 },
    { name: 'minute', value: 60 }
  ];
  
  for (const unit of units) {
    const count = Math.floor(seconds / unit.value);
    if (count >= 1) {
      return `${count} ${unit.name}${count > 1 ? 's' : ''}`;
    }
  }
  
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
}

function processTags(tags) {
  const meceTags = {
    "DA": "Digital Audio",
    "DV": "Digital Video", 
    "DT": "Digital Text",
    "DS": "Digital Software",
    "DO": "Digital Others",
    "NDG": "Non-Digital Goods",
    "NDS": "Non-Digital Services",
    "NDO": "Non-Digital Others"
  };
  
  const categories = [];
  const customTags = [];
  
  for (const tag of tags) {
    if (meceTags[tag]) {
      categories.push(meceTags[tag]);
    } else {
      customTags.push(tag);
    }
  }
  
  return { categories, customTags };
}

async function formatEventMessage(eventTypeName, jobId, eventType, eventData, txHash, blockNumber, env) {
  const eventNames = {
    0: "Job Created", 1: "Job Taken", 2: "Job Paid", 3: "Job Updated", 4: "Job Signed",
    5: "Job Completed", 6: "Job Delivered", 7: "Job Closed", 8: "Job Reopened", 9: "Job Rated",
    10: "Job Refunded", 11: "Job Disputed", 12: "Job Arbitrated", 13: "Arbitration Refused",
    14: "Worker Whitelisted", 15: "Worker Removed", 16: "Collateral Withdrawn"
  };
  
  let message = `🔔 <b>${eventNames[eventType] || eventTypeName}</b>\n📋 Job ID: ${jobId}`;
  
  message += `\n🔗 <a href="https://arbiscan.io/tx/${txHash}">View Transaction</a>`;
  
  if (eventType === 0 && eventData.data_ && eventData.data_ !== '0x') {
    console.log('Attempting to parse Created event data...');
    try {
      const createdData = parseCreatedEventData(eventData.data_);
      if (createdData) {
        console.log('Successfully parsed Created data:', createdData);
        
        if (createdData.title) {
          message += `\n📝 <b>${createdData.title}</b>`;
        }
        
        if (createdData.amount && createdData.tokenAddress) {
          const tokenInfo = await getTokenSymbol(createdData.tokenAddress, env);
          const formattedAmount = formatAmount(createdData.amount, tokenInfo.decimals);
          message += `\n💰 Reward: ${formattedAmount} <a href="https://arbiscan.io/token/${createdData.tokenAddress}">${tokenInfo.symbol}</a>`;
        }
        
        if (createdData.tags && createdData.tags.length > 0) {
          const { categories, customTags } = processTags(createdData.tags);
          
          if (categories.length > 0) {
            message += `\n📂 Category: ${categories.join(', ')}`;
          }
          
          if (customTags.length > 0) {
            message += `\n🏷️ Tags: ${customTags.join(', ')}`;
          }
        }
        
        if (createdData.maxTime) {
          const timeFormatted = formatTimeFromSeconds(createdData.maxTime);
          message += `\n⏳ Max Time: ${timeFormatted}`;
        }
        
        if (createdData.multipleApplicants !== undefined) {
          message += `\n👥 Multiple Applicants: ${createdData.multipleApplicants ? 'Yes' : 'No'}`;
        }
        
        if (createdData.deliveryMethod) {
          message += `\n📦 Delivery: ${createdData.deliveryMethod}`;
        }
      } else {
        console.log('Failed to parse Created event data');
      }
    } catch (parseError) {
      console.error('Error parsing Created event details:', parseError);
    }
  }
  
  if (eventData.address_ && eventData.address_ !== '0x') {
    const addressHex = eventData.address_;
    if (addressHex.length >= 42) {
      const address = '0x' + addressHex.slice(-40);
      const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
      message += `\n👤 Address: <a href="https://arbiscan.io/address/${address}">${shortAddr}</a>`;
    }
  }
  
  if (eventData.timestamp_ && eventData.timestamp_.toString() !== '0') {
    const timestamp = parseInt(eventData.timestamp_.toString());
    const date = new Date(timestamp * 1000);
    message += `\n⏰ Event Time: ${date.toLocaleString()} UTC`;
  }
  
  message += `\n📦 Block: ${blockNumber}`;
  message += `\n🕐 Processed: ${new Date().toLocaleString()} UTC`;
  
  return message;
}

async function sendTelegramMessage(text, env) {
  try {
    console.log('Sending to Telegram...');
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Telegram API error:', errorText);
      return false;
    }
    
    console.log('Telegram message sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}