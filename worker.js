export default {
  async email(message, env, _ctx) {
    console.log(`Processing email from: ${message.from} to: ${message.to}`);
    console.log(`Subject: ${message.subject || 'No Subject'}`);
    
    // Allow entire domain and specific emails - CUSTOMIZE THESE FOR YOUR SETUP
    const allowedEmails = ["your-email@gmail.com", "another@email.com"];
    const isAllowedDomain = message.from.endsWith("@yourdomain.com");
    const isAllowedEmail = allowedEmails.includes(message.from);
    
    console.log(`Sender check - Domain allowed: ${isAllowedDomain}, Email allowed: ${isAllowedEmail}`);
    
    if (!isAllowedDomain && !isAllowedEmail) {
      console.log("Address not allowed, rejecting");
      message.setReject("Address not allowed");
      return;
    }

    console.log("Sender authorized, checking for attachments...");
    
    // Try different ways to access attachments
    console.log("Message object keys:", Object.keys(message));
    console.log("Message.attachments:", message.attachments);
    
    // Try to get the raw email and parse it
    try {
      const rawEmail = message.raw;
      console.log("Raw email available:", !!rawEmail);
      console.log("Raw email type:", typeof rawEmail);
      console.log("Raw email constructor:", rawEmail?.constructor?.name);
      
      if (rawEmail) {
        let emailText;
        
        // Try different methods to read the raw email
        if (typeof rawEmail === 'string') {
          emailText = rawEmail;
        } else if (rawEmail.text && typeof rawEmail.text === 'function') {
          emailText = await rawEmail.text();
        } else if (rawEmail.arrayBuffer && typeof rawEmail.arrayBuffer === 'function') {
          const buffer = await rawEmail.arrayBuffer();
          emailText = new TextDecoder().decode(buffer);
        } else if (rawEmail instanceof ReadableStream) {
          const reader = rawEmail.getReader();
          const chunks = [];
          let done, value;
          while (!done) {
            ({ done, value } = await reader.read());
            if (value) chunks.push(value);
          }
          const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
          let offset = 0;
          for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
          }
          emailText = new TextDecoder().decode(buffer);
        } else {
          console.log("Unknown raw email format, trying toString()");
          emailText = String(rawEmail);
        }
        
        console.log("Email text length:", emailText.length);
        
        // Check for MIME boundaries and attachments
        const hasMimeBoundary = emailText.includes('boundary=');
        const hasContentDisposition = emailText.includes('Content-Disposition: attachment');
        console.log("Has MIME boundary:", hasMimeBoundary);
        console.log("Has attachment headers:", hasContentDisposition);
        
        if (hasContentDisposition) {
          console.log("Email contains attachment headers - parsing MIME content");
          
          // Extract MIME boundary
          const boundaryMatch = emailText.match(/boundary=["']?([^"'\\s;]+)/);
          if (boundaryMatch) {
            const boundary = boundaryMatch[1];
            console.log("Found MIME boundary:", boundary);
            
            // Split email into parts
            const parts = emailText.split(`--${boundary}`);
            console.log("Found", parts.length, "MIME parts");
            
            let attachmentCount = 0;
            
            for (let i = 1; i < parts.length - 1; i++) { // Skip first empty part and last closing part
              const part = parts[i];
              
              // Check if this part is an attachment
              if (part.includes('Content-Disposition: attachment')) {
                console.log(`Processing MIME part ${i} as attachment`);
                
                // Extract filename - try multiple patterns
                let filename = null;
                
                // Try quoted filename first
                let filenameMatch = part.match(/filename=["']([^"']+)["']/);
                if (filenameMatch) {
                  filename = filenameMatch[1];
                } else {
                  // Try unquoted filename
                  filenameMatch = part.match(/filename=([^;\\s\\r\\n]+)/);
                  if (filenameMatch) {
                    filename = filenameMatch[1];
                  } else {
                    // Try name parameter as fallback
                    filenameMatch = part.match(/name=["']?([^"'\\s;]+)/);
                    if (filenameMatch) {
                      filename = filenameMatch[1];
                    }
                  }
                }
                
                if (filename) {
                  // Clean up filename
                  filename = filename.replace(/[<>:"/\\\\|?*]/g, '_'); // Remove invalid chars
                  console.log("Found attachment filename:", filename);
                  
                  // Find the content after headers (double newline)
                  const contentStart = part.indexOf('\\r\\n\\r\\n');
                  if (contentStart !== -1) {
                    let content = part.substring(contentStart + 4);
                    
                    // Check if content is base64 encoded
                    if (part.includes('Content-Transfer-Encoding: base64')) {
                      console.log("Decoding base64 content");
                      // Remove newlines and decode base64
                      content = content.replace(/\\r?\\n/g, '');
                      try {
                        // Convert base64 string to binary
                        const binaryString = atob(content);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let j = 0; j < binaryString.length; j++) {
                          bytes[j] = binaryString.charCodeAt(j);
                        }
                        content = bytes;
                      } catch (e) {
                        console.error("Failed to decode base64:", e.message);
                        continue;
                      }
                    }
                    
                    // Determine content type
                    const contentTypeMatch = part.match(/Content-Type:\\s*([^;\\r\\n]+)/);
                    const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';
                    
                    try {
                      // Upload to R2
                      await env.R2_BUCKET.put(filename, content, {
                        httpMetadata: {
                          contentType: contentType,
                        },
                        customMetadata: {
                          sender: message.from,
                          subject: message.subject || 'No Subject',
                          timestamp: new Date().toISOString(),
                          originalSize: String(content.length || content.byteLength),
                        }
                      });
                      
                      attachmentCount++;
                      console.log(`Successfully uploaded attachment: ${filename} (${contentType})`);
                    } catch (error) {
                      console.error(`Failed to upload ${filename}:`, error);
                    }
                  } else {
                    console.log("Could not find content start marker");
                  }
                } else {
                  console.log("Could not extract filename from MIME part");
                  // Generate a filename with timestamp if none found
                  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                  const generatedFilename = `attachment-${timestamp}.bin`;
                  console.log("Using generated filename:", generatedFilename);
                }
              }
            }
            
            console.log(`Processed ${attachmentCount} attachments from email`);
          } else {
            console.log("Could not find MIME boundary");
          }
        }
      }
    } catch (error) {
      console.error("Error processing raw email:", error);
    }
    
    // Also try the original attachments API
    const attachments = message.attachments;
    if (attachments) {
      console.log("Attachments type:", typeof attachments);
      console.log("Attachments constructor:", attachments.constructor.name);
      
      if (attachments.size > 0) {
        console.log(`Found ${attachments.size} attachments via attachments API`);
        for (const [filename, attachment] of attachments) {
          console.log(`Processing attachment: ${filename}, type: ${attachment.type}`);
          try {
            await env.R2_BUCKET.put(filename, attachment.stream(), {
              httpMetadata: {
                contentType: attachment.type || 'application/octet-stream',
              },
              customMetadata: {
                sender: message.from,
                subject: message.subject || 'No Subject',
                timestamp: new Date().toISOString(),
              }
            });
            console.log(`Successfully uploaded attachment: ${filename} from ${message.from}`);
          } catch (error) {
            console.error(`Failed to upload ${filename}:`, error);
          }
        }
      } else {
        console.log("No attachments found via attachments API");
      }
    } else {
      console.log("Attachments object is null/undefined");
    }
    
    console.log("Email processing completed");
  },
};