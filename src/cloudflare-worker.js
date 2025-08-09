const JOB_EVENT_TYPES = {
    0: "Created", 1: "Taken", 2: "Paid", 3: "Updated", 4: "Signed",
    5: "Completed", 6: "Delivered", 7: "Closed", 8: "Reopened", 9: "Rated",
    10: "Refunded", 11: "Disputed", 12: "Arbitrated", 13: "ArbitrationRefused",
    14: "WhitelistedWorkerAdded", 15: "WhitelistedWorkerRemoved", 16: "CollateralWithdrawn",
    17: "WorkerMessage", 18: "OwnerMessage"
  };
  
  const JOB_EVENT_TOPIC = "0x2c03c6df0d03954344db45c40d4facdfa60aaf0e03186fc750db6b83c6bbd1bb";
  
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
  
        for (const log of logs) {
          if (log.topics[0] !== JOB_EVENT_TOPIC) {
            console.log('Skipping non-JobEvent log');
            continue;
          }
  
          const jobId = parseInt(log.topics[1], 16);
          console.log(`Processing JobEvent for Job ID: ${jobId}`);
          
          const dataHex = log.data.slice(2);
          console.log('Full data hex:', dataHex);
   
          const structStart = 64;
          const eventType1 = parseInt(dataHex.slice(structStart + 62, structStart + 64), 16);
          const eventType2 = parseInt(dataHex.slice(structStart, structStart + 2), 16);
          const eventType3 = parseInt(dataHex.slice(structStart + 64 + 62, structStart + 64 + 64), 16);
          console.log('Event type attempts:', { eventType1, eventType2, eventType3 });
          const eventType = eventType1 || eventType2 || eventType3 || 0;
          console.log('Final event type:', eventType);
          const eventTypeName = JOB_EVENT_TYPES[eventType] || `Unknown(${eventType})`;
          
          const txHash = log.transaction?.hash || 'unknown';
          const blockNumber = body.event.data.block.number;
          
          const message = `🔔 EACC Job Event: ${eventTypeName}
  📋 Job ID: ${jobId}
  🔗 TX: https://arbiscan.io/tx/${txHash}
  📦 Block: ${blockNumber}
  ⏰ ${new Date().toLocaleString()}`;
  
          console.log('Sending message:', message);
          const success = await sendTelegramMessage(message, env);
          console.log('Telegram send result:', success);
        }
        
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Error processing webhook:', error);
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }
  };
  
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