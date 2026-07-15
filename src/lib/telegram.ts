/**
 * Sends a notification message to a Telegram chat using a Telegram Bot.
 */
export async function sendTelegramNotification(
  token: string,
  chatId: string,
  message: string
): Promise<boolean> {
  if (!token || !chatId) {
    console.warn('Telegram token or chat ID is missing. Cannot send alert.');
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Failed to send Telegram notification:', errText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}
